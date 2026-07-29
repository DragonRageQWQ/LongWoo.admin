'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateProfile } from '@/lib/profile'
import { saveOtp, verifyOtp, hasActiveOtp } from '@/lib/otp-store'
import type { Profile } from '@/types/database'

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

    // 自己生成6位数字验证码（不依赖 Supabase 的 email_otp，它返回8位）
    const otpCode = String(Math.floor(100000 + Math.random() * 900000))

    // 存入内存（10分钟有效）
    saveOtp(email, otpCode, tokenHash)

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
            html: `
              <!DOCTYPE html>
              <html lang="zh-CN">
              <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
              <body style="margin:0;padding:0;background-color:#F3F3F3;font-family:'PingFang SC','Microsoft YaHei','Noto Sans CJK SC',-apple-system,sans-serif;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F3F3F3;">
                  <tr><td align="center" style="padding:32px 16px;">
                    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,0.06);">
                      <tr><td style="background-color:#0D3B3B;padding:28px 40px;text-align:center;">
                        <h1 style="color:#FFFFFF;font-size:22px;font-weight:700;margin:0;letter-spacing:3px;">龙坞 LONGWOO</h1>
                        <p style="color:rgba(255,255,255,0.5);font-size:10px;margin:4px 0 0;letter-spacing:2px;">Creative Design Studio</p>
                      </td></tr>
                      <tr><td style="background-color:#1A5050;height:4px;line-height:4px;font-size:4px;">&nbsp;</td></tr>
                      <tr><td style="padding:32px 40px;">
                        <h2 style="color:#0D3B3B;font-size:18px;font-weight:700;margin:0 0 16px;">登录验证码</h2>
                        <p style="color:#666;font-size:15px;line-height:1.7;margin:0 0 20px;">您好，您正在登录 LongWoo 龙坞，验证码为：</p>
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                          <tr><td style="background-color:#F0F7F7;border-left:3px solid #0D3B3B;border-radius:0 8px 8px 0;padding:24px;text-align:center;">
                            <span style="font-size:36px;font-weight:700;letter-spacing:10px;color:#0D3B3B;">${otpCode}</span>
                          </td></tr>
                        </table>
                        <p style="color:#999;font-size:13px;line-height:1.6;margin:0;">验证码 10 分钟内有效，请勿泄露给他人。如非本人操作，请忽略此邮件。</p>
                      </td></tr>
                      <tr><td style="padding:0 40px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #EEE;"><tr><td style="height:1px;line-height:1px;font-size:1px;">&nbsp;</td></tr></table>
                      </td></tr>
                      <tr><td style="padding:20px 40px 28px;">
                        <p style="color:#AAA;font-size:12px;line-height:1.6;margin:0;">此邮件由 LongWoo 龙坞系统自动发送，请勿直接回复。</p>
                        <p style="color:#CCC;font-size:11px;margin:4px 0 0;">© 2026 LongWoo 龙坞. All rights reserved.</p>
                      </td></tr>
                    </table>
                  </td></tr>
                </table>
              </body>
              </html>
            `,
          }),
        })

        if (!response.ok) {
          console.error('Resend 发送失败:', await response.text())
        }
      } catch (err) {
        console.error('邮件发送异常:', err)
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
    const result = verifyOtp(email, code)

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
    return { success: true, role: profile?.role ?? 'studio' }
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
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError || !session) {
      return { success: false, error: '未获取到会话信息' }
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (profileError) {
      console.error('获取用户信息失败:', profileError.message)
      // 尝试用 admin 客户端获取（可能 RLS 问题）
      const admin = createAdminClient()
      const { data: adminProfile } = await admin
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      return {
        success: true,
        session: {
          user: {
            id: session.user.id,
            email: session.user.email,
          },
        },
        profile: (adminProfile as Profile) ?? null,
      }
    }

    return {
      success: true,
      session: {
        user: {
          id: session.user.id,
          email: session.user.email,
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
