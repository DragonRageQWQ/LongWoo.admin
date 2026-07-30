import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOtp, consumeOtp } from '@/lib/otp-store'
import { getOrCreateProfile } from '@/lib/profile'

// Vercel Hobby 计划默认超时 10 秒，认证流程含 5+ API 调用需要更长时间
export const maxDuration = 60

/**
 * 邮箱验证码登录 API Route Handler
 *
 * 为什么用 API Route 而非 Server Action：
 * 1. Server Action 在 Vercel 上可能被中止（net::ERR_ABORTED），尤其是涉及多步 API 调用时
 * 2. API Route 通过标准 HTTP 响应设置 Set-Cookie 头，更可靠
 * 3. 不受 RSC payload 编码影响
 *
 * 认证流程：
 * 1. 校验验证码（不消费，失败可重试）
 * 2. admin.generateLink 获取 magic link token_hash（send_email: false）
 * 3. HTTP POST 到 /auth/v1/verify 交换 session token
 * 4. 并行：消费验证码 + 创建/获取 profile
 * 5. 在 NextResponse 上直接设置 Set-Cookie（base64url 编码 + 分片）
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

    // ===== 第5步：创建最终 response 并设置 session cookie =====
    // 关键：先完成所有逻辑确定 role，再创建唯一的 response 对象设置 cookie
    // 这样 Set-Cookie 头和 JSON body 在同一个 HTTP 响应中返回
    console.log('[Login API] 第5步：设置 session cookie...')

    // expires_at 兜底：某些 Supabase 版本 /auth/v1/verify 响应不含 expires_at
    const expiresAt =
      sessionData.expires_at ??
      Math.floor(Date.now() / 1000) + (sessionData.expires_in ?? 3600)

    const tokenData = JSON.stringify({
      access_token: sessionData.access_token,
      refresh_token: sessionData.refresh_token,
      expires_at: expiresAt,
      expires_in: sessionData.expires_in ?? 3600,
      token_type: sessionData.token_type ?? 'bearer',
      user: sessionData.user,
    })

    // base64url 编码（@supabase/ssr 的 cookieEncoding 默认值）
    const encoded =
      'base64-' + Buffer.from(tokenData, 'utf-8').toString('base64url')

    const projectRef =
      supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? ''
    const cookieName = `sb-${projectRef}-auth-token`

    // @supabase/ssr DEFAULT_COOKIE_OPTIONS
    const cookieOptions = {
      path: '/',
      sameSite: 'lax' as const,
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 400 * 24 * 60 * 60, // 400 天
    }

    const MAX_CHUNK_SIZE = 3180

    // 创建最终 response（包含正确的 role）
    const response = NextResponse.json({ success: true, role })

    // 清除旧 cookie（避免残留脏数据）
    response.cookies.delete(cookieName)
    for (let i = 0; i < 10; i++) {
      response.cookies.delete(`${cookieName}.${i}`)
    }

    // 设置新 session cookie
    if (encoded.length <= MAX_CHUNK_SIZE) {
      response.cookies.set(cookieName, encoded, cookieOptions)
      console.log(
        '[Login API] Cookie 已设置（单 cookie）:',
        cookieName,
        '长度:',
        encoded.length
      )
    } else {
      const chunkCount = Math.ceil(encoded.length / MAX_CHUNK_SIZE)
      for (let i = 0; i < chunkCount; i++) {
        const chunk = encoded.slice(
          i * MAX_CHUNK_SIZE,
          (i + 1) * MAX_CHUNK_SIZE
        )
        response.cookies.set(`${cookieName}.${i}`, chunk, cookieOptions)
      }
      console.log(
        '[Login API] Cookie 已设置（分片）:',
        cookieName,
        '分片数:',
        chunkCount,
        '总长度:',
        encoded.length
      )
    }

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
