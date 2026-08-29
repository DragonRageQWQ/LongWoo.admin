import { getSessionUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasUserTag } from '@/lib/user-tags'

/**
 * API 路由软封禁守卫：判断当前会话用户是否被拉黑（blacklist）
 * - 未登录：返回 false（由各路由原有登录校验处理）
 * - 已登录且带 blacklist 标签：返回 true，调用方应返回 403
 *
 * 用于"使用型"API（AI 对话、创建角色、下单、上传附件等）：
 * 拉黑用户可正常浏览网页，但禁止使用业务内容。
 */
export async function isSessionUserSoftBanned(): Promise<boolean> {
  try {
    const user = await getSessionUser()
    if (!user) return false

    const admin = createAdminClient()
    const { data } = await admin
      .from('profiles')
      .select('tags')
      .eq('id', user.id)
      .single()

    return hasUserTag(data?.tags, 'blacklist')
  } catch {
    return false
  }
}
