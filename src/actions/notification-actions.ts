'use server'

import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, requireZeroUser } from '@/lib/auth'
import { validateCsrf } from '@/lib/csrf'
import { checkRateLimit } from '@/lib/rate-limit'
import { getClientIp, sendEmail } from '@/lib/server-utils'
import {
  validateNotificationInput,
  resolveTargetFilter,
  buildNotificationRows,
  buildEmailHtml,
  buildEmailHistoryRow,
  type NotificationTargetRole,
  type EmailHistoryRow,
} from '@/lib/notification-utils'
import { RATE_LIMIT_NOTIFY_MAX, RATE_LIMIT_NOTIFY_WINDOW } from '@/lib/constants'

// 批量插入分块大小（避免单次请求过大）
const INSERT_CHUNK_SIZE = 100
// 邮件并发发送路数
const EMAIL_SEND_CONCURRENCY = 5

export interface SendNotificationResult {
  success: boolean
  count?: number
  error?: string
}

/**
 * 管理员向目标群体发送通知/站内信
 *
 * 目标群体（targetRole）：
 *   - all   ：全体用户（所有已注册用户）
 *   - admin ：仅限管理员
 *   - user  ：全部普通成员
 *   - tag   ：指定 tag 成员（tags 数组，任一命中即纳入）
 *   - users ：指定成员（userIds 数组）
 *
 * 实现：查询目标用户列表，按收件人批量插入 notifications 表
 * （单表 + 每用户一条记录），写入审计日志。
 *
 * 安全：CSRF → 管理员鉴权 → 速率限制 → 输入校验 → 目标群体校验
 */
export async function sendNotification(input: {
  targetRole: NotificationTargetRole
  title: string
  content: string
  tags?: string[]
  userIds?: string[]
}): Promise<SendNotificationResult> {
  // 1) CSRF 保护（最先）
  const csrfError = await validateCsrf()
  if (csrfError) {
    return { success: false, error: csrfError }
  }

  // 2) 鉴权：仅管理员
  const authResult = await requireAdmin()
  if (!authResult.success) {
    return { success: false, error: authResult.error }
  }
  const operator = authResult.user

  // 3) 速率限制：按 IP 防轰炸
  const ip = await getClientIp()
  const rateLimitResult = await checkRateLimit(
    `admin-notify:${ip}`,
    RATE_LIMIT_NOTIFY_MAX,
    RATE_LIMIT_NOTIFY_WINDOW
  )
  if (!rateLimitResult.allowed) {
    return { success: false, error: '操作过于频繁，请稍后再试' }
  }

  // 4) 输入校验
  const validationError = validateNotificationInput(input.title, input.content)
  if (validationError) {
    return { success: false, error: validationError }
  }

  // 5) 目标群体校验与映射
  const target = resolveTargetFilter({
    targetRole: input.targetRole,
    tags: input.tags,
    userIds: input.userIds,
  })
  if (!target.ok) {
    return { success: false, error: target.error }
  }

  const admin = createAdminClient()

  try {
    // 6) 查询目标用户列表
    let targetQuery = admin.from('profiles').select('id, is_active')
    if (target.query.kind === 'eq') {
      targetQuery = targetQuery.eq('role', target.query.value)
    } else if (target.query.kind === 'tags') {
      targetQuery = targetQuery.overlaps('tags', target.query.value)
    } else if (target.query.kind === 'ids') {
      targetQuery = targetQuery.in('id', target.query.value)
    }
    const { data: targets, error: targetError } = await targetQuery

    if (targetError) {
      console.error('查询目标用户失败:', targetError.message)
      return { success: false, error: '查询目标用户失败，请稍后重试' }
    }

    // 仅向启用账户发送
    const activeTargets = (targets ?? []).filter((t) => t.is_active !== false)
    if (activeTargets.length === 0) {
      return { success: false, error: '该群体暂无可用用户' }
    }

    // 7) 批量插入通知（每收件人一条，共享同一 batchId 便于超管后续修改/删除）
    const title = input.title.trim()
    const content = input.content.trim()
    const now = new Date().toISOString()
    const batchId = randomUUID()
    const targetTags = target.query.kind === 'tags' ? target.query.value : undefined
    const targetUserIds = target.query.kind === 'ids' ? target.query.value : undefined

    const rows = buildNotificationRows({
      targetUserIds: activeTargets.map((t) => t.id),
      senderUserId: operator.userId,
      targetRole: input.targetRole,
      title,
      content,
      batchId,
      createdAt: now,
      tags: targetTags,
      userIds: targetUserIds,
    })

    for (let i = 0; i < rows.length; i += INSERT_CHUNK_SIZE) {
      const chunk = rows.slice(i, i + INSERT_CHUNK_SIZE)
      const { error: insertError } = await admin.from('notifications').insert(chunk)
      if (insertError) {
        console.error('插入通知失败:', insertError.message)
        return { success: false, error: '发送失败，请稍后重试' }
      }
    }

    // 8) 审计日志（静默失败，不影响主流程）
    try {
      await admin.from('admin_audit_log').insert({
        operator_uid: operator.uid,
        operator_email: operator.profile?.email ?? null,
        action: 'send_notification',
        target_uid: null,
        target_email: null,
        details: {
          batch_id: batchId,
          target_role: input.targetRole,
          target_label: target.label,
          target_tags: targetTags ?? null,
          target_user_ids: targetUserIds ?? null,
          recipient_count: activeTargets.length,
          title,
        },
      })
    } catch (auditError) {
      console.error('写入审计日志失败:', auditError)
    }

    revalidatePath('/admin/dashboard')
    return { success: true, count: activeTargets.length }
  } catch (error) {
    console.error('发送通知异常:', error)
    return { success: false, error: '操作时发生未知错误' }
  }
}

export interface SendEmailResult {
  success: boolean
  count?: number
  successCount?: number
  failedCount?: number
  error?: string
}

/**
 * 管理员向目标群体发送邮件（Resend）
 *
 * 目标群体与 sendNotification 一致（all/admin/user/tag/users）。
 * 发送成功/失败计数会写入 email_send_history 发送历史表，
 * 供管理后台「邮件发送历史」查看。
 *
 * 安全：CSRF → 管理员鉴权 → 速率限制 → 输入校验 → 目标群体校验 → 邮件服务可用性
 */
export async function sendEmailBroadcast(input: {
  targetRole: NotificationTargetRole
  subject: string
  content: string
  tags?: string[]
  userIds?: string[]
}): Promise<SendEmailResult> {
  // 1) CSRF 保护（最先）
  const csrfError = await validateCsrf()
  if (csrfError) {
    return { success: false, error: csrfError }
  }

  // 2) 鉴权：仅管理员
  const authResult = await requireAdmin()
  if (!authResult.success) {
    return { success: false, error: authResult.error }
  }
  const operator = authResult.user

  // 3) 速率限制：按 IP 防轰炸
  const ip = await getClientIp()
  const rateLimitResult = await checkRateLimit(
    `admin-email:${ip}`,
    RATE_LIMIT_NOTIFY_MAX,
    RATE_LIMIT_NOTIFY_WINDOW
  )
  if (!rateLimitResult.allowed) {
    return { success: false, error: '操作过于频繁，请稍后再试' }
  }

  // 4) 输入校验（主题复用标题校验规则）
  const validationError = validateNotificationInput(input.subject, input.content)
  if (validationError) {
    return { success: false, error: validationError }
  }

  // 5) 目标群体校验与映射
  const target = resolveTargetFilter({
    targetRole: input.targetRole,
    tags: input.tags,
    userIds: input.userIds,
  })
  if (!target.ok) {
    return { success: false, error: target.error }
  }

  // 6) 邮件服务可用性
  if (!process.env.RESEND_API_KEY) {
    return { success: false, error: '未配置 RESEND_API_KEY，邮件服务不可用' }
  }

  const admin = createAdminClient()

  try {
    // 7) 查询目标用户列表（需邮箱）
    let targetQuery = admin.from('profiles').select('id, email, is_active')
    if (target.query.kind === 'eq') {
      targetQuery = targetQuery.eq('role', target.query.value)
    } else if (target.query.kind === 'tags') {
      targetQuery = targetQuery.overlaps('tags', target.query.value)
    } else if (target.query.kind === 'ids') {
      targetQuery = targetQuery.in('id', target.query.value)
    }
    const { data: targets, error: targetError } = await targetQuery

    if (targetError) {
      console.error('查询目标用户失败:', targetError.message)
      return { success: false, error: '查询目标用户失败，请稍后重试' }
    }

    // 启用账户且已绑定邮箱
    type EmailRecipient = { id: string; email: string; is_active: boolean | null }
    const recipients: EmailRecipient[] = (targets ?? []).filter(
      (t): t is EmailRecipient =>
        t.is_active !== false &&
        typeof t.email === 'string' &&
        t.email.trim().length > 0
    )
    if (recipients.length === 0) {
      return { success: false, error: '该群体暂无可发送的邮箱用户' }
    }

    // 8) 并发发送（默认 5 路并发），统计成功/失败数
    const subject = input.subject.trim()
    const content = input.content.trim()
    const html = buildEmailHtml(subject, content)
    const now = new Date().toISOString()
    const batchId = randomUUID()

    let successCount = 0
    let failedCount = 0
    let cursor = 0

    const worker = async () => {
      while (cursor < recipients.length) {
        const current = recipients[cursor++]
        const ok = await sendEmail(current.email, subject, html)
        if (ok) successCount++
        else failedCount++
      }
    }

    await Promise.all(
      Array.from(
        { length: Math.min(EMAIL_SEND_CONCURRENCY, recipients.length) },
        () => worker()
      )
    )

    // 9) 写入发送历史（无论成败均记录计数）
    const historyRow = buildEmailHistoryRow({
      batchId,
      subject,
      content,
      targetRole: input.targetRole,
      tags: target.query.kind === 'tags' ? target.query.value : undefined,
      userIds: target.query.kind === 'ids' ? target.query.value : undefined,
      recipientCount: recipients.length,
      successCount,
      failedCount,
      senderUid: operator.uid,
      senderEmail: operator.profile?.email ?? null,
      createdAt: now,
    })
    const { error: historyError } = await admin
      .from('email_send_history')
      .insert(historyRow)
    if (historyError) {
      console.error('写入邮件发送历史失败:', historyError.message)
    }

    // 10) 审计日志（静默失败，不影响主流程）
    try {
      await admin.from('admin_audit_log').insert({
        operator_uid: operator.uid,
        operator_email: operator.profile?.email ?? null,
        action: 'send_email_broadcast',
        target_uid: null,
        target_email: null,
        details: {
          batch_id: batchId,
          target_role: input.targetRole,
          target_label: target.label,
          recipient_count: recipients.length,
          success_count: successCount,
          failed_count: failedCount,
          subject,
        },
      })
    } catch (auditError) {
      console.error('写入审计日志失败:', auditError)
    }

    revalidatePath('/admin/dashboard')
    return { success: true, count: recipients.length, successCount, failedCount }
  } catch (error) {
    console.error('发送邮件异常:', error)
    return { success: false, error: '操作时发生未知错误' }
  }
}

/**
 * 查询邮件发送历史（按时间倒序）
 * 仅管理员可调用
 *
 * 数据源：email_send_history 表（每次广播一条记录）。
 */
export async function listEmailSendHistory(options?: {
  limit?: number
}): Promise<{
  success: boolean
  data?: EmailHistoryRow[]
  error?: string
}> {
  // 鉴权：仅管理员
  const authResult = await requireAdmin()
  if (!authResult.success) {
    return { success: false, error: authResult.error }
  }

  const admin = createAdminClient()
  const limit = Math.min(options?.limit ?? 20, 50)

  try {
    const { data, error } = await admin
      .from('email_send_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('查询邮件发送历史失败:', error.message)
      return { success: false, error: '查询失败，请稍后重试' }
    }

    return { success: true, data: (data ?? []) as EmailHistoryRow[] }
  } catch (error) {
    console.error('查询邮件发送历史异常:', error)
    return { success: false, error: '查询时发生未知错误' }
  }
}

/**
 * 查询已发送公告列表（按发送时间倒序，按批次聚合）
 * 仅管理员可调用
 *
 * 数据源：notifications 表按 batch_id 分组聚合。
 * 相比审计日志：batch_id 必然存在（删除/修改可用），
 * 且收件人数为实际记录数、可顺带返回内容供编辑预填。
 *
 * 分类规则：站内信（公告）的 batch_id 为随机 UUID；
 * 委托单相关通知（估价/接单/拒单/回复/进度）的 batch_id 为订单 id，
 * 通过 orders 表反向关联精确区分——本函数仅返回站内信，
 * 委托单通知请使用 listOrderNotifications。
 */
export async function listSentNotifications(options?: {
  limit?: number
}): Promise<{
  success: boolean
  data?: Array<{
    id: string
    batch_id: string
    title: string
    content: string
    target_role: NotificationTargetRole
    target_tags: string[] | null
    target_user_ids: string[] | null
    recipient_count: number
    created_at: string
  }>
  error?: string
}> {
  // 鉴权：仅管理员
  const authResult = await requireAdmin()
  if (!authResult.success) {
    return { success: false, error: authResult.error }
  }

  const admin = createAdminClient()
  const limit = Math.min(options?.limit ?? 20, 50)

  try {
    // 拉取足够多的批次记录（按时间倒序），在内存中按 batch_id 分组聚合
    const { data, error } = await admin
      .from('notifications')
      .select('batch_id, title, content, target_role, target_tags, target_user_ids, created_at')
      .not('batch_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      console.error('查询发送记录失败:', error.message)
      return { success: false, error: '查询失败，请稍后重试' }
    }

    // 精确分类：batch_id 属于订单 id 的记录为委托单通知，其余为站内信
    const allBatchIds = Array.from(
      new Set((data ?? []).map((r) => r.batch_id).filter(Boolean))
    )
    const { data: orderRows } = await admin
      .from('orders')
      .select('id')
      .in('id', allBatchIds)
    const orderIdSet = new Set((orderRows ?? []).map((o) => o.id))

    // 按 batch_id 分组：取每组最新一条为批次代表，收件人数 = 组内条数
    const groupMap = new Map<string, {
      batch_id: string
      title: string
      content: string
      target_role: NotificationTargetRole
      target_tags: string[] | null
      target_user_ids: string[] | null
      created_at: string
      recipient_count: number
    }>()

    for (const row of data ?? []) {
      if (!row.batch_id) continue
      // 跳过委托单通知（batch_id 为订单 id）
      if (orderIdSet.has(row.batch_id)) continue
      const existing = groupMap.get(row.batch_id)
      if (existing) {
        existing.recipient_count += 1
      } else {
        groupMap.set(row.batch_id, {
          batch_id: row.batch_id,
          title: row.title,
          content: row.content,
          target_role: row.target_role as NotificationTargetRole,
          target_tags: row.target_tags ?? null,
          target_user_ids: row.target_user_ids ?? null,
          created_at: row.created_at,
          recipient_count: 1,
        })
      }
    }

    const batches = Array.from(groupMap.values())
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit)

    return {
      success: true,
      data: batches.map((b) => ({
        id: b.batch_id,
        batch_id: b.batch_id,
        title: b.title,
        content: b.content,
        target_role: b.target_role,
        target_tags: b.target_tags,
        target_user_ids: b.target_user_ids,
        recipient_count: b.recipient_count,
        created_at: b.created_at,
      })),
    }
  } catch (error) {
    console.error('查询发送记录异常:', error)
    return { success: false, error: '查询时发生未知错误' }
  }
}

/**
 * 查询委托单相关通知历史（估价/接单/拒单/回复/进度等）
 * 仅管理员可调用
 *
 * 分类规则：委托单通知的 batch_id 为订单 id（见 sendOrderNotification），
 * 通过 orders 表反向关联识别并附带订单号。
 */
export async function listOrderNotifications(options?: {
  limit?: number
}): Promise<{
  success: boolean
  data?: Array<{
    batch_id: string
    order_no: string
    title: string
    content: string
    recipient_count: number
    created_at: string
  }>
  error?: string
}> {
  // 鉴权：仅管理员
  const authResult = await requireAdmin()
  if (!authResult.success) {
    return { success: false, error: authResult.error }
  }

  const admin = createAdminClient()
  const limit = Math.min(options?.limit ?? 30, 100)

  try {
    const { data, error } = await admin
      .from('notifications')
      .select('batch_id, title, content, target_role, created_at')
      .not('batch_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      console.error('查询委托单通知失败:', error.message)
      return { success: false, error: '查询失败，请稍后重试' }
    }

    // 反向关联 orders：识别委托单通知并获取订单号
    const allBatchIds = Array.from(
      new Set((data ?? []).map((r) => r.batch_id).filter(Boolean))
    )
    const { data: orderRows } = await admin
      .from('orders')
      .select('id, order_no')
      .in('id', allBatchIds)
    const orderMap = new Map<string, string>()
    for (const o of orderRows ?? []) {
      orderMap.set(o.id, o.order_no)
    }

    // 仅保留委托单通知，按 batch_id 聚合
    const groupMap = new Map<string, {
      batch_id: string
      order_no: string
      title: string
      content: string
      created_at: string
      recipient_count: number
    }>()

    for (const row of data ?? []) {
      if (!row.batch_id) continue
      const orderNo = orderMap.get(row.batch_id)
      if (!orderNo) continue // 非委托单通知
      const existing = groupMap.get(row.batch_id)
      if (existing) {
        existing.recipient_count += 1
      } else {
        groupMap.set(row.batch_id, {
          batch_id: row.batch_id,
          order_no: orderNo,
          title: row.title,
          content: row.content,
          created_at: row.created_at,
          recipient_count: 1,
        })
      }
    }

    const batches = Array.from(groupMap.values())
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit)

    return { success: true, data: batches }
  } catch (error) {
    console.error('查询委托单通知异常:', error)
    return { success: false, error: '查询时发生未知错误' }
  }
}

export interface ManageNotificationResult {
  success: boolean
  error?: string
}

/**
 * 超管（uid=10001）静默修改已发送公告
 *
 * 静默：仅更新 title/content，不改动任何收件人的 is_read/read_at，
 * 用户已读状态保持不变（下次看到的是新内容，但不产生新通知）。
 *
 * 安全：CSRF → 超管鉴权 → 速率限制 → 输入校验
 */
export async function updateSentNotification(input: {
  batchId: string
  title: string
  content: string
}): Promise<ManageNotificationResult> {
  // 1) CSRF 保护（最先）
  const csrfError = await validateCsrf()
  if (csrfError) {
    return { success: false, error: csrfError }
  }

  // 2) 鉴权：仅超级管理员（uid=10001）
  const authResult = await requireZeroUser()
  if (!authResult.success) {
    return { success: false, error: authResult.error }
  }

  // 3) 速率限制
  const ip = await getClientIp()
  const rateLimitResult = await checkRateLimit(
    `admin-notify:${ip}`,
    RATE_LIMIT_NOTIFY_MAX,
    RATE_LIMIT_NOTIFY_WINDOW
  )
  if (!rateLimitResult.allowed) {
    return { success: false, error: '操作过于频繁，请稍后再试' }
  }

  // 4) 输入校验
  const validationError = validateNotificationInput(input.title, input.content)
  if (validationError) {
    return { success: false, error: validationError }
  }

  // 5) 参数校验
  if (!input.batchId || typeof input.batchId !== 'string') {
    return { success: false, error: '批次参数错误' }
  }

  const admin = createAdminClient()

  try {
    // 6) 静默修改：只更新 title/content，保留 is_read/read_at
    const { data: updated, error: updateError } = await admin
      .from('notifications')
      .update({
        title: input.title.trim(),
        content: input.content.trim(),
      })
      .eq('batch_id', input.batchId)
      .select('id')

    if (updateError) {
      console.error('修改通知失败:', updateError.message)
      return { success: false, error: '修改失败，请稍后重试' }
    }
    if (!updated || updated.length === 0) {
      return { success: false, error: '未找到该批次公告' }
    }

    // 7) 审计日志（静默失败）
    try {
      await admin.from('admin_audit_log').insert({
        operator_uid: authResult.user.uid,
        operator_email: authResult.user.profile?.email ?? null,
        action: 'update_notification',
        target_uid: null,
        target_email: null,
        details: {
          batch_id: input.batchId,
          title: input.title.trim(),
          recipient_count: updated.length,
        },
      })
    } catch (auditError) {
      console.error('写入审计日志失败:', auditError)
    }

    revalidatePath('/admin/dashboard')
    return { success: true }
  } catch (error) {
    console.error('修改通知异常:', error)
    return { success: false, error: '操作时发生未知错误' }
  }
}

/**
 * 超管（uid=10001）删除已发送公告
 *
 * 删除该批次全部收件人记录（用户侧铃铛中将不再显示）。
 *
 * 安全：CSRF → 超管鉴权 → 速率限制
 */
export async function deleteSentNotification(input: {
  batchId: string
}): Promise<ManageNotificationResult> {
  // 1) CSRF 保护（最先）
  const csrfError = await validateCsrf()
  if (csrfError) {
    return { success: false, error: csrfError }
  }

  // 2) 鉴权：仅超级管理员（uid=10001）
  const authResult = await requireZeroUser()
  if (!authResult.success) {
    return { success: false, error: authResult.error }
  }

  // 3) 速率限制
  const ip = await getClientIp()
  const rateLimitResult = await checkRateLimit(
    `admin-notify:${ip}`,
    RATE_LIMIT_NOTIFY_MAX,
    RATE_LIMIT_NOTIFY_WINDOW
  )
  if (!rateLimitResult.allowed) {
    return { success: false, error: '操作过于频繁，请稍后再试' }
  }

  // 4) 参数校验
  if (!input.batchId || typeof input.batchId !== 'string') {
    return { success: false, error: '批次参数错误' }
  }

  const admin = createAdminClient()

  try {
    // 5) 删除该批次全部记录
    const { data: deleted, error: deleteError } = await admin
      .from('notifications')
      .delete()
      .eq('batch_id', input.batchId)
      .select('id')

    if (deleteError) {
      console.error('删除通知失败:', deleteError.message)
      return { success: false, error: '删除失败，请稍后重试' }
    }
    if (!deleted || deleted.length === 0) {
      return { success: false, error: '未找到该批次公告' }
    }

    // 6) 审计日志（静默失败）
    try {
      await admin.from('admin_audit_log').insert({
        operator_uid: authResult.user.uid,
        operator_email: authResult.user.profile?.email ?? null,
        action: 'delete_notification',
        target_uid: null,
        target_email: null,
        details: {
          batch_id: input.batchId,
          recipient_count: deleted.length,
        },
      })
    } catch (auditError) {
      console.error('写入审计日志失败:', auditError)
    }

    revalidatePath('/admin/dashboard')
    return { success: true }
  } catch (error) {
    console.error('删除通知异常:', error)
    return { success: false, error: '操作时发生未知错误' }
  }
}
