import type { Profile } from '@/types/database'

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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getOrCreateProfile(
  supabase: any,
  userId: string,
  options?: {
    email?: string | null
    phone?: string | null
    displayName?: string | null
    avatarUrl?: string | null
  }
): Promise<Profile | null> {
  try {
    // 查询是否已有 profile
    const { data: existing, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (!fetchError && existing) {
      // 已有 profile：如果有新的昵称/头像，则更新
      if (options?.displayName || options?.avatarUrl) {
        const updateData: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        }
        if (options.displayName) updateData.display_name = options.displayName
        if (options.avatarUrl) updateData.avatar_url = options.avatarUrl

        await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', userId)
      }

      // 返回更新后的信息（合并传入字段）
      return {
        ...existing,
        display_name: options?.displayName ?? existing.display_name,
        avatar_url: options?.avatarUrl ?? existing.avatar_url,
      }
    }

    // 自动创建 profile 记录，默认 role 为 user
    // uid 和 has_password 由数据库默认值/触发器处理
    const now = new Date().toISOString()
    const newProfile = {
      id: userId,
      email: options?.email ?? '',
      role: 'user',
      phone: options?.phone ?? null,
      display_name: options?.displayName ?? null, // null → 数据库触发器会设置为 "新朋友+uid"
      avatar_url: options?.avatarUrl ?? null,
      is_active: true,
      has_password: false,
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

    // 如果数据库触发器未生成 uid（旧数据库未执行迁移），在应用层生成
    let result = created as Profile

    if (!result.uid) {
      // 应用层生成 uid：确保大于 ZERO_USER_UID(10001)，避免与超级管理员冲突
      // 使用数据库 RPC 原子递增，避免并发冲突
      const { data: rpcUid, error: rpcError } = await supabase
        .rpc('generate_uid')

      if (!rpcError && rpcUid && rpcUid > 10001) {
        const { data: updated } = await supabase
          .from('profiles')
          .update({ uid: rpcUid })
          .eq('id', userId)
          .select()
          .single()

        if (updated) {
          result = updated as Profile
        }
      } else {
        // RPC 不可用时降级：查询最大 uid + 1，确保不与零号用户冲突
        const { data: maxRow } = await supabase
          .from('profiles')
          .select('uid')
          .order('uid', { ascending: false })
          .range(0, 0)
          .single()

        const maxUid = maxRow?.uid ?? 10001
        const fallbackUid = Math.max(maxUid + 1, 10002)

        const { data: updated } = await supabase
          .from('profiles')
          .update({ uid: fallbackUid })
          .eq('id', userId)
          .select()
          .single()

        if (updated) {
          result = updated as Profile
        }
      }
    }

    // 如果 display_name 仍为空，设置为 "新朋友+uid"
    if (!result.display_name || result.display_name === '新用户') {
      const defaultName = `新朋友${result.uid ?? ''}`
      const { data: updated } = await supabase
        .from('profiles')
        .update({ display_name: defaultName })
        .eq('id', userId)
        .select()
        .single()

      if (updated) {
        result = updated as Profile
      }
    }

    return result
  } catch (error) {
    console.error('获取/创建 profile 异常:', error)
    return null
  }
}
