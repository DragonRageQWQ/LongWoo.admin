'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, canUserAccessOrder, requireAdmin } from '@/lib/auth'
import { escapeHtml, escapePostgrestKeyword, escapeIlikeKeyword } from '@/lib/postgrest-utils'
import { validateUrl, isValidUUID } from '@/lib/order-utils'
import { maskPhone, maskEmail } from '@/lib/utils'
import { checkRateLimit } from '@/lib/rate-limit'
import { validateCsrf } from '@/lib/csrf'
import { getClientIp, logOperation, sendEmail } from '@/lib/server-utils'
import { RATE_LIMIT_ORDER_WINDOW, MAX_PAGE_LIMIT, ESTIMATE_PRICE_MIN, ESTIMATE_PRICE_MAX, RATE_LIMIT_EMAIL_REPLY_MAX, RATE_LIMIT_EMAIL_REPLY_WINDOW } from '@/lib/constants'
import type { Order, OrderAttachment, OrderReply, OperationLog } from '@/types/database'

// ==================== 订单查询速率限制（数据库版） ====================
// 基于 IP + 手机号组合做限制，同一组合 1 分钟内最多查询 5 次
// 使用数据库表实现，兼容 Vercel Serverless 多实例环境

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

  // 授权校验：检查用户是否有权访问此订单
  const hasAccess = await canUserAccessOrder(id, currentUser.userId, currentUser.role)
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
      .select('customer_email')
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

    // 使用统一的邮件发送函数发送回复通知邮件
    // 仅在配置了 RESEND_API_KEY 时发送，行为与原实现一致
    if (process.env.RESEND_API_KEY) {
      // HTML 转义防止 XSS 注入
      const safeContent = escapeHtml(trimmedContent)
      const safeContentHtml = safeContent.replace(/\n/g, '<br/>')

      emailSent = await sendEmail(toEmail, '【LongWoo 龙坞】委托单回复通知', `
              <!DOCTYPE html>
              <html lang="zh-CN">
              <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
              <body style="margin:0;padding:0;background-color:#F3F3F3;font-family:'PingFang SC','Microsoft YaHei','Noto Sans CJK SC',-apple-system,sans-serif;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F3F3F3;">
                  <tr><td align="center" style="padding:32px 16px;">
                    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,0.06);">
                      <tr><td style="background-color:#0D3B3B;padding:28px 40px;text-align:center;">
                        <h1 style="color:#FFFFFF;font-size:22px;font-weight:700;margin:0;letter-spacing:3px;">龙坞 LONGWOO</h1>
                        <p style="color:rgba(255,255,255,0.5);font-size:10px;margin:4px 0 0;letter-spacing:2px;">Creative Design Studio</p>
                      </td></tr>
                      <tr><td style="background-color:#1A5050;height:4px;line-height:4px;font-size:4px;">&nbsp;</td></tr>
                      <tr><td style="padding:32px 40px;">
                        <h2 style="color:#0D3B3B;font-size:18px;font-weight:700;margin:0 0 16px;">委托单回复通知</h2>
                        <p style="color:#666;font-size:15px;line-height:1.7;margin:0 0 20px;">您好，您的委托单有新的回复：</p>
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                          <tr><td style="background-color:#F0F7F7;border-left:3px solid #0D3B3B;border-radius:0 8px 8px 0;padding:16px;">
                            <p style="color:#333;font-size:14px;line-height:1.7;margin:0;">${safeContentHtml}</p>
                          </td></tr>
                        </table>
                        <p style="color:#666;font-size:14px;line-height:1.6;margin:0 0 8px;">请登录系统查看完整详情。</p>
                        <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.longwoo.studio'}/studio/dashboard" style="display:inline-block;margin-top:16px;padding:10px 28px;background-color:#0D3B3B;color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">查看委托单</a>
                      </td></tr>
                      <tr><td style="padding:0 40px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #EEE;"><tr><td style="height:1px;line-height:1px;font-size:1px;">&nbsp;</td></tr></table>
                      </td></tr>
                      <tr><td style="padding:20px 40px 28px;">
                        <p style="color:#AAA;font-size:12px;line-height:1.6;margin:0;">此邮件由 LongWoo 龙坞系统自动发送，请勿直接回复。</p>
                        <p style="color:#CCC;font-size:11px;margin:4px 0 0;">© 2026 LongWoo 龙坞. All rights reserved.</p>
                      </td></tr>
                    </table>
                  </td></tr>
                </table>
              </body>
              </html>
            `)
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

    revalidatePath('/studio/dashboard')
    revalidatePath('/admin/dashboard')

    return { success: true, emailSent }
  } catch (error) {
    console.error('邮件回复异常:', error)
    return { success: false, error: '邮件回复时发生未知错误' }
  }
}

// ==================== 按单号+手机号查询 ====================

export async function queryOrderByNo(
  orderNo: string,
  phone: string
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
  if (!phone || !phone.trim()) {
    return { success: false, error: '请输入手机号' }
  }
  // 手机号格式验证
  if (!/^1[3-9]\d{9}$/.test(phone.trim())) {
    return { success: false, error: '请输入有效的手机号' }
  }
  // 订单号长度和格式验证（防止注入）
  const trimmedOrderNo = orderNo.trim()
  if (trimmedOrderNo.length > 50) {
    return { success: false, error: '委托单号格式不正确' }
  }

  // 速率限制：基于 IP + 手机号组合，1分钟内最多查询5次（数据库版）
  const ip = await getClientIp()
  const rateLimitResult = await checkRateLimit(
    `query:${ip}:${phone.trim()}`,
    5,
    RATE_LIMIT_ORDER_WINDOW
  )
  if (!rateLimitResult.allowed) {
    return { success: false, error: '查询过于频繁，请稍后再试' }
  }

  const supabase = await createClient()

  try {
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, service_types(*)')
      .eq('order_no', trimmedOrderNo)
      .eq('customer_phone', phone.trim())
      .single()

    if (orderError || !order) {
      return { success: false, error: '未找到匹配的委托单，请确认单号和手机号' }
    }

    // 查询附件
    const { data: attachments } = await supabase
      .from('order_attachments')
      .select('*')
      .eq('order_id', order.id)
      .order('created_at', { ascending: true })

    // 查询回复（仅返回显示名称和头像，不泄露内部用户信息）
    const { data: replies } = await supabase
      .from('order_replies')
      .select('*, profiles(display_name, avatar_url)')
      .eq('order_id', order.id)
      .order('sent_at', { ascending: true })
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

    // 客户订单：按下单邮箱匹配（orders.customer_email = profile.email）
    // 同时包含分配给当前用户的订单（studio_user_id = userId），兼容工作台场景
    const email = currentUser.profile?.email
    let query = supabase
      .from('orders')
      .select('*, service_types(*)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(safeLimit)

    if (email && currentUser.userId) {
      query = query.or(`customer_email.eq.${escapePostgrestKeyword(email)},studio_user_id.eq.${currentUser.userId}`)
    } else if (currentUser.userId) {
      query = query.eq('studio_user_id', currentUser.userId)
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
