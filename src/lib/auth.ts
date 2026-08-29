/**
 * 统一权限工具模块
 *
 * 三级权限体系：
 *   游客 (guest)   - 未登录，仅可浏览公开页面、提交委托
 *   普通用户 (user) - 已登录，role='user'，可管理个人信息和查看自己的订单
 *   管理员 (admin)  - 已登录，role='admin'，可访问管理后台和工作台
 *
 * 零号用户 (uid=10001) 是超级管理员，可授予/撤销其他用户的管理员权限
 */

import { cache } from 'react'
import { createClient, getSessionUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ZERO_USER_UID as CONST_ZERO_USER_UID } from '@/lib/constants'
import { hasUserTag } from '@/lib/user-tags'
import type { UserRole, Profile } from '@/types/database'

/** 零号用户 UID — 超级管理员，唯一可授予/撤销管理员权限的用户 */
export const ZERO_USER_UID = CONST_ZERO_USER_UID

/** 默认角色 — 新注册用户自动获得此角色 */
export const DEFAULT_ROLE: UserRole = 'user'

/**
 * 获取当前登录用户信息（含角色）
 *
 * 通过 getSessionUser 验证 access token，不信任 Cookie 中的 userId。
 * 使用 React cache() 在同一请求内复用结果，避免重复查询。
 *
 * @returns 用户信息（userId, role, uid, profile），未登录返回 null
 */
export const getCurrentUser = cache(async (): Promise<{
  userId: string
  role: UserRole
  uid: number | null
  profile: Profile | null
} | null> => {
  try {
    const verifiedUser = await getSessionUser()
    if (!verifiedUser) return null

    const admin = createAdminClient()
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('*')
      .eq('id', verifiedUser.id)
      .single()

    if (profileError || !profile || profile.is_active !== true) return null

    // 硬封禁（ban）：视为未登录——已有会话立即失效，
    // 页面级 redirect 到 /login，登录接口再伪装失败（见 login route）
    if (hasUserTag(profile.tags, 'ban')) return null

    return {
      userId: verifiedUser.id,
      role: (profile.role as UserRole) ?? DEFAULT_ROLE,
      uid: profile.uid,
      profile: profile as Profile,
    }
  } catch {
    return null
  }
})

/**
 * 要求用户已登录，否则返回错误对象
 * 供 Server Actions 使用
 */
export async function requireUser(): Promise<
  | { success: true; user: { userId: string; role: UserRole; uid: number | null; profile: Profile | null } }
  | { success: false; error: string }
> {
  const user = await getCurrentUser()
  if (!user) {
    return { success: false, error: '请先登录' }
  }
  return { success: true, user }
}

/**
 * 要求用户已登录且未被拉黑（blacklist 软封禁），否则返回错误对象
 * 供"使用型"业务（下单/AI 对话/上传等）Server Actions 使用：
 * 拉黑用户可正常浏览网页，但禁止使用业务内容
 */
export async function requireUsableUser(): Promise<
  | { success: true; user: { userId: string; role: UserRole; uid: number | null; profile: Profile | null } }
  | { success: false; error: string }
> {
  const user = await getCurrentUser()
  if (!user) {
    return { success: false, error: '请先登录' }
  }
  if (hasUserTag(user.profile?.tags, 'blacklist')) {
    return { success: false, error: '账户已被限制使用，请联系管理员' }
  }
  return { success: true, user }
}

/**
 * 要求用户是管理员，否则返回错误对象
 * 供 Server Actions 使用
 */
export async function requireAdmin(): Promise<
  | { success: true; user: { userId: string; role: UserRole; uid: number | null; profile: Profile | null } }
  | { success: false; error: string }
> {
  const user = await getCurrentUser()
  if (!user) {
    return { success: false, error: '请先登录' }
  }
  if (user.role !== 'admin') {
    return { success: false, error: '无权访问，仅管理员可执行此操作' }
  }
  return { success: true, user }
}

/**
 * 要求用户是零号用户（超级管理员），否则返回错误对象
 * 仅零号用户可授予/撤销管理员权限
 */
export async function requireZeroUser(): Promise<
  | { success: true; user: { userId: string; role: UserRole; uid: number | null; profile: Profile | null } }
  | { success: false; error: string }
> {
  const user = await getCurrentUser()
  if (!user) {
    return { success: false, error: '请先登录' }
  }
  if (user.uid !== ZERO_USER_UID || user.role !== 'admin' || user.profile?.is_active !== true) {
    return { success: false, error: '无权操作，仅超级管理员可执行此操作' }
  }
  return { success: true, user }
}

/**
 * 检查用户是否为零号用户
 */
export function isZeroUser(uid: number | null): boolean {
  return uid === ZERO_USER_UID
}

/**
 * 验证当前用户是否有权操作指定订单
 *
 * 权限规则：
 * - admin 角色可操作所有订单
 * - user 角色只能操作分配给自己的订单（studio_user_id 匹配）
 * - 对于 pending/estimated 状态的订单（尚未分配），user 也可操作（估价、接单）
 */
export async function canUserAccessOrder(
  orderId: string,
  userId: string,
  role: UserRole
): Promise<boolean> {
  if (role === 'admin') return true

  const supabase = await createClient()

  const { data: order } = await supabase
    .from('orders')
    .select('status, studio_user_id')
    .eq('id', orderId)
    .single()

  if (!order) return false

  // 订单已分配给某个用户，检查是否是当前用户
  if (order.studio_user_id) {
    return order.studio_user_id === userId
  }

  // 订单尚未分配（pending/estimated 状态），允许用户操作
  return order.status === 'pending' || order.status === 'estimated'
}

/**
 * 验证当前用户是否有权【查看】指定订单的完整详情（含附件/回复/操作日志）
 *
 * 安全加固（SEC-03）：将"可接单/估价"与"可查看完整详情"权限分离。
 * 未分配订单（pending/estimated）对所有登录用户开放操作（接单池），
 * 但完整详情（客户隐私、设计稿附件、内部回复与日志）仅限：
 * - admin 角色
 * - 该订单已分配的工作室成员（studio_user_id 匹配）
 *
 * 防止任意登录用户枚举订单 UUID 窃取客户隐私数据（IDOR）。
 */
export async function canViewOrderDetail(
  orderId: string,
  userId: string,
  role: UserRole
): Promise<boolean> {
  if (role === 'admin') return true

  const supabase = await createClient()

  const { data: order } = await supabase
    .from('orders')
    .select('status, studio_user_id')
    .eq('id', orderId)
    .single()

  if (!order) return false

  // 仅已分配给本人的订单可查看完整详情
  if (order.studio_user_id) {
    return order.studio_user_id === userId
  }

  // 未分配订单：不得查看完整详情（避免客户隐私泄露）
  return false
}
