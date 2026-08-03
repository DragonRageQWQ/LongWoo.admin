import { describe, it, expect } from 'vitest'
import {
  validateNotificationInput,
  resolveTargetRoleFilter,
  buildNotificationRows,
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
})
