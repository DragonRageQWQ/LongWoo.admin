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
import { hasUserTag } from '@/lib/user-tags'

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
  // 安全加固（L-1）：移除调试端点，避免误配置泄露会话信息

  // ===== CSP nonce 安全加固（NEXT-CSP-001）=====
  // 每请求生成唯一 nonce：script-src 不再使用 'unsafe-inline'，
  // 仅放行 Next.js 自动生成且携带该 nonce 的内联脚本（RSC payload 等），
  // 其余内联脚本一律被 CSP 拦截，显著缩小 XSS 注入执行面。
  // 注：public/*.html 静态页默认不走 middleware（matcher 排除 .html），
  // 由 next.config.ts 的 CSP（含 'unsafe-inline'）兜底；本 nonce CSP 仅作用于
  // App Router 动态页面。旧版静态下单流程页（order-step*.html 等）因需做
  // 权限判定而单独加入 matcher，管理员放行时会移除本 nonce CSP 保持页面可用。
  // 使用 Web Crypto API（Edge runtime 原生支持，Node crypto 模块不可用）
  const nonce = Buffer.from(globalThis.crypto.randomUUID()).toString('base64')
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseWsUrl = supabaseUrl.replace(/^https/, 'wss')
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline' https://cdn-font.hyperos.mi.com",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data: https://cdn-file.hyperos.mi.com",
    `connect-src 'self' ${supabaseUrl} ${supabaseWsUrl}`,
    "object-src 'none'",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
  // 注入 x-nonce：Next.js 检测到该请求头后，自动为生成的内联脚本附加 nonce
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  const applyCsp = (res: NextResponse): NextResponse => {
    res.headers.set('Content-Security-Policy', csp)
    return res
  }

  let response = applyCsp(NextResponse.next({ request: { headers: requestHeaders } }))

  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() { return request.cookies.getAll() },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value))
        // 同步最新 cookie 到渲染请求头（保留 x-nonce，确保 nonce CSP 下内联脚本可用）
        requestHeaders.set('cookie', request.cookies.toString())
        response = applyCsp(NextResponse.next({ request: { headers: requestHeaders } }))
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options))
      }
    }
  })

  const pathname = request.nextUrl.pathname

  // 旧版遗留路径（普通用户一律 301 到新首页）：
  // - public/ 静态下单流程页（order-step1~5.html、preorder-step1.html）
  // - 旧订单查询 /order/query（已迁移至首页 ?tab=check）
  // - AI 智能体工作区 /ai/characters（仅管理员与 testA 测试用户开放）
  // - 旧版作品详情页 /works-detail.html（已重构为 /gallery/[id]）
  const legacyPaths = [
    '/order-step1.html',
    '/order-step2.html',
    '/order-step3.html',
    '/order-step4.html',
    '/order-step5.html',
    '/preorder-step1.html',
    '/works-detail.html',
    '/order/query',
    '/ai/characters',
  ]
  const isLegacyPath = legacyPaths.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  )

  // 受保护路径：需要登录才能访问
  const protectedPaths = ['/studio', '/admin', '/profile', '/ai', '/gray-test']
  // 仅管理员可访问的路径
  const adminOnlyPaths = ['/admin', '/studio', '/gray-test']

  // 如果不是受保护路径且非遗留路径，直接放行
  if (!protectedPaths.some(p => pathname.startsWith(p)) && !isLegacyPath) {
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
  if (!userId) {
    // 旧版遗留路径：游客（未登录）也一律 301 到新首页
    if (isLegacyPath) {
      return applyCsp(NextResponse.redirect(new URL('/', request.url), 301))
    }
    const loginUrl = new URL('/login', request.url)
    if (hasExpiredSession) {
      loginUrl.searchParams.set('expired', '1')
    }
    return applyCsp(NextResponse.redirect(loginUrl))
  }

  const profileAccess = userId ? await getProfileAccess(userId) : null
  if (userId && (!profileAccess || !profileAccess.isActive)) {
    return applyCsp(NextResponse.redirect(new URL('/login?inactive=1', request.url)))
  }

  // 旧版遗留路径权限：仅管理员可访问；/ai/characters 额外对 testA 测试用户开放
  if (isLegacyPath) {
    const isAdmin = profileAccess?.isAdmin === true
    const isTestA = hasUserTag(profileAccess?.tags, 'testA')
    const canAccessLegacy =
      isAdmin || (pathname.startsWith('/ai/characters') && isTestA)
    if (!canAccessLegacy) {
      // 普通用户 → 301 永久重定向到新首页
      return applyCsp(NextResponse.redirect(new URL('/', request.url), 301))
    }
    // 静态 HTML 遗留页放行时移除 nonce CSP：其内联脚本无 nonce，
    // 交由 next.config.ts 中针对 public/*.html 的 'unsafe-inline' CSP 兜底
    if (pathname.endsWith('.html')) {
      response.headers.delete('Content-Security-Policy')
    }
    return response
  }

  // 已登录用户访问管理员专属路径 → 检查角色
  if (userId && adminOnlyPaths.some(p => pathname.startsWith(p))) {
    // 非管理员访问 /admin/* 或 /studio/* → 重定向到个人中心（防越级）
    if (!profileAccess?.isAdmin) {
      return applyCsp(NextResponse.redirect(new URL('/profile', request.url)))
    }
  }

  return response
}

/**
 * 检查用户角色是否为管理员
 *
 * 复用 admin 客户端单例（createAdminClient），避免每次请求都创建新的 SupabaseClient。
 * 使用 service_role key 绕过 RLS 读取 profiles 表。
 *
 * 性能优化（PERF-01）：结果按 userId 做模块级 TTL 缓存（60s）。
 * 受保护路径（/profile、/admin、/ai 等）每个请求都会进入 middleware，
 * 未缓存时每次额外一次到 Supabase 的网络往返（RTT），是"进入页面卡顿"的主因之一。
 * 缓存后热请求零网络；60s TTL 兼顾管理员授权/停用操作的生效延迟（刷新页面即更新）。
 * 注：serverless 实例每次冷启动缓存为空（首次请求 1 次 RTT，可接受）。
 */
const profileAccessCache = new Map<
  string,
  { data: { isAdmin: boolean; isActive: boolean; tags: unknown }; at: number }
>()
const PROFILE_CACHE_TTL_MS = 60_000
const PROFILE_CACHE_MAX = 500

async function getProfileAccess(
  userId: string
): Promise<{ isAdmin: boolean; isActive: boolean; tags: unknown } | null> {
  const cached = profileAccessCache.get(userId)
  if (cached && Date.now() - cached.at < PROFILE_CACHE_TTL_MS) {
    return cached.data
  }
  try {
    // 复用 admin 客户端单例
    const admin = createAdminClient()

    const { data: profile } = await admin
      .from('profiles')
      .select('role, is_active, tags')
      .eq('id', userId)
      .single()

    if (!profile) return null
    const result = {
      isAdmin: profile.role === 'admin',
      isActive: profile.is_active === true,
      tags: profile.tags ?? [],
    }
    // 写入缓存；超上限时清空（防内存增长）
    if (profileAccessCache.size >= PROFILE_CACHE_MAX) {
      profileAccessCache.clear()
    }
    profileAccessCache.set(userId, { data: result, at: Date.now() })
    return result
  } catch {
    return null
  }
}

export const config = {
  // 全站 HTML 渲染路径统一应用 nonce CSP（NEXT-CSP-001）：
  // - 排除 _next 静态资源、图片优化、favicon、robots、sitemap
  // - 排除 public 静态文件（.html/.css/.js/.png 等，由静态服务器直服，
  //   其中 public/*.html 的 CSP 由 next.config.ts 的 'unsafe-inline' 配置兜底）
  // - 排除 '/'（安全加固 N-01）：首页经 rewrite 指向 index.html 静态页，其
  //   内联脚本不带 nonce，若命中本中间件会被 nonce CSP 拦截导致功能失效。
  //   matcher 的 lookahead 中 '^$' 专门匹配 '/' 之后的空路径，使首页跳过中间件，
  //   仅由 next.config 的 'unsafe-inline' CSP 兜底。
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|index.html|^$|.*\\.(?:png|jpg|jpeg|svg|gif|webp|avif|css|js|mjs|ico|mp4|woff2?|ttf|html)$).*)',
    // 旧版静态下单流程页（普通用户 301 到新首页；管理员可访问）：
    // 默认 matcher 排除 .html，此处单独放行以进入 middleware 权限判定
    '/order-step1.html',
    '/order-step2.html',
    '/order-step3.html',
    '/order-step4.html',
    '/order-step5.html',
    '/preorder-step1.html',
    '/works-detail.html',
  ],
}
