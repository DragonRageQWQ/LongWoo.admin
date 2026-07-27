'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/types/database'

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

// ==================== 登录后确保 Profile 存在 ====================
// 客户端验证 OTP 成功后调用，从服务端读取 session 并确保 profile 记录存在
// 所有新用户默认 role 为 'studio'（普通用户），管理员仅可后台手动赋予

export async function ensureProfileAfterLogin(): Promise<{
  success: boolean
  role?: string
  error?: string
}> {
  const supabase = await createClient()

  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError || !session) {
      return { success: false, error: '未获取到登录会话' }
    }

    const userId = session.user.id
    const userEmail = session.user.email ?? ''

    // 获取或创建 profile（默认普通用户权限）
    const profile = await getOrCreateProfile(
      supabase,
      userId,
      userEmail,
      null
    )

    revalidatePath('/')
    return { success: true, role: profile?.role ?? 'studio' }
  } catch (error) {
    console.error('确保 Profile 异常:', error)
    return { success: false, error: '处理用户信息时发生未知错误' }
  }
}

// ==================== 获取当前会话和用户信息 ====================

export async function getSession(): Promise<{
  success: boolean
  session?: {
    user: {
      id: string
      email: string | null | undefined
    }
    access_token: string
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

    // 获取 profile 信息
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (profileError) {
      console.error('获取用户信息失败:', profileError.message)
      return {
        success: true,
        session: {
          user: {
            id: session.user.id,
            email: session.user.email,
          },
          access_token: session.access_token,
        },
        profile: null,
      }
    }

    return {
      success: true,
      session: {
        user: {
          id: session.user.id,
          email: session.user.email,
        },
        access_token: session.access_token,
      },
      profile: profile as Profile,
    }
  } catch (error) {
    console.error('获取会话异常:', error)
    return { success: false, error: '获取会话时发生未知错误' }
  }
}

// ==================== 内部辅助函数：获取或创建 profile ====================

async function getOrCreateProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  userEmail?: string | null,
  phone?: string | null
): Promise<Profile | null> {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (!fetchError && existing) {
      return existing as Profile
    }

    // 自动创建 profile 记录，默认 role 为 studio
    const now = new Date().toISOString()
    const newProfile = {
      id: userId,
      email: userEmail ?? '',
      role: 'studio',
      phone: phone ?? null,
      display_name: '新用户',
      avatar_url: null,
      is_active: true,
      created_at: now,
      updated_at: now,
    }

    const { data: created, error: insertError } = await supabase
      .from('profiles')
      .insert(newProfile)
      .select()
      .single()

    if (insertError) {
      console.error('创建 profile 失败:', insertError.message)
      return null
    }

    return created as Profile
  } catch (error) {
    console.error('获取/创建 profile 异常:', error)
    return null
  }
}

// ==================== 发送邮箱验证码 ====================

export async function sendEmailOtp(
  email: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  try {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { success: false, error: '请输入有效的邮箱地址' }
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('发送邮箱验证码异常:', error)
    return { success: false, error: '发送验证码时发生未知错误' }
  }
}

// ==================== 验证邮箱验证码并登录 ====================

export async function verifyEmailOtp(
  email: string,
  token: string
): Promise<{ success: boolean; error?: string; role?: string }> {
  const supabase = await createClient()

  try {
    if (!email || !token) {
      return { success: false, error: '邮箱和验证码不能为空' }
    }

    // signInWithOtp 发送的验证码，新用户用 'signup' 类型，已有用户用 'magiclink' 类型
    // 先尝试 signup（新用户注册），失败则尝试 magiclink（已有用户登录）
    let verifyResult = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'signup',
    })

    if (verifyResult.error) {
      // signup 失败，尝试 magiclink 类型
      verifyResult = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'magiclink',
      })
    }

    if (verifyResult.error) {
      return { success: false, error: verifyResult.error.message }
    }

    const userId = verifyResult.data.user?.id
    if (!userId) {
      return { success: false, error: '登录成功但未获取到用户信息' }
    }

    // 获取或创建 profile
    const profile = await getOrCreateProfile(
      supabase,
      userId,
      verifyResult.data.user?.email,
      null
    )

    revalidatePath('/')
    return { success: true, role: profile?.role ?? 'studio' }
  } catch (error) {
    console.error('验证邮箱验证码异常:', error)
    return { success: false, error: '验证登录时发生未知错误' }
  }
}

// ==================== QQ OAuth 登录 ====================

export async function signInWithQQ(): Promise<{
  success: boolean
  error?: string
  url?: string
}> {
  const supabase = await createClient()

  try {
    const clientId = process.env.QQ_CLIENT_ID
    const clientSecret = process.env.QQ_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      return { success: false, error: 'QQ登录暂未配置' }
    }

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000')

    // QQ 需要在 Supabase 后台配置为自定义 OIDC 提供商
    // 配置路径: Supabase Dashboard → Authentication → Providers → OIDC
    // 配置完成后使用 provider: 'oidc' 发起 OAuth 流程
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'oidc' as never,
      options: {
        redirectTo: `${origin}/auth/callback`,
        queryParams: {
          provider_id: 'qq',
        },
      },
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, url: data.url }
  } catch (error) {
    console.error('QQ 登录异常:', error)
    return { success: false, error: 'QQ 登录时发生未知错误' }
  }
}


