'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateProfile } from '@/lib/profile'
import { saveOtp, verifyOtp, hasActiveOtp, consumeOtp } from '@/lib/otp-store'
import { loginOtpEmailTemplate } from '@/lib/email-templates'
import type { Profile } from '@/types/database'
import { randomInt } from 'crypto'
import { headers } from 'next/headers'

// ==================== 邮箱验证码速率限制 ====================

interface OtpRateLimitEntry {
  count: number
  resetAt: number
}

const otpRateLimitStore = new Map<string, OtpRateLimitEntry>()
const OTP_RATE_LIMIT_WINDOW = 60 * 1000
const OTP_RATE_LIMIT_MAX = 3

if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of otpRateLimitStore.entries()) {
      if (entry.resetAt < now) {
        otpRateLimitStore.delete(key)
      }
    }
  }, 5 * 60 * 1000)
}

function checkOtpRateLimit(key: string): boolean {
  const now = Date.now()
  const entry = otpRateLimitStore.get(key)

  if (!entry || entry.resetAt < now) {
    otpRateLimitStore.set(key, { count: 1, resetAt: now + OTP_RATE_LIMIT_WINDOW })
    return true
  }

  if (entry.count >= OTP_RATE_LIMIT_MAX) {
    return false
  }

  entry.count++
  return true
}

// ==================== 发送邮箱验证码 ====================

export async function sendEmailOtp(
  email: string
): Promise<{ success: boolean; error?: string }> {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: '请输入有效的邮箱地址' }
  }

  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!checkOtpRateLimit(`ip:${ip}`)) {
    return { success: false, error: '请求过于频繁，请1分钟后再试' }
  }
  if (!checkOtpRateLimit(`email:${email.toLowerCase()}`)) {
    return { success: false, error: '该邮箱请求过于频繁，请稍后再试' }
  }

  const admin = createAdminClient()

  try {
    // 直接尝试创建用户，如果已存在会返回错误，忽略即可
    // 比 listUsers() 高效得多（后者会拉取所有用户）
    await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    })

    // 生成 6 位验证码
    const otpCode = String(randomInt(100000, 1000000))

    // 存入数据库（10分钟有效）
    await saveOtp(email, otpCode)

    // 发送验证码邮件
    const resendApiKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@longwoo.studio'

    if (resendApiKey) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: email,
          subject: '【LongWoo 龙坞】登录验证码',
          html: loginOtpEmailTemplate(otpCode),
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Resend 发送失败:', errorText)
        return { success: false, error: '验证码邮件发送失败，请稍后重试或联系客服' }
      }
    } else {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      console.log(`📧 邮箱验证码 [${email}]: ${otpCode}`)
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)
    }

    return { success: true }
  } catch (error) {
    console.error('发送验证码异常:', error)
    return { success: false, error: '发送验证码时发生未知错误' }
  }
}

// ==================== 验证邮箱验证码并登录 ====================
//
// 核心流程：
// 1. 从数据库校验验证码（不消费，失败可重试）
// 2. 调用 admin.generateLink 获取 magic link token_hash（send_email: false）
// 3. 直接 HTTP POST 到 /auth/v1/verify 交换 session token
// 4. 手动用 base64url 编码写入 cookie（完全模拟 @supabase/ssr 的 applyServerStorage）
//    — 不依赖 SSR 客户端的 onAuthStateChange 回调
//    — 该回调在 Server Action 中异步执行，可能在响应提交前未完成
// 5. 会话建立成功后消费验证码
// 6. 创建/获取 profile

export async function verifyEmailOtpAndLogin(
  email: string,
  code: string
): Promise<{
  success: boolean
  role?: string
  error?: string
}> {
  if (!email || !code) {
    return { success: false, error: '请输入邮箱和验证码' }
  }

  if (code.length !== 6) {
    return { success: false, error: '请输入6位验证码' }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  try {
    const startTime = Date.now()
    console.log('[Login] ===== 开始验证码登录流程 =====', { email, timestamp: new Date().toISOString() })

    // 第1步：校验验证码（不消费，以便后续失败时用户可重试）
    console.log('[Login] 第1步：校验验证码...')
    const result = await verifyOtp(email, code, false)
    console.log('[Login] 第1步完成：', result.valid, '耗时' + (Date.now() - startTime) + 'ms')

    if (!result.valid) {
      return { success: false, error: '验证码无效或已过期，请重新获取' }
    }

    // 第2步：生成 magic link（必须禁用邮件发送）
    console.log('[Login] 第2步：生成 magic link...')
    const step2Start = Date.now()
    const admin = createAdminClient()
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        send_email: false,
      } as Record<string, unknown>,
    } as Parameters<typeof admin.auth.admin.generateLink>[0])

    if (linkError || !linkData) {
      console.error('[Login] generateLink 失败:', linkError?.message, linkError?.status)
      return { success: false, error: '生成登录令牌失败，请稍后重试' }
    }

    const tokenHash = linkData.properties?.hashed_token
    console.log('[Login] 第2步完成：token_hash 已获取 耗时' + (Date.now() - step2Start) + 'ms')
    if (!tokenHash) {
      console.error('[Login] token_hash 缺失')
      return { success: false, error: '登录令牌异常，请稍后重试' }
    }

    // 第3步：直接 HTTP POST 到 /auth/v1/verify 交换 session
    console.log('[Login] 第3步：验证 token 获取 session...')
    const step3Start = Date.now()
    const verifyResponse = await fetch(`${supabaseUrl}/auth/v1/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify({
        token_hash: tokenHash,
        type: 'magiclink',
      }),
    })

    if (!verifyResponse.ok) {
      const errText = await verifyResponse.text()
      console.error('[Login] verify 失败:', verifyResponse.status, errText)
      return { success: false, error: '令牌验证失败，请重新获取验证码' }
    }

    const sessionData = await verifyResponse.json()

    if (!sessionData.access_token || !sessionData.refresh_token || !sessionData.user?.id) {
      console.error('[Login] verify 返回数据不完整')
      return { success: false, error: '令牌验证失败，请重新获取验证码' }
    }

    // 第4步：手动用 base64url 编码写入 session cookie
    console.log('[Login] 第4步：写入 session cookie...')
    //
    // 完全模拟 @supabase/ssr v0.12 的 applyServerStorage 逻辑：
    //   1. JSON.stringify(session)
    //   2. "base64-" + base64url( jsonString )   ← cookieEncoding 默认 "base64url"
    //   3. 按 encodeURIComponent 后的长度分片（每片 ≤ 3180）
    //   4. cookieStore.set( name, chunk, options )
    //
    // 之前失败的原因：
    //   - v1: 手动写 raw JSON → URL 编码后膨胀超 4096B → 浏览器丢弃
    //   - v2: setSession/verifyOtp → onAuthStateChange 异步回调在 Server Action
    //         中可能未执行完毕就被 Next.js 提交响应 → cookie 未写入
    const cookieStore = await cookies()

    const tokenData = JSON.stringify({
      access_token: sessionData.access_token,
      refresh_token: sessionData.refresh_token,
      expires_at: sessionData.expires_at,
      expires_in: sessionData.expires_in ?? 3600,
      token_type: sessionData.token_type ?? 'bearer',
      user: sessionData.user,
    })

    // base64url 编码（@supabase/ssr 的 cookieEncoding 默认值）
    const encoded = 'base64-' + Buffer.from(tokenData, 'utf-8').toString('base64url')

    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? ''
    const cookieName = `sb-${projectRef}-auth-token`

    // @supabase/ssr DEFAULT_COOKIE_OPTIONS（createServerClient 不传 cookieOptions 时使用）
    const cookieOptions = {
      path: '/',
      sameSite: 'lax' as const,
      httpOnly: false,          // @supabase/ssr 默认 false
      secure: process.env.NODE_ENV === 'production',
      maxAge: 400 * 24 * 60 * 60,  // 400 天，与 @supabase/ssr 一致
    }

    // 分片逻辑（与 @supabase/ssr createChunks 一致）
    // base64url 编码后只含 [A-Za-z0-9-] 和前缀 "base64-"，
    // encodeURIComponent 不改变长度，可直接按原始长度切分
    const MAX_CHUNK_SIZE = 3180

    // 先清除可能存在的旧分片 cookie（避免残留脏数据）
    cookieStore.delete(cookieName)
    for (let i = 0; i < 10; i++) {
      cookieStore.delete(`${cookieName}.${i}`)
    }

    if (encoded.length <= MAX_CHUNK_SIZE) {
      cookieStore.set(cookieName, encoded, cookieOptions)
    } else {
      const chunkCount = Math.ceil(encoded.length / MAX_CHUNK_SIZE)
      for (let i = 0; i < chunkCount; i++) {
        const chunk = encoded.slice(i * MAX_CHUNK_SIZE, (i + 1) * MAX_CHUNK_SIZE)
        cookieStore.set(`${cookieName}.${i}`, chunk, cookieOptions)
      }
    }

    // 第5+6步：并行执行消费验证码和创建/获取 profile
    console.log('[Login] 第5+6步：并行消费验证码和获取 profile...')
    const step56Start = Date.now()
    const userId = sessionData.user.id
    const userEmail = sessionData.user.email ?? email

    const [, profileResult] = await Promise.all([
      consumeOtp(email, code),
      getOrCreateProfile(admin, userId, { email: userEmail }),
    ])

    console.log('[Login] 第5+6步完成 耗时' + (Date.now() - step56Start) + 'ms 总耗时' + (Date.now() - startTime) + 'ms')

    // 移除 revalidatePath('/') - 可能导致 Server Action 响应被中止
    // 客户端 redirectByRole 会通过 router.push 触发页面刷新
    return { success: true, role: profileResult?.role ?? 'user' }
  } catch (error) {
    console.error('[Login] 验证码登录异常:', error instanceof Error ? error.message : String(error))
    if (error instanceof Error && error.stack) {
      console.error('[Login] 堆栈:', error.stack)
    }
    return { success: false, error: '验证时发生未知错误，请稍后重试' }
  }
}

// ==================== 登录后确保 Profile 存在 ====================

export async function ensureProfileAfterLogin(userInfo: {
  userId: string
  email: string
}): Promise<{
  success: boolean
  role?: string
  error?: string
}> {
  const supabase = createAdminClient()

  try {
    const profile = await getOrCreateProfile(supabase, userInfo.userId, {
      email: userInfo.email,
    })

    revalidatePath('/')
    return { success: true, role: profile?.role ?? 'user' }
  } catch (error) {
    console.error('确保 Profile 异常:', error)
    return { success: false, error: '处理用户信息时发生未知错误' }
  }
}

// ==================== 用户登录（邮箱密码） ====================

export async function loginUser(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/')
    return { success: true }
  } catch (error) {
    console.error('登录异常:', error)
    return { success: false, error: '登录时发生未知错误' }
  }
}

// ==================== 用户登出 ====================

export async function logoutUser(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  let signOutError: string | null = null

  try {
    const { error } = await supabase.auth.signOut()

    if (error) {
      signOutError = error.message
    }
  } catch (error) {
    console.error('登出异常:', error)
    return { success: false, error: '登出时发生未知错误' }
  }

  if (signOutError) {
    return { success: false, error: signOutError }
  }

  revalidatePath('/')
  redirect('/login')
}

// ==================== 获取当前会话和用户信息 ====================

export async function getSession(): Promise<{
  success: boolean
  session?: {
    user: {
      id: string
      email: string | null | undefined
    }
  }
  profile?: Profile | null
  error?: string
}> {
  const supabase = await createClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return { success: false, error: '未获取到会话信息' }
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('获取用户信息失败:', profileError.message)
      const admin = createAdminClient()
      const { data: adminProfile } = await admin
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      return {
        success: true,
        session: {
          user: {
            id: user.id,
            email: user.email,
          },
        },
        profile: (adminProfile as Profile) ?? null,
      }
    }

    return {
      success: true,
      session: {
        user: {
          id: user.id,
          email: user.email,
        },
      },
      profile: profile as Profile,
    }
  } catch (error) {
    console.error('获取会话异常:', error)
    return { success: false, error: '获取会话时发生未知错误' }
  }
}

// ==================== QQ OAuth 登录 ====================

export async function isQQConfigured(): Promise<boolean> {
  return !!(process.env.QQ_CLIENT_ID && process.env.QQ_CLIENT_SECRET)
}

export async function signInWithQQ(): Promise<{
  success: boolean
  error?: string
  url?: string
}> {
  try {
    const clientId = process.env.QQ_CLIENT_ID

    if (!clientId || !process.env.QQ_CLIENT_SECRET) {
      return { success: false, error: 'QQ登录暂未配置，请在环境变量中设置 QQ_CLIENT_ID 和 QQ_CLIENT_SECRET' }
    }

    return { success: true, url: '/auth/qq' }
  } catch (error) {
    console.error('QQ 登录异常:', error)
    return { success: false, error: 'QQ 登录时发生未知错误' }
  }
}
