import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import {
  readSessionCookieValue,
  decodeSessionCookie,
  refreshSession,
  encodeSessionCookie,
  getSupabaseCookieName,
  SECURE_COOKIE_OPTIONS,
} from '@/lib/supabase/cookie-utils'

/**
 * 中间件：三级权限路由保护
 *
 * 权限模型：
 *   游客 (未登录)      → 仅可访问公开页面，受保护路径重定向到 /login
 *   普通用户 (role=user) → 可访问 /profile（个人中心），不可访问 /admin/* 和 /studio/*
 *   管理员 (role=admin)  → 可访问所有路径（/admin/*, /studio/*, /profile）
 *
 * 零号用户 (uid=10001) 是超级管理员，拥有管理员权限并管理角色授权
 *
 * 认证策略：
 *   信任 cookie 中的签名 JWT（Supabase JWT 由服务端签名，无法伪造）。
 *   仅当 access_token 过期时才发起网络请求刷新。
 *   避免每次请求都调用 Supabase API 导致网络波动时认证失败。
 *
 * Token 刷新机制：
 *   当 access_token 过期时，使用 refresh_token 获取新的 access_token，
 *   并将刷新后的 session 写入 response cookie，实现无感续期。
 */
export async function middleware(request: NextRequest) {
  // ===== 调试端点：仅开发环境可用 =====
  if (request.nextUrl.searchParams.get('debug') === '1') {
    if (process.env.NODE_ENV === 'production') {
      return new NextResponse(null, { status: 404 })
    }
    return handleDebugRequest(request)
  }

  let response = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() { return request.cookies.getAll() },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options))
      }
    }
  })

  const pathname = request.nextUrl.pathname

  // 受保护路径：需要登录才能访问
  const protectedPaths = ['/studio', '/admin', '/profile']
  // 仅管理员可访问的路径
  const adminOnlyPaths = ['/admin', '/studio']

  // 如果不是受保护路径，直接放行
  if (!protectedPaths.some(p => pathname.startsWith(p))) {
    return response
  }

  // ===== 认证：从 cookie 读取 session，信任签名 JWT =====
  let userId: string | null = null
  let hasExpiredSession = false

  // Step 1: 从 cookie 解码 session（快速检查，无网络开销）
  const cookieValue = readSessionCookieValue(request.cookies)
  const decoded = cookieValue ? decodeSessionCookie(cookieValue) : null

  if (decoded) {
    const session = decoded as {
      access_token: string
      refresh_token: string
      expires_at: number
      user: { id: string; email?: string }
    }

    if (session.user?.id && session.access_token) {
      // Step 2: 检查 token 是否过期
      const now = Math.floor(Date.now() / 1000)
      const isExpired = session.expires_at ? session.expires_at < now : false

      if (!isExpired) {
        // Token 仍然有效 — 信任签名 JWT，直接使用（零网络调用）
        userId = session.user.id
      } else if (session.refresh_token) {
        // Token 已过期 — 尝试刷新
        hasExpiredSession = true
        const refreshedSession = await refreshSession(session.refresh_token)
        if (refreshedSession) {
          userId = refreshedSession.user.id

          // 将刷新后的 session 写入 response cookie（无感续期）
          const cookieName = getSupabaseCookieName()
          const cookieParts = encodeSessionCookie(refreshedSession)
          cookieParts.forEach(({ name, value }) => {
            response.cookies.set(name, value, SECURE_COOKIE_OPTIONS)
          })
          // 如果有分片，清除主 cookie 避免读取冲突
          if (cookieParts.length > 1) {
            response.cookies.set(cookieName, '', {
              ...SECURE_COOKIE_OPTIONS,
              maxAge: 0,
            })
          }
        }
      } else {
        hasExpiredSession = true
      }
    }
  }

  // 备选：使用 SSR 客户端的 getSession（处理 cookie 格式差异 + token 刷新）
  if (!userId) {
    try {
      const { data: { session: ssrSession } } = await supabase.auth.getSession()
      if (ssrSession?.user?.id && ssrSession.access_token) {
        // 信任 SSR 客户端读取的 session（同样是签名 JWT）
        const now = Math.floor(Date.now() / 1000)
        const isExpired = ssrSession.expires_at ? ssrSession.expires_at < now : false

        if (!isExpired) {
          userId = ssrSession.user.id
        } else if (ssrSession.refresh_token) {
          hasExpiredSession = true
          const { data: refreshData, error: refreshError } =
            await supabase.auth.refreshSession({
              refresh_token: ssrSession.refresh_token,
            })

          if (!refreshError && refreshData.session?.user?.id) {
            userId = refreshData.session.user.id
          }
        }
      }
    } catch {
      // 静默失败
    }
  }

  // 未登录用户访问受保护路径 → 重定向到登录页
  if (!userId && protectedPaths.some(p => pathname.startsWith(p))) {
    const loginUrl = new URL('/login', request.url)
    if (hasExpiredSession) {
      loginUrl.searchParams.set('expired', '1')
    }
    return NextResponse.redirect(loginUrl)
  }

  // 已登录用户访问管理员专属路径 → 检查角色
  if (userId && adminOnlyPaths.some(p => pathname.startsWith(p))) {
    const isAdmin = await checkAdminRole(userId)

    // 非管理员访问 /admin/* 或 /studio/* → 重定向到个人中心（防越级）
    if (!isAdmin) {
      return NextResponse.redirect(new URL('/profile', request.url))
    }
  }

  return response
}

/**
 * 检查用户角色是否为管理员
 *
 * 依次尝试 service_role key 和 anon key，
 * 确保即使其中一个 key 无效也能正常工作。
 */
async function checkAdminRole(userId: string): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // 依次尝试可用的 key
  const keysToTry = [serviceKey, anonKey].filter(
    (k): k is string => typeof k === 'string' && k.length > 0
  )

  for (const key of keysToTry) {
    try {
      const admin = createClient(supabaseUrl, key, {
        auth: { autoRefreshToken: false, persistSession: false }
      })

      const { data: profile } = await admin
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()

      if (profile?.role === 'admin') return true
      if (profile) return false // 查到 profile 但不是 admin
    } catch {
      // 当前 key 失败，尝试下一个
    }
  }

  return false
}

/**
 * 调试端点处理（仅开发环境）
 */
async function handleDebugRequest(request: NextRequest) {
  const allCookies = request.cookies.getAll()
  const cookieInfo = allCookies.map(c => ({
    name: c.name,
    valueLength: c.value.length,
    hasBase64Prefix: c.value.startsWith('base64-'),
  }))

  const cookieValue = readSessionCookieValue(request.cookies)
  const decoded = cookieValue ? decodeSessionCookie(cookieValue) : null

  const session = decoded as {
    access_token: string
    refresh_token: string
    expires_at: number
    user: { id: string; email?: string }
  } | null

  const now = Math.floor(Date.now() / 1000)
  const isExpired = session?.expires_at ? session.expires_at < now : null

  return NextResponse.json({
    pathname: request.nextUrl.pathname,
    cookieCount: allCookies.length,
    cookies: cookieInfo,
    session: session ? {
      userId: session.user?.id,
      userEmail: session.user?.email,
      expiresAt: session.expires_at,
      isExpired,
      trusted: !isExpired, // 信任未过期的签名 JWT
    } : null,
  })
}

export const config = {
  // 匹配 /admin/*, /studio/*, /profile（含子路径和根路径）
  matcher: ['/studio/:path*', '/admin/:path*', '/profile/:path*', '/profile']
}
