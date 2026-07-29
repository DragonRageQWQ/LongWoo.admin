'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { maskPhone } from '@/lib/utils'
import type { Order, OrderAttachment, OrderReply, OperationLog } from '@/types/database'

// ==================== 安全辅助函数 ====================

/**
 * HTML 转义，防止 XSS 注入
 * 在将用户输入插入 HTML 邮件模板前调用
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * 获取当前登录用户信息及角色
 * 返回 null 表示未登录
 */
async function getCurrentUser(): Promise<{
  userId: string
  role: 'studio' | 'admin'
} | null> {
  const supabase = await createClient()

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return null

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()

    return {
      userId: session.user.id,
      role: (profile?.role as 'studio' | 'admin') ?? 'studio',
    }
  } catch {
    return null
  }
}

/**
 * 验证当前用户是否有权操作指定订单
 * - admin 角色可操作所有订单
 * - studio 角色只能操作分配给自己的订单（studio_user_id 匹配）
 * - 对于 pending/estimated 状态的订单（尚未分配），studio 也可操作（估价、接单）
 */
async function canUserAccessOrder(
  orderId: string,
  userId: string,
  role: string
): Promise<boolean> {
  if (role === 'admin') return true

  const supabase = await createClient()

  const { data: order } = await supabase
    .from('orders')
    .select('status, studio_user_id')
    .eq('id', orderId)
    .single()

  if (!order) return false

  // 订单已分配给某个工作室用户，检查是否是当前用户
  if (order.studio_user_id) {
    return order.studio_user_id === userId
  }

  // 订单尚未分配（pending/estimated 状态），允许工作室用户操作
  return order.status === 'pending' || order.status === 'estimated'
}

// ==================== 创建委托单 ====================

export async function createOrder(formData: {
  serviceTypeId?: string
  customerName: string
  customerPhone: string
  customerEmail: string
  requirements: string
  attachments?: Array<{
    fileName: string
    filePath: string
    fileSize?: number
    fileType?: string
  }>
}): Promise<{ success: boolean; orderNo?: string; error?: string }> {
  const supabase = await createClient()

  try {
    // 尝试获取当前登录用户（客户可能已登录也可能未登录）
    const currentUser = await getCurrentUser()

    // 生成单号
    const { data: orderNoData, error: orderNoError } = await supabase
      .rpc('generate_order_no')

    if (orderNoError || !orderNoData) {
      return { success: false, error: '生成单号失败' }
    }

    const orderNo = orderNoData as string

    // 插入 orders 表
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_no: orderNo,
        service_type_id: formData.serviceTypeId || null,
        status: 'pending',
        customer_name: formData.customerName,
        customer_phone: formData.customerPhone,
        customer_email: formData.customerEmail,
        requirements: formData.requirements,
      })
      .select()
      .single()

    if (orderError) {
      return { success: false, error: orderError.message }
    }

    // 如有附件则插入 order_attachments
    if (formData.attachments && formData.attachments.length > 0) {
      const attachmentsToInsert = formData.attachments.map(att => ({
        order_id: order.id,
        file_name: att.fileName,
        file_path: att.filePath,
        file_size: att.fileSize || null,
        file_type: att.fileType || null,
      }))

      const { error: attachError } = await supabase
        .from('order_attachments')
        .insert(attachmentsToInsert)

      if (attachError) {
        console.error('插入附件失败:', attachError.message)
        // 附件插入失败不影响主流程
      }
    }

    // 记录 operation_logs
    // 使用当前登录用户 ID；若未登录则尝试插入 null（依赖数据库字段是否允许 NULL）
    const { error: logError } = await supabase
      .from('operation_logs')
      .insert({
        order_id: order.id,
        user_id: currentUser?.userId ?? null,
        action: 'create_order',
        details: {
          customer_name: formData.customerName,
          customer_email: formData.customerEmail,
        },
      })

    if (logError) {
      console.error('记录操作日志失败:', logError.message)
    }

    revalidatePath('/order/submit')
    revalidatePath('/admin/dashboard')

    return { success: true, orderNo }
  } catch (error) {
    console.error('创建委托单异常:', error)
    return { success: false, error: '创建委托单时发生未知错误' }
  }
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
    const limit = filters.limit ?? 20

    let query = supabase
      .from('orders')
      .select('*, service_types(*)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (filters.status) {
      query = query.eq('status', filters.status)
    }

    // 关键词搜索：订单号、客户名、需求描述
    if (filters.search && filters.search.trim()) {
      const keyword = filters.search.trim()
      query = query.or(`order_no.ilike.%${keyword}%,customer_name.ilike.%${keyword}%,requirements.ilike.%${keyword}%`)
    }

    // 日期范围筛选（服务端）
    if (filters.startDate) {
      query = query.gte('created_at', `${filters.startDate}T00:00:00.000Z`)
    }
    if (filters.endDate) {
      query = query.lte('created_at', `${filters.endDate}T23:59:59.999Z`)
    }

    const { data, error, count } = await query

    if (error) {
      return { success: false, error: error.message }
    }

    // 对 customer_phone 做脱敏处理
    const maskedData = (data || []).map(order => ({
      ...order,
      customer_phone: maskPhone(order.customer_phone),
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
    const [orderResult, attachmentsResult, repliesResult, logsResult] = await Promise.all([
      supabase
        .from('orders')
        .select('*, service_types(*), profiles(*)')
        .eq('id', id)
        .single(),
      supabase
        .from('order_attachments')
        .select('*')
        .eq('order_id', id)
        .order('created_at', { ascending: true }),
      supabase
        .from('order_replies')
        .select('*, profiles(display_name, avatar_url)')
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
      return { success: false, error: orderError?.message || '未找到委托单' }
    }

    const attachments = attachmentsResult.data
    const replies = repliesResult.data
    const logs = logsResult.data

    return {
      success: true,
      data: {
        ...order,
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
  const supabase = await createClient()

  try {
    // 授权校验
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return { success: false, error: '请先登录' }
    }

    const hasAccess = await canUserAccessOrder(orderId, currentUser.userId, currentUser.role)
    if (!hasAccess) {
      return { success: false, error: '无权操作此委托单' }
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'estimated',
        estimated_price: price,
        estimate_notes: notes,
      })
      .eq('id', orderId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    // 记录 operation_logs
    const { error: logError } = await supabase
      .from('operation_logs')
      .insert({
        order_id: orderId,
        user_id: currentUser.userId,
        action: 'submit_estimate',
        details: { estimated_price: price, estimate_notes: notes },
      })

    if (logError) {
      console.error('记录操作日志失败:', logError.message)
    }

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
  orderId: string,
  studioUserId?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  try {
    // 授权校验
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return { success: false, error: '请先登录' }
    }

    const hasAccess = await canUserAccessOrder(orderId, currentUser.userId, currentUser.role)
    if (!hasAccess) {
      return { success: false, error: '无权操作此委托单' }
    }

    // 使用当前登录用户 ID，忽略传入的 studioUserId（防止伪造）
    const userId = currentUser.userId

    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'accepted',
        studio_user_id: userId,
      })
      .eq('id', orderId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    // 记录 operation_logs
    const { error: logError } = await supabase
      .from('operation_logs')
      .insert({
        order_id: orderId,
        user_id: userId,
        action: 'accept_order',
        details: {},
      })

    if (logError) {
      console.error('记录操作日志失败:', logError.message)
    }

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
  const supabase = await createClient()

  try {
    // 授权校验
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return { success: false, error: '请先登录' }
    }

    const hasAccess = await canUserAccessOrder(orderId, currentUser.userId, currentUser.role)
    if (!hasAccess) {
      return { success: false, error: '无权操作此委托单' }
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'rejected',
        reject_reason: reason,
      })
      .eq('id', orderId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    // 记录 operation_logs
    const { error: logError } = await supabase
      .from('operation_logs')
      .insert({
        order_id: orderId,
        user_id: currentUser.userId,
        action: 'reject_order',
        details: { reason },
      })

    if (logError) {
      console.error('记录操作日志失败:', logError.message)
    }

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
  const supabase = await createClient()

  // 校验状态值
  const validStatuses = ['processing', 'delivered', 'completed']
  if (!validStatuses.includes(newStatus)) {
    return { success: false, error: '无效的状态值' }
  }

  try {
    // 授权校验
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return { success: false, error: '请先登录' }
    }

    const hasAccess = await canUserAccessOrder(orderId, currentUser.userId, currentUser.role)
    if (!hasAccess) {
      return { success: false, error: '无权操作此委托单' }
    }

    // 构建更新对象
    const updateData: Record<string, unknown> = { status: newStatus }
    if (deliveryUrl) {
      updateData.delivery_url = deliveryUrl
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    // 记录 operation_logs
    const { error: logError } = await supabase
      .from('operation_logs')
      .insert({
        order_id: orderId,
        user_id: currentUser.userId,
        action: 'update_status',
        details: { new_status: newStatus, delivery_url: deliveryUrl || null },
      })

    if (logError) {
      console.error('记录操作日志失败:', logError.message)
    }

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
  const supabase = await createClient()

  try {
    // 授权校验
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return { success: false, error: '请先登录' }
    }

    const hasAccess = await canUserAccessOrder(orderId, currentUser.userId, currentUser.role)
    if (!hasAccess) {
      return { success: false, error: '无权操作此委托单' }
    }

    const { error: replyError } = await supabase
      .from('order_replies')
      .insert({
        order_id: orderId,
        reply_type: 'site',
        content,
        sender_id: currentUser.userId,
      })

    if (replyError) {
      return { success: false, error: replyError.message }
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
  const supabase = await createClient()

  try {
    // 授权校验
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return { success: false, error: '请先登录' }
    }

    const hasAccess = await canUserAccessOrder(orderId, currentUser.userId, currentUser.role)
    if (!hasAccess) {
      return { success: false, error: '无权操作此委托单' }
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

    let emailSent = false

    // 如果配置了 RESEND_API_KEY，则发送邮件
    const resendApiKey = process.env.RESEND_API_KEY
    if (resendApiKey) {
      try {
        // HTML 转义防止 XSS 注入
        const safeContent = escapeHtml(content)
        const safeContentHtml = safeContent.replace(/\n/g, '<br/>')

        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM_EMAIL || 'noreply@longwoo.studio',
            to: toEmail,
            subject: '【LongWoo 龙坞】委托单回复通知',
            html: `
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
            `,
          }),
        })

        emailSent = response.ok
        if (!emailSent) {
          console.error('邮件发送失败:', await response.text())
        }
      } catch (emailError) {
        console.error('邮件发送异常:', emailError)
        emailSent = false
      }
    }

    // 无论邮件是否发送成功，都在站内记录
    const { error: replyError } = await supabase
      .from('order_replies')
      .insert({
        order_id: orderId,
        reply_type: 'email',
        content,
        sender_id: currentUser.userId,
      })

    if (replyError) {
      return { success: false, error: replyError.message }
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
  const supabase = await createClient()

  try {
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, service_types(*)')
      .eq('order_no', orderNo)
      .eq('customer_phone', phone)
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
    const limit = filters.limit ?? 20

    let query = supabase
      .from('orders')
      .select('*, service_types(*)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (filters.status) {
      query = query.eq('status', filters.status)
    }

    // 非 admin 用户只能看到：
    // 1. 分配给自己的订单（studio_user_id = 当前用户）
    // 2. 尚未分配的订单（pending/estimated 状态，studio_user_id 为 null）
    if (currentUser.role !== 'admin') {
      query = query.or(`studio_user_id.eq.${currentUser.userId},and(studio_user_id.is.null,status.in.(pending,estimated))`)
    }

    // 关键词搜索：订单号、客户名、需求描述
    if (filters.search && filters.search.trim()) {
      const keyword = filters.search.trim()
      query = query.or(`order_no.ilike.%${keyword}%,customer_name.ilike.%${keyword}%,requirements.ilike.%${keyword}%`)
    }

    const { data, error, count } = await query

    if (error) {
      return { success: false, error: error.message }
    }

    // 对 customer_phone 做脱敏处理
    const maskedData = (data || []).map(order => ({
      ...order,
      customer_phone: maskPhone(order.customer_phone),
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
      return { success: false, error: error.message }
    }

    return { success: true, data: data || [] }
  } catch (error) {
    console.error('获取服务类型异常:', error)
    return { success: false, error: '获取服务类型时发生未知错误' }
  }
}
