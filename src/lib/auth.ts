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

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { UserRole, Profile } from '@/types/database'

/** 零号用户 UID — 超级管理员，唯一可授予/撤销管理员权限的用户 */
export const ZERO_USER_UID = 10001

/** 默认角色 — 新注册用户自动获得此角色 */
export const DEFAULT_ROLE: UserRole = 'user'

/**
 * 获取当前登录用户信息（含角色）
 *
 * 注意：生产环境中 supabase.auth.getUser() 返回 "Invalid API key" 错误，
 * 改用 getSession() 从 cookie 读取会话。Profile 查询使用 admin 客户端
 * 确保 RLS 不会阻止读取。
 *
 * @returns 用户信息（userId, role, uid, profile），未登录返回 null
 */
export async function getCurrentUser(): Promise<{
  userId: string
  role: UserRole
  uid: number | null
  profile: Profile | null
} | null> {
  const supabase = await createClient()

  try {
    // 使用 getSession() 替代 getUser()
    // getUser() 在生产环境返回 "Invalid API key"，getSession() 从 cookie 读取更可靠
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session?.user) return null

    const user = session.user

    // 使用 admin 客户端查询 profile，绕过 anon key 的 API 问题
    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!profile) return null

    return {
      userId: user.id,
      role: (profile.role as UserRole) ?? DEFAULT_ROLE,
      uid: profile.uid,
      profile: profile as Profile,
    }
  } catch {
    return null
  }
}

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
  if (user.uid !== ZERO_USER_UID) {
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
