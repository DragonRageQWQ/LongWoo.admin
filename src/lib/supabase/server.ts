import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { User } from '@supabase/supabase-js'
import { verifyAccessToken, refreshSession } from '@/lib/supabase/cookie-utils'
import { COOKIE_MAX_AGE } from '@/lib/constants'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, {
              ...options,
              // 统一安全选项：确保 httpOnly 和 maxAge 一致
              httpOnly: true,
              maxAge: COOKIE_MAX_AGE,
            }))
        }
      }
    }
  )
}

/**
 * 获取当前登录用户（安全验证版）
 *
 * 安全修复：
 *   不再仅从 cookie 读取用户信息，而是通过 Supabase API 验证 access_token。
 *   使用直接 fetch 调用 /auth/v1/user，显式设置 apikey 头。
 *
 * Token 刷新机制：
 *   当 access_token 过期时，使用 refresh_token 通过 Supabase API 获取新 token。
 *   刷新后的 session 会通过 SSR 客户端的 setAll 回调自动写入 cookie。
 *
 * @returns 验证通过的用户对象，未登录或 token 无效返回 null
 */
export async function getSessionUser(): Promise<User | null> {
  const supabase = await createClient()
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user?.id || !session.access_token) return null

    // 通过 API 验证 token 有效性
    const verifiedUserId = await verifyAccessToken(session.access_token)
    if (verifiedUserId && verifiedUserId === session.user.id) {
      return session.user
    }

    // Token 可能已过期，尝试使用 refresh_token 刷新
    if (session.refresh_token) {
      // 优先使用 SSR 客户端的 refreshSession（会自动写入新 cookie）
      const { data: refreshData, error: refreshError } =
        await supabase.auth.refreshSession({
          refresh_token: session.refresh_token,
        })

      if (!refreshError && refreshData.session?.user?.id && refreshData.session.access_token) {
        const refreshedUserId = await verifyAccessToken(refreshData.session.access_token)
        if (refreshedUserId && refreshedUserId === refreshData.session.user.id) {
          return refreshData.session.user
        }
      }

      // SSR 客户端刷新失败，尝试直接 fetch 刷新（Edge Runtime 兼容）
      const refreshedSession = await refreshSession(session.refresh_token)
      if (refreshedSession) {
        const refreshedUserId = await verifyAccessToken(refreshedSession.access_token)
        if (refreshedUserId && refreshedUserId === refreshedSession.user.id) {
          return refreshedSession.user as unknown as User
        }
      }
    }

    return null
  } catch {
    return null
  }
}
