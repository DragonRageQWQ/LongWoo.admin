import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

/**
 * 认证诊断 API
 *
 * 用于诊断为什么 Supabase SSR 客户端无法从 cookie 中读取 session。
 * 输出详细的 cookie 信息、解码结果、getUser() 调用结果。
 *
 * 安全：仅在非生产环境可用，生产环境直接返回 404。
 */
export async function GET(request: Request) {
  // ===== 生产环境守卫 =====
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Not available in production' },
      { status: 404 }
    )
  }

  const debug: Record<string, unknown> = {}

  // ===== 1. 原始 Cookie 头 =====
  const rawCookieHeader = request.headers.get('cookie') || ''
  debug.rawCookieHeader = {
    length: rawCookieHeader.length,
    first200: rawCookieHeader.substring(0, 200),
  }

  // ===== 2. next/headers 的 cookies() =====
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()
  debug.cookiesFromHeaders = allCookies.map(c => ({
    name: c.name,
    valueLength: c.value.length,
    valueStart: c.value.substring(0, 80),
    hasBase64Prefix: c.value.startsWith('base64-'),
  }))

  // ===== 3. 查找 session cookie =====
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? ''
  const cookieName = `sb-${projectRef}-auth-token`
  debug.cookieName = cookieName

  const sessionCookie = cookieStore.get(cookieName)
  debug.sessionCookieFound = !!sessionCookie

  if (sessionCookie) {
    debug.sessionCookie = {
      valueLength: sessionCookie.value.length,
      hasBase64Prefix: sessionCookie.value.startsWith('base64-'),
      valueStart: sessionCookie.value.substring(0, 100),
      valueEnd: sessionCookie.value.substring(sessionCookie.value.length - 50),
    }

    // ===== 4. 手动解码 session cookie =====
    try {
      const value = sessionCookie.value
      if (value.startsWith('base64-')) {
        const base64Part = value.substring(7)

        // 方法1: 使用 atob (Edge Runtime 兼容)
        try {
          const base64 = base64Part.replace(/-/g, '+').replace(/_/g, '/')
          const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
          const jsonStr = atob(padded)
          const session = JSON.parse(jsonStr)

          debug.manualDecode = {
            success: true,
            method: 'atob',
            hasAccessToken: !!session.access_token,
            hasRefreshToken: !!session.refresh_token,
            userId: session.user?.id,
            userEmail: session.user?.email,
            expiresAt: session.expires_at,
            accessTokenLength: session.access_token?.length,
          }
        } catch (e) {
          debug.manualDecode = {
            success: false,
            method: 'atob',
            error: String(e),
          }
        }
      } else {
        debug.manualDecode = {
          success: false,
          error: 'No base64- prefix',
        }
      }
    } catch (e) {
      debug.manualDecode = { success: false, error: String(e) }
    }
  }

  // ===== 5. 使用 @supabase/ssr 创建客户端并调用 getUser() =====
  try {
    const supabase = createServerClient(
      supabaseUrl,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() {},
        },
      }
    )

    const { data, error } = await supabase.auth.getUser()

    debug.supabaseGetUser = {
      hasUser: !!data.user,
      userId: data.user?.id,
      userEmail: data.user?.email,
      error: error ? {
        message: error.message,
        name: error.name,
        status: (error as { status?: number }).status,
      } : null,
    }

    // 也尝试 getSession()
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    debug.supabaseGetSession = {
      hasSession: !!sessionData.session,
      hasAccessToken: !!sessionData.session?.access_token,
      error: sessionError?.message ?? null,
    }
  } catch (e) {
    debug.supabaseClientError = String(e)
    if (e instanceof Error && e.stack) {
      debug.supabaseClientStack = e.stack
    }
  }

  // ===== 6. 环境变量检查 =====
  debug.envVars = {
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabaseUrl: supabaseUrl,
    nodeEnv: process.env.NODE_ENV,
  }

  return NextResponse.json(debug)
}
