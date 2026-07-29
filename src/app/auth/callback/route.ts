import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getOrCreateProfile } from '@/lib/profile'

/**
 * OAuth 回调处理路由
 *
 * 处理 QQ 和微信 OAuth 登录回调：
 * 1. 从 URL 获取 code
 * 2. 使用 supabase.auth.exchangeCodeForSession(code) 交换 session
 * 3. 成功后根据 role 重定向到 /admin/dashboard 或 /studio/dashboard
 * 4. 失败重定向到 /login?error=oauth_failed
 *
 * 注意：在 Next.js App Router 中，route.ts 和 page.tsx 不能同时存在于同一目录。
 * OAuth 回调使用 route.ts 进行服务端处理，速度最快，无需额外加载页。
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  // 没有 code 参数，直接重定向到登录页
  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`)
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

    // 获取当前用户
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error('获取用户信息失败:', userError?.message)
      return NextResponse.redirect(`${origin}/login?error=oauth_failed`)
    }

    // 查询 profiles 表获取 role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    let role = 'studio'

    if (profileError || !profile) {
      // profile 不存在，使用公共工具函数自动创建
      const createdProfile = await getOrCreateProfile(supabase, user.id, {
        email: user.email,
        avatarUrl: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
      })
      role = createdProfile?.role ?? 'studio'
    } else {
      role = profile.role
    }

    // 根据 role 重定向到对应的面板
    const redirectTo =
      role === 'admin' ? '/admin/dashboard' : '/studio/dashboard'

    // 重新设置 response 为正确的重定向目标
    // 需要保留之前设置的 cookies
    const finalResponse = NextResponse.redirect(`${origin}${redirectTo}`)

    // 复制所有 cookies 到最终响应
    response.cookies.getAll().forEach((cookie) => {
      finalResponse.cookies.set(cookie.name, cookie.value, {
        ...cookie,
      })
    })

    return finalResponse
  } catch (error) {
    console.error('OAuth 回调处理异常:', error)
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`)
  }
}
