import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  readSessionCookieValue,
  decodeSessionCookie,
  verifyAccessToken,
  refreshSession,
  encodeSessionCookie,
  getSessionCookieNames,
  SECURE_COOKIE_OPTIONS,
  clearAllSessionCookies,
} from '@/lib/supabase/cookie-utils'
import { createAdminClient } from '@/lib/supabase/admin'

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
 * 认证策略：Cookie 外层 JSON 不可信（仅为 base64url 编码，可被任意伪造），
 * 身份必须通过 Supabase 验证 access token。middleware 对受保护路径一律执行
 * verifyAccessToken 网络验证，绝不信任 cookie 中未经验证的 user.id。
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
  const protectedPaths = ['/studio', '/admin', '/profile', '/ai']
  // 仅管理员可访问的路径
  const adminOnlyPaths = ['/admin', '/studio']

  // 如果不是受保护路径，直接放行
  if (!protectedPaths.some(p => pathname.startsWith(p))) {
    return response
  }

  // ===== 认证：从 cookie 读取 session，并通过 Supabase 验证 access token =====
  let userId: string | null = null
  let hasExpiredSession = false
  // 标记 cookie 是否解码成功，用于决定是否走 SSR 备选流程
  let cookieDecoded = false

  // Step 1: 从 cookie 解码 session（快速检查，无网络开销）
  const cookieValue = readSessionCookieValue(request.cookies)
  const decoded = cookieValue ? decodeSessionCookie(cookieValue) : null

  if (decoded) {
    cookieDecoded = true
    const session = decoded as {
      access_token: string
      refresh_token: string
      expires_at: number
      user: { id: string; email?: string }
    }

    if (session.user?.id && session.access_token) {
      // 安全修复（FIND-01）：cookie 只是 base64url 编码的 JSON，攻击者可自行构造
      // {"access_token":"任意","expires_at":<未来>,"user":{"id":"<目标UUID>"}} 伪造身份。
      // 因此一律通过 Supabase 网络验证 access_token，绝不信任 cookie 中的 user.id。
      userId = await verifyAccessToken(session.access_token)
      if (userId !== session.user.id) userId = null

      if (!userId && session.refresh_token) {
        hasExpiredSession = true
        const refreshedSession = await refreshSession(session.refresh_token)
        if (refreshedSession) {
          const refreshedUserId = await verifyAccessToken(refreshedSession.access_token)
          if (refreshedUserId === refreshedSession.user.id) userId = refreshedUserId

          if (userId) {
            // 使用统一的 cookie 清理函数清除旧 session cookie（含分片），
            // 再写入刷新后的新 session
            clearAllSessionCookies(response, getSessionCookieNames(request.cookies.getAll()))
            encodeSessionCookie(refreshedSession).forEach(({ name, value }) =>
              response.cookies.set(name, value, SECURE_COOKIE_OPTIONS))
          }
        }
      } else if (!userId) {
        hasExpiredSession = true
      }
    }
  }

  // 备选：使用 SSR 客户端的 getSession（处理 cookie 格式差异 + token 刷新）
  // 优化：仅在 cookie 解码完全失败时才走 SSR 流程，
  //      避免与主流程重复执行（主流程已覆盖 cookie 解码成功的场景）。
  if (!userId && !cookieDecoded) {
    try {
      const { data: { session: ssrSession } } = await supabase.auth.getSession()
      if (ssrSession?.user?.id && ssrSession.access_token) {
        userId = await verifyAccessToken(ssrSession.access_token)
        if (userId !== ssrSession.user.id) userId = null
        if (!userId && ssrSession.refresh_token) {
          hasExpiredSession = true
          const { data: refreshData, error: refreshError } =
            await supabase.auth.refreshSession({
              refresh_token: ssrSession.refresh_token,
            })

          if (!refreshError && refreshData.session?.user?.id && refreshData.session.access_token) {
            const refreshedId = await verifyAccessToken(refreshData.session.access_token)
            if (refreshedId === refreshData.session.user.id) userId = refreshedId
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

  const profileAccess = userId ? await getProfileAccess(userId) : null
  if (userId && (!profileAccess || !profileAccess.isActive)) {
    return NextResponse.redirect(new URL('/login?inactive=1', request.url))
  }

  // 已登录用户访问管理员专属路径 → 检查角色
  if (userId && adminOnlyPaths.some(p => pathname.startsWith(p))) {
    // 非管理员访问 /admin/* 或 /studio/* → 重定向到个人中心（防越级）
    if (!profileAccess?.isAdmin) {
      return NextResponse.redirect(new URL('/profile', request.url))
    }
  }

  return response
}

/**
 * 检查用户角色是否为管理员
 *
 * 复用 admin 客户端单例（createAdminClient），避免每次请求都创建新的 SupabaseClient。
 * 使用 service_role key 绕过 RLS 读取 profiles 表。
 */
async function getProfileAccess(
  userId: string
): Promise<{ isAdmin: boolean; isActive: boolean } | null> {
  try {
    // 复用 admin 客户端单例
    const admin = createAdminClient()

    const { data: profile } = await admin
      .from('profiles')
      .select('role, is_active')
      .eq('id', userId)
      .single()

    if (!profile) return null
    return {
      isAdmin: profile.role === 'admin',
      isActive: profile.is_active === true,
    }
  } catch {
    return null
  }
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
      tokenExpired: isExpired,
    } : null,
  })
}

export const config = {
  // 匹配 /admin/*, /studio/*, /profile, /ai/*（含子路径和根路径）
  matcher: ['/studio/:path*', '/admin/:path*', '/profile/:path*', '/profile', '/ai/:path*']
}
