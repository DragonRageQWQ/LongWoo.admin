import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOtp, consumeOtp } from '@/lib/otp-store'
import { getOrCreateProfile } from '@/lib/profile'
import {
  encodeSessionCookie,
  getSessionCookieNames,
  getSupabaseCookieName,
  SECURE_COOKIE_OPTIONS,
} from '@/lib/supabase/cookie-utils'
import { checkRateLimit } from '@/lib/rate-limit'
import { validateApiCsrf } from '@/lib/api-csrf'
import { RATE_LIMIT_OTP_WINDOW } from '@/lib/constants'

// Vercel Hobby 计划默认超时 10 秒，认证流程含 5+ API 调用需要更长时间
export const maxDuration = 60
export const dynamic = 'force-dynamic'

// 条件日志：仅在 DEBUG_AUTH 环境变量启用时输出详细日志
const DEBUG_AUTH = process.env.DEBUG_AUTH === 'true'
function debugLog(...args: unknown[]) {
  if (DEBUG_AUTH) console.log(...args)
}
function debugError(...args: unknown[]) {
  if (DEBUG_AUTH) console.error(...args)
}

/**
 * 邮箱验证码登录 API Route Handler
 *
 * 安全措施：
 *   - Origin/CSRF 校验
 *   - 基于 IP 和邮箱的数据库速率限制（防止暴力破解）
 *   - 验证码延迟消费（建立会话失败时验证码仍有效）
 *   - 手动 base64url cookie 编码（避免 setSession 刷新问题）
 */
export async function POST(request: Request) {
  const startTime = Date.now()

  // ===== CSRF 校验（解析 body 之前） =====
  const csrfError = validateApiCsrf(request)
  if (csrfError) {
    return csrfError
  }

  // 获取客户端 IP（用于速率限制）
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

  try {
    const body = await request.json()
    const { email, code, password } = body as {
      email?: string
      code?: string
      password?: string
    }

    if (!email || (!code && !password)) {
      return NextResponse.json(
        { success: false, error: '请输入完整登录信息' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json(
        { success: false, error: '请输入有效的邮箱地址' },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    // 密码登录也走 Route Handler，确保 Set-Cookie 在标准 HTTP 响应中可靠持久化。
    if (password) {
      if (password.length < 6 || password.length > 64) {
        return NextResponse.json(
          { success: false, error: '邮箱或密码错误' },
          { status: 400 }
        )
      }

      const [ipLimit, emailLimit] = await Promise.all([
        checkRateLimit(`passwordlogin:ip:${ip}`, 10, RATE_LIMIT_OTP_WINDOW),
        checkRateLimit(`passwordlogin:email:${normalizedEmail}`, 5, RATE_LIMIT_OTP_WINDOW),
      ])
      if (!ipLimit.allowed || !emailLimit.allowed) {
        return NextResponse.json(
          { success: false, error: '登录尝试过于频繁，请稍后再试' },
          { status: 429 }
        )
      }

      const passwordResponse = await fetch(
        `${supabaseUrl}/auth/v1/token?grant_type=password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseAnonKey,
          },
          body: JSON.stringify({ email: normalizedEmail, password }),
          cache: 'no-store',
        }
      )

      if (!passwordResponse.ok) {
        return NextResponse.json(
          { success: false, error: '邮箱或密码错误' },
          { status: 401 }
        )
      }

      const passwordSession = await passwordResponse.json()
      if (!passwordSession.access_token || !passwordSession.refresh_token || !passwordSession.user?.id) {
        return NextResponse.json(
          { success: false, error: '登录会话创建失败，请稍后重试' },
          { status: 500 }
        )
      }

      const admin = createAdminClient()
      const passwordProfile = await getOrCreateProfile(admin, passwordSession.user.id, {
        email: passwordSession.user.email ?? normalizedEmail,
        hasPassword: true,
      })
      if (!passwordProfile.is_active) {
        return NextResponse.json(
          { success: false, error: '账户已停用，请联系管理员' },
          { status: 403 }
        )
      }

      const passwordExpiresAt = passwordSession.expires_at
        ?? Math.floor(Date.now() / 1000) + (passwordSession.expires_in ?? 3600)
      const response = NextResponse.json({ success: true, role: passwordProfile.role })
      setSessionCookies(request, response, {
        access_token: passwordSession.access_token,
        refresh_token: passwordSession.refresh_token,
        expires_at: passwordExpiresAt,
        expires_in: passwordSession.expires_in ?? 3600,
        token_type: passwordSession.token_type ?? 'bearer',
        user: passwordSession.user,
      })
      return response
    }

    if (!code || code.length !== 6) {
      return NextResponse.json(
        { success: false, error: '请输入6位验证码' },
        { status: 400 }
      )
    }

    // ===== 速率限制：基于 IP（每分钟最多10次登录尝试） =====
    const ipRateLimit = await checkRateLimit(
      `login:${ip}`,
      10,
      RATE_LIMIT_OTP_WINDOW
    )
    if (!ipRateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: '尝试过于频繁，请1分钟后再试' },
        { status: 429 }
      )
    }

    // ===== 速率限制：基于邮箱（每分钟最多5次登录尝试） =====
    const emailRateLimit = await checkRateLimit(
      `login:${normalizedEmail}`,
      5,
      RATE_LIMIT_OTP_WINDOW
    )
    if (!emailRateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: '该邮箱尝试过于频繁，请稍后再试' },
        { status: 429 }
      )
    }

    debugLog('[Login API] ===== 开始验证码登录 =====', {
      email: email.replace(/(.{2}).*(@.*)/, '$1***$2'),
      timestamp: new Date().toISOString(),
    })

    // ===== 第1步：校验验证码（不消费） =====
    debugLog('[Login API] 第1步：校验验证码...')
    const otpResult = await verifyOtp(normalizedEmail, code, false)
    debugLog(
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
    debugLog('[Login API] 第2步：生成 magic link...')
    const step2Start = Date.now()
    const admin = createAdminClient()
    const { data: linkData, error: linkError } =
      await admin.auth.admin.generateLink({
        type: 'magiclink',
        email: normalizedEmail,
        options: {
          send_email: false,
        } as Record<string, unknown>,
      } as Parameters<typeof admin.auth.admin.generateLink>[0])

    if (linkError || !linkData) {
      debugError(
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
    debugLog(
      '[Login API] 第2步完成：token_hash 已获取 耗时' +
        (Date.now() - step2Start) +
        'ms'
    )

    if (!tokenHash) {
      debugError('[Login API] token_hash 缺失')
      return NextResponse.json(
        { success: false, error: '登录令牌异常，请稍后重试' },
        { status: 500 }
      )
    }

    // ===== 第3步：HTTP POST 到 /auth/v1/verify 交换 session =====
    debugLog('[Login API] 第3步：验证 token 获取 session...')
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
      debugError(
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
      debugError('[Login API] verify 返回数据不完整')
      return NextResponse.json(
        { success: false, error: '令牌验证失败，请重新获取验证码' },
        { status: 500 }
      )
    }

    debugLog(
      '[Login API] 第3步完成 耗时' + (Date.now() - step3Start) + 'ms'
    )

    // ===== 第4步：先确保 profile 持久化成功，再消费验证码 =====
    debugLog('[Login API] 第4步：创建或读取 profile...')
    const step4Start = Date.now()
    const userId = sessionData.user.id
    const userEmail = sessionData.user.email ?? normalizedEmail

    const profileResult = await getOrCreateProfile(admin, userId, { email: userEmail })

    if (!profileResult.is_active) {
      return NextResponse.json(
        { success: false, error: '账户已停用，请联系管理员' },
        { status: 403 }
      )
    }
    const role = profileResult.role
    await consumeOtp(normalizedEmail, code)

    debugLog(
      '[Login API] 第4步完成 耗时' +
        (Date.now() - step4Start) +
        'ms 总耗时' +
        (Date.now() - startTime) +
        'ms'
    )

    // ===== 第5步：手动设置 Supabase 格式的 cookie =====
    debugLog('[Login API] 第5步：手动设置 cookie...')

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

    // 创建 response 对象
    const response = NextResponse.json({ success: true, role })
    const cookieParts = setSessionCookies(request, response, session)

    debugLog('[Login API] cookie 设置完成，共', cookieParts.length, '个')
    debugLog('[Login API] ===== 登录成功 =====', {
      email: email.replace(/(.{2}).*(@.*)/, '$1***$2'),
      role,
      totalMs: Date.now() - startTime,
    })

    return response
  } catch (error) {
    // 异常始终记录（无论 DEBUG_AUTH 是否开启）
    console.error(
      '[Login API] 异常:',
      error instanceof Error ? error.message : String(error)
    )
    return NextResponse.json(
      { success: false, error: '验证时发生未知错误，请稍后重试' },
      { status: 500 }
    )
  }
}

function setSessionCookies(
  request: Request,
  response: NextResponse,
  session: Record<string, unknown>
): Array<{ name: string; value: string }> {
  const requestCookieNames = (request.headers.get('cookie') ?? '')
    .split(';')
    .map(part => part.trim().split('=')[0])
    .filter((name): name is string => Boolean(name))
    .map(name => ({ name }))

  getSessionCookieNames(requestCookieNames).forEach(name => {
    response.cookies.set(name, '', { ...SECURE_COOKIE_OPTIONS, maxAge: 0 })
  })

  // 额外清理常见旧分片，避免 session 变短后残留高编号分片。
  const cookieName = getSupabaseCookieName()
  for (let index = 0; index < 8; index += 1) {
    response.cookies.set(`${cookieName}.${index}`, '', {
      ...SECURE_COOKIE_OPTIONS,
      maxAge: 0,
    })
  }
  response.cookies.set(cookieName, '', { ...SECURE_COOKIE_OPTIONS, maxAge: 0 })

  const cookieParts = encodeSessionCookie(session)
  cookieParts.forEach(({ name, value }) => {
    response.cookies.set(name, value, SECURE_COOKIE_OPTIONS)
  })
  return cookieParts
}
