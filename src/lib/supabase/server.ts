import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { User } from '@supabase/supabase-js'

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
 * 获取当前登录用户（从 session cookie 读取）
 *
 * 生产环境中 supabase.auth.getUser() 返回 "Invalid API key" 错误，
 * 改用 getSession() 从 cookie 读取会话信息。
 * getSession() 不发起 API 请求，仅从 cookie 解码 session。
 *
 * @returns 用户对象，未登录返回 null
 */
export async function getSessionUser(): Promise<User | null> {
  const supabase = await createClient()
  try {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.user ?? null
  } catch {
    return null
  }
}
