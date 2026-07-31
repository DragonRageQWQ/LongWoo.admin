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
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { refreshSession } from '@/lib/supabase/cookie-utils'
import { ZERO_USER_UID as CONST_ZERO_USER_UID } from '@/lib/constants'
import type { UserRole, Profile } from '@/types/database'

/** 零号用户 UID — 超级管理员，唯一可授予/撤销管理员权限的用户 */
export const ZERO_USER_UID = CONST_ZERO_USER_UID

/** 默认角色 — 新注册用户自动获得此角色 */
export const DEFAULT_ROLE: UserRole = 'user'

/**
 * 获取当前登录用户信息（含角色）
 *
 * 信任 cookie 中的签名 JWT，仅在 token 过期时发起网络请求刷新。
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
    const supabase = await createClient()

    // Step 1: 从 cookie 读取 session
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user?.id || !session.access_token) return null

    // Step 2: 检查 token 是否过期
    const now = Math.floor(Date.now() / 1000)
    const isExpired = session.expires_at ? session.expires_at < now : false

    let userId = session.user.id

    if (isExpired && session.refresh_token) {
      // Token 已过期 — 尝试刷新
      // 优先使用 SSR 客户端刷新（会自动写入新 cookie）
      const { data: refreshData, error: refreshError } =
        await supabase.auth.refreshSession({
          refresh_token: session.refresh_token,
        })

      if (!refreshError && refreshData.session?.user?.id && refreshData.session.access_token) {
        userId = refreshData.session.user.id
      } else {
        // SSR 客户端刷新失败，尝试直接 fetch 刷新
        const refreshedSession = await refreshSession(session.refresh_token)
        if (refreshedSession) {
          userId = refreshedSession.user.id
        } else {
          return null
        }
      }
    }

    // Step 3: 使用 admin 客户端查询 profile
    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (!profile) return null

    return {
      userId,
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
