import { describe, it, expect } from 'vitest'
import {
  parseBeijingDateTime,
  formatBeijingDateTime,
  validateScheduledInput,
  isDueScheduledTask,
  buildScheduledSendRow,
  type ScheduledSendStatus,
} from './notification-schedule-utils'

describe('parseBeijingDateTime', () => {
  it('合法输入（datetime-local 格式）按北京时间解析为正确 UTC 时刻', () => {
    const date = parseBeijingDateTime('2026-08-30T14:30')
    // 北京 14:30 = UTC 06:30
    expect(date?.toISOString()).toBe('2026-08-30T06:30:00.000Z')
  })

  it('午夜 00:00 正确解析（避免 24 小时制回绕问题）', () => {
    const date = parseBeijingDateTime('2026-08-30T00:00')
    expect(date?.toISOString()).toBe('2026-08-29T16:00:00.000Z')
  })

  it('空字符串 → null', () => {
    expect(parseBeijingDateTime('')).toBeNull()
  })

  it('非法格式 → null', () => {
    expect(parseBeijingDateTime('abc')).toBeNull()
    expect(parseBeijingDateTime('2026-13-40T99:99')).toBeNull()
  })
})

describe('formatBeijingDateTime', () => {
  it('将 UTC 时刻格式化为北京时间 YYYY-MM-DD HH:mm', () => {
    const formatted = formatBeijingDateTime('2026-08-30T06:30:00.000Z')
    expect(formatted).toBe('2026-08-30 14:30')
  })

  it('支持 Date 对象输入', () => {
    const formatted = formatBeijingDateTime(new Date('2026-08-30T16:00:00.000Z'))
    expect(formatted).toBe('2026-08-31 00:00')
  })
})

describe('validateScheduledInput', () => {
  // 参考时刻：UTC 2026-08-30 06:00 = 北京 14:00
  const now = new Date('2026-08-30T06:00:00.000Z')

  it('空字符串 → 错误', () => {
    const result = validateScheduledInput('', now)
    expect(result.ok).toBe(false)
  })

  it('非法格式 → 错误', () => {
    const result = validateScheduledInput('not-a-date', now)
    expect(result.ok).toBe(false)
  })

  it('过去时间（北京时间 13:00 < 当前 14:00）→ 错误', () => {
    const result = validateScheduledInput('2026-08-30T13:00', now)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('当前时间')
    }
  })

  it('未来时间（北京时间 14:30）→ ok，返回 UTC 时刻', () => {
    const result = validateScheduledInput('2026-08-30T14:30', now)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.scheduledAt).toBe('2026-08-30T06:30:00.000Z')
    }
  })

  it('超过一年上限 → 错误', () => {
    const result = validateScheduledInput('2027-09-01T14:00', now)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('一年')
    }
  })
})

describe('isDueScheduledTask', () => {
  const now = new Date('2026-08-30T06:30:00.000Z')

  it('pending 且已到计划时间 → true', () => {
    expect(
      isDueScheduledTask(
        { status: 'pending', scheduled_at: '2026-08-30T06:29:00.000Z' },
        now
      )
    ).toBe(true)
  })

  it('pending 但未到计划时间 → false', () => {
    expect(
      isDueScheduledTask(
        { status: 'pending', scheduled_at: '2026-08-30T06:31:00.000Z' },
        now
      )
    ).toBe(false)
  })

  it('非 pending 状态（sending/sent/failed/cancelled）→ false', () => {
    for (const status of ['sending', 'sent', 'failed', 'cancelled'] as ScheduledSendStatus[]) {
      expect(
        isDueScheduledTask(
          { status, scheduled_at: '2026-08-30T06:00:00.000Z' },
          now
        )
      ).toBe(false)
    }
  })
})

describe('buildScheduledSendRow', () => {
  it('构造 scheduled_sends 插入行（tag 目标，trim 标题/内容）', () => {
    const row = buildScheduledSendRow({
      channel: 'notification',
      targetRole: 'tag',
      tags: ['testA'],
      title: '  定时公告  ',
      content: '  内容  ',
      scheduledAt: '2026-08-30T06:30:00.000Z',
      createdByUid: 10001,
      createdByEmail: 'admin@longwoo.studio',
    })
    expect(row).toEqual({
      channel: 'notification',
      target_role: 'tag',
      target_tags: ['testA'],
      target_user_ids: null,
      title: '定时公告',
      content: '内容',
      scheduled_at: '2026-08-30T06:30:00.000Z',
      status: 'pending',
      created_by_uid: 10001,
      created_by_email: 'admin@longwoo.studio',
    })
  })

  it('email 渠道 + users 目标 → 记录 target_user_ids 与渠道', () => {
    const row = buildScheduledSendRow({
      channel: 'email',
      targetRole: 'users',
      userIds: ['u1', 'u2'],
      title: '邮件主题',
      content: '正文',
      scheduledAt: '2026-08-30T06:30:00.000Z',
      createdByUid: null,
      createdByEmail: null,
    })
    expect(row.channel).toBe('email')
    expect(row.target_user_ids).toEqual(['u1', 'u2'])
    expect(row.target_tags).toBeNull()
  })
})
