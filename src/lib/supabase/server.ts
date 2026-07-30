import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { User } from '@supabase/supabase-js'
import { verifyAccessToken } from '@/lib/supabase/cookie-utils'

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
            cookieStore.set(name, value, options))
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
 * @returns 验证通过的用户对象，未登录或 token 无效返回 null
 */
export async function getSessionUser(): Promise<User | null> {
  const supabase = await createClient()
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user?.id || !session.access_token) return null

    // 通过 API 验证 token 有效性
    const verifiedUserId = await verifyAccessToken(session.access_token)
    if (!verifiedUserId || verifiedUserId !== session.user.id) return null

    return session.user
  } catch {
    return null
  }
}
