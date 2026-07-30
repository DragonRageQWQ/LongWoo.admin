'use server'

import { revalidatePath } from 'next/cache'
import { createClient, getSessionUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { headers } from 'next/headers'

// ==================== 密码登录失败次数限制 ====================
// 防止暴力破解：同一邮箱 + IP 组合，5次失败后锁定15分钟

interface LoginFailEntry {
  count: number
  lockedUntil: number
}

const loginFailStore = new Map<string, LoginFailEntry>()
const LOGIN_MAX_FAILS = 5
const LOGIN_LOCK_DURATION = 15 * 60 * 1000  // 15分钟

// 定期清理过期项（每5分钟）
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of loginFailStore.entries()) {
      if (entry.lockedUntil < now && entry.count === 0) {
        loginFailStore.delete(key)
      }
    }
  }, 5 * 60 * 1000)
}

/**
 * 检查密码登录是否被锁定
 * @returns 锁定剩余秒数，0表示未锁定
 */
function checkLoginLock(email: string, ip: string): number {
  const key = `${email.toLowerCase()}:${ip}`
  const entry = loginFailStore.get(key)
  if (!entry) return 0
  if (entry.lockedUntil < Date.now()) return 0
  return Math.ceil((entry.lockedUntil - Date.now()) / 1000)
}

/**
 * 记录密码登录失败
 */
function recordLoginFail(email: string, ip: string): boolean {
  const key = `${email.toLowerCase()}:${ip}`
  const entry = loginFailStore.get(key) ?? { count: 0, lockedUntil: 0 }
  entry.count++

  if (entry.count >= LOGIN_MAX_FAILS) {
    entry.lockedUntil = Date.now() + LOGIN_LOCK_DURATION
    loginFailStore.set(key, entry)
    return true  // 已锁定
  }

  loginFailStore.set(key, entry)
  return false
}

/**
 * 清除密码登录失败记录（登录成功时调用）
 */
function clearLoginFails(email: string, ip: string): void {
  loginFailStore.delete(`${email.toLowerCase()}:${ip}`)
}

// ==================== 修改昵称 ====================

export async function updateDisplayName(
  displayName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getSessionUser()
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
    const user = await getSessionUser()
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
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getSessionUser()
    if (!user) {
      return { success: false, error: '未登录' }
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

    // 获取客户端 IP 用于登录失败限制
    const headersList = await headers()
    const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

    // 检查是否被锁定
    const lockRemaining = checkLoginLock(email, ip)
    if (lockRemaining > 0) {
      const minutes = Math.ceil(lockRemaining / 60)
      return {
        success: false,
        error: `登录失败次数过多，请 ${minutes} 分钟后再试`,
      }
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      // 记录登录失败
      const locked = recordLoginFail(email, ip)
      if (locked) {
        return {
          success: false,
          error: '密码错误次数过多，账户已锁定15分钟',
        }
      }
      const remaining = LOGIN_MAX_FAILS - (loginFailStore.get(`${email.toLowerCase()}:${ip}`)?.count ?? 0)
      return {
        success: false,
        error: remaining > 0
          ? `邮箱或密码错误，剩余尝试次数 ${remaining} 次`
          : '邮箱或密码错误',
      }
    }

    // 登录成功，清除失败记录
    clearLoginFails(email, ip)

    // 使用 admin 客户端获取角色（避免 RLS 问题）
    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    revalidatePath('/')
    return { success: true, role: profile?.role ?? 'user' }
  } catch (error) {
    console.error('密码登录异常:', error)
    return { success: false, error: '登录时发生未知错误' }
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
