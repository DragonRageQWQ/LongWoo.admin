import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { User } from '@supabase/supabase-js'
import {
  encodeSessionCookie,
  getSessionCookieNames,
  getSessionFromCookieValue,
  readSessionCookieValue,
  refreshSession,
  SECURE_COOKIE_OPTIONS,
  verifyAccessToken,
} from '@/lib/supabase/cookie-utils'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                ...SECURE_COOKIE_OPTIONS,
              }))
          } catch {
            // Server Component 渲染阶段不能写 cookie；Route Handler/Middleware 负责刷新。
          }
        }
      }
    }
  )
}

/**
 * 获取当前登录用户
 *
 * Cookie 外层 JSON 不可信；身份始终以 Supabase /auth/v1/user 的验证结果为准。
 * access token 失效后尝试使用 refresh token 续期，并统一重写全部 cookie 分片。
 *
 * @returns 当前用户对象，未登录返回 null
 */
export async function getSessionUser(): Promise<User | null> {
  try {
    const cookieStore = await cookies()
    const session = getSessionFromCookieValue(readSessionCookieValue(cookieStore))
    if (!session?.user?.id || !session.access_token) return null

    const verifiedUserId = await verifyAccessToken(session.access_token)
    if (verifiedUserId && verifiedUserId === session.user.id) {
      return session.user as unknown as User
    }

    if (!session.refresh_token) return null

    const refreshedSession = await refreshSession(session.refresh_token)
    if (!refreshedSession) return null

    const refreshedUserId = await verifyAccessToken(refreshedSession.access_token)
    if (!refreshedUserId || refreshedUserId !== refreshedSession.user.id) return null

    try {
      const oldCookieNames = getSessionCookieNames(cookieStore.getAll())
      oldCookieNames.forEach(name => cookieStore.set(name, '', {
        ...SECURE_COOKIE_OPTIONS,
        maxAge: 0,
      }))
      encodeSessionCookie(refreshedSession).forEach(({ name, value }) =>
        cookieStore.set(name, value, SECURE_COOKIE_OPTIONS))
    } catch {
      // 只读渲染阶段不能写 cookie；当前请求仍使用已验证的新 session。
    }

    return refreshedSession.user as unknown as User
  } catch (error) {
    console.error('读取或验证会话失败:', error)
    return null
  }
}
