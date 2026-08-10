'use server'

import { revalidatePath } from 'next/cache'
import { getSessionUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit } from '@/lib/rate-limit'
import { validateCsrf } from '@/lib/csrf'
import { requireAdmin, requireUser } from '@/lib/auth'
import { getClientIp } from '@/lib/server-utils'
import { MAX_PAGE_LIMIT, RATE_LIMIT_FEEDBACK_WINDOW, RATE_LIMIT_FEEDBACK_MAX, RATE_LIMIT_FEEDBACK_REPLY_WINDOW, RATE_LIMIT_FEEDBACK_REPLY_MAX } from '@/lib/constants'
import type { FeedbackCategory, FeedbackStatus, UserFeedback } from '@/types/database'

// ==================== 用户端：提交反馈 ====================

export async function submitFeedback(input: {
  category: FeedbackCategory
  title: string
  content: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    // CSRF 保护
    const csrfError = await validateCsrf()
    if (csrfError) {
      return { success: false, error: csrfError }
    }

    const user = await getSessionUser()
    if (!user) {
      return { success: false, error: '未登录' }
    }

    // 速率限制：防止反馈刷屏
    const ip = await getClientIp()
    const rateLimit = await checkRateLimit(
      `feedback:${user.id}:${ip}`,
      RATE_LIMIT_FEEDBACK_MAX,
      RATE_LIMIT_FEEDBACK_WINDOW
    )
    if (!rateLimit.allowed) {
      return { success: false, error: '操作过于频繁，请稍后再试' }
    }

    // 参数校验
    const category: FeedbackCategory = input.category ?? 'suggestion'
    if (!['bug', 'suggestion', 'other'].includes(category)) {
      return { success: false, error: '反馈类别无效' }
    }
    const title = (input.title || '').trim()
    if (!title || title.length > 60) {
      return { success: false, error: '标题长度需在1-60个字符之间' }
    }
    const content = (input.content || '').trim()
    if (!content || content.length > 2000) {
      return { success: false, error: '内容长度需在1-2000个字符之间' }
    }

    const admin = createAdminClient()
    const { error } = await admin.from('user_feedback').insert({
      user_id: user.id,
      category,
      title,
      content,
      status: 'pending',
      reply_read: false,
    })

    if (error) {
      console.error('[submitFeedback] Insert failed:', error.message)
      return { success: false, error: '提交失败，请稍后重试' }
    }

    revalidatePath('/profile')
    return { success: true }
  } catch (error) {
    console.error('[submitFeedback] Exception:', error)
    return { success: false, error: '操作时发生未知错误' }
  }
}

// ==================== 用户端：查询我的反馈 ====================

export async function listMyFeedback(limit = 20): Promise<{
  success: boolean
  data?: UserFeedback[]
  error?: string
}> {
  try {
    const user = await getSessionUser()
    if (!user) {
      return { success: false, error: '未登录' }
    }
    const safeLimit = Math.min(Math.max(1, limit), MAX_PAGE_LIMIT)

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('user_feedback')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(safeLimit)

    if (error) {
      console.error('[listMyFeedback] Query failed:', error.message)
      return { success: false, error: '加载反馈失败' }
    }

    return { success: true, data: (data || []) as UserFeedback[] }
  } catch (error) {
    console.error('[listMyFeedback] Exception:', error)
    return { success: false, error: '操作时发生未知错误' }
  }
}

// ==================== 用户端：未读回复计数（红标） ====================

export async function getFeedbackUnreadCount(): Promise<{
  success: boolean
  unreadCount?: number
  error?: string
}> {
  try {
    const user = await getSessionUser()
    if (!user) {
      return { success: false, error: '未登录' }
    }

    const admin = createAdminClient()
    const { count, error } = await admin
      .from('user_feedback')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('status', ['replied', 'adopted'])
      .eq('reply_read', false)

    if (error) {
      console.error('[getFeedbackUnreadCount] Query failed:', error.message)
      return { success: false, error: '加载未读数失败' }
    }

    return { success: true, unreadCount: count ?? 0 }
  } catch (error) {
    console.error('[getFeedbackUnreadCount] Exception:', error)
    return { success: false, error: '操作时发生未知错误' }
  }
}

// ==================== 用户端：标记回复已读 ====================

export async function markFeedbackReplyRead(
  feedbackId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const csrfError = await validateCsrf()
    if (csrfError) {
      return { success: false, error: csrfError }
    }

    const user = await getSessionUser()
    if (!user) {
      return { success: false, error: '未登录' }
    }

    if (!feedbackId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(feedbackId)) {
      return { success: false, error: '参数无效' }
    }

    const admin = createAdminClient()
    // 仅当存在未读回复时才更新（避免无谓写操作）
    const { data: row } = await admin
      .from('user_feedback')
      .select('id')
      .eq('id', feedbackId)
      .eq('user_id', user.id)
      .in('status', ['replied', 'adopted'])
      .eq('reply_read', false)
      .maybeSingle()

    if (!row) {
      return { success: true } // 无未读回复，幂等成功
    }

    const { error } = await admin
      .from('user_feedback')
      .update({ reply_read: true })
      .eq('id', feedbackId)
      .eq('user_id', user.id)

    if (error) {
      console.error('[markFeedbackReplyRead] Update failed:', error.message)
      return { success: false, error: '操作失败，请稍后重试' }
    }

    revalidatePath('/profile')
    return { success: true }
  } catch (error) {
    console.error('[markFeedbackReplyRead] Exception:', error)
    return { success: false, error: '操作时发生未知错误' }
  }
}

// ==================== 管理员端：反馈列表（分页 + 状态筛选） ====================

export type FeedbackListFilter = 'all' | FeedbackStatus

export async function listAllFeedback(params: {
  offset?: number
  limit?: number
  status?: FeedbackListFilter
  search?: string
}): Promise<{
  success: boolean
  data?: UserFeedback[]
  total?: number
  error?: string
}> {
  try {
    const authResult = await requireAdmin()
    if (!authResult.success) {
      return { success: false, error: authResult.error || '无权限' }
    }

    const offset = Math.max(0, params.offset ?? 0)
    const limit = Math.min(Math.max(1, params.limit ?? 10), MAX_PAGE_LIMIT)
    const status = params.status ?? 'all'
    const search = (params.search || '').trim()

    const admin = createAdminClient()
    let query = admin
      .from('user_feedback')
      .select('*', { count: 'exact' })

    if (status !== 'all') {
      query = query.eq('status', status)
    }
    if (search) {
      // 搜索标题/内容（防注入转义由 PostgREST 处理；仅做基本清洗）
      const safe = search.replace(/%/g, '\\%').replace(/_/g, '\\_')
      query = query.or(`title.ilike.%${safe}%,content.ilike.%${safe}%`)
    }

    query = query.order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data, count, error } = await query

    if (error) {
      console.error('[listAllFeedback] Query failed:', error.message)
      return { success: false, error: '加载反馈列表失败' }
    }

    // 关联提交人信息（user_feedback.user_id 外键指向 auth.users，
    // PostgREST 无法直接 join profiles，故分两次查询后服务端组装）
    type FeedbackAuthor = NonNullable<UserFeedback['profiles']>
    const feedbackRows = (data || []) as UserFeedback[]
    const userIds = [...new Set(feedbackRows.map((f) => f.user_id).filter(Boolean))]
    const profilesMap: Record<string, FeedbackAuthor> = {}
    if (userIds.length > 0) {
      const { data: profiles } = await admin
        .from('profiles')
        .select('id, uid, email, display_name, avatar_url')
        .in('id', userIds)
      for (const p of (profiles as FeedbackAuthor[]) || []) {
        profilesMap[p.id] = p
      }
    }
    const enriched = feedbackRows.map((f) => ({ ...f, profiles: profilesMap[f.user_id] ?? null }))

    return { success: true, data: enriched, total: count ?? 0 }
  } catch (error) {
    console.error('[listAllFeedback] Exception:', error)
    return { success: false, error: '操作时发生未知错误' }
  }
}

// ==================== 管理员端：回复 / 采纳 ====================

export async function replyFeedback(params: {
  feedbackId: string
  reply: string
  status: Extract<FeedbackStatus, 'replied' | 'adopted'>
}): Promise<{ success: boolean; error?: string }> {
  try {
    const csrfError = await validateCsrf()
    if (csrfError) {
      return { success: false, error: csrfError }
    }

    const authResult = await requireAdmin()
    if (!authResult.success) {
      return { success: false, error: authResult.error || '无权限' }
    }

    const ip = await getClientIp()
    const rateLimit = await checkRateLimit(
      `feedbackreply:${ip}`,
      RATE_LIMIT_FEEDBACK_REPLY_MAX,
      RATE_LIMIT_FEEDBACK_REPLY_WINDOW
    )
    if (!rateLimit.allowed) {
      return { success: false, error: '操作过于频繁，请稍后再试' }
    }

    const { feedbackId, reply, status } = params
    if (!feedbackId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(feedbackId)) {
      return { success: false, error: '参数无效' }
    }
    if (!['replied', 'adopted'].includes(status)) {
      return { success: false, error: '状态无效' }
    }
    const replyText = (reply || '').trim()
    if (!replyText || replyText.length > 2000) {
      return { success: false, error: '回复内容长度需在1-2000个字符之间' }
    }

    const admin = createAdminClient()
    const { error } = await admin
      .from('user_feedback')
      .update({
        status,
        reply: replyText,
        replied_by: authResult.user.userId,
        replied_at: new Date().toISOString(),
        reply_read: false, // 新回复 → 用户端红标
        updated_at: new Date().toISOString(),
      })
      .eq('id', feedbackId)

    if (error) {
      console.error('[replyFeedback] Update failed:', error.message)
      return { success: false, error: '回复失败，请稍后重试' }
    }

    revalidatePath('/admin/dashboard')
    return { success: true }
  } catch (error) {
    console.error('[replyFeedback] Exception:', error)
    return { success: false, error: '操作时发生未知错误' }
  }
}

// ==================== 管理员端：未处理反馈计数（侧边栏/概览可选） ====================

export async function getPendingFeedbackCount(): Promise<{
  success: boolean
  count?: number
  error?: string
}> {
  try {
    const authResult = await requireUser()
    if (!authResult.success) {
      return { success: false, error: '未登录' }
    }

    const admin = createAdminClient()
    const { count, error } = await admin
      .from('user_feedback')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')

    if (error) {
      return { success: false, error: '加载失败' }
    }
    return { success: true, count: count ?? 0 }
  } catch (error) {
    console.error('[getPendingFeedbackCount] Exception:', error)
    return { success: false, error: '操作时发生未知错误' }
  }
}
