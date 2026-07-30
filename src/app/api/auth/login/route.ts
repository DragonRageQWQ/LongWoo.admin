import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOtp, consumeOtp } from '@/lib/otp-store'
import { getOrCreateProfile } from '@/lib/profile'
import {
  encodeSessionCookie,
  getSupabaseCookieName,
  SECURE_COOKIE_OPTIONS,
} from '@/lib/supabase/cookie-utils'
import { checkRateLimit } from '@/lib/rate-limit'
import { validateApiCsrf } from '@/lib/api-csrf'
import { RATE_LIMIT_OTP_WINDOW, RATE_LIMIT_OTP_MAX } from '@/lib/constants'

// Vercel Hobby 计划默认超时 10 秒，认证流程含 5+ API 调用需要更长时间
export const maxDuration = 60

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
      `login:${email.toLowerCase()}`,
      5,
      RATE_LIMIT_OTP_WINDOW
    )
    if (!emailRateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: '该邮箱尝试过于频繁，请稍后再试' },
        { status: 429 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    debugLog('[Login API] ===== 开始验证码登录 =====', {
      email: email.replace(/(.{2}).*(@.*)/, '$1***$2'),
      timestamp: new Date().toISOString(),
    })

    // ===== 第1步：校验验证码（不消费） =====
    debugLog('[Login API] 第1步：校验验证码...')
    const otpResult = await verifyOtp(email, code, false)
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
        email,
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

    // ===== 第4步：并行消费验证码和获取 profile =====
    debugLog('[Login API] 第4步：并行消费验证码和获取 profile...')
    const step4Start = Date.now()
    const userId = sessionData.user.id
    const userEmail = sessionData.user.email ?? email

    const [, profileResult] = await Promise.all([
      consumeOtp(email, code),
      getOrCreateProfile(admin, userId, { email: userEmail }),
    ])

    const role = profileResult?.role ?? 'user'

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

    // 使用统一的 cookie 工具获取 cookie 名称并编码 session（含分片支持）
    const cookieName = getSupabaseCookieName()
    const cookieParts = encodeSessionCookie(session)

    // 创建 response 对象
    const response = NextResponse.json({ success: true, role })

    // 设置 cookie（使用统一的安全选项）
    cookieParts.forEach(({ name, value }) => {
      debugLog(`[Login API] 设置 cookie: ${name} (长度: ${value.length})`)
      response.cookies.set(name, value, SECURE_COOKIE_OPTIONS)
    })

    // 如果有分片，需要清除主 cookie（避免读取冲突）
    if (cookieParts.length > 1) {
      response.cookies.set(cookieName, '', {
        ...SECURE_COOKIE_OPTIONS,
        maxAge: 0,
      })
    }

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
