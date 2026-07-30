import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOtp, consumeOtp } from '@/lib/otp-store'
import { getOrCreateProfile } from '@/lib/profile'

// Vercel Hobby 计划默认超时 10 秒，认证流程含 5+ API 调用需要更长时间
export const maxDuration = 60

/**
 * 将 session 数据编码为 Supabase SSR 格式的 cookie
 *
 * @supabase/ssr 使用 base64url 编码 JSON 字符串作为 cookie 值。
 * 如果值超过 3180 字符，会分片为多个 cookie。
 */
function encodeSessionCookie(
  session: Record<string, unknown>,
  cookieName: string
): Array<{ name: string; value: string }> {
  // @supabase/ssr 使用 "base64-" 前缀 + base64url 编码
  // 参考 node_modules/@supabase/ssr/dist/main/cookies.js
  const jsonStr = JSON.stringify(session)
  const base64url = Buffer.from(jsonStr)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  // 关键：添加 "base64-" 前缀，这是 @supabase/ssr 的编码格式
  const encoded = `base64-${base64url}`

  const MAX_CHUNK_SIZE = 3180

  // 不需要分片
  if (encoded.length <= MAX_CHUNK_SIZE) {
    return [{ name: cookieName, value: encoded }]
  }

  // 需要分片（与 @supabase/ssr createChunks 逻辑一致）
  const chunks: Array<{ name: string; value: string }> = []
  let remaining = encoded
  while (remaining.length > 0) {
    const chunk = remaining.slice(0, MAX_CHUNK_SIZE)
    chunks.push({
      name: `${cookieName}.${chunks.length}`,
      value: chunk,
    })
    remaining = remaining.slice(MAX_CHUNK_SIZE)
  }
  return chunks
}

/**
 * 邮箱验证码登录 API Route Handler
 *
 * 直接手动设置 Supabase 格式的 cookie（base64url 编码）
 * 不使用 setSession，避免其在 API Route 中刷新 token 导致失败
 */
export async function POST(request: Request) {
  const startTime = Date.now()

  try {
    const body = await request.json()
    const { email, code } = body as { email?: string; code?: string }

    if (!email || !code) {
      return NextResponse.json(
        { success: false, error: '请输入邮箱和验证码' },
        { status: 400 }
      )
    }

    if (code.length !== 6) {
      return NextResponse.json(
        { success: false, error: '请输入6位验证码' },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    console.log('[Login API] ===== 开始验证码登录 =====', {
      email,
      timestamp: new Date().toISOString(),
    })

    // ===== 第1步：校验验证码（不消费） =====
    console.log('[Login API] 第1步：校验验证码...')
    const otpResult = await verifyOtp(email, code, false)
    console.log(
      '[Login API] 第1步完成：',
      otpResult.valid,
      `耗时${Date.now() - startTime}ms`
    )

    if (!otpResult.valid) {
      return NextResponse.json(
        { success: false, error: '验证码无效或已过期，请重新获取' },
        { status: 400 }
      )
    }

    // ===== 第2步：生成 magic link（禁用邮件发送） =====
    console.log('[Login API] 第2步：生成 magic link...')
    const step2Start = Date.now()
    const admin = createAdminClient()
    const { data: linkData, error: linkError } =
      await admin.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: {
          send_email: false,
        } as Record<string, unknown>,
      } as Parameters<typeof admin.auth.admin.generateLink>[0])

    if (linkError || !linkData) {
      console.error(
        '[Login API] generateLink 失败:',
        linkError?.message,
        linkError?.status
      )
      return NextResponse.json(
        { success: false, error: '生成登录令牌失败，请稍后重试' },
        { status: 500 }
      )
    }

    const tokenHash = linkData.properties?.hashed_token
    console.log(
      '[Login API] 第2步完成：token_hash 已获取 耗时' +
        (Date.now() - step2Start) +
        'ms'
    )

    if (!tokenHash) {
      console.error('[Login API] token_hash 缺失')
      return NextResponse.json(
        { success: false, error: '登录令牌异常，请稍后重试' },
        { status: 500 }
      )
    }

    // ===== 第3步：HTTP POST 到 /auth/v1/verify 交换 session =====
    console.log('[Login API] 第3步：验证 token 获取 session...')
    const step3Start = Date.now()
    const verifyResponse = await fetch(`${supabaseUrl}/auth/v1/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({
        token_hash: tokenHash,
        type: 'magiclink',
      }),
    })

    if (!verifyResponse.ok) {
      const errText = await verifyResponse.text()
      console.error(
        '[Login API] verify 失败:',
        verifyResponse.status,
        errText
      )
      return NextResponse.json(
        { success: false, error: '令牌验证失败，请重新获取验证码' },
        { status: 500 }
      )
    }

    const sessionData = await verifyResponse.json()

    if (
      !sessionData.access_token ||
      !sessionData.refresh_token ||
      !sessionData.user?.id
    ) {
      console.error('[Login API] verify 返回数据不完整')
      return NextResponse.json(
        { success: false, error: '令牌验证失败，请重新获取验证码' },
        { status: 500 }
      )
    }

    console.log(
      '[Login API] 第3步完成 耗时' + (Date.now() - step3Start) + 'ms'
    )

    // ===== 第4步：并行消费验证码和获取 profile =====
    console.log('[Login API] 第4步：并行消费验证码和获取 profile...')
    const step4Start = Date.now()
    const userId = sessionData.user.id
    const userEmail = sessionData.user.email ?? email

    const [, profileResult] = await Promise.all([
      consumeOtp(email, code),
      getOrCreateProfile(admin, userId, { email: userEmail }),
    ])

    const role = profileResult?.role ?? 'user'

    console.log(
      '[Login API] 第4步完成 耗时' +
        (Date.now() - step4Start) +
        'ms 总耗时' +
        (Date.now() - startTime) +
        'ms'
    )

    // ===== 第5步：手动设置 Supabase 格式的 cookie =====
    // 不使用 setSession，直接构造 base64url 编码的 cookie
    // 这避免了 setSession 内部刷新 token 的网络调用，更可靠
    console.log('[Login API] 第5步：手动设置 cookie...')

    // expires_at 兜底
    const expiresAt =
      sessionData.expires_at ??
      Math.floor(Date.now() / 1000) + (sessionData.expires_in ?? 3600)

    const session = {
      access_token: sessionData.access_token,
      refresh_token: sessionData.refresh_token,
      expires_at: expiresAt,
      expires_in: sessionData.expires_in ?? 3600,
      token_type: sessionData.token_type ?? 'bearer',
      user: sessionData.user,
    }

    // 从 Supabase URL 提取 project ref 构造 cookie 名称
    // URL 格式: https://xxxxxxxxxxxx.supabase.co
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? ''
    const cookieName = `sb-${projectRef}-auth-token`

    // 编码 session 为 Supabase cookie 格式（含分片支持）
    const cookieParts = encodeSessionCookie(session, cookieName)

    // 创建 response 对象
    const response = NextResponse.json({ success: true, role })

    // 设置 cookie
    const cookieOptions = {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 24 * 7, // 7天
    }

    cookieParts.forEach(({ name, value }) => {
      console.log(`[Login API] 设置 cookie: ${name} (长度: ${value.length})`)
      response.cookies.set(name, value, cookieOptions)
    })

    // 如果有分片，需要清除主 cookie（避免读取冲突）
    if (cookieParts.length > 1) {
      response.cookies.set(cookieName, '', { ...cookieOptions, maxAge: 0 })
    }

    console.log('[Login API] cookie 设置完成，共', cookieParts.length, '个')
    console.log('[Login API] ===== 登录成功 =====', {
      email,
      role,
      totalMs: Date.now() - startTime,
    })

    return response
  } catch (error) {
    console.error(
      '[Login API] 异常:',
      error instanceof Error ? error.message : String(error)
    )
    if (error instanceof Error && error.stack) {
      console.error('[Login API] 堆栈:', error.stack)
    }
    return NextResponse.json(
      { success: false, error: '验证时发生未知错误，请稍后重试' },
      { status: 500 }
    )
  }
}
