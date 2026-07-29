'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
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
// 2. 调用 generateLink 获取 magic link token_hash
// 3. HTTP POST 到 /auth/v1/verify 交换 session token
// 4. 使用 SSR 客户端的 setSession() 设置会话
//    — setSession 内部会通过 onAuthStateChange → applyServerStorage
//      自动以 base64url 编码 + 正确分片写入 cookie
//    — 之前的手动 cookie 设置因未做 base64url 编码，
//      URL 编码后超出 4096 字节限制被浏览器静默丢弃
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
    // 第1步：校验验证码（不消费，以便后续失败时用户可重试）
    const result = await verifyOtp(email, code, false)

    if (!result.valid) {
      return { success: false, error: '验证码无效或已过期，请重新获取' }
    }

    // 第2步：生成 magic link（admin API 默认不发送邮件）
    const admin = createAdminClient()
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })

    if (linkError || !linkData) {
      console.error('生成 magic link 失败:', linkError?.message)
      return { success: false, error: '登录失败，请重新获取验证码' }
    }

    const tokenHash = linkData.properties?.hashed_token
    if (!tokenHash) {
      console.error('token_hash 数据不完整')
      return { success: false, error: '登录失败，请重新获取验证码' }
    }

    // 第3步：交换 token_hash 获取 session token
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
      console.error('Supabase verify 失败:', verifyResponse.status, errText)
      return { success: false, error: '登录失败，请重新获取验证码' }
    }

    const sessionData = await verifyResponse.json()

    if (!sessionData.access_token || !sessionData.refresh_token) {
      console.error('verify 返回数据不完整')
      return { success: false, error: '登录失败，请重新获取验证码' }
    }

    // 第4步：使用 SSR 客户端的 setSession 写入会话 cookie
    //
    // 关键：必须用 setSession 而非手动 cookieStore.set
    // @supabase/ssr v0.12 默认 cookieEncoding="base64url"
    // setSession → onAuthStateChange → applyServerStorage
    //   → 以 "base64-" 前缀 + base64url 编码写入
    //   → 按 encodeURIComponent 后的长度正确分片
    // 手动写 raw JSON 会被 Next.js cookie.serialize URL 编码
    //   → 超过 4096 字节 → 浏览器静默丢弃
    const supabase = await createClient()
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: sessionData.access_token,
      refresh_token: sessionData.refresh_token,
    })

    if (sessionError) {
      console.error('setSession 失败:', sessionError.message)
      return { success: false, error: '登录失败，请重新获取验证码' }
    }

    // 第5步：会话建立成功，消费验证码
    await consumeOtp(email, code)

    // 第6步：创建/获取 profile
    const userId = sessionData.user?.id
    const userEmail = sessionData.user?.email ?? email
    const profile = userId
      ? await getOrCreateProfile(admin, userId, { email: userEmail })
      : null

    revalidatePath('/')
    return { success: true, role: profile?.role ?? 'user' }
  } catch (error) {
    console.error('验证码登录异常:', error)
    return { success: false, error: '验证时发生未知错误' }
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
