import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { User } from '@supabase/supabase-js'
import { refreshSession } from '@/lib/supabase/cookie-utils'
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
 * 获取当前登录用户
 *
 * 信任 cookie 中的签名 JWT（Supabase JWT 由服务端签名，无法伪造）。
 * 仅当 access_token 过期时才发起网络请求刷新，避免每次请求都调用 Supabase API。
 *
 * @returns 当前用户对象，未登录返回 null
 */
export async function getSessionUser(): Promise<User | null> {
  const supabase = await createClient()
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user?.id || !session.access_token) return null

    // 检查 token 是否过期
    const now = Math.floor(Date.now() / 1000)
    const isExpired = session.expires_at ? session.expires_at < now : false

    if (!isExpired) {
      // Token 仍然有效 — 直接返回，无需网络调用
      return session.user
    }

    // Token 已过期 — 尝试使用 refresh_token 刷新
    if (session.refresh_token) {
      // 优先使用 SSR 客户端刷新（会自动写入新 cookie）
      const { data: refreshData, error: refreshError } =
        await supabase.auth.refreshSession({
          refresh_token: session.refresh_token,
        })

      if (!refreshError && refreshData.session?.user?.id && refreshData.session.access_token) {
        return refreshData.session.user
      }

      // SSR 客户端刷新失败，尝试直接 fetch 刷新（Edge Runtime 兼容）
      const refreshedSession = await refreshSession(session.refresh_token)
      if (refreshedSession) {
        return refreshedSession.user as unknown as User
      }
    }

    return null
  } catch {
    return null
  }
}
