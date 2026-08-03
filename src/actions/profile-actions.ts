'use server'

import { revalidatePath } from 'next/cache'
import { getSessionUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit } from '@/lib/rate-limit'
import { validateCsrf } from '@/lib/csrf'
import { validateFileMagicNumber } from '@/lib/file-validation'
import { getOrCreateProfile } from '@/lib/profile'
import { confirmPasswordSet } from '@/lib/password-confirm'
import { getClientIp } from '@/lib/server-utils'
import { AVATAR_MAX_SIZE, AVATAR_ALLOWED_MIME_TYPES, RATE_LIMIT_AVATAR_WINDOW, RATE_LIMIT_AVATAR_MAX, RATE_LIMIT_PASSWORD_WINDOW, RATE_LIMIT_PASSWORD_MAX, RATE_LIMIT_CHECK_EMAIL_WINDOW, RATE_LIMIT_CHECK_EMAIL_MAX } from '@/lib/constants'

// ==================== 修改昵称 ====================

export async function updateDisplayName(
  displayName: string
): Promise<{ success: boolean; error?: string; debug?: string }> {
  try {
    // CSRF 保护
    const csrfError = await validateCsrf()
    if (csrfError) {
      return { success: false, error: csrfError, debug: `CSRF:${csrfError}` }
    }

    const user = await getSessionUser()
    if (!user) {
      return { success: false, error: '未登录', debug: 'NoUser' }
    }

    const name = displayName.trim()
    if (!name || name.length > 20) {
      return { success: false, error: '昵称长度需在1-20个字符之间', debug: 'InvalidName' }
    }

    // 使用 admin 客户端更新，绕过 RLS 限制
    const admin = createAdminClient()

    // 确保 profile 存在（防止登录时未自动创建的情况）
    const profile = await getOrCreateProfile(admin, user.id, { email: user.email })
    if (!profile.is_active) {
      return { success: false, error: '账户已停用', debug: 'InactiveUser' }
    }

    const { error: updateError } = await admin
      .from('profiles')
      .update({
        display_name: name,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('[updateDisplayName] Update failed:', updateError.message)
      return { success: false, error: '更新失败，请稍后重试', debug: `UpdateError:${updateError.message}` }
    }

    revalidatePath('/profile')
    return { success: true }
  } catch (error) {
    console.error('[updateDisplayName] Exception:', error)
    return { success: false, error: '操作时发生未知错误', debug: `Exception:${String(error)}` }
  }
}

// ==================== 修改头像 ====================

export async function updateAvatar(
  file: File
): Promise<{ success: boolean; avatarUrl?: string; error?: string }> {
  try {
    // CSRF 保护
    const csrfError = await validateCsrf()
    if (csrfError) {
      return { success: false, error: csrfError }
    }

    const user = await getSessionUser()
    if (!user) {
      return { success: false, error: '未登录' }
    }

    // 速率限制：防止头像上传滥用（H5）
    const ip = await getClientIp()
    const avatarRateLimit = await checkRateLimit(
      `avatar:${ip}`,
      RATE_LIMIT_AVATAR_MAX,
      RATE_LIMIT_AVATAR_WINDOW
    )
    if (!avatarRateLimit.allowed) {
      return { success: false, error: '操作过于频繁，请稍后再试' }
    }

    // 验证文件
    if (!file || file.size === 0) {
      return { success: false, error: '请选择图片' }
    }

    // 限制文件大小
    if (file.size > AVATAR_MAX_SIZE) {
      return { success: false, error: '图片大小不能超过 2MB' }
    }

    // 验证文件类型（客户端声明的 MIME）
    if (!AVATAR_ALLOWED_MIME_TYPES.includes(file.type as typeof AVATAR_ALLOWED_MIME_TYPES[number])) {
      return { success: false, error: '仅支持 JPG、PNG、GIF、WebP 格式' }
    }

    // 安全加固：通过魔数验证文件实际类型，防止伪造 MIME 类型上传恶意文件
    const isMagicNumberValid = await validateFileMagicNumber(file, AVATAR_ALLOWED_MIME_TYPES)
    if (!isMagicNumberValid) {
      return { success: false, error: '文件内容与声明类型不符，请上传有效的图片文件' }
    }

    const admin = createAdminClient()

    // 确保 profile 存在（防止登录时未自动创建的情况）
    const ensuredProfile = await getOrCreateProfile(admin, user.id, { email: user.email })
    if (!ensuredProfile.is_active) {
      return { success: false, error: '账户已停用' }
    }

    // 查询旧头像 URL，用于后续清理旧文件
    const { data: oldProfile } = await admin
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .single()

    const oldAvatarUrl = oldProfile?.avatar_url as string | null

    // 确保 avatars bucket 存在
    const { data: buckets } = await admin.storage.listBuckets()
    const bucketExists = buckets?.some(b => b.name === 'avatars')
    if (!bucketExists) {
      await admin.storage.createBucket('avatars', { public: true })
    }

    // 上传文件到 Storage
    // 根据 MIME 类型映射固定扩展名，防止用户伪造文件名扩展名
    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
    }
    const ext = extMap[file.type] || 'jpg'
    // 安全加固（FIND-06）：文件名使用随机 UUID，不包含用户 ID。
    // 公开 bucket 中固定路径模式（含完整 UUID）可被枚举，随机化后无法
    // 通过路径推断用户身份。
    const fileName = `${crypto.randomUUID()}/avatar-${crypto.randomUUID()}.${ext}`

    // 将 File 转为 ArrayBuffer 再上传，避免序列化问题
    const arrayBuffer = await file.arrayBuffer()

    const { error: uploadError } = await admin.storage
      .from('avatars')
      .upload(fileName, arrayBuffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      console.error('头像上传失败:', uploadError.message)
      return { success: false, error: '头像上传失败' }
    }

    // 获取公开 URL
    const { data: urlData } = admin.storage
      .from('avatars')
      .getPublicUrl(fileName)

    const avatarUrl = urlData.publicUrl

    // 使用 admin 客户端更新 profile，绕过 RLS 限制
    const { error: updateError } = await admin
      .from('profiles')
      .update({
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('更新头像URL失败:', updateError.message)
      return { success: false, error: '更新头像失败' }
    }

    // 清理旧头像文件（非阻塞，失败不影响主流程）
    if (oldAvatarUrl && oldAvatarUrl !== avatarUrl) {
      try {
        // 从 URL 中提取文件路径
        // URL 格式: https://xxx.supabase.co/storage/v1/object/public/avatars/userId/avatar-xxx.jpg
        const urlMatch = oldAvatarUrl.match(/\/storage\/v1\/object\/public\/avatars\/(.+)$/)
        if (urlMatch && urlMatch[1]) {
          await admin.storage.from('avatars').remove([urlMatch[1]])
        }
      } catch {
        // 旧文件清理失败不影响主流程
      }
    }

    revalidatePath('/profile')
    return { success: true, avatarUrl }
  } catch (error) {
    console.error('更新头像异常:', error)
    return { success: false, error: '操作时发生未知错误' }
  }
}

// ==================== 设置/修改密码 ====================

export async function updatePassword(
  newPassword: string,
  currentPassword?: string
): Promise<{ success: boolean; error?: string; sessionInvalidated?: boolean }> {
  try {
    // CSRF 保护
    const csrfError = await validateCsrf()
    if (csrfError) {
      return { success: false, error: csrfError }
    }

    const user = await getSessionUser()
    if (!user) {
      return { success: false, error: '未登录' }
    }

    // 速率限制：防止密码暴力修改（H5）
    const ip = await getClientIp()
    const pwdRateLimit = await checkRateLimit(
      `pwdchange:${ip}`,
      RATE_LIMIT_PASSWORD_MAX,
      RATE_LIMIT_PASSWORD_WINDOW
    )
    if (!pwdRateLimit.allowed) {
      return { success: false, error: '操作过于频繁，请稍后再试' }
    }

    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: '密码长度至少6位' }
    }

    if (newPassword.length > 64) {
      return { success: false, error: '密码长度不能超过64位' }
    }

    // 密码复杂度：至少包含字母和数字
    if (!/[a-zA-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      return { success: false, error: '密码必须包含字母和数字' }
    }

    const admin = createAdminClient()

    // 确保 profile 存在（防止登录时未自动创建的情况）
    const ensuredProfile = await getOrCreateProfile(admin, user.id, { email: user.email })
    if (!ensuredProfile.is_active) {
      return { success: false, error: '账户已停用' }
    }

    // C4 安全修复：如果用户已设置密码，必须验证旧密码
    // 先查询用户是否已有密码
    const { data: profile } = await admin
      .from('profiles')
      .select('has_password')
      .eq('id', user.id)
      .single()

    if (profile?.has_password) {
      // 已有密码，必须验证旧密码
      if (!currentPassword) {
        return { success: false, error: '请输入当前密码' }
      }

      // 使用 Supabase Auth 验证旧密码
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = await createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: currentPassword,
      })

      if (signInError) {
        return { success: false, error: '当前密码不正确' }
      }
    }

    // 使用 admin 客户端设置密码（Supabase Auth）
    const { error: updateError } = await admin.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    )

    // 幂等确认（修复"报错但实际成功"）：
    // updateUserById 偶发"响应丢失/超时"——服务端已成功修改密码，
    // 但客户端收到错误。此时直接返回失败会误导用户以为密码未设置。
    // 用新密码尝试登录验证：能登录说明密码已实际设置，仅响应丢失。
    if (updateError) {
      console.error('设置密码报错（尝试确认是否实际已设置）:', updateError.message)
      const confirmResult = await confirmPasswordSet({
        email: user.email!,
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
      // 密码已成功设置（响应丢失场景），继续走成功流程
    }

    // 使用 admin 客户端更新 has_password 标记，绕过 RLS 限制
    const { error: profileError } = await admin
      .from('profiles')
      .update({
        has_password: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (profileError) {
      console.error('更新 has_password 失败:', profileError.message)
      // 密码已设置成功，仅标记更新失败，不影响主流程
    }

    revalidatePath('/profile')

    // 修改密码成功后，Supabase GoTrue 会撤销该用户的所有现有 session
    //（含当前 access token 与 refresh token）。清除本地 cookie 并提示
    // 重新登录，避免"密码已改但后续请求 401"的困惑。
    try {
      const { createClient: createServerSupabase } = await import('@/lib/supabase/server')
      const client = await createServerSupabase()
      await client.auth.signOut()
    } catch {
      // 登出失败不阻断主流程；middleware 会兜底处理失效 session
    }

    return { success: true, sessionInvalidated: true }
  } catch (error) {
    console.error('设置密码异常:', error)
    return { success: false, error: '操作时发生未知错误' }
  }
}

// ==================== 检查邮箱是否已设置密码 ====================
// 统一返回 canUsePassword，避免泄露"邮箱是否存在"或"是否已设置密码"等敏感信息
// canUsePassword: 邮箱存在且已设置密码时为 true，否则为 false

export async function checkEmailHasPassword(
  email: string
): Promise<{ canUsePassword: boolean }> {
  try {
    if (!email) return { canUsePassword: false }

    // M2 安全修复：添加速率限制，防止通过暴力查询枚举用户
    const ip = await getClientIp()
    const checkRateLimitResult = await checkRateLimit(
      `checkemail:${ip}`,
      RATE_LIMIT_CHECK_EMAIL_MAX,
      RATE_LIMIT_CHECK_EMAIL_WINDOW
    )
    if (!checkRateLimitResult.allowed) {
      // 速率限制触发时统一返回 false，不泄露信息
      return { canUsePassword: false }
    }

    const admin = createAdminClient()

    // 通过 profiles 表查询
    const { data: profile } = await admin
      .from('profiles')
      .select('has_password')
      .eq('email', email)
      .single()

    if (!profile) {
      return { canUsePassword: false }
    }

    return {
      canUsePassword: profile.has_password ?? false,
    }
  } catch {
    return { canUsePassword: false }
  }
}
