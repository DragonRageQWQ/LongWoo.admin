/**
 * 通知/站内信工具（纯函数，便于测试）
 *
 * 提供输入校验与目标群体映射逻辑，供管理员发送通知的
 * Server Action 使用。目标群体（targetRole）枚举：
 *   - all   ：全体用户（所有已注册用户，含管理员）
 *   - admin ：全体管理员（role='admin'）
 *   - user  ：全体普通成员（role='user'）
 */

export type NotificationTargetRole = 'all' | 'admin' | 'user'

export const TITLE_MAX_LENGTH = 100
export const CONTENT_MAX_LENGTH = 2000

/**
 * 校验通知标题与内容
 *
 * @returns 错误信息字符串；合法返回 null
 */
export function validateNotificationInput(
  title: string,
  content: string
): string | null {
  const trimmedTitle = title.trim()
  const trimmedContent = content.trim()

  if (!trimmedTitle) return '请输入标题'
  if (!trimmedContent) return '请输入内容'
  if (trimmedTitle.length > TITLE_MAX_LENGTH) return '标题不能超过100字'
  if (trimmedContent.length > CONTENT_MAX_LENGTH) return '内容不能超过2000字'

  return null
}

export type ResolveTargetRoleResult =
  | { ok: true; query: TargetQuery; label: string }
  | { ok: false; error: string }

/** PostgREST 过滤描述（供 Server Action 构造查询） */
export type TargetQuery =
  | { kind: 'all' }
  | { kind: 'eq'; value: 'admin' | 'user' }

const TARGET_ROLE_MAP: Record<NotificationTargetRole, { query: TargetQuery; label: string }> = {
  // 全体用户：所有已注册用户（profiles 仅 user/admin 两种角色，无需过滤）
  all: { query: { kind: 'all' }, label: '全体用户' },
  admin: { query: { kind: 'eq', value: 'admin' }, label: '全体管理员' },
  user: { query: { kind: 'eq', value: 'user' }, label: '全体普通成员' },
}

/**
 * 将目标群体映射为 PostgREST 过滤描述
 *
 * @returns ok=true 时 query 为过滤描述、label 为展示名
 */
export function resolveTargetRoleFilter(
  targetRole: NotificationTargetRole
): ResolveTargetRoleResult {
  const mapped = TARGET_ROLE_MAP[targetRole]
  if (!mapped) {
    return { ok: false, error: '目标群体无效' }
  }
  return { ok: true, query: mapped.query, label: mapped.label }
}
