'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient, getSessionUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { saveOtp } from '@/lib/otp-store'
import { loginOtpEmailTemplate } from '@/lib/email-templates'
import type { Profile } from '@/types/database'
import { randomInt } from 'crypto'
import { headers, cookies } from 'next/headers'
import { checkRateLimit } from '@/lib/rate-limit'
import { validateCsrf } from '@/lib/csrf'
import { getSupabaseCookieName } from '@/lib/supabase/cookie-utils'
import { getOrCreateProfile } from '@/lib/profile'
import { RATE_LIMIT_OTP_WINDOW, RATE_LIMIT_OTP_MAX, DEFAULT_FROM_EMAIL } from '@/lib/constants'

// ==================== 发送邮箱验证码 ====================

export async function sendEmailOtp(
  email: string
): Promise<{ success: boolean; error?: string }> {
  // CSRF 保护
  const csrfError = await validateCsrf()
  if (csrfError) {
    return { success: false, error: csrfError }
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: '请输入有效的邮箱地址' }
  }

  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

  // 基于 IP 的速率限制
  const ipRateLimit = await checkRateLimit(`ip:${ip}`, RATE_LIMIT_OTP_MAX, RATE_LIMIT_OTP_WINDOW)
  if (!ipRateLimit.allowed) {
    return { success: false, error: '请求过于频繁，请1分钟后再试' }
  }

  // 基于邮箱的速率限制
  const emailRateLimit = await checkRateLimit(`email:${email.toLowerCase()}`, RATE_LIMIT_OTP_MAX, RATE_LIMIT_OTP_WINDOW)
  if (!emailRateLimit.allowed) {
    return { success: false, error: '该邮箱请求过于频繁，请稍后再试' }
  }

  try {
    // C3 安全修复：不再在发送验证码时创建用户
    // 原代码调用 admin.auth.admin.createUser({ email, email_confirm: true })
    // 会在用户验证 OTP 之前就创建已验证邮箱的用户，存在安全风险：
    // 1. 攻击者可利用此机制为任意邮箱创建已验证账户
    // 2. 用户邮箱在未验证前就被标记为已确认
    //
    // 修复方案：用户在登录流程中通过 generateLink(magiclink) 自动创建，
    // 此时 OTP 验证已通过，确保只有验证了邮箱的用户才会被创建。

    // 生成 6 位验证码
    const otpCode = String(randomInt(100000, 1000000))

    // 存入数据库（10分钟有效）
    await saveOtp(email, otpCode)

    // 发送验证码邮件
    const resendApiKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.RESEND_FROM_EMAIL || DEFAULT_FROM_EMAIL

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
      console.log('[OTP] 验证码已生成（未配置邮件服务）')
    }

    return { success: true }
  } catch (error) {
    console.error('发送验证码异常:', error)
    return { success: false, error: '发送验证码时发生未知错误' }
  }
}

// ==================== 用户登出 ====================

export async function logoutUser(): Promise<{ success: boolean; error?: string }> {
  // CSRF 保护
  const csrfError = await validateCsrf()
  if (csrfError) {
    return { success: false, error: csrfError }
  }

  const supabase = await createClient()

  try {
    await supabase.auth.signOut()
  } catch (error) {
    console.error('登出异常:', error)
    // 即使 signOut 失败也继续清除 cookie
  }

  // 手动清除所有 session cookie（含分片），防止残留 cookie 恢复 session
  try {
    const cookieStore = await cookies()
    const cookieName = getSupabaseCookieName()
    const allCookies = cookieStore.getAll()

    // 清除主 cookie
    cookieStore.set(cookieName, '', { path: '/', maxAge: 0 })

    // 清除所有分片 cookie (sb-xxx-auth-token.0, .1, ...)
    for (const c of allCookies) {
      if (c.name.startsWith(`${cookieName}.`)) {
        cookieStore.set(c.name, '', { path: '/', maxAge: 0 })
      }
    }
  } catch {
    // cookie 清除失败不阻断登出流程
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
  try {
    const user = await getSessionUser()

    if (!user) {
      return { success: false, error: '未获取到会话信息' }
    }

    // 使用 admin 客户端查询 profile，绕过 anon key 的 API 问题
    const admin = createAdminClient()
    const { data: existingProfile, error: profileError } = await admin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      console.error('获取用户信息失败:', profileError.message)
      return { success: false, error: '获取用户资料失败' }
    }

    const profile = existingProfile ?? await getOrCreateProfile(admin, user.id, {
      email: user.email,
    })
    if (!profile.is_active) return { success: false, error: '账户已停用' }

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
