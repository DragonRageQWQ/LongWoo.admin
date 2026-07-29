'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateProfile } from '@/lib/profile'
import { saveOtp, verifyOtp, hasActiveOtp } from '@/lib/otp-store'
import { loginOtpEmailTemplate } from '@/lib/email-templates'
import type { Profile } from '@/types/database'
import { randomInt } from 'crypto'
import { headers } from 'next/headers'

// ==================== 邮箱验证码速率限制 ====================
// 基于 IP + 邮箱组合做限制，防止邮件轰炸和垃圾用户注册

interface OtpRateLimitEntry {
  count: number
  resetAt: number
}

const otpRateLimitStore = new Map<string, OtpRateLimitEntry>()
const OTP_RATE_LIMIT_WINDOW = 60 * 1000  // 1 分钟窗口
const OTP_RATE_LIMIT_MAX = 3             // 每分钟最多 3 次
const OTP_COOLDOWN = 60 * 1000           // 同一邮箱 60 秒冷却

// 定期清理过期项
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
    otpRateLimitStore.set(key, {
      count: 1,
      resetAt: now + OTP_RATE_LIMIT_WINDOW,
    })
    return true
  }

  if (entry.count >= OTP_RATE_LIMIT_MAX) {
    return false
  }

  entry.count++
  return true
}

// ==================== 发送邮箱验证码（自定义 OTP 系统） ====================
//
// 完全绕过 Supabase 内置的 signInWithOtp（默认发送魔法链接而非数字验证码）
// 改用 admin 客户端的 generateLink API：
// 1. 生成 magic link 并提取 email_otp（6位数字）和 hashed_token
// 2. 将 { email → code, tokenHash } 存入内存（10分钟有效）
// 3. 通过 Resend 发送验证码邮件（如已配置）或输出到控制台（dev 模式）
// 4. 用户输入验证码后，服务端校验并返回 tokenHash
// 5. 客户端用 tokenHash 调用 verifyOtp 建立会话

export async function sendEmailOtp(
  email: string
): Promise<{ success: boolean; error?: string }> {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: '请输入有效的邮箱地址' }
  }

  // 速率限制：基于 IP 和邮箱
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
    // 尝试为已有用户生成 magic link（不发送 Supabase 默认邮件）
    // send_email 不在 TS 类型定义中但 API 运行时支持，用 as 断言
    let { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { send_email: false } as Record<string, unknown>,
    } as Parameters<typeof admin.auth.admin.generateLink>[0])

    // 用户不存在时，先创建用户再生成 link
    if (linkError) {
      const { error: createError } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
      })

      if (createError) {
        console.error('创建用户失败:', createError.message)
        return { success: false, error: '发送验证码失败，请稍后重试' }
      }

      // 重新生成 magic link
      const retry = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: { send_email: false } as Record<string, unknown>,
      } as Parameters<typeof admin.auth.admin.generateLink>[0])

      linkData = retry.data
      linkError = retry.error
    }

    if (linkError || !linkData) {
      console.error('生成验证码失败:', linkError?.message)
      return { success: false, error: '发送验证码失败，请稍后重试' }
    }

    // 提取 token_hash（用于后续建立会话）
    const tokenHash = linkData.properties?.hashed_token

    if (!tokenHash) {
      console.error('token_hash 数据不完整')
      return { success: false, error: '生成验证码失败' }
    }

    // 使用密码学安全的随机数生成 6 位验证码
    const otpCode = String(randomInt(100000, 1000000))

    // 存入数据库（10分钟有效，自动降级为内存存储）
    await saveOtp(email, otpCode, tokenHash)

    // 发送验证码邮件
    const resendApiKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@longwoo.studio'

    if (resendApiKey) {
      try {
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
          // 邮件发送失败时返回错误，不再静默吞掉
          return {
            success: false,
            error: '验证码邮件发送失败，请稍后重试或联系客服',
          }
        }
      } catch (err) {
        console.error('邮件发送异常:', err)
        return {
          success: false,
          error: '邮件服务暂时不可用，请稍后重试',
        }
      }
    } else {
      // Dev 模式：输出到控制台
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      console.log(`📧 邮箱验证码 [${email}]: ${otpCode}`)
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)
    }

    // 验证码仅通过邮件发送，不返回给前端
    return {
      success: true,
    }
  } catch (error) {
    console.error('发送验证码异常:', error)
    return { success: false, error: '发送验证码时发生未知错误' }
  }
}

// ==================== 验证邮箱验证码 ====================
//
// 服务端校验验证码，返回 tokenHash 供客户端建立会话

export async function verifyEmailOtpAndLogin(
  email: string,
  code: string
): Promise<{
  success: boolean
  tokenHash?: string
  error?: string
}> {
  if (!email || !code) {
    return { success: false, error: '请输入邮箱和验证码' }
  }

  if (code.length !== 6) {
    return { success: false, error: '请输入6位验证码' }
  }

  try {
    const result = await verifyOtp(email, code)

    if (!result.valid) {
      return { success: false, error: '验证码无效或已过期，请重新获取' }
    }

    return { success: true, tokenHash: result.tokenHash }
  } catch (error) {
    console.error('验证码校验异常:', error)
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

// ==================== 用户登录（邮箱密码，保留给管理员使用） ====================

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
    // 使用 getUser() 替代 getSession()，确保 JWT 与 Supabase 服务器验证
    // getSession() 仅从 cookie 读取，不验证有效性，可被伪造
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
      // 尝试用 admin 客户端获取（可能 RLS 问题）
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
