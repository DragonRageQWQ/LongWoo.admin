import { describe, it, expect } from 'vitest'
import {
  validateNotificationInput,
  resolveTargetRoleFilter,
  resolveTargetFilter,
  buildNotificationRows,
  buildEmailHtml,
  buildEmailHistoryRow,
  type NotificationTargetRole,
} from './notification-utils'

describe('validateNotificationInput', () => {
  it('合法输入（标题+内容）→ 无错误', () => {
    const result = validateNotificationInput('系统维护通知', '平台将于今晚进行例行维护')
    expect(result).toBeNull()
  })

  it('标题为空 → 返回错误', () => {
    const result = validateNotificationInput('', '内容')
    expect(result).toBe('请输入标题')
  })

  it('标题为空白字符 → 返回错误', () => {
    const result = validateNotificationInput('   ', '内容')
    expect(result).toBe('请输入标题')
  })

  it('内容为空 → 返回错误', () => {
    const result = validateNotificationInput('标题', '')
    expect(result).toBe('请输入内容')
  })

  it('标题超过100字 → 返回错误', () => {
    const result = validateNotificationInput('标'.repeat(101), '内容')
    expect(result).toBe('标题不能超过100字')
  })

  it('内容超过2000字 → 返回错误', () => {
    const result = validateNotificationInput('标题', '内'.repeat(2001))
    expect(result).toBe('内容不能超过2000字')
  })

  it('标题恰好100字 → 无错误', () => {
    const result = validateNotificationInput('标'.repeat(100), '内容')
    expect(result).toBeNull()
  })
})

describe('resolveTargetRoleFilter', () => {
  it('all（全体用户）→ 无需过滤', () => {
    const result = resolveTargetRoleFilter('all')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.query).toEqual({ kind: 'all' })
      expect(result.label).toBe('全体用户')
    }
  })

  it('admin（全体管理员）→ role=admin', () => {
    const result = resolveTargetRoleFilter('admin')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.query).toEqual({ kind: 'eq', value: 'admin' })
      expect(result.label).toBe('全体管理员')
    }
  })

  it('user（全体普通成员）→ role=user', () => {
    const result = resolveTargetRoleFilter('user')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.query).toEqual({ kind: 'eq', value: 'user' })
      expect(result.label).toBe('全体普通成员')
    }
  })

  it('非法目标群体 → 返回错误', () => {
    const result = resolveTargetRoleFilter('superadmin' as NotificationTargetRole)
    expect(result.ok).toBe(false)
  })

  it('空字符串 → 返回错误', () => {
    const result = resolveTargetRoleFilter('' as NotificationTargetRole)
    expect(result.ok).toBe(false)
  })
})

describe('buildNotificationRows', () => {
  it('为每个收件人生成一条记录，且共享同一 batchId', () => {
    const rows = buildNotificationRows({
      targetUserIds: ['u1', 'u2', 'u3'],
      senderUserId: 'admin-1',
      targetRole: 'all',
      title: '  系统通知  ',
      content: '  维护公告  ',
      batchId: 'batch-abc',
      createdAt: '2026-08-03T00:00:00.000Z',
    })
    expect(rows).toHaveLength(3)
    expect(rows[0]).toEqual({
      user_id: 'u1',
      sender_user_id: 'admin-1',
      target_role: 'all',
      title: '系统通知',
      content: '维护公告',
      batch_id: 'batch-abc',
      target_tags: null,
      target_user_ids: null,
      created_at: '2026-08-03T00:00:00.000Z',
    })
    // 共享同一批次标识
    expect(new Set(rows.map((r) => r.batch_id))).toEqual(new Set(['batch-abc']))
  })

  it('目标用户为空 → 返回空数组', () => {
    const rows = buildNotificationRows({
      targetUserIds: [],
      senderUserId: 'admin-1',
      targetRole: 'user',
      title: '标题',
      content: '内容',
      batchId: 'batch-1',
      createdAt: '2026-08-03T00:00:00.000Z',
    })
    expect(rows).toHaveLength(0)
  })

  it('tag 目标 → 每行携带 target_tags', () => {
    const rows = buildNotificationRows({
      targetUserIds: ['u1'],
      senderUserId: 'admin-1',
      targetRole: 'tag',
      tags: ['testA'],
      title: '标题',
      content: '内容',
      batchId: 'batch-2',
      createdAt: '2026-08-03T00:00:00.000Z',
    })
    expect(rows[0].target_tags).toEqual(['testA'])
    expect(rows[0].target_user_ids).toBeNull()
  })

  it('指定成员目标 → 每行携带 target_user_ids', () => {
    const rows = buildNotificationRows({
      targetUserIds: ['u1', 'u2'],
      senderUserId: 'admin-1',
      targetRole: 'users',
      userIds: ['u1', 'u2'],
      title: '标题',
      content: '内容',
      batchId: 'batch-3',
      createdAt: '2026-08-03T00:00:00.000Z',
    })
    expect(rows[0].target_user_ids).toEqual(['u1', 'u2'])
    expect(rows[0].target_tags).toBeNull()
  })
})

describe('resolveTargetFilter', () => {
  it('all（全体用户）→ 无需过滤', () => {
    const result = resolveTargetFilter({ targetRole: 'all' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.query).toEqual({ kind: 'all' })
      expect(result.label).toBe('全体用户')
    }
  })

  it('admin（仅限管理员）→ role=admin', () => {
    const result = resolveTargetFilter({ targetRole: 'admin' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.query).toEqual({ kind: 'eq', value: 'admin' })
      expect(result.label).toBe('全体管理员')
    }
  })

  it('user（全部普通成员）→ role=user', () => {
    const result = resolveTargetFilter({ targetRole: 'user' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.query).toEqual({ kind: 'eq', value: 'user' })
      expect(result.label).toBe('全体普通成员')
    }
  })

  it('tag 合法（多个标签去重）→ kind=tags + 标签名 label', () => {
    const result = resolveTargetFilter({ targetRole: 'tag', tags: ['testA', 'vip', 'testA'] })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.query).toEqual({ kind: 'tags', value: ['testA', 'vip'] })
      expect(result.label).toBe('指定标签成员（测试A、VIP）')
    }
  })

  it('tag 空数组 → 返回错误', () => {
    const result = resolveTargetFilter({ targetRole: 'tag', tags: [] })
    expect(result.ok).toBe(false)
  })

  it('tag 含非法标签 → 返回错误', () => {
    const result = resolveTargetFilter({ targetRole: 'tag', tags: ['testA', 'hacker'] })
    expect(result.ok).toBe(false)
  })

  it('tag 超过数量上限 → 返回错误', () => {
    const result = resolveTargetFilter({ targetRole: 'tag', tags: Array(11).fill('testA') })
    expect(result.ok).toBe(false)
  })

  it('users 合法 → kind=ids + 人数 label', () => {
    const result = resolveTargetFilter({ targetRole: 'users', userIds: ['u1', 'u2', 'u3'] })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.query).toEqual({ kind: 'ids', value: ['u1', 'u2', 'u3'] })
      expect(result.label).toBe('指定成员（3人）')
    }
  })

  it('users 空数组 → 返回错误', () => {
    const result = resolveTargetFilter({ targetRole: 'users', userIds: [] })
    expect(result.ok).toBe(false)
  })

  it('users 超过数量上限 → 返回错误', () => {
    const result = resolveTargetFilter({ targetRole: 'users', userIds: Array(201).fill('u') })
    expect(result.ok).toBe(false)
  })

  it('非法目标群体 → 返回错误', () => {
    const result = resolveTargetFilter({ targetRole: 'superadmin' as NotificationTargetRole })
    expect(result.ok).toBe(false)
  })
})

describe('buildEmailHtml', () => {
  it('生成含主题与正文的 HTML，并转义特殊字符、转换换行', () => {
    const html = buildEmailHtml('维护 <通知>', '第一行\n第二行 & 更多')
    expect(html).toContain('维护 &lt;通知&gt;')
    expect(html).toContain('第一行<br/>第二行 &amp; 更多')
  })

  it('正文为空 → 仍生成可用 HTML', () => {
    const html = buildEmailHtml('标题', '')
    expect(html).toContain('标题')
  })
})

describe('buildEmailHistoryRow', () => {
  it('生成 email_send_history 插入行（tag 目标）', () => {
    const row = buildEmailHistoryRow({
      batchId: 'batch-1',
      subject: '  活动通知  ',
      content: ' 内容 ',
      targetRole: 'tag',
      tags: ['testA'],
      recipientCount: 3,
      successCount: 2,
      failedCount: 1,
      senderUid: 10001,
      senderEmail: 'admin@longwoo.studio',
      createdAt: '2026-08-30T00:00:00.000Z',
    })
    expect(row).toEqual({
      batch_id: 'batch-1',
      subject: '活动通知',
      content: '内容',
      target_role: 'tag',
      target_tags: ['testA'],
      target_user_ids: null,
      recipient_count: 3,
      success_count: 2,
      failed_count: 1,
      sender_uid: 10001,
      sender_email: 'admin@longwoo.studio',
      created_at: '2026-08-30T00:00:00.000Z',
    })
  })

  it('users 目标 → 记录 target_user_ids，target_tags 为 null', () => {
    const row = buildEmailHistoryRow({
      batchId: 'batch-2',
      subject: 's',
      content: 'c',
      targetRole: 'users',
      userIds: ['u1', 'u2'],
      recipientCount: 2,
      successCount: 2,
      failedCount: 0,
      senderUid: null,
      senderEmail: null,
      createdAt: '2026-08-30T00:00:00.000Z',
    })
    expect(row.target_user_ids).toEqual(['u1', 'u2'])
    expect(row.target_tags).toBeNull()
  })
})
