import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import {
  readSessionCookieValue,
  getSessionFromCookieValue,
  verifyAccessToken,
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
 * 安全修复：
 *   不再信任 cookie 中的 userId，而是通过 Supabase API 验证 access_token。
 *   使用直接 fetch 调用 /auth/v1/user，显式设置 apikey 头，
 *   解决 Edge Runtime 中 SDK 的 "Invalid API key" 问题。
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

  // ===== 安全验证：从 cookie 读取 session，通过 API 验证 token =====
  let userId: string | null = null

  // Step 1: 从 cookie 解码 session（快速检查，无网络开销）
  const cookieValue = readSessionCookieValue(request.cookies)
  const session = getSessionFromCookieValue(cookieValue)

  if (session?.user?.id && session.access_token) {
    // Step 2: 通过 Supabase API 验证 token（安全核心）
    // 使用直接 fetch 避免 Edge Runtime SDK 问题
    userId = await verifyAccessToken(session.access_token)
  }

  // 备选：使用 SSR 客户端的 getSession（仅用于 token 刷新场景）
  if (!userId) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.id && session.access_token) {
        userId = await verifyAccessToken(session.access_token)
      }
    } catch {
      // 静默失败
    }
  }

  // 未登录用户访问受保护路径 → 重定向到登录页
  if (!userId && protectedPaths.some(p => pathname.startsWith(p))) {
    // 如果 cookie 存在但 session 已过期，添加 expired 参数提示用户
    const hasExpiredSession = cookieValue !== null && session === null
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
 * 使用 service role key 检查用户角色
 */
async function checkAdminRole(userId: string): Promise<boolean> {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

    const admin = createClient(supabaseUrl, serviceKey!, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    return profile?.role === 'admin'
  } catch {
    return false
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
  const session = getSessionFromCookieValue(cookieValue)

  let authInfo: Record<string, unknown> = {}
  if (session?.access_token) {
    const verifiedId = await verifyAccessToken(session.access_token)
    authInfo = {
      cookieUserId: session.user?.id,
      verifiedUserId: verifiedId,
      tokenValid: verifiedId !== null,
    }
  }

  return NextResponse.json({
    pathname: request.nextUrl.pathname,
    cookieCount: allCookies.length,
    cookies: cookieInfo,
    session: session ? {
      userId: session.user?.id,
      userEmail: session.user?.email,
      expiresAt: session.expires_at,
      isExpired: session.expires_at
        ? session.expires_at < Math.floor(Date.now() / 1000)
        : null,
    } : null,
    authInfo,
  })
}

export const config = {
  // 匹配 /admin/*, /studio/*, /profile（含子路径和根路径）
  matcher: ['/studio/:path*', '/admin/:path*', '/profile/:path*', '/profile']
}
