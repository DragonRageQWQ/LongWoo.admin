/**
 * 通知/站内信工具（纯函数，便于测试）
 *
 * 提供输入校验与目标群体映射逻辑，供管理员发送通知/邮件的
 * Server Action 使用。目标群体（targetRole）枚举：
 *   - all   ：全体用户（所有已注册用户，含管理员）
 *   - admin ：仅限管理员（role='admin'）
 *   - user  ：全部普通成员（role='user'）
 *   - tag   ：指定 tag 成员（tags 数组，任一命中即纳入）
 *   - users ：指定成员（userIds 数组）
 */

import { isUserTag, USER_TAG_LABELS } from '@/lib/user-tags'

export type NotificationTargetRole = 'all' | 'admin' | 'user' | 'tag' | 'users'

export const TITLE_MAX_LENGTH = 100
export const CONTENT_MAX_LENGTH = 2000
/** 指定 tag 成员时最多可选标签数 */
export const MAX_TARGET_TAGS = 10
/** 指定成员时最多可选人数 */
export const MAX_TARGET_USER_IDS = 200

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
  | { kind: 'tags'; value: string[] }
  | { kind: 'ids'; value: string[] }

const TARGET_ROLE_MAP: Record<'all' | 'admin' | 'user', { query: TargetQuery; label: string }> = {
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
  const mapped =
    targetRole === 'all' || targetRole === 'admin' || targetRole === 'user'
      ? TARGET_ROLE_MAP[targetRole]
      : undefined
  if (!mapped) {
    return { ok: false, error: '目标群体无效' }
  }
  return { ok: true, query: mapped.query, label: mapped.label }
}

export type ResolveTargetResult =
  | { ok: true; query: TargetQuery; label: string }
  | { ok: false; error: string }

/**
 * 扩展版目标群体解析（支持 tag / 指定成员）
 *
 * 与 resolveTargetRoleFilter 的关系：本函数是其超集，覆盖全部 5 种目标，
 * 并对 tag / users 类型做参数校验（非空、白名单、数量上限、去重）。
 * 管理端发送通知/邮件统一走本函数。
 */
export function resolveTargetFilter(input: {
  targetRole: NotificationTargetRole
  tags?: string[]
  userIds?: string[]
}): ResolveTargetResult {
  const { targetRole } = input

  // 角色型目标：复用原映射
  if (targetRole === 'all' || targetRole === 'admin' || targetRole === 'user') {
    return resolveTargetRoleFilter(targetRole)
  }

  if (targetRole === 'tag') {
    const rawTags = Array.isArray(input.tags) ? input.tags : []
    if (rawTags.length === 0) {
      return { ok: false, error: '请至少选择一个标签' }
    }
    if (rawTags.length > MAX_TARGET_TAGS) {
      return { ok: false, error: `最多选择${MAX_TARGET_TAGS}个标签` }
    }
    // 白名单校验：任一标签非法即整体拒绝（防注入）
    if (!rawTags.every(isUserTag)) {
      return { ok: false, error: '包含无效标签' }
    }
    const tags = Array.from(new Set(rawTags))
    const tagNames = tags.map((tag) => USER_TAG_LABELS[tag] ?? tag)
    return {
      ok: true,
      query: { kind: 'tags', value: tags },
      label: `指定标签成员（${tagNames.join('、')}）`,
    }
  }

  if (targetRole === 'users') {
    const rawIds = Array.isArray(input.userIds) ? input.userIds : []
    if (rawIds.length === 0) {
      return { ok: false, error: '请至少选择一位成员' }
    }
    if (rawIds.length > MAX_TARGET_USER_IDS) {
      return { ok: false, error: `最多选择${MAX_TARGET_USER_IDS}位成员` }
    }
    const userIds = Array.from(new Set(rawIds))
    return {
      ok: true,
      query: { kind: 'ids', value: userIds },
      label: `指定成员（${userIds.length}人）`,
    }
  }

  return { ok: false, error: '目标群体无效' }
}

/**
 * 构造通知插入行（每收件人一条，共享同一 batchId）
 *
 * 批次标识用于超管对"已发送公告"的统一修改/删除：
 * 同一次群发的所有收件人记录共享 batch_id，超管按批次操作。
 */
export function buildNotificationRows(input: {
  targetUserIds: string[]
  senderUserId: string | null
  targetRole: NotificationTargetRole
  title: string
  content: string
  batchId: string
  createdAt: string
  tags?: string[]
  userIds?: string[]
}): Array<{
  user_id: string
  sender_user_id: string | null
  target_role: NotificationTargetRole
  title: string
  content: string
  batch_id: string
  target_tags: string[] | null
  target_user_ids: string[] | null
  created_at: string
}> {
  const title = input.title.trim()
  const content = input.content.trim()
  return input.targetUserIds.map((userId) => ({
    user_id: userId,
    sender_user_id: input.senderUserId,
    target_role: input.targetRole,
    title,
    content,
    batch_id: input.batchId,
    target_tags: input.tags ?? null,
    target_user_ids: input.userIds ?? null,
    created_at: input.createdAt,
  }))
}

/**
 * 将纯文本正文转换为邮件 HTML（供 Resend 发送）
 *
 * - 对主题与正文做 HTML 转义，防止注入
 * - 换行转换为 <br/>
 * - 空正文同样生成可用模板
 */
export function buildEmailHtml(subject: string, content: string): string {
  const escapeHtml = (s: string): string =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')

  const safeSubject = escapeHtml(subject.trim())
  const body = escapeHtml(content.trim()).replace(/\n/g, '<br/>')

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#f6f7f9;font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f6f7f9;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px;background-color:#0D3B3B;">
                <p style="margin:0;color:#ffffff;font-size:18px;font-weight:600;line-height:1.4;">${safeSubject}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px;color:#333333;font-size:14px;line-height:1.8;">${body}</td>
            </tr>
            <tr>
              <td style="padding:16px 32px;border-top:1px solid #eeeeee;color:#999999;font-size:12px;">
                龙坞工作室 LongWoo Studio · 此邮件由系统自动发送，请勿直接回复
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

export type EmailHistoryRow = {
  id: string
  batch_id: string
  subject: string
  content: string
  target_role: NotificationTargetRole
  target_tags: string[] | null
  target_user_ids: string[] | null
  recipient_count: number
  success_count: number
  failed_count: number
  sender_uid: number | null
  sender_email: string | null
  created_at: string
}

/**
 * 构造邮件发送历史插入行（email_send_history 表）
 *
 * 同一次广播共享同一 batchId；target_tags / target_user_ids 二选一记录，
 * 用于后台历史展示"指定 tag 成员 / 指定成员"的具体对象。
 * id 由数据库生成，插入行不含 id。
 */
export function buildEmailHistoryRow(input: {
  batchId: string
  subject: string
  content: string
  targetRole: NotificationTargetRole
  tags?: string[]
  userIds?: string[]
  recipientCount: number
  successCount: number
  failedCount: number
  senderUid: number | null
  senderEmail: string | null
  createdAt: string
}): Omit<EmailHistoryRow, 'id'> {
  return {
    batch_id: input.batchId,
    subject: input.subject.trim(),
    content: input.content.trim(),
    target_role: input.targetRole,
    target_tags: input.tags ?? null,
    target_user_ids: input.userIds ?? null,
    recipient_count: input.recipientCount,
    success_count: input.successCount,
    failed_count: input.failedCount,
    sender_uid: input.senderUid,
    sender_email: input.senderEmail,
    created_at: input.createdAt,
  }
}
