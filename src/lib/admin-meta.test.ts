import { describe, it, expect } from 'vitest'
import { buildUserListMeta } from './admin-meta'

describe('buildUserListMeta', () => {
  it('零号用户（uid=10001 且 role=admin）→ isZeroUser=true', () => {
    const meta = buildUserListMeta(10001, 'admin')
    expect(meta.isZeroUser).toBe(true)
    expect(meta.zeroUserUid).toBe(10001)
  })

  it('普通管理员 → isZeroUser=false', () => {
    const meta = buildUserListMeta(500, 'admin')
    expect(meta.isZeroUser).toBe(false)
    expect(meta.zeroUserUid).toBe(10001)
  })

  it('普通用户 → isZeroUser=false', () => {
    const meta = buildUserListMeta(123, 'user')
    expect(meta.isZeroUser).toBe(false)
  })

  it('未登录（uid=null）→ isZeroUser=false', () => {
    const meta = buildUserListMeta(null, null)
    expect(meta.isZeroUser).toBe(false)
  })
})
