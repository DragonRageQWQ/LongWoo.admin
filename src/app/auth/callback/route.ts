import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getOrCreateProfile } from '@/lib/profile'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * OAuth 回调处理路由
 *
 * 处理 QQ 和微信 OAuth 登录回调：
 * 1. 从 URL 获取 code
 * 2. 校验 state 参数（CSRF 防护，与 QQ 回调一致）
 * 3. 使用 supabase.auth.exchangeCodeForSession(code) 交换 session
 * 4. 成功后根据 role 重定向到 /admin/dashboard（管理员）或 /profile（普通用户）
 * 5. 失败重定向到 /login?error=oauth_failed
 *
 * 注意：在 Next.js App Router 中，route.ts 和 page.tsx 不能同时存在于同一目录。
 * OAuth 回调使用 route.ts 进行服务端处理，速度最快，无需额外加载页。
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const state = requestUrl.searchParams.get('state')
  const origin = requestUrl.origin

  // 没有 code 参数，直接重定向到登录页
  if (!code) {
    const resp = NextResponse.redirect(`${origin}/login?error=oauth_failed`)
    // 安全修复：即使验证失败也清除 state cookie，防止重放攻击
    resp.cookies.delete('oauth_state')
    return resp
  }

  // ===== state 参数校验（CSRF 防护，与 QQ 回调一致） =====
  const storedState = request.cookies.get('oauth_state')?.value
  if (!state || !storedState || state !== storedState) {
    console.error('OAuth 回调验证失败: state 不匹配或缺少参数')
    const resp = NextResponse.redirect(`${origin}/login?error=oauth_failed`)
    // 安全修复：验证失败时也清除 state cookie，防止重放
    resp.cookies.delete('oauth_state')
    return resp
  }

  // 创建 Supabase 服务端客户端（在 route handler 中需要手动处理 cookies）
  let response = NextResponse.redirect(`${origin}/login?error=oauth_failed`)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  try {
    // 交换 code 获取 session
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('OAuth code 交换失败:', error.message)
      return NextResponse.redirect(`${origin}/login?error=oauth_failed`)
    }

    // 获取当前用户（使用 getSession() 替代 getUser()，避免生产环境 "Invalid API key" 问题）
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()
    const user = session?.user ?? null

    if (sessionError || !user) {
      console.error('获取用户信息失败:', sessionError?.message)
      return NextResponse.redirect(`${origin}/login?error=oauth_failed`)
    }

    // 使用 admin 客户端查询 profiles 表获取 role
    const admin = createAdminClient()
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    let role = 'user'

    if (profileError || !profile) {
      // profile 不存在，使用 admin 客户端创建（绕过 RLS）
      // 与 QQ 回调保持一致，统一使用 admin 客户端避免 RLS 同步问题
      const adminForProfile = createAdminClient()
      const createdProfile = await getOrCreateProfile(adminForProfile, user.id, {
        email: user.email,
        avatarUrl: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
      })
      role = createdProfile?.role ?? 'user'
    } else {
      role = profile.role
    }

    // 根据 role 重定向到对应的面板
    // 管理员 → /admin/dashboard，普通用户 → /profile
    const redirectTo =
      role === 'admin' ? '/admin/dashboard' : '/profile'

    // 重新设置 response 为正确的重定向目标
    // 需要保留之前设置的 cookies
    const finalResponse = NextResponse.redirect(`${origin}${redirectTo}`)

    // 复制所有 cookies 到最终响应
    response.cookies.getAll().forEach((cookie) => {
      finalResponse.cookies.set(cookie.name, cookie.value, {
        ...cookie,
      })
    })

    // 清除 oauth_state cookie（CSRF 一次性使用）
    finalResponse.cookies.delete('oauth_state')

    return finalResponse
  } catch (error) {
    console.error('OAuth 回调处理异常:', error)
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`)
  }
}
