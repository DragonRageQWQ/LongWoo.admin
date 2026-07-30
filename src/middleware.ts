import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

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
 * 注意：生产环境中 supabase.auth.getUser() 返回 "Invalid API key" 错误，
 * 原因是 Edge Runtime 中 SDK 的 apikey 头处理与直接 fetch 不同。
 * 改用 getSession() + 手动 cookie 解码作为备选方案。
 */
export async function middleware(request: NextRequest) {
  // ===== 调试端点：通过 ?debug=1 查看 cookie 和认证状态 =====
  if (request.nextUrl.searchParams.get('debug') === '1') {
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

  // ===== 使用 getSession() 获取会话（不调用 API，从 cookie 读取） =====
  // getUser() 在生产环境返回 "Invalid API key"，改用 getSession()
  let userId: string | null = null

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user?.id) {
      userId = session.user.id
    }
  } catch {
    // getSession() 失败，尝试手动解码
  }

  // ===== 备选：手动解码 session cookie =====
  if (!userId) {
    userId = getUserIdFromCookie(request)
  }

  // 未登录用户访问受保护路径 → 重定向到登录页
  if (!userId && protectedPaths.some(p => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/login', request.url))
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
 * 从 cookie 中手动解码 session 获取 userId
 * 作为 getSession() 的备选方案
 */
function getUserIdFromCookie(request: NextRequest): string | null {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? ''
    const cookieName = `sb-${projectRef}-auth-token`

    // 尝试读取主 cookie 和分片 cookie
    const mainCookie = request.cookies.get(cookieName)
    if (mainCookie?.value) {
      return decodeSessionUserId(mainCookie.value)
    }

    // 尝试分片 cookie (sb-xxx-auth-token.0, sb-xxx-auth-token.1, ...)
    const chunkCookies = request.cookies.getAll()
      .filter(c => c.name.startsWith(`${cookieName}.`))
      .sort((a, b) => {
        const aNum = parseInt(a.name.split('.').pop() || '0')
        const bNum = parseInt(b.name.split('.').pop() || '0')
        return aNum - bNum
      })

    if (chunkCookies.length > 0) {
      const combined = chunkCookies.map(c => c.value).join('')
      return decodeSessionUserId(combined)
    }
  } catch {
    // 静默失败
  }

  return null
}

/**
 * 解码 Supabase session cookie 值，提取 userId
 */
function decodeSessionUserId(cookieValue: string): string | null {
  try {
    if (!cookieValue.startsWith('base64-')) return null

    const base64Part = cookieValue.substring(7)
    // Edge Runtime 中使用 atob
    const base64 = base64Part.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4)
    const jsonStr = atob(padded)
    const session = JSON.parse(jsonStr)

    return session?.user?.id ?? null
  } catch {
    return null
  }
}

/**
 * 使用 service role key 检查用户角色
 * 绕过 anon key 的 API 问题
 */
async function checkAdminRole(userId: string): Promise<boolean> {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

    // 使用 service role key 创建 admin 客户端
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
 * 调试端点处理
 */
async function handleDebugRequest(request: NextRequest) {
  const allCookies = request.cookies.getAll()
  const cookieInfo = allCookies.map(c => ({
    name: c.name,
    valueLength: c.value.length,
    valueStart: c.value.substring(0, 80),
    hasBase64Prefix: c.value.startsWith('base64-'),
  }))

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? ''
  const cookieName = `sb-${projectRef}-auth-token`
  const sessionCookie = request.cookies.get(cookieName)

  let sessionInfo: Record<string, unknown> = { cookieName, found: !!sessionCookie }

  if (sessionCookie) {
    try {
      const value = sessionCookie.value
      if (value.startsWith('base64-')) {
        const base64Part = value.substring(7)
        const base64 = base64Part.replace(/-/g, '+').replace(/_/g, '/')
        const padded = base64 + '='.repeat((4 - base64.length % 4) % 4)
        const jsonStr = atob(padded)
        const session = JSON.parse(jsonStr)
        sessionInfo = {
          cookieName,
          found: true,
          hasAccessToken: !!session.access_token,
          hasRefreshToken: !!session.refresh_token,
          userId: session.user?.id,
          userEmail: session.user?.email,
          expiresAt: session.expires_at,
        }
      } else {
        sessionInfo = { cookieName, found: true, error: 'no base64- prefix', valueStart: value.substring(0, 80) }
      }
    } catch (e) {
      sessionInfo = { cookieName, found: true, error: String(e) }
    }
  }

  // 尝试 getSession() 和 getUser()
  let authInfo: Record<string, unknown> = {}
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll() {},
        }
      }
    )
    const { data: sessionData } = await supabase.auth.getSession()
    const { data: userData, error: userError } = await supabase.auth.getUser()
    authInfo = {
      sessionUserId: sessionData.session?.user?.id ?? null,
      sessionUserEmail: sessionData.session?.user?.email ?? null,
      getUserUserId: userData.user?.id ?? null,
      getUserError: userError?.message ?? null,
    }
  } catch (e) {
    authInfo = { error: String(e) }
  }

  return NextResponse.json({
    pathname: request.nextUrl.pathname,
    cookieCount: allCookies.length,
    cookies: cookieInfo,
    sessionInfo,
    authInfo,
  })
}

export const config = {
  // 匹配 /admin/*, /studio/*, /profile（含子路径和根路径）
  matcher: ['/studio/:path*', '/admin/:path*', '/profile/:path*', '/profile']
}
