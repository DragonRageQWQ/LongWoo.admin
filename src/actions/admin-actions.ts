'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireZeroUser, requireAdmin, ZERO_USER_UID } from '@/lib/auth'
import { validateCsrf } from '@/lib/csrf'
import { checkRateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/server-utils'
import { MAX_PAGE_LIMIT } from '@/lib/constants'
import { escapePostgrestKeyword, escapeIlikeKeyword } from '@/lib/postgrest-utils'
import { buildUserListMeta, type UserListMeta } from '@/lib/admin-meta'
import { isUserTag, sanitizeTags, type UserTagKey, USER_TAG_LABELS } from '@/lib/user-tags'
import type { Profile, UserRole } from '@/types/database'

// ==================== 零号用户专属操作 ====================
//
// 以下操作仅限零号用户（uid=10001）执行：
// - grantAdminRole: 授予管理员权限
// - revokeAdminRole: 撤销管理员权限
//
// 防越级措施：
// 1. 服务端通过 requireZeroUser() 验证调用者身份
// 2. 使用 admin 客户端（service_role）执行数据库操作
// 3. 零号用户自身权限不可被撤销（防自锁）
// 4. 所有操作记录到 admin_audit_log 审计表
// ====================

interface AdminActionResult {
  success: boolean
  error?: string
}

/**
 * 授予指定用户管理员权限
 * 仅零号用户（uid=10001）可调用
 *
 * @param targetUid 目标用户 UID
 */
export async function grantAdminRole(targetUid: number): Promise<AdminActionResult> {
  // CSRF 保护
  const csrfError = await validateCsrf()
  if (csrfError) {
    return { success: false, error: csrfError }
  }

  // 鉴权：仅零号用户可操作
  const authResult = await requireZeroUser()
  if (!authResult.success) {
    return { success: false, error: authResult.error }
  }

  // 安全加固（SEC-11）：权限授予限速（防滥用/防账号被盗后批量提权）
  const ip = await getClientIp()
  const rateLimit = await checkRateLimit(
    `grantadmin:${ip}`,
    10,
    60 * 1000
  )
  if (!rateLimit.allowed) {
    return { success: false, error: '操作过于频繁，请稍后再试' }
  }

  const operator = authResult.user

  // 不能对自己操作（已经是超级管理员）
  if (targetUid === ZERO_USER_UID) {
    return { success: false, error: '无需为自己授予管理员权限' }
  }

  const admin = createAdminClient()

  try {
    // 查询目标用户
    const { data: targetUser, error: fetchError } = await admin
      .from('profiles')
      .select('id, uid, email, display_name, role')
      .eq('uid', targetUid)
      .single()

    if (fetchError || !targetUser) {
      return { success: false, error: '未找到该用户' }
    }

    // 已经是管理员
    if (targetUser.role === 'admin') {
      return { success: false, error: '该用户已经是管理员' }
    }

    // 使用 admin 客户端更新角色（绕过 RLS 和触发器）
    const { error: updateError } = await admin
      .from('profiles')
      .update({
        role: 'admin' as UserRole,
        updated_at: new Date().toISOString(),
      })
      .eq('uid', targetUid)

    if (updateError) {
      console.error('授予管理员权限失败:', updateError.message)
      return { success: false, error: '操作失败，请稍后重试' }
    }

    // 记录审计日志
    await admin.from('admin_audit_log').insert({
      operator_uid: operator.uid,
      operator_email: operator.profile?.email ?? null,
      action: 'grant_admin',
      target_uid: targetUid,
      target_email: targetUser.email,
      details: {
        target_display_name: targetUser.display_name,
        before_role: targetUser.role,
        after_role: 'admin',
      },
    })

    revalidatePath('/admin/dashboard')
    return { success: true }
  } catch (error) {
    console.error('授予管理员权限异常:', error)
    return { success: false, error: '操作时发生未知错误' }
  }
}

/**
 * 撤销指定用户管理员权限
 * 仅零号用户（uid=10001）可调用
 *
 * @param targetUid 目标用户 UID
 */
export async function revokeAdminRole(targetUid: number): Promise<AdminActionResult> {
  // CSRF 保护
  const csrfError = await validateCsrf()
  if (csrfError) {
    return { success: false, error: csrfError }
  }

  // 鉴权：仅零号用户可操作
  const authResult = await requireZeroUser()
  if (!authResult.success) {
    return { success: false, error: authResult.error }
  }

  // 安全加固（SEC-11）：权限撤销限速（防滥用）
  const ip = await getClientIp()
  const rateLimit = await checkRateLimit(
    `revokeadmin:${ip}`,
    10,
    60 * 1000
  )
  if (!rateLimit.allowed) {
    return { success: false, error: '操作过于频繁，请稍后再试' }
  }

  const operator = authResult.user

  // 防自锁：零号用户不能撤销自己的权限
  if (targetUid === ZERO_USER_UID) {
    return { success: false, error: '不能撤销自己的超级管理员权限' }
  }

  const admin = createAdminClient()

  try {
    // 查询目标用户
    const { data: targetUser, error: fetchError } = await admin
      .from('profiles')
      .select('id, uid, email, display_name, role')
      .eq('uid', targetUid)
      .single()

    if (fetchError || !targetUser) {
      return { success: false, error: '未找到该用户' }
    }

    // 不是管理员
    if (targetUser.role !== 'admin') {
      return { success: false, error: '该用户不是管理员' }
    }

    // 使用 admin 客户端更新角色
    const { error: updateError } = await admin
      .from('profiles')
      .update({
        role: 'user' as UserRole,
        updated_at: new Date().toISOString(),
      })
      .eq('uid', targetUid)

    if (updateError) {
      console.error('撤销管理员权限失败:', updateError.message)
      return { success: false, error: '操作失败，请稍后重试' }
    }

    // 记录审计日志
    await admin.from('admin_audit_log').insert({
      operator_uid: operator.uid,
      operator_email: operator.profile?.email ?? null,
      action: 'revoke_admin',
      target_uid: targetUid,
      target_email: targetUser.email,
      details: {
        target_display_name: targetUser.display_name,
        before_role: targetUser.role,
        after_role: 'user',
      },
    })

    revalidatePath('/admin/dashboard')
    return { success: true }
  } catch (error) {
    console.error('撤销管理员权限异常:', error)
    return { success: false, error: '操作时发生未知错误' }
  }
}

// ==================== 管理员查询操作 ====================

/**
 * 获取所有用户列表（分页）
 * 仅管理员可调用
 */
export async function listAllUsers(options?: {
  search?: string
  roleFilter?: 'all' | 'user' | 'admin'
  offset?: number
  limit?: number
}): Promise<{
  success: boolean
  data?: Array<Pick<Profile, 'id' | 'uid' | 'email' | 'role' | 'display_name' | 'avatar_url' | 'is_active' | 'created_at' | 'tags'>>
  total?: number
  meta?: UserListMeta
  error?: string
}> {
  // 鉴权：仅管理员可调用
  const authResult = await requireAdmin()
  if (!authResult.success) {
    return { success: false, error: authResult.error }
  }

  // 性能优化：与列表查询并行下发权限元数据，客户端无需
  // 再单独调用 checkIsZeroUser，消除"权限检查→拉列表"瀑布。
  const meta = buildUserListMeta(authResult.user.uid, authResult.user.role)

  const admin = createAdminClient()
  const offset = options?.offset ?? 0
  const limit = Math.min(options?.limit ?? 20, MAX_PAGE_LIMIT)

  try {
    // 性能优化：移除前端未使用的 has_password 字段，减少传输
    let query = admin
      .from('profiles')
      .select('id, uid, email, role, display_name, avatar_url, is_active, created_at, tags', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // 角色筛选
    if (options?.roleFilter && options.roleFilter !== 'all') {
      query = query.eq('role', options.roleFilter)
    }

    // 关键词搜索（转义防止 PostgREST 注入 + ilike 通配符注入）
    if (options?.search && options.search.trim()) {
      const keyword = escapeIlikeKeyword(escapePostgrestKeyword(options.search.trim()))
      query = query.or(`email.ilike.%${keyword}%,display_name.ilike.%${keyword}%`)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('查询用户列表失败:', error.message)
      return { success: false, error: '查询失败，请稍后重试' }
    }

    return {
      success: true,
      data: data as Array<Pick<Profile, 'id' | 'uid' | 'email' | 'role' | 'display_name' | 'avatar_url' | 'is_active' | 'created_at' | 'tags'>>,
      total: count ?? 0,
      meta,
    }
  } catch (error) {
    console.error('查询用户列表异常:', error)
    return { success: false, error: '查询时发生未知错误' }
  }
}

/**
 * 获取管理员审计日志
 * 仅零号用户可查看完整审计日志
 */
export async function getAdminAuditLog(options?: {
  offset?: number
  limit?: number
}): Promise<{
  success: boolean
  data?: Array<{
    id: string
    operator_uid: number
    operator_email: string | null
    action: string
    target_uid: number | null
    target_email: string | null
    details: Record<string, unknown> | null
    created_at: string
  }>
  total?: number
  error?: string
}> {
  // 鉴权：仅零号用户可查看审计日志
  const authResult = await requireZeroUser()
  if (!authResult.success) {
    return { success: false, error: authResult.error }
  }

  const admin = createAdminClient()
  const offset = options?.offset ?? 0
  const limit = Math.min(options?.limit ?? 20, MAX_PAGE_LIMIT)

  try {
    const { data, error, count } = await admin
      .from('admin_audit_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('查询审计日志失败:', error.message)
      return { success: false, error: '查询失败，请稍后重试' }
    }

    return {
      success: true,
      data: data || [],
      total: count ?? 0,
    }
  } catch (error) {
    console.error('查询审计日志异常:', error)
    return { success: false, error: '查询时发生未知错误' }
  }
}

// ==================== 用户标签（tag）操作 ====================
//
// 标签体系（全部仅零号用户 uid=10001 可执行）：
//   blacklist 拉黑（软封禁） / ban 硬封禁 / testA~D 测试 / vip / svip
//
// 安全措施：
// 1. requireZeroUser() 服务端验证调用者身份
// 2. 标签白名单校验（sanitizeTags），拒绝任意字符串注入
// 3. 操作者不能修改自己的标签（self-protect，防自解封）
// 4. 操作记录到 admin_audit_log 审计表
// ====================

/**
 * 为指定用户添加标签（幂等：已存在则忽略）
 * 仅零号用户可调用
 */
export async function addUserTag(targetUid: number, tag: string): Promise<AdminActionResult> {
  // CSRF 保护
  const csrfError = await validateCsrf()
  if (csrfError) {
    return { success: false, error: csrfError }
  }

  // 鉴权：仅零号用户可操作
  const authResult = await requireZeroUser()
  if (!authResult.success) {
    return { success: false, error: authResult.error }
  }

  // 标签白名单校验
  if (!isUserTag(tag)) {
    return { success: false, error: '非法的标签类型' }
  }
  const tagKey = tag as UserTagKey

  // 安全：操作者不能修改自己的标签（防自解封）
  if (targetUid === ZERO_USER_UID) {
    return { success: false, error: '不能修改自己的标签' }
  }

  const operator = authResult.user
  const admin = createAdminClient()

  try {
    // 查询目标用户当前标签
    const { data: targetUser, error: fetchError } = await admin
      .from('profiles')
      .select('id, uid, email, display_name, tags')
      .eq('uid', targetUid)
      .single()

    if (fetchError || !targetUser) {
      return { success: false, error: '未找到该用户' }
    }

    const currentTags = sanitizeTags(targetUser.tags)
    if (currentTags.includes(tagKey)) {
      return { success: true } // 已存在，幂等返回
    }

    const newTags = [...currentTags, tagKey]
    const { error: updateError } = await admin
      .from('profiles')
      .update({
        tags: newTags,
        updated_at: new Date().toISOString(),
      })
      .eq('uid', targetUid)

    if (updateError) {
      console.error('添加用户标签失败:', updateError.message)
      return { success: false, error: '操作失败，请稍后重试' }
    }

    // 审计日志
    await admin.from('admin_audit_log').insert({
      operator_uid: operator.uid,
      operator_email: operator.profile?.email ?? null,
      action: 'add_user_tag',
      target_uid: targetUid,
      target_email: targetUser.email,
      details: {
        tag: tagKey,
        tag_label: USER_TAG_LABELS[tagKey],
        target_display_name: targetUser.display_name,
      },
    })

    revalidatePath('/admin/dashboard')
    return { success: true }
  } catch (error) {
    console.error('添加用户标签异常:', error)
    return { success: false, error: '操作时发生未知错误' }
  }
}

/**
 * 移除指定用户的标签
 * 仅零号用户可调用
 */
export async function removeUserTag(targetUid: number, tag: string): Promise<AdminActionResult> {
  // CSRF 保护
  const csrfError = await validateCsrf()
  if (csrfError) {
    return { success: false, error: csrfError }
  }

  // 鉴权：仅零号用户可操作
  const authResult = await requireZeroUser()
  if (!authResult.success) {
    return { success: false, error: authResult.error }
  }

  // 标签白名单校验
  if (!isUserTag(tag)) {
    return { success: false, error: '非法的标签类型' }
  }
  const tagKey = tag as UserTagKey

  // 安全：操作者不能修改自己的标签
  if (targetUid === ZERO_USER_UID) {
    return { success: false, error: '不能修改自己的标签' }
  }

  const operator = authResult.user
  const admin = createAdminClient()

  try {
    const { data: targetUser, error: fetchError } = await admin
      .from('profiles')
      .select('id, uid, email, display_name, tags')
      .eq('uid', targetUid)
      .single()

    if (fetchError || !targetUser) {
      return { success: false, error: '未找到该用户' }
    }

    const currentTags = sanitizeTags(targetUser.tags)
    if (!currentTags.includes(tagKey)) {
      return { success: true } // 不存在，幂等返回
    }

    const newTags = currentTags.filter((t) => t !== tagKey)
    const { error: updateError } = await admin
      .from('profiles')
      .update({
        tags: newTags,
        updated_at: new Date().toISOString(),
      })
      .eq('uid', targetUid)

    if (updateError) {
      console.error('移除用户标签失败:', updateError.message)
      return { success: false, error: '操作失败，请稍后重试' }
    }

    // 审计日志
    await admin.from('admin_audit_log').insert({
      operator_uid: operator.uid,
      operator_email: operator.profile?.email ?? null,
      action: 'remove_user_tag',
      target_uid: targetUid,
      target_email: targetUser.email,
      details: {
        tag: tagKey,
        tag_label: USER_TAG_LABELS[tagKey],
        target_display_name: targetUser.display_name,
      },
    })

    revalidatePath('/admin/dashboard')
    return { success: true }
  } catch (error) {
    console.error('移除用户标签异常:', error)
    return { success: false, error: '操作时发生未知错误' }
  }
}
