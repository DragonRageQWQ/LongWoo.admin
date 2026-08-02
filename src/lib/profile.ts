import type { Profile } from '@/types/database'

// 使用宽松类型约束，兼容 server/admin/SSR 客户端的各类 PostgrestBuilder 返回值
/* eslint-disable @typescript-eslint/no-explicit-any */
type SupabaseLike = {
  from: (table: string) => any
  rpc: (fn: string) => any
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * 获取或创建用户 Profile（公共工具函数）
 *
 * 供 auth-actions.ts 和 QQ OAuth 回调共用，消除重复逻辑。
 * 所有新用户默认 role 为 'user'（普通用户），管理员仅可后台手动赋予。
 *
 * UID 由数据库触发器自动生成（从 10001 开始递增）。
 * 新用户默认昵称为 "新朋友+uid"（如 "新朋友10001"）。
 *
 * @param supabase - 任意 Supabase 客户端实例（server / SSR / admin 均可）
 * @param userId   - 用户 ID（auth.users.id）
 * @param options  - 可选字段：email, phone, display_name, avatar_url
 * @returns Profile 记录，失败返回 null
 */
export async function getOrCreateProfile(
  supabase: SupabaseLike,
  userId: string,
  options?: {
    email?: string | null
    phone?: string | null
    displayName?: string | null
    avatarUrl?: string | null
    hasPassword?: boolean
  }
): Promise<Profile> {
  try {
    // 查询是否已有 profile
    const { data: existing, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (fetchError) {
      throw new Error(`查询 profile 失败: ${fetchError.message}`)
    }

    if (existing) {
      // 已有 profile：如果有新的昵称/头像，则更新
      if (options?.displayName || options?.avatarUrl || options?.hasPassword === true) {
        const updateData: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        }
        if (options.displayName) updateData.display_name = options.displayName
        if (options.avatarUrl) updateData.avatar_url = options.avatarUrl
        if (options.hasPassword === true) updateData.has_password = true

        const { data: updated, error: updateError } = await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', userId)
          .select()
          .single()

        if (updateError || !updated) {
          throw new Error(`更新 profile 失败: ${updateError?.message ?? '无返回数据'}`)
        }
        return updated as Profile
      }

      return existing as Profile
    }

    // 自动创建 profile 记录，默认 role 为 user
    // uid 和 has_password 由数据库默认值/触发器处理
    const now = new Date().toISOString()
    const email = options?.email?.trim().toLowerCase() ?? ''
    if (!email) {
      throw new Error('创建 profile 失败: 用户邮箱为空')
    }
    const defaultDisplayName = options?.displayName?.trim()
      || email.split('@')[0]?.slice(0, 20)
      || '新朋友'
    const newProfile = {
      id: userId,
      email,
      role: 'user',
      phone: options?.phone ?? null,
      display_name: defaultDisplayName,
      avatar_url: options?.avatarUrl ?? null,
      is_active: true,
      has_password: options?.hasPassword ?? false,
      created_at: now,
      updated_at: now,
    }

    const { data: created, error: insertError } = await supabase
      .from('profiles')
      .insert(newProfile)
      .select()
      .single()

    if (insertError) {
      // OAuth/登录并发回调可能同时创建同一 profile；唯一键冲突时重新读取。
      if (insertError.code === '23505') {
        const { data: racedProfile, error: raceError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single()
        if (!raceError && racedProfile) return racedProfile as Profile
      }
      throw new Error(`创建 profile 失败: ${insertError.message}`)
    }

    // 直接返回 created 结果，uid 和 display_name 由数据库触发器处理
    return created as Profile
  } catch (error) {
    console.error('获取/创建 profile 异常:', error)
    throw error instanceof Error ? error : new Error(String(error))
  }
}
