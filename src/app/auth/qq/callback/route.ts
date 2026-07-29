import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getOrCreateProfile } from '@/lib/profile'

/**
 * QQ OAuth 回调处理路由
 *
 * 完整流程：
 * 1. 验证 state（CSRF 防护）
 * 2. 用 authorization_code 换取 access_token
 * 3. 用 access_token 获取 openid
 * 4. 用 access_token + openid 获取用户信息（昵称、头像）
 * 5. 用 Supabase Admin 创建/查找用户（邮箱格式：qq_<openid>@longwoo.studio）
 * 6. 生成 magic link 并验证，建立 Supabase 会话（写入 cookie）
 * 7. 创建/更新 profiles 记录
 * 8. 根据 role 重定向到 /admin/dashboard 或 /studio/dashboard
 */

// ==================== 辅助函数：交换 code 获取 access_token ====================
async function getAccessToken(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<string | null> {
  const tokenUrl = new URL('https://graph.qq.com/oauth2.0/token')
  tokenUrl.searchParams.set('grant_type', 'authorization_code')
  tokenUrl.searchParams.set('client_id', clientId)
  tokenUrl.searchParams.set('client_secret', clientSecret)
  tokenUrl.searchParams.set('code', code)
  tokenUrl.searchParams.set('redirect_uri', redirectUri)
  tokenUrl.searchParams.set('fmt', 'json')

  const response = await fetch(tokenUrl)
  if (!response.ok) {
    console.error('QQ token 接口 HTTP 错误:', response.status)
    return null
  }

  const data = await response.json()
  if (data.error || !data.access_token) {
    console.error('QQ token 获取失败:', data.error_description || data.error)
    return null
  }

  return data.access_token as string
}

// ==================== 辅助函数：获取 openid ====================
async function getOpenId(accessToken: string): Promise<string | null> {
  const meUrl = new URL('https://graph.qq.com/oauth2.0/me')
  meUrl.searchParams.set('access_token', accessToken)
  meUrl.searchParams.set('fmt', 'json')

  const response = await fetch(meUrl)
  if (!response.ok) {
    console.error('QQ openid 接口 HTTP 错误:', response.status)
    return null
  }

  const data = await response.json()
  if (data.error || !data.openid) {
    console.error('QQ openid 获取失败:', data.error_description || data.error)
    return null
  }

  return data.openid as string
}

// ==================== 辅助函数：获取用户信息 ====================
async function getQQUserInfo(
  accessToken: string,
  clientId: string,
  openid: string
): Promise<{ nickname: string; avatarUrl: string | null } | null> {
  const userInfoUrl = new URL('https://graph.qq.com/user/get_user_info')
  userInfoUrl.searchParams.set('access_token', accessToken)
  userInfoUrl.searchParams.set('oauth_consumer_key', clientId)
  userInfoUrl.searchParams.set('openid', openid)

  const response = await fetch(userInfoUrl)
  if (!response.ok) {
    console.error('QQ 用户信息接口 HTTP 错误:', response.status)
    return null
  }

  const data = await response.json()
  if (data.ret !== 0) {
    console.error('QQ 用户信息获取失败:', data.msg)
    return null
  }

  // figureurl_qq_2 是高清头像，figureurl_qq_1 是中尺寸
  const avatarUrl = data.figureurl_qq_2 || data.figureurl_qq_1 || data.figureurl_2 || data.figureurl_1 || null

  return {
    nickname: data.nickname || 'QQ用户',
    avatarUrl,
  }
}

// ==================== 主处理函数 ====================
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const state = requestUrl.searchParams.get('state')
  const origin = requestUrl.origin

  // 验证 state（CSRF 防护）
  const storedState = request.cookies.get('qq_oauth_state')?.value

  if (!code || !state || !storedState || state !== storedState) {
    console.error('QQ 回调验证失败: state 不匹配或缺少参数')
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`)
  }

  const clientId = process.env.QQ_CLIENT_ID!
  const clientSecret = process.env.QQ_CLIENT_SECRET!
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? origin
  const redirectUri = `${siteUrl}/auth/qq/callback`

  // 准备 response 对象（用于后续设置 cookie）
  let response = NextResponse.redirect(`${origin}/login?error=oauth_failed`)

  // 创建 SSR 客户端（用于最终建立会话）
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

  // 创建 Admin 客户端（用于创建用户、生成 magic link）
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )

  try {
    // Step 1: 用 code 换取 access_token
    const accessToken = await getAccessToken(code, clientId, clientSecret, redirectUri)
    if (!accessToken) {
      return NextResponse.redirect(`${origin}/login?error=oauth_failed`)
    }

    // Step 2: 获取 openid
    const openid = await getOpenId(accessToken)
    if (!openid) {
      return NextResponse.redirect(`${origin}/login?error=oauth_failed`)
    }

    // Step 3: 获取用户信息
    const userInfo = await getQQUserInfo(accessToken, clientId, openid)
    if (!userInfo) {
      return NextResponse.redirect(`${origin}/login?error=oauth_failed`)
    }

    // Step 4: 构造 QQ 用户的虚拟邮箱（用于 Supabase Auth）
    const qqEmail = `qq_${openid}@longwoo.studio`

    // Step 5: 尝试创建用户（如果已存在则忽略错误）
    const { error: createError } = await adminClient.auth.admin.createUser({
      email: qqEmail,
      email_confirm: true,
      user_metadata: {
        nickname: userInfo.nickname,
        avatar_url: userInfo.avatarUrl,
        qq_openid: openid,
        provider: 'qq',
        full_name: userInfo.nickname,
      },
    })

    if (createError) {
      // 用户可能已存在，这不是致命错误
      console.error('QQ 用户创建结果（可能已存在）:', createError.message)
    }

    // Step 6: 生成 magic link 用于建立会话
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: qqEmail,
    })

    if (linkError || !linkData?.properties?.hashed_token) {
      console.error('生成 magic link 失败:', linkError?.message)
      return NextResponse.redirect(`${origin}/login?error=oauth_failed`)
    }

    // Step 7: 用 hashed_token 验证并建立会话（SSR 客户端会自动设置 cookie）
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: 'magiclink',
    })

    if (verifyError) {
      console.error('验证 magic link 失败:', verifyError.message)
      return NextResponse.redirect(`${origin}/login?error=oauth_failed`)
    }

    // Step 8: 获取当前用户
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error('获取用户信息失败:', userError?.message)
      return NextResponse.redirect(`${origin}/login?error=oauth_failed`)
    }

    // Step 9: 创建或更新 profile（使用公共函数，消除重复逻辑）
    const profile = await getOrCreateProfile(supabase, user.id, {
      email: qqEmail,
      displayName: userInfo.nickname,
      avatarUrl: userInfo.avatarUrl,
    })

    const role = profile?.role ?? 'studio'

    // Step 10: 根据 role 重定向到对应面板
    const redirectTo = role === 'admin' ? '/admin/dashboard' : '/studio/dashboard'

    // 构建最终重定向响应，保留所有已设置的 cookie
    const finalResponse = NextResponse.redirect(`${origin}${redirectTo}`)
    response.cookies.getAll().forEach((cookie) => {
      finalResponse.cookies.set(cookie.name, cookie.value, {
        ...cookie,
      })
    })

    // 清除 state cookie
    finalResponse.cookies.delete('qq_oauth_state')

    return finalResponse
  } catch (error) {
    console.error('QQ 回调处理异常:', error)
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`)
  }
}
