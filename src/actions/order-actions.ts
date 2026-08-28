'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser, canViewOrderDetail, requireAdmin, requireZeroUser } from '@/lib/auth'
import { escapeHtml, escapePostgrestKeyword, escapeIlikeKeyword } from '@/lib/postgrest-utils'
import { validateUrl, isValidUUID } from '@/lib/order-utils'
import { maskPhone, maskEmail } from '@/lib/utils'
import { checkRateLimit } from '@/lib/rate-limit'
import { validateCsrf } from '@/lib/csrf'
import { getClientIp, logOperation, sendEmail } from '@/lib/server-utils'
import { RATE_LIMIT_ORDER_WINDOW, MAX_PAGE_LIMIT, ESTIMATE_PRICE_MIN, ESTIMATE_PRICE_MAX, RATE_LIMIT_EMAIL_REPLY_MAX, RATE_LIMIT_EMAIL_REPLY_WINDOW } from '@/lib/constants'
import { getNotificationTemplate, renderTemplate } from '@/lib/notification-templates'
import type { TemplateKey, TemplateVars } from '@/lib/notification-templates'
import type { Order, OrderAttachment, OrderReply, OperationLog } from '@/types/database'

// ==================== 订单查询速率限制（数据库版） ====================
// 基于 IP + 手机号组合做限制，同一组合 1 分钟内最多查询 5 次
// 使用数据库表实现，兼容 Vercel Serverless 多实例环境

// ==================== 订单状态站内通知 ====================
// 管理员对订单操作（估价/接单/拒单/进度/回复）后，向订单客户发送站内通知，
// 用户侧由 NotificationBell（顶栏铃铛）展示。客户未注册账号时跳过（邮件回复已覆盖）。

/**
 * 向订单客户发送站内通知（模板化）
 *
 * @param order 订单（需含 id/order_no/customer_email/user_id）
 * @param key   模板键（estimate/accepted/rejected/reply/progress），优先读取数据库模板
 * @param fallbackTitle 未配置模板时的默认标题
 * @param fallbackContent 未配置模板时的默认内容（可含 {orderNo} 等占位符）
 * @param vars  模板占位符变量
 * @returns 是否成功（用户未注册/插入失败返回 false，不阻塞主流程）
 */
export async function sendOrderNotification(
  order: {
    id: string
    order_no: string
    customer_email: string | null
    user_id?: string | null
  },
  key: TemplateKey,
  fallbackTitle: string,
  fallbackContent: string,
  vars: TemplateVars = {}
): Promise<boolean> {
  try {
    const admin = createAdminClient()

    // 查找订单客户对应的注册用户（仅启用的账号）：
    // 方案 A：优先按下单账号 user_id 匹配；旧订单/匿名订单兜底按邮箱匹配
    let userQuery = admin.from('profiles').select('id').eq('is_active', true)
    if (order.user_id) {
      userQuery = userQuery.eq('id', order.user_id)
    } else {
      const email = order.customer_email
      if (!email) return false
      userQuery = userQuery.eq('email', email)
    }
    const { data: user, error: userError } = await userQuery.maybeSingle()

    if (userError || !user) return false

    // 读取模板（数据库优先，回退内置默认），未命中时用调用方 fallback
    const tpl = await getNotificationTemplate(key)
    const title = tpl.title || fallbackTitle
    let content = (tpl.content || fallbackContent).replaceAll(
      '{orderNo}',
      order.order_no
    )
    content = renderTemplate(content, { ...vars, orderNo: order.order_no })

    const fullContent = `${content}\n订单号：${order.order_no}`
    const { error: insertError } = await admin.from('notifications').insert({
      user_id: user.id,
      sender_user_id: null,
      batch_id: order.id, // 用订单 id 作为批次标识，便于关联
      target_role: 'user',
      title,
      content: fullContent,
    })

    return !insertError
  } catch (error) {
    console.error('[sendOrderNotification] 发送通知异常:', error)
    return false
  }
}

/**
 * 向订单客户发送状态邮件（估价/接单/拒单/进度/回复），模板化
 * 仅在配置 RESEND_API_KEY 且订单有邮箱时发送；失败不阻塞主流程。
 */
export async function sendOrderStatusEmail(
  order: {
    order_no: string
    customer_email: string | null
  },
  key: TemplateKey,
  fallbackSubject: string,
  fallbackBody: string,
  vars: TemplateVars = {}
): Promise<boolean> {
  try {
    const toEmail = order.customer_email
    if (!toEmail) return false
    if (!process.env.RESEND_API_KEY) return false

    const tpl = await getNotificationTemplate(key)
    const subject = tpl.email_subject || fallbackSubject
    let body = tpl.email_body || fallbackBody
    body = renderTemplate(body, { ...vars, orderNo: order.order_no })

    return await sendEmail(toEmail, subject, body)
  } catch (error) {
    console.error('[sendOrderStatusEmail] 发送邮件异常:', error)
    return false
  }
}

/**
 * 构建订单查询的公共逻辑
 * 抽取自 getOrders 和 getStudioOrders 的重复代码
 *
 * 包含：基础查询（select/order/range）、状态筛选、非管理员可见性过滤、
 * 关键词搜索、日期范围筛选。各筛选条件为可选，按需应用。
 *
 * @returns 构建好的查询（尚未执行，调用方通过 await 执行）
 */
function buildOrderQuery(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    offset: number
    limit: number
    status?: string
    search?: string
    startDate?: string
    endDate?: string
    isAdmin: boolean
    userId?: string
  }
) {
  let query = supabase
    .from('orders')
    .select('*, service_types(*)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(params.offset, params.offset + params.limit - 1)

  // 状态筛选
  if (params.status) {
    query = query.eq('status', params.status)
  }

  // 非 admin 用户只能看到：
  // 1. 分配给自己的订单（studio_user_id = 当前用户）
  // 2. 尚未分配的订单（pending/estimated 状态，studio_user_id 为 null）
  if (!params.isAdmin && params.userId) {
    query = query.or(`studio_user_id.eq.${params.userId},and(studio_user_id.is.null,status.in.(pending,estimated))`)
  }

  // 关键词搜索：订单号、客户名、需求描述
  if (params.search && params.search.trim()) {
    const keyword = escapeIlikeKeyword(escapePostgrestKeyword(params.search.trim()))
    query = query.or(`order_no.ilike.%${keyword}%,customer_name.ilike.%${keyword}%,requirements.ilike.%${keyword}%`)
  }

  // 日期范围筛选（仅 getOrders 使用，服务端）
  if (params.startDate) {
    query = query.gte('created_at', `${params.startDate}T00:00:00.000Z`)
  }
  if (params.endDate) {
    query = query.lte('created_at', `${params.endDate}T23:59:59.999Z`)
  }

  return query
}

// ==================== 查询委托单列表（Admin，带搜索、日期筛选、分页） ====================

export async function getOrders(filters: {
  status?: string
  search?: string
  startDate?: string
  endDate?: string
  offset?: number
  limit?: number
}): Promise<{
  success: boolean
  data?: Order[]
  count?: number
  total?: number
  error?: string
}> {
  // 鉴权：仅 admin 可调用
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { success: false, error: '请先登录' }
  }
  if (currentUser.role !== 'admin') {
    return { success: false, error: '无权访问' }
  }

  const supabase = await createClient()

  try {
    const offset = filters.offset ?? 0
    const limit = Math.min(filters.limit ?? 20, MAX_PAGE_LIMIT)

    // 使用公共查询构建函数（admin 可见全部订单，无需可见性过滤）
    const query = buildOrderQuery(supabase, {
      offset,
      limit,
      status: filters.status,
      search: filters.search,
      startDate: filters.startDate,
      endDate: filters.endDate,
      isAdmin: true,
      userId: currentUser.userId,
    })

    const { data, error, count } = await query

    if (error) {
      console.error('查询委托单列表失败:', error.message)
      return { success: false, error: '查询失败，请稍后重试' }
    }

    // 对 customer_phone 和 customer_email 做脱敏处理
    // 安全修复：非管理员用户不应看到其他客户的完整邮箱地址
    const maskedData = (data || []).map(order => ({
      ...order,
      customer_phone: maskPhone(order.customer_phone),
      customer_email: currentUser.role === 'admin'
        ? order.customer_email
        : maskEmail(order.customer_email),
    })) as Order[]

    return { success: true, data: maskedData, count: count ?? 0, total: count ?? 0 }
  } catch (error) {
    console.error('查询委托单列表异常:', error)
    return { success: false, error: '查询委托单列表时发生未知错误' }
  }
}

// ==================== 查询委托单详情 ====================

export async function getOrderById(
  id: string
): Promise<{
  success: boolean
  data?: Order & {
    attachments?: OrderAttachment[]
    replies?: OrderReply[]
    logs?: OperationLog[]
  }
  error?: string
}> {
  // UUID 格式验证
  if (!isValidUUID(id)) {
    return { success: false, error: '无效的订单 ID' }
  }

  // 鉴权：必须登录
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { success: false, error: '请先登录' }
  }

  // 授权校验（安全加固 SEC-03）：查看完整详情要求已分配本人或管理员
  // 未分配订单（接单池）不得查看客户隐私/附件/内部日志，防止 IDOR
  const hasAccess = await canViewOrderDetail(id, currentUser.userId, currentUser.role)
  if (!hasAccess) {
    return { success: false, error: '无权查看此委托单' }
  }

  const supabase = await createClient()

  try {
    // 并行查询主表、附件、回复、操作日志
    // 安全修复：仅查询必要的 profiles 字段（display_name, avatar_url），
    // 避免泄露 email、has_password、role 等敏感信息
    const [orderResult, attachmentsResult, repliesResult, logsResult] = await Promise.all([
      supabase
        .from('orders')
        .select('*, service_types(*), profiles!studio_user_id(display_name, avatar_url)')
        .eq('id', id)
        .single(),
      supabase
        .from('order_attachments')
        .select('*')
        .eq('order_id', id)
        .order('created_at', { ascending: true }),
      supabase
        .from('order_replies')
        .select('*, profiles!sender_id(display_name, avatar_url)')
        .eq('order_id', id)
        .order('sent_at', { ascending: true }),
      supabase
        .from('operation_logs')
        .select('*')
        .eq('order_id', id)
        .order('created_at', { ascending: true }),
    ])

    const order = orderResult.data
    const orderError = orderResult.error

    if (orderError || !order) {
      // 安全加固（M-5）：不向客户端回传数据库错误细节
      console.error('[getOrderById] 查询订单失败:', orderError?.message)
      return { success: false, error: '未找到委托单' }
    }

    const attachments = attachmentsResult.data
    const replies = repliesResult.data
    const logs = logsResult.data

    // 安全修复：对订单详情中的客户手机号和邮箱做脱敏处理
    // 管理员可查看完整信息；普通用户仅能看到脱敏后的数据
    const maskedOrder = {
      ...order,
      customer_phone: currentUser.role === 'admin'
        ? order.customer_phone
        : maskPhone(order.customer_phone),
      customer_email: currentUser.role === 'admin'
        ? order.customer_email
        : maskEmail(order.customer_email),
    }

    return {
      success: true,
      data: {
        ...maskedOrder,
        attachments: attachments || [],
        replies: (replies || []) as OrderReply[],
        logs: (logs || []) as OperationLog[],
      },
    }
  } catch (error) {
    console.error('查询委托单详情异常:', error)
    return { success: false, error: '查询委托单详情时发生未知错误' }
  }
}

// ==================== 提交估价 ====================

export async function submitEstimate(
  orderId: string,
  price: number,
  notes: string
): Promise<{ success: boolean; error?: string }> {
  // CSRF 保护
  const csrfError = await validateCsrf()
  if (csrfError) {
    return { success: false, error: csrfError }
  }

  // UUID 格式验证
  if (!isValidUUID(orderId)) {
    return { success: false, error: '无效的订单 ID' }
  }

  // 价格范围校验（H4）
  if (!Number.isFinite(price) || price < ESTIMATE_PRICE_MIN || price > ESTIMATE_PRICE_MAX) {
    return { success: false, error: `估价金额必须在 ${ESTIMATE_PRICE_MIN} - ${ESTIMATE_PRICE_MAX} RMB 之间` }
  }

  // notes 长度限制
  const trimmedNotes = notes.trim()
  if (trimmedNotes.length > 2000) {
    return { success: false, error: '估价备注不能超过2000个字符' }
  }

  const supabase = await createClient()

  try {
    // 授权校验：仅管理员可提交估价（C2）
    const adminCheck = await requireAdmin()
    if (!adminCheck.success) {
      return { success: false, error: adminCheck.error }
    }
    const currentUser = adminCheck.user

    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'estimated',
        estimated_price: price,
        estimate_notes: trimmedNotes,
      })
      .eq('id', orderId)
      .eq('status', 'pending')
      .select()
      .single()

    if (updateError || !updatedOrder) {
      return { success: false, error: '该委托单状态已变更，请刷新后重试' }
    }

    // 记录 operation_logs（使用统一的日志记录函数）
    await logOperation(currentUser.userId, 'submit_estimate', 'order', orderId, {
      estimated_price: price,
      estimate_notes: trimmedNotes,
    })

    // 站内通知客户：已完成估价（模板化）
    await sendOrderNotification(
      updatedOrder,
      'estimate',
      '委托单估价完成',
      `您的委托单已完成估价，估价金额 RMB ${price}。请登录个人中心查看详情。`,
      { price }
    )

    // 邮件通知客户：已完成估价（模板化；失败不阻塞主流程）
    await sendOrderStatusEmail(
      updatedOrder,
      'estimate',
      '【LongWoo 龙坞】委托单估价完成',
      '',
      { price }
    )

    revalidatePath('/admin/dashboard')
    revalidatePath(`/studio/dashboard`)

    return { success: true }
  } catch (error) {
    console.error('提交估价异常:', error)
    return { success: false, error: '提交估价时发生未知错误' }
  }
}

// ==================== 接单 ====================

export async function acceptOrder(
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  // CSRF 保护
  const csrfError = await validateCsrf()
  if (csrfError) {
    return { success: false, error: csrfError }
  }

  // UUID 格式验证
  if (!isValidUUID(orderId)) {
    return { success: false, error: '无效的订单 ID' }
  }

  const supabase = await createClient()

  try {
    // 授权校验：仅管理员可接单（C2）
    const adminCheck = await requireAdmin()
    if (!adminCheck.success) {
      return { success: false, error: adminCheck.error }
    }
    const currentUser = adminCheck.user

    // 使用当前登录用户 ID（防止伪造）
    const userId = currentUser.userId

    // 条件更新：仅当订单仍处于 pending/estimated 状态且尚未被接单时才更新
    // 防止并发接单竞态条件（两个用户同时接同一个单）
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'accepted',
        studio_user_id: userId,
      })
      .eq('id', orderId)
      .in('status', ['pending', 'estimated'])
      .is('studio_user_id', null)
      .select()
      .single()

    if (updateError || !updatedOrder) {
      return { success: false, error: '该委托单已被接单或状态已变更，请刷新后重试' }
    }

    // 记录 operation_logs（使用统一的日志记录函数）
    await logOperation(userId, 'accept_order', 'order', orderId)

    // 站内通知客户：已接单（模板化）
    await sendOrderNotification(
      updatedOrder,
      'accepted',
      '委托单已接单',
      '工作室已接受您的委托单，即将开始制作，请留意后续进度更新。'
    )

    // 邮件通知客户：已接单（模板化；失败不阻塞主流程）
    await sendOrderStatusEmail(
      updatedOrder,
      'accepted',
      '【LongWoo 龙坞】委托单已接单',
      ''
    )

    revalidatePath('/studio/dashboard')
    revalidatePath('/admin/dashboard')

    return { success: true }
  } catch (error) {
    console.error('接单异常:', error)
    return { success: false, error: '接单时发生未知错误' }
  }
}

// ==================== 拒单 ====================

export async function rejectOrder(
  orderId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  // CSRF 保护
  const csrfError = await validateCsrf()
  if (csrfError) {
    return { success: false, error: csrfError }
  }

  // UUID 格式验证
  if (!isValidUUID(orderId)) {
    return { success: false, error: '无效的订单 ID' }
  }

  const supabase = await createClient()

  try {
    // 授权校验：仅管理员可拒单（C2）
    const adminCheck = await requireAdmin()
    if (!adminCheck.success) {
      return { success: false, error: adminCheck.error }
    }
    const currentUser = adminCheck.user

    // 输入验证
    const trimmedReason = reason.trim()
    if (!trimmedReason) {
      return { success: false, error: '请输入拒单原因' }
    }
    if (trimmedReason.length > 500) {
      return { success: false, error: '拒单原因不能超过500个字符' }
    }

    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'rejected',
        reject_reason: trimmedReason,
      })
      .eq('id', orderId)
      .in('status', ['pending', 'estimated'])
      .select()
      .single()

    if (updateError || !updatedOrder) {
      return { success: false, error: '该委托单状态已变更，请刷新后重试' }
    }

    // 记录 operation_logs（使用统一的日志记录函数）
    await logOperation(currentUser.userId, 'reject_order', 'order', orderId, {
      reason,
    })

    // 站内通知客户：已拒单（模板化）
    await sendOrderNotification(
      updatedOrder,
      'rejected',
      '委托单已被拒单',
      `很抱歉，您的委托单未通过审核：${trimmedReason}`,
      { reason: trimmedReason }
    )

    revalidatePath('/studio/dashboard')
    revalidatePath('/admin/dashboard')

    return { success: true }
  } catch (error) {
    console.error('拒单异常:', error)
    return { success: false, error: '拒单时发生未知错误' }
  }
}

// ==================== 更新进度 ====================

export async function updateOrderStatus(
  orderId: string,
  newStatus: 'processing' | 'delivered' | 'completed',
  deliveryUrl?: string
): Promise<{ success: boolean; error?: string }> {
  // CSRF 保护
  const csrfError = await validateCsrf()
  if (csrfError) {
    return { success: false, error: csrfError }
  }

  // UUID 格式验证
  if (!isValidUUID(orderId)) {
    return { success: false, error: '无效的订单 ID' }
  }

  const supabase = await createClient()

  // 校验状态值
  const validStatuses = ['processing', 'delivered', 'completed']
  if (!validStatuses.includes(newStatus)) {
    return { success: false, error: '无效的状态值' }
  }

  try {
    // 授权校验：仅管理员可更新进度（C2）
    const adminCheck = await requireAdmin()
    if (!adminCheck.success) {
      return { success: false, error: adminCheck.error }
    }
    const currentUser = adminCheck.user

    // 构建更新对象
    const updateData: Record<string, unknown> = { status: newStatus }
    if (deliveryUrl) {
      // 验证 URL 协议，防止 javascript: 等 XSS
      if (!validateUrl(deliveryUrl)) {
        return { success: false, error: '交付链接必须是 http:// 或 https:// 开头的有效网址' }
      }
      updateData.delivery_url = deliveryUrl
    }

    // 状态转换校验：确保只允许合法的状态转换
    const allowedTransitions: Record<string, string[]> = {
      processing: ['accepted'],
      delivered: ['processing'],
      completed: ['delivered'],
    }
    const allowedFromStatuses = allowedTransitions[newStatus] || []
    
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .in('status', allowedFromStatuses)
      .select()
      .single()

    if (updateError || !updatedOrder) {
      return { success: false, error: '该委托单状态不允许此操作，请刷新后重试' }
    }

    // 记录 operation_logs（使用统一的日志记录函数）
    await logOperation(currentUser.userId, 'update_status', 'order', orderId, {
      new_status: newStatus,
      delivery_url: deliveryUrl || null,
    })

    // 站内通知客户：进度更新（模板化）
    const STATUS_TEXT: Record<string, string> = {
      processing: '处理中（开始制作）',
      delivered: '已交付',
      completed: '已完成',
    }
    const statusText = STATUS_TEXT[newStatus] || newStatus
    const deliveryText = deliveryUrl ? `，交付链接：${deliveryUrl}` : ''
    await sendOrderNotification(
      updatedOrder,
      'progress',
      '委托单进度更新',
      `您的委托单状态已更新为：${statusText}${deliveryText}`,
      { status: statusText, deliveryUrl: deliveryText }
    )

    // 邮件通知客户：进度更新（模板化；失败不阻塞主流程）
    await sendOrderStatusEmail(
      updatedOrder,
      'progress',
      '【LongWoo 龙坞】委托单进度更新',
      '',
      { status: statusText, deliveryUrl: deliveryText }
    )

    revalidatePath('/studio/dashboard')
    revalidatePath('/admin/dashboard')

    return { success: true }
  } catch (error) {
    console.error('更新进度异常:', error)
    return { success: false, error: '更新进度时发生未知错误' }
  }
}

// ==================== 站内回复 ====================

export async function replySite(
  orderId: string,
  content: string
): Promise<{ success: boolean; error?: string }> {
  // CSRF 保护
  const csrfError = await validateCsrf()
  if (csrfError) {
    return { success: false, error: csrfError }
  }

  // UUID 格式验证
  if (!isValidUUID(orderId)) {
    return { success: false, error: '无效的订单 ID' }
  }

  const supabase = await createClient()

  try {
    // 授权校验：仅管理员可站内回复（工作室为管理员专属）
    const adminCheck = await requireAdmin()
    if (!adminCheck.success) {
      return { success: false, error: adminCheck.error }
    }
    const currentUser = adminCheck.user

    // 安全加固（SEC-11）：站内回复限速，防滥用刷站内消息（与 replyEmail 一致）
    const ip = await getClientIp()
    const replyRateLimit = await checkRateLimit(
      `sitereply:${ip}`,
      RATE_LIMIT_EMAIL_REPLY_MAX,
      RATE_LIMIT_EMAIL_REPLY_WINDOW
    )
    if (!replyRateLimit.allowed) {
      return { success: false, error: '操作过于频繁，请稍后再试' }
    }

    // 输入验证
    const trimmedContent = content.trim()
    if (!trimmedContent) {
      return { success: false, error: '请输入回复内容' }
    }
    if (trimmedContent.length > 2000) {
      return { success: false, error: '回复内容不能超过2000个字符' }
    }

    const { error: replyError } = await supabase
      .from('order_replies')
      .insert({
        order_id: orderId,
        reply_type: 'site',
        content: trimmedContent,
        sender_id: currentUser.userId,
      })

    if (replyError) {
      console.error('站内回复失败:', replyError.message)
      return { success: false, error: '回复失败，请稍后重试' }
    }

    // 站内通知客户：有新的站内回复（模板化）
    try {
      const { data: orderForNotify } = await supabase
        .from('orders')
        .select('id, order_no, customer_email, user_id')
        .eq('id', orderId)
        .single()
      if (orderForNotify) {
        await sendOrderNotification(
          orderForNotify,
          'reply',
          '委托单有新的回复',
          '工作室对您的委托单进行了回复，请登录个人中心查看。',
          { reply: trimmedContent }
        )
      }
    } catch (notifyError) {
      console.error('发送回复通知失败:', notifyError)
    }

    revalidatePath('/studio/dashboard')
    revalidatePath('/admin/dashboard')

    return { success: true }
  } catch (error) {
    console.error('站内回复异常:', error)
    return { success: false, error: '站内回复时发生未知错误' }
  }
}

// ==================== 邮件回复 ====================

export async function replyEmail(
  orderId: string,
  content: string
): Promise<{ success: boolean; error?: string; emailSent?: boolean }> {
  // CSRF 保护
  const csrfError = await validateCsrf()
  if (csrfError) {
    return { success: false, error: csrfError }
  }

  // UUID 格式验证
  if (!isValidUUID(orderId)) {
    return { success: false, error: '无效的订单 ID' }
  }

  const supabase = await createClient()

  try {
    // 授权校验：仅管理员可邮件回复（工作室为管理员专属）
    const adminCheck = await requireAdmin()
    if (!adminCheck.success) {
      return { success: false, error: adminCheck.error }
    }
    const currentUser = adminCheck.user

    // 速率限制：防止邮件轰炸（H5）
    const ip = await getClientIp()
    const replyRateLimit = await checkRateLimit(
      `emailreply:${ip}`,
      RATE_LIMIT_EMAIL_REPLY_MAX,
      RATE_LIMIT_EMAIL_REPLY_WINDOW
    )
    if (!replyRateLimit.allowed) {
      return { success: false, error: '操作过于频繁，请稍后再试' }
    }

    // 从订单记录中读取客户邮箱，而非信任客户端传入的邮箱地址
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, order_no, customer_email, user_id')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return { success: false, error: '未找到委托单' }
    }

    const toEmail = order.customer_email
    if (!toEmail) {
      return { success: false, error: '该委托单未关联客户邮箱' }
    }

    // 输入验证：与 replySite 保持一致
    const trimmedContent = content.trim()
    if (!trimmedContent) {
      return { success: false, error: '请输入回复内容' }
    }
    if (trimmedContent.length > 2000) {
      return { success: false, error: '回复内容不能超过2000个字符' }
    }

    let emailSent = false

    // 使用模板化的状态邮件发送回复通知（数据库模板可自定义文案与样式）
    // 仅在配置了 RESEND_API_KEY 时发送，行为与原实现一致
    if (process.env.RESEND_API_KEY) {
      const safeContent = escapeHtml(trimmedContent)
      emailSent = await sendOrderStatusEmail(
        order,
        'reply',
        '【LongWoo 龙坞】委托单回复通知',
        '',
        { reply: safeContent }
      )
      if (!emailSent) {
        console.error('邮件发送失败')
      }
    }

    // 无论邮件是否发送成功，都在站内记录
    const { error: replyError } = await supabase
      .from('order_replies')
      .insert({
        order_id: orderId,
        reply_type: 'email',
        content: trimmedContent,
        sender_id: currentUser.userId,
      })

    if (replyError) {
      console.error('邮件回复失败:', replyError.message)
      return { success: false, error: '回复失败，请稍后重试' }
    }

    // 站内通知客户：有新的邮件回复（模板化）
    await sendOrderNotification(
      order,
      'reply',
      '委托单有新的回复',
      '工作室对您的委托单进行了回复（已同步发送邮件），请登录个人中心查看。',
      { reply: trimmedContent }
    )

    revalidatePath('/studio/dashboard')
    revalidatePath('/admin/dashboard')

    return { success: true, emailSent }
  } catch (error) {
    console.error('邮件回复异常:', error)
    return { success: false, error: '邮件回复时发生未知错误' }
  }
}

// ==================== 按单号+邮箱查询 ====================

export async function queryOrderByNo(
  orderNo: string,
  email: string
): Promise<{
  success: boolean
  data?: Order & {
    attachments?: OrderAttachment[]
    replies?: OrderReply[]
  }
  error?: string
}> {
  // CSRF 保护（H3）
  const csrfError = await validateCsrf()
  if (csrfError) {
    return { success: false, error: csrfError }
  }

  // 输入验证（H3）
  if (!orderNo || !orderNo.trim()) {
    return { success: false, error: '请输入委托单号' }
  }
  if (!email || !email.trim()) {
    return { success: false, error: '请输入邮箱' }
  }
  // 邮箱格式验证
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return { success: false, error: '请输入有效的邮箱地址' }
  }
  // 订单号长度和格式验证（防止注入）
  const trimmedOrderNo = orderNo.trim()
  if (trimmedOrderNo.length > 50) {
    return { success: false, error: '委托单号格式不正确' }
  }

  // 速率限制（安全加固 N-04）：双键限流，防单号枚举。
  // 单号格式为 LW+日期+4位序列（可预测），攻击者若掌握目标邮箱，可枚举当日
  // 单号批量查询以获取订单内容。仅按 IP 限流可被轮换 IP 绕过，因此增加
  // 「邮箱维度」强限制：同一邮箱 1 分钟内最多 5 次查询，与 IP 无关。
  const trimmedEmail = email.trim().toLowerCase()
  const ip = await getClientIp()
  const [emailLimitResult, ipLimitResult] = await Promise.all([
    checkRateLimit(`query:email:${trimmedEmail}`, 5, RATE_LIMIT_ORDER_WINDOW),
    checkRateLimit(`query:ip:${ip}`, 20, RATE_LIMIT_ORDER_WINDOW),
  ])
  if (!emailLimitResult.allowed || !ipLimitResult.allowed) {
    return { success: false, error: '查询过于频繁，请稍后再试' }
  }

  // 安全加固（N-04/H5）：主查询与附件/回复统一使用 admin client（service_role）。
  // 认证凭据为「订单号 + 邮箱」双因子同时匹配（服务端校验）；
  // orders 表 RLS 未对匿名/游客开放 SELECT（orders_select_own 仅 admin 与归属者可见），
  // 若用 anon client 查询，游客提交订单后将永远查不到进度（功能失效）。
  // 返回数据已脱敏（手机号/邮箱），且上方邮箱维度限流限制枚举面。
  const admin = createAdminClient()

  try {
    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('*, service_types(*)')
      .eq('order_no', trimmedOrderNo)
      .eq('customer_email', trimmedEmail)
      .single()

    if (orderError || !order) {
      return { success: false, error: '未找到匹配的委托单，请确认单号和邮箱' }
    }

    // 性能优化：附件与回复查询相互独立，改为并行执行（Promise.all），
    // 原串行实现多花费 1 个 RTT（约 40-100ms）
    const [attachmentResult, repliesResult] = await Promise.all([
      admin
        .from('order_attachments')
        .select('*')
        .eq('order_id', order.id)
        .order('created_at', { ascending: true }),
      admin
        .from('order_replies')
        .select('*, profiles(display_name, avatar_url)')
        .eq('order_id', order.id)
        .order('sent_at', { ascending: true }),
    ])
    const attachments = attachmentResult.data
    const replies = repliesResult.data
    return {
      success: true,
      data: {
        ...order,
        customer_phone: maskPhone(order.customer_phone),
        customer_email: maskEmail(order.customer_email),
        attachments: attachments || [],
        replies: (replies || []) as OrderReply[],
      },
    }
  } catch (error) {
    console.error('按单号查询异常:', error)
    return { success: false, error: '查询委托单时发生未知错误' }
  }
}

// ==================== 删除委托单（仅超级管理员 uid=10001） ====================
//
// 用于清除测试产生的多余订单。删除时同步清理关联数据：
// 附件（order_attachments）、回复（order_replies）、
// 操作日志（operation_logs）、站内通知（notifications.batch_id=订单id）。
//
// 权限：requireZeroUser() 校验（uid=10001 且 role=admin 且 is_active）
// ====================
export async function deleteOrder(orderId: string): Promise<{
  success: boolean
  error?: string
}> {
  const csrfError = await validateCsrf()
  if (csrfError) {
    return { success: false, error: csrfError }
  }

  const authResult = await requireZeroUser()
  if (!authResult.success) {
    return { success: false, error: authResult.error }
  }

  if (!isValidUUID(orderId)) {
    return { success: false, error: '参数错误' }
  }

  const admin = createAdminClient()
  try {
    // 确认订单存在
    const { data: target, error: fetchError } = await admin
      .from('orders')
      .select('id, order_no')
      .eq('id', orderId)
      .maybeSingle()
    if (fetchError || !target) {
      return { success: false, error: '未找到该委托单' }
    }

    // 删除关联数据（并行执行，单条失败不阻断主删除）
    const [attRes, replyRes, logRes, notiRes] = await Promise.all([
      admin.from('order_attachments').delete().eq('order_id', orderId),
      admin.from('order_replies').delete().eq('order_id', orderId),
      admin
        .from('operation_logs')
        .delete()
        .eq('target_type', 'order')
        .eq('target_id', orderId),
      admin.from('notifications').delete().eq('batch_id', orderId),
    ])
    const relatedErrors = [
      attRes.error,
      replyRes.error,
      logRes.error,
      notiRes.error,
    ].filter(Boolean)
    if (relatedErrors.length > 0) {
      console.error(
        '删除委托单关联数据失败:',
        relatedErrors.map((e) => (e as { message?: string }).message ?? '').join('; ')
      )
    }

    // 删除订单本体
    const { error: deleteError } = await admin.from('orders').delete().eq('id', orderId)
    if (deleteError) {
      console.error('删除委托单失败:', deleteError.message)
      return { success: false, error: '删除失败，请稍后重试' }
    }

    revalidatePath('/admin/dashboard')
    return { success: true }
  } catch (error) {
    console.error('删除委托单异常:', error)
    return { success: false, error: '删除委托单时发生未知错误' }
  }
}

// ==================== 工作室获取委托单列表（带搜索、分页、分组统计） ====================

export async function getStudioOrders(filters: {
  status?: string
  search?: string
  offset?: number
  limit?: number
}): Promise<{
  success: boolean
  data?: Order[]
  count?: number
  total?: number
  error?: string
}> {
  // 鉴权：必须登录
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { success: false, error: '请先登录' }
  }

  const supabase = await createClient()

  try {
    const offset = filters.offset ?? 0
    const limit = Math.min(filters.limit ?? 20, MAX_PAGE_LIMIT)

    // 使用公共查询构建函数
    // 非 admin 用户仅可见分配给自己或尚未分配的订单（可见性过滤由 buildOrderQuery 处理）
    const query = buildOrderQuery(supabase, {
      offset,
      limit,
      status: filters.status,
      search: filters.search,
      isAdmin: currentUser.role === 'admin',
      userId: currentUser.userId,
    })

    const { data, error, count } = await query

    if (error) {
      console.error('查询工作室订单失败:', error.message)
      return { success: false, error: '查询失败，请稍后重试' }
    }

    // 对 customer_phone 和 customer_email 做脱敏处理
    // 安全修复：非管理员用户不应看到其他客户的完整邮箱地址
    const maskedData = (data || []).map(order => ({
      ...order,
      customer_phone: maskPhone(order.customer_phone),
      customer_email: currentUser.role === 'admin'
        ? order.customer_email
        : maskEmail(order.customer_email),
    })) as Order[]

    return { success: true, data: maskedData, count: count ?? 0, total: count ?? 0 }
  } catch (error) {
    console.error('工作室查询委托单异常:', error)
    return { success: false, error: '查询委托单时发生未知错误' }
  }
}

// ==================== 获取委托单状态计数统计 ====================
// 使用并行 head 查询（不传输数据行，仅返回 count），避免全表扫描

export async function getOrderStatusCounts(): Promise<{
  success: boolean
  counts?: {
    pending: number
    estimated: number
    accepted: number
    processing: number
    delivered: number
    completed: number
    rejected: number
    total: number
  }
  error?: string
}> {
  // 鉴权：必须登录
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { success: false, error: '请先登录' }
  }

  const supabase = await createClient()

  try {
    const statuses = ['pending', 'estimated', 'accepted', 'processing', 'delivered', 'completed', 'rejected'] as const

    // 构建 base filter：非 admin 用户只能看到分配给自己的订单 + 尚未分配的订单（pending/estimated）
    const buildQuery = (status: string) => {
      let q = supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('status', status)

      if (currentUser.role !== 'admin') {
        // 分配给自己的，或尚未分配的（pending/estimated 且 studio_user_id 为 null）
        q = q.or(`studio_user_id.eq.${currentUser.userId},and(studio_user_id.is.null,status.in.(pending,estimated))`)
      }

      return q
    }

    // 并行查询每种状态的计数（head: true 仅返回 count，不传输数据）
    const results = await Promise.all(
      statuses.map(status => buildQuery(status))
    )

    const counts = {
      pending: 0,
      estimated: 0,
      accepted: 0,
      processing: 0,
      delivered: 0,
      completed: 0,
      rejected: 0,
      total: 0,
    }

    results.forEach((result, index) => {
      if (result.error) {
        console.error(`查询 ${statuses[index]} 计数失败:`, result.error.message)
        return
      }
      const count = result.count ?? 0
      counts[statuses[index]] = count
      counts.total += count
    })

    return { success: true, counts }
  } catch (error) {
    console.error('获取委托单状态计数异常:', error)
    return { success: false, error: '获取统计数据时发生未知错误' }
  }
}

// ==================== 获取服务类型列表（公开，供客户端调用） ====================

export async function getServiceTypes(): Promise<{
  success: boolean
  data?: Array<{ id: string; name: string; price_range: string | null }>
  error?: string
}> {
  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .from('service_types')
      .select('id, name, price_range')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('获取服务类型失败:', error.message)
      return { success: false, error: '获取服务类型失败，请稍后重试' }
    }

    return { success: true, data: data || [] }
  } catch (error) {
    console.error('获取服务类型异常:', error)
    return { success: false, error: '获取服务类型时发生未知错误' }
  }
}

// ==================== 我的订单（个人中心） ====================

/**
 * 获取当前登录用户的订单列表（按下单邮箱匹配）
 * 普通用户查看自己名下订单，无需手动输入单号+手机号
 */
export async function listMyOrders(limit = 20): Promise<{
  success: boolean
  data?: Order[]
  error?: string
}> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { success: false, error: '请先登录' }
  }

  const supabase = await createClient()

  try {
    const safeLimit = Math.min(limit, MAX_PAGE_LIMIT)

    // 客户订单：优先按下单账号（user_id）匹配，兜底按下单邮箱匹配（旧订单/匿名订单）
    // 方案 A：已登录用户下单时 orders.user_id 已写入，邮箱变更/输错不影响订单归属
    const email = currentUser.profile?.email
    let query = supabase
      .from('orders')
      .select('*, service_types(*)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(safeLimit)

    if (email && currentUser.userId) {
      // 注意：email 中的 "." 不能转义（PostgREST or 过滤器里 \. 会导致匹配失败），
      // 仅需防御转义 or 过滤器分隔符逗号（合法邮箱不含逗号，此为纵深防御）。
      const safeEmail = email.replace(/,/g, '\\,')
      query = query.or(
        `user_id.eq.${currentUser.userId},customer_email.eq.${safeEmail},studio_user_id.eq.${currentUser.userId}`
      )
    } else if (currentUser.userId) {
      query = query.or(`user_id.eq.${currentUser.userId},studio_user_id.eq.${currentUser.userId}`)
    } else if (email) {
      query = query.eq('customer_email', email)
    } else {
      return { success: true, data: [] }
    }

    const { data, error } = await query

    if (error) {
      console.error('查询我的订单失败:', error.message)
      return { success: false, error: '查询失败，请稍后重试' }
    }

    return { success: true, data: (data || []) as Order[] }
  } catch (error) {
    console.error('查询我的订单异常:', error)
    return { success: false, error: '查询我的订单时发生未知错误' }
  }
}

// ==================== 订单导出（管理员 CSV） ====================
const ORDER_EXPORT_COLUMNS = [
  '订单号',
  '状态',
  '客户姓名',
  '手机号',
  '邮箱',
  '下单时间',
  '估价金额',
  '需求描述',
] as const

// CSV 转义：包裹含逗号/引号/换行的字段
function csvEscape(value: unknown): string {
  const str = value == null ? '' : String(value)
  // 安全加固（N-03）：防 CSV 公式注入（CSV Injection）。
  // Excel/WPS 会将单元格开头为 = + - @（或 \t \r）的内容解析为公式执行，
  // 客户姓名/需求描述等用户可控字段可借此注入恶意公式（如 =HYPERLINK(...)）。
  // 对这类字段前置单引号 '，使其按纯文本处理。
  const sanitized = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str
  if (/[",\n\r]/.test(sanitized)) {
    return '"' + sanitized.replace(/"/g, '""') + '"'
  }
  return sanitized
}

/**
 * 导出全部订单为 CSV（管理员权限）
 *
 * @returns success=true 时 csv 为 CSV 字符串（含表头）
 */
export async function exportOrdersCsv(): Promise<{
  success: boolean
  csv?: string
  count?: number
  error?: string
}> {
  const currentUser = await requireAdmin()
  if (!currentUser) {
    return { success: false, error: '无权限执行此操作' }
  }

  const supabase = await createClient()
  const PAGE = 1000
  let offset = 0
  const rows: Array<Record<string, unknown>> = []

  try {
    // 分批拉取全部订单（避免一次性加载过大）
    while (true) {
      const { data, error } = await supabase
        .from('orders')
        .select('order_no,status,customer_name,customer_phone,customer_email,created_at,estimated_price,requirements')
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE - 1)

      if (error) {
        return { success: false, error: '导出失败，请稍后重试' }
      }
      if (!data || data.length === 0) break
      rows.push(...data)
      if (data.length < PAGE) break
      offset += PAGE
    }

    const header = ORDER_EXPORT_COLUMNS.join(',')
    const lines = rows.map((row) =>
      [
        row.order_no,
        row.status,
        row.customer_name,
        row.customer_phone,
        row.customer_email,
        row.created_at,
        row.estimated_price != null ? Number(row.estimated_price) : '',
        row.requirements,
      ]
        .map(csvEscape)
        .join(',')
    )
    const csv = '\uFEFF' + [header, ...lines].join('\r\n') // BOM 供 Excel 正确识别 UTF-8
    return { success: true, csv, count: rows.length }
  } catch (error) {
    console.error('导出订单异常:', error)
    return { success: false, error: '导出订单时发生未知错误' }
  }
}

