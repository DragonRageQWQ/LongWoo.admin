/**
 * 定时发送工具（纯函数，便于测试）
 *
 * 为「发送通知 / 发送邮件」提供定时发送能力：
 * - 时间基准统一为北京时间（Asia/Shanghai）
 * - 管理员在管理后台选择定时时间（datetime-local 值按北京时间解析）
 * - 由 Vercel Cron 每分钟扫描 scheduled_sends 表，到点执行
 */

import type { NotificationTargetRole } from './notification-utils'

/** 北京时间时区 */
export const BEIJING_TIMEZONE = 'Asia/Shanghai'
/** 定时最远上限：365 天 */
export const MAX_SCHEDULE_DAYS = 365
/** 至少提前 1 分钟（避免刚提交即到点） */
export const MIN_SCHEDULE_AHEAD_MS = 60 * 1000

export type ScheduledSendChannel = 'notification' | 'email'
export type ScheduledSendStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'cancelled'

/**
 * 将 datetime-local 输入值（YYYY-MM-DDTHH:mm）按北京时间解析
 *
 * 管理员的浏览器可能不在北京时区，因此不依赖本地时区解析，
 * 而是显式附加 +08:00 偏移，得到绝对 UTC 时刻。
 *
 * @returns 解析失败（空/非法格式）返回 null
 */
export function parseBeijingDateTime(value: string): Date | null {
  if (!value || typeof value !== 'string') return null
  const date = new Date(`${value}:00+08:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * 将时刻格式化为北京时间显示（YYYY-MM-DD HH:mm）
 *
 * 支持 Date 或 ISO 字符串输入；非法输入返回空字符串。
 */
export function formatBeijingDateTime(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BEIJING_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: string): string =>
    parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`
}

export type ValidateScheduledResult =
  | { ok: true; scheduledAt: string }
  | { ok: false; error: string }

/**
 * 校验定时发送时间（以北京时间为基准的 datetime-local 输入）
 *
 * 规则：
 * - 非空、格式合法
 * - 至少提前 1 分钟（未来时间）
 * - 不超过一年上限
 *
 * @param now 服务端当前时刻（UTC），用于相对校验
 */
export function validateScheduledInput(
  value: string,
  now: Date
): ValidateScheduledResult {
  const trimmed = value.trim()
  if (!trimmed) {
    return { ok: false, error: '请选择定时发送时间' }
  }
  const scheduled = parseBeijingDateTime(trimmed)
  if (!scheduled) {
    return { ok: false, error: '定时时间格式不正确' }
  }
  const nowMs = now.getTime()
  if (scheduled.getTime() <= nowMs + MIN_SCHEDULE_AHEAD_MS) {
    return { ok: false, error: '定时时间不能早于当前时间' }
  }
  if (scheduled.getTime() > nowMs + MAX_SCHEDULE_DAYS * 24 * 60 * 60 * 1000) {
    return { ok: false, error: '定时时间不能超过一年' }
  }
  return { ok: true, scheduledAt: scheduled.toISOString() }
}

/**
 * 判断定时任务是否到点可执行
 *
 * 仅 status='pending' 且 scheduled_at <= now 的任务为到点。
 */
export function isDueScheduledTask(
  task: { status: ScheduledSendStatus; scheduled_at: string },
  now: Date
): boolean {
  if (task.status !== 'pending') return false
  const scheduledAt = new Date(task.scheduled_at)
  if (Number.isNaN(scheduledAt.getTime())) return false
  return scheduledAt.getTime() <= now.getTime()
}

export type ScheduledSendRow = {
  channel: ScheduledSendChannel
  target_role: NotificationTargetRole
  target_tags: string[] | null
  target_user_ids: string[] | null
  title: string
  content: string
  scheduled_at: string
  status: 'pending'
  created_by_uid: number | null
  created_by_email: string | null
}

/**
 * 构造 scheduled_sends 表插入行
 *
 * 统一 status='pending'；target_tags / target_user_ids 二选一记录；
 * 标题/内容 trim。
 */
export function buildScheduledSendRow(input: {
  channel: ScheduledSendChannel
  targetRole: NotificationTargetRole
  tags?: string[]
  userIds?: string[]
  title: string
  content: string
  scheduledAt: string
  createdByUid: number | null
  createdByEmail: string | null
}): ScheduledSendRow {
  return {
    channel: input.channel,
    target_role: input.targetRole,
    target_tags: input.tags ?? null,
    target_user_ids: input.userIds ?? null,
    title: input.title.trim(),
    content: input.content.trim(),
    scheduled_at: input.scheduledAt,
    status: 'pending',
    created_by_uid: input.createdByUid,
    created_by_email: input.createdByEmail,
  }
}
