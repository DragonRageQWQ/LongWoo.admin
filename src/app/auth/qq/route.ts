import { NextResponse, type NextRequest } from 'next/server'

/**
 * QQ OAuth 发起路由
 *
 * 流程：
 * 1. 用户点击"使用 QQ 登录" → 前端跳转到 /auth/qq
 * 2. 本路由生成 state（CSRF 防护）并重定向到 QQ 授权页面
 * 3. 用户在 QQ 授权后，QQ 回调到 /auth/qq/callback?code=xxx&state=xxx
 *
 * QQ 互联授权地址：https://graph.qq.com/oauth2.0/authorize
 * 所需 scope：get_user_info（获取用户昵称、头像等基本信息）
 */
export async function GET(request: NextRequest) {
  const clientId = process.env.QQ_CLIENT_ID
  const clientSecret = process.env.QQ_CLIENT_SECRET

  // 检查 QQ 配置是否完整
  if (!clientId || !clientSecret) {
    console.error('QQ 登录未配置：缺少 QQ_CLIENT_ID 或 QQ_CLIENT_SECRET')
    return NextResponse.redirect(
      new URL('/login?error=qq_not_configured', request.url)
    )
  }

  // 确定回调地址（使用 NEXT_PUBLIC_SITE_URL 保证与 QQ 互联平台注册的回调地址一致）
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin
  const redirectUri = `${origin}/auth/qq/callback`

  // 生成 state 用于 CSRF 防护
  const state = crypto.randomUUID()

  // 构建 QQ 授权 URL
  const authUrl = new URL('https://graph.qq.com/oauth2.0/authorize')
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('scope', 'get_user_info')

  // 重定向到 QQ 授权页面，同时将 state 写入 cookie 供回调时验证
  const response = NextResponse.redirect(authUrl)
  response.cookies.set('qq_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 分钟有效期
    path: '/',
  })

  return response
}
