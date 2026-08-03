'use server'

import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, requireZeroUser } from '@/lib/auth'
import { validateCsrf } from '@/lib/csrf'
import { checkRateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/server-utils'
import {
  validateNotificationInput,
  resolveTargetRoleFilter,
  buildNotificationRows,
  type NotificationTargetRole,
} from '@/lib/notification-utils'
import { RATE_LIMIT_NOTIFY_MAX, RATE_LIMIT_NOTIFY_WINDOW } from '@/lib/constants'

// 批量插入分块大小（避免单次请求过大）
const INSERT_CHUNK_SIZE = 100

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
 *   - admin ：全体管理员
 *   - user  ：全体普通成员
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
  const target = resolveTargetRoleFilter(input.targetRole)
  if (!target.ok) {
    return { success: false, error: target.error }
  }

  const admin = createAdminClient()

  try {
    // 6) 查询目标用户列表
    let targetQuery = admin.from('profiles').select('id, is_active')
    if (target.query.kind === 'eq') {
      targetQuery = targetQuery.eq('role', target.query.value)
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

    const rows = buildNotificationRows({
      targetUserIds: activeTargets.map((t) => t.id),
      senderUserId: operator.userId,
      targetRole: input.targetRole,
      title,
      content,
      batchId,
      createdAt: now,
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

/**
 * 查询当前用户的通知列表（供管理后台历史记录使用，按发送时间倒序）
 * 仅管理员可调用
 */
export async function listSentNotifications(options?: {
  limit?: number
}): Promise<{
  success: boolean
  data?: Array<{
    id: string
    batch_id: string | null
    title: string
    target_role: NotificationTargetRole
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
    // 读取审计日志中的发送记录（按时间倒序）
    const { data, error } = await admin
      .from('admin_audit_log')
      .select('*')
      .eq('action', 'send_notification')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('查询发送记录失败:', error.message)
      return { success: false, error: '查询失败，请稍后重试' }
    }

    return {
      success: true,
      data: (data ?? []).map((log) => ({
        id: log.id,
        batch_id: ((log.details as Record<string, unknown> | null)?.batch_id as string) ?? null,
        title: (log.details as Record<string, unknown> | null)?.title as string ?? '通知',
        target_role: ((log.details as Record<string, unknown> | null)?.target_role ?? 'all') as NotificationTargetRole,
        recipient_count: ((log.details as Record<string, unknown> | null)?.recipient_count as number) ?? 0,
        created_at: log.created_at,
      })),
    }
  } catch (error) {
    console.error('查询发送记录异常:', error)
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
