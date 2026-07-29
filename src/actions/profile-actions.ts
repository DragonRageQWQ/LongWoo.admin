'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ==================== 修改昵称 ====================

export async function updateDisplayName(
  displayName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: '未登录' }
    }

    const name = displayName.trim()
    if (!name || name.length > 20) {
      return { success: false, error: '昵称长度需在1-20个字符之间' }
    }

    // 使用 admin 客户端更新，绕过 RLS 限制
    const admin = createAdminClient()
    const { error } = await admin
      .from('profiles')
      .update({
        display_name: name,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (error) {
      console.error('更新昵称失败:', error.message)
      return { success: false, error: '更新失败，请稍后重试' }
    }

    revalidatePath('/profile')
    return { success: true }
  } catch (error) {
    console.error('更新昵称异常:', error)
    return { success: false, error: '操作时发生未知错误' }
  }
}

// ==================== 修改头像 ====================

export async function updateAvatar(
  file: File
): Promise<{ success: boolean; avatarUrl?: string; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: '未登录' }
    }

    // 验证文件
    if (!file || file.size === 0) {
      return { success: false, error: '请选择图片' }
    }

    // 限制 2MB
    if (file.size > 2 * 1024 * 1024) {
      return { success: false, error: '图片大小不能超过 2MB' }
    }

    // 验证文件类型
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return { success: false, error: '仅支持 JPG、PNG、GIF、WebP 格式' }
    }

    const admin = createAdminClient()

    // 确保 avatars bucket 存在
    const { data: buckets } = await admin.storage.listBuckets()
    const bucketExists = buckets?.some(b => b.name === 'avatars')
    if (!bucketExists) {
      await admin.storage.createBucket('avatars', { public: true })
    }

    // 上传文件到 Storage
    const ext = file.name.split('.').pop() || 'jpg'
    const fileName = `${user.id}/avatar-${Date.now()}.${ext}`

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

    revalidatePath('/profile')
    return { success: true, avatarUrl }
  } catch (error) {
    console.error('更新头像异常:', error)
    return { success: false, error: '操作时发生未知错误' }
  }
}

// ==================== 设置/修改密码 ====================

export async function updatePassword(
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: '未登录' }
    }

    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: '密码长度至少6位' }
    }

    if (newPassword.length > 64) {
      return { success: false, error: '密码长度不能超过64位' }
    }

    // 使用 admin 客户端设置密码（Supabase Auth）
    const admin = createAdminClient()
    const { error: updateError } = await admin.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    )

    if (updateError) {
      console.error('设置密码失败:', updateError.message)
      return { success: false, error: '设置密码失败：' + updateError.message }
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
    return { success: true }
  } catch (error) {
    console.error('设置密码异常:', error)
    return { success: false, error: '操作时发生未知错误' }
  }
}

// ==================== 密码登录 ====================

export async function loginWithPassword(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string; role?: string }> {
  const supabase = await createClient()

  try {
    if (!email || !password) {
      return { success: false, error: '请输入邮箱和密码' }
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return { success: false, error: '邮箱或密码错误' }
    }

    // 使用 admin 客户端获取角色（避免 RLS 问题）
    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    revalidatePath('/')
    return { success: true, role: profile?.role ?? 'studio' }
  } catch (error) {
    console.error('密码登录异常:', error)
    return { success: false, error: '登录时发生未知错误' }
  }
}

// ==================== 检查邮箱是否已设置密码 ====================

export async function checkEmailHasPassword(
  email: string
): Promise<{ hasPassword: boolean; exists: boolean }> {
  try {
    if (!email) return { hasPassword: false, exists: false }

    const admin = createAdminClient()

    // 通过 profiles 表查询
    const { data: profile } = await admin
      .from('profiles')
      .select('has_password')
      .eq('email', email)
      .single()

    if (!profile) {
      return { hasPassword: false, exists: false }
    }

    return {
      hasPassword: profile.has_password ?? false,
      exists: true,
    }
  } catch {
    return { hasPassword: false, exists: false }
  }
}
