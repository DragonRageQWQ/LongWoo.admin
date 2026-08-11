'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient, getSessionUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { saveOtp, verifyOtp } from '@/lib/otp-store'
import { loginOtpEmailTemplate, passwordResetOtpEmailTemplate } from '@/lib/email-templates'
import type { Profile } from '@/types/database'
import { randomInt } from 'crypto'
import { cookies } from 'next/headers'
import { checkRateLimit } from '@/lib/rate-limit'
import { validateCsrf } from '@/lib/csrf'
import { getSupabaseCookieName } from '@/lib/supabase/cookie-utils'
import { getOrCreateProfile } from '@/lib/profile'
import { getClientIp, sendEmail } from '@/lib/server-utils'
import { confirmPasswordSet } from '@/lib/password-confirm'
import { RATE_LIMIT_OTP_WINDOW, RATE_LIMIT_OTP_MAX, RATE_LIMIT_PASSWORD_WINDOW, RATE_LIMIT_PASSWORD_MAX } from '@/lib/constants'

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

  const ip = await getClientIp()

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

    // 发送验证码邮件（使用统一的邮件发送函数）
    if (process.env.RESEND_API_KEY) {
      const sent = await sendEmail(
        email,
        '【LongWoo 龙坞】登录验证码',
        loginOtpEmailTemplate(otpCode)
      )
      if (!sent) {
        console.error('Resend 发送失败')
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

// ==================== 忘记密码：发送邮箱验证码 ====================

/**
 * 发送密码重置验证码到邮箱
 *
 * 使用场景：
 * - 已登录（个人中心-账号安全）：不传 email，使用当前会话邮箱（防止向任意邮箱发送）
 * - 未登录（登录页"忘记密码"）：传入 email
 *
 * 安全：
 * - CSRF 保护
 * - 基于 IP 与邮箱的双重速率限制
 * - 防枚举：邮箱未注册时同样返回成功（不透露账号是否存在）
 */
export async function sendPasswordResetOtp(
  email?: string
): Promise<{ success: boolean; error?: string }> {
  // CSRF 保护
  const csrfError = await validateCsrf()
  if (csrfError) {
    return { success: false, error: csrfError }
  }

  // 邮箱来源：优先使用传入邮箱；已登录但未传邮箱时使用会话邮箱
  let targetEmail = email?.trim().toLowerCase()
  if (!targetEmail) {
    const user = await getSessionUser()
    if (!user?.email) {
      return { success: false, error: '未获取到邮箱信息，请直接输入邮箱' }
    }
    targetEmail = user.email.toLowerCase()
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
    return { success: false, error: '请输入有效的邮箱地址' }
  }

  const ip = await getClientIp()

  // 基于 IP 的速率限制
  const ipRateLimit = await checkRateLimit(`ip:${ip}`, RATE_LIMIT_OTP_MAX, RATE_LIMIT_OTP_WINDOW)
  if (!ipRateLimit.allowed) {
    return { success: false, error: '请求过于频繁，请1分钟后再试' }
  }

  // 基于邮箱的速率限制
  const emailRateLimit = await checkRateLimit(`pwreset:${targetEmail}`, RATE_LIMIT_OTP_MAX, RATE_LIMIT_OTP_WINDOW)
  if (!emailRateLimit.allowed) {
    return { success: false, error: '该邮箱请求过于频繁，请稍后再试' }
  }

  try {
    const admin = createAdminClient()

    // 防枚举：账号不存在时同样返回成功，但不发送邮件
    const { data: existing } = await admin
      .from('profiles')
      .select('id')
      .eq('email', targetEmail)
      .maybeSingle()
    if (!existing) {
      return { success: true }
    }

    // 生成 6 位验证码并存入数据库（10 分钟有效）
    const otpCode = String(randomInt(100000, 1000000))
    await saveOtp(targetEmail, otpCode)

    // 发送密码重置验证码邮件
    if (process.env.RESEND_API_KEY) {
      const sent = await sendEmail(
        targetEmail,
        '【LongWoo 龙坞】密码重置验证码',
        passwordResetOtpEmailTemplate(otpCode)
      )
      if (!sent) {
        console.error('Resend 密码重置邮件发送失败')
        return { success: false, error: '验证码邮件发送失败，请稍后重试或联系客服' }
      }
    } else {
      console.log('[OTP] 密码重置验证码已生成（未配置邮件服务）')
    }

    return { success: true }
  } catch (error) {
    console.error('发送密码重置验证码异常:', error)
    return { success: false, error: '发送验证码时发生未知错误' }
  }
}

// ==================== 忘记密码：验证码重置密码 ====================

/**
 * 通过邮箱验证码重置密码（无需旧密码）
 *
 * 流程：verifyOtp 校验验证码（含尝试次数限制）→ admin 设置新密码
 * → 幂等确认（处理 updateUserById 偶发响应丢失）→ 更新 has_password
 *
 * 安全：
 * - CSRF 保护
 * - 基于 IP 的速率限制
 * - 验证码错误 5 次自动失效（otp-store 内置 OTP_MAX_ATTEMPTS）
 * - 重置成功后 Supabase 自动撤销该用户所有 session，需重新登录
 */
export async function resetPasswordWithOtp(
  email: string,
  code: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  // CSRF 保护
  const csrfError = await validateCsrf()
  if (csrfError) {
    return { success: false, error: csrfError }
  }

  const targetEmail = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
    return { success: false, error: '请输入有效的邮箱地址' }
  }
  if (!code || code.length !== 6) {
    return { success: false, error: '请输入6位验证码' }
  }
  if (!newPassword || newPassword.length < 6) {
    return { success: false, error: '密码长度至少6位' }
  }
  if (newPassword.length > 64) {
    return { success: false, error: '密码长度不能超过64位' }
  }
  if (!/[a-zA-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
    return { success: false, error: '密码必须包含字母和数字' }
  }

  // 速率限制：防止暴力重置（复用密码修改的速率限制配置）
  const ip = await getClientIp()
  const rateLimit = await checkRateLimit(`pwreset:${ip}`, RATE_LIMIT_PASSWORD_MAX, RATE_LIMIT_PASSWORD_WINDOW)
  if (!rateLimit.allowed) {
    return { success: false, error: '操作过于频繁，请稍后再试' }
  }

  // 验证 OTP（校验失败达到上限会自动失效）
  const otpResult = await verifyOtp(targetEmail, code)
  if (otpResult.systemError) {
    return { success: false, error: '系统繁忙，请稍后重试' }
  }
  if (!otpResult.valid) {
    return { success: false, error: '验证码无效或已过期' }
  }

  try {
    const admin = createAdminClient()

    // 根据邮箱找到用户
    const { data: profile } = await admin
      .from('profiles')
      .select('id, is_active')
      .eq('email', targetEmail)
      .maybeSingle()
    if (!profile) {
      return { success: false, error: '账号不存在' }
    }
    if (!profile.is_active) {
      return { success: false, error: '账户已停用' }
    }

    // 使用 admin 客户端设置新密码（Supabase Auth）
    const { error: updateError } = await admin.auth.admin.updateUserById(
      profile.id,
      { password: newPassword }
    )

    // 幂等确认（处理"报错但实际成功"的响应丢失场景）
    if (updateError) {
      console.error('重置密码报错（尝试确认是否实际已重置）:', updateError.message)
      const confirmResult = await confirmPasswordSet({
        email: targetEmail,
        newPassword,
        updateError,
        attemptLogin: async (email, password) => {
          const { createClient: createServerSupabase } = await import('@/lib/supabase/server')
          const client = await createServerSupabase()
          const { error } = await client.auth.signInWithPassword({ email, password })
          return { error }
        },
      })
      if (!confirmResult.success) {
        return { success: false, error: confirmResult.error }
      }
    }

    // 更新 has_password 标记（绕过 RLS）
    const { error: profileError } = await admin
      .from('profiles')
      .update({
        has_password: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id)

    if (profileError) {
      console.error('更新 has_password 失败:', profileError.message)
      // 密码已重置成功，仅标记更新失败，不影响主流程
    }

    // 重置成功后 Supabase GoTrue 会撤销该用户所有 session。
    // 若当前已登录（个人中心场景），显式清除本地 session cookie。
    try {
      const { createClient: createServerSupabase } = await import('@/lib/supabase/server')
      const client = await createServerSupabase()
      await client.auth.signOut()
    } catch {
      // 登出失败不阻断主流程；middleware 会兜底处理失效 session
    }

    return { success: true }
  } catch (error) {
    console.error('重置密码异常:', error)
    return { success: false, error: '重置密码时发生未知错误' }
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

    // 安全加固（FIND-05）：白名单化返回字段，避免把未来新增的敏感字段
    // （如身份证号、地址等）自动下发客户端。仅返回页面功能所需的字段。
    const safeProfile = profile ? {
      id: profile.id,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      role: profile.role,
      uid: profile.uid,
      email: profile.email,
      phone: profile.phone,
      is_active: profile.is_active,
      has_password: profile.has_password,
      created_at: profile.created_at,
    } : null

    return {
      success: true,
      session: {
        user: {
          id: user.id,
          email: user.email,
        },
      },
      profile: safeProfile as Profile,
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
