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
  verifyAccessTokenWithUser,
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
 * Cookie 外层 JSON 不可信；身份与字段一律以【JWT 验签 payload】或
 * Supabase /auth/v1/user 响应为准（verifyAccessTokenWithUser）。
 * access token 失效后尝试使用 refresh token 续期，并统一重写全部 cookie 分片。
 *
 * 安全加固（SEC-08）：不再直接返回 cookie 中的 user 对象（其 email 等字段
 * 可被攻击者篡改），而是用签名验证过的受信字段重建，杜绝身份数据伪造。
 *
 * @returns 当前用户对象，未登录返回 null
 */
export async function getSessionUser(): Promise<User | null> {
  try {
    const cookieStore = await cookies()
    const session = getSessionFromCookieValue(readSessionCookieValue(cookieStore))
    if (!session?.user?.id || !session.access_token) return null

    const verifiedUser = await verifyAccessTokenWithUser(session.access_token)
    if (verifiedUser && verifiedUser.id === session.user.id) {
      return buildTrustedUser(verifiedUser)
    }

    if (!session.refresh_token) return null

    const refreshedSession = await refreshSession(session.refresh_token)
    if (!refreshedSession) return null

    const refreshedVerified = await verifyAccessTokenWithUser(refreshedSession.access_token)
    if (!refreshedVerified || refreshedVerified.id !== refreshedSession.user.id) return null

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

    return buildTrustedUser(refreshedVerified)
  } catch (error) {
    console.error('读取或验证会话失败:', error)
    return null
  }
}

/**
 * 用【签名验证过】的受信字段重建 User 对象
 *
 * 安全加固（SEC-08）：仅使用 JWT payload / /auth/v1/user 响应中的受信字段，
 * 不信任 cookie 外层 JSON 中的任意字段。
 */
function buildTrustedUser(v: {
  id: string
  email?: string
  role?: string
  user_metadata?: Record<string, unknown>
}): User {
  const user = {
    id: v.id,
    aud: 'authenticated',
    role: v.role ?? 'authenticated',
    email: v.email ?? null,
    email_confirmed_at: null,
    phone: null,
    confirmed_at: null,
    last_sign_in_at: null,
    app_metadata: {},
    user_metadata: v.user_metadata ?? {},
    created_at: '',
    updated_at: '',
  } as unknown as User
  return user
}
