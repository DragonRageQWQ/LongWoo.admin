import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'crypto'

// Mock supabase admin client
const mocks = {
  queryFn: vi.fn(),
  updateFn: vi.fn(),
  deleteFn: vi.fn(),
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: () => ({
              limit: () => ({ maybeSingle: mocks.queryFn }),
            }),
          }),
        }),
      }),
      update: (payload: unknown) => ({ eq: () => mocks.updateFn(payload) }),
      delete: () => ({ eq: () => mocks.deleteFn() }),
    }),
  }),
}))

import { verifyOtp } from './otp-store'

function makeQueryResponse(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      id: 'otp-1',
      code: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', // sha256('')
      expires_at: new Date(Date.now() + 60000).toISOString(),
      used: false,
      attempts: 0,
      ...overrides,
    },
    error: null,
  }
}

function sha256hex(input: string): string {
  return createHash('sha256').update(input, 'utf-8').digest('hex')
}

describe('verifyOtp 错误分类', () => {
  beforeEach(() => {
    mocks.queryFn.mockReset()
    mocks.updateFn.mockReset().mockResolvedValue({ error: null })
    mocks.deleteFn.mockReset().mockResolvedValue({ error: null })
  })

  it('数据库查询失败（系统错误）→ systemError=true，而非误报验证码无效', async () => {
    mocks.queryFn.mockResolvedValue({ data: null, error: new Error('connection reset') })
    const result = await verifyOtp('a@b.com', '123456')
    expect(result).toEqual({ valid: false, systemError: true })
  })

  it('验证码不匹配（用户错误）→ systemError=false', async () => {
    mocks.queryFn.mockResolvedValue(makeQueryResponse({ code: sha256hex('999999') }))
    const result = await verifyOtp('a@b.com', '123456')
    expect(result.valid).toBe(false)
    expect(result.systemError).toBe(false)
  })

  it('验证码匹配 → valid=true', async () => {
    mocks.queryFn.mockResolvedValue(makeQueryResponse({ code: sha256hex('123456') }))
    const result = await verifyOtp('a@b.com', '123456', false)
    expect(result).toEqual({ valid: true, systemError: false })
  })

  it('验证码已过期 → valid=false 并删除记录', async () => {
    mocks.queryFn.mockResolvedValue(makeQueryResponse({ expires_at: new Date(Date.now() - 1000).toISOString() }))
    const result = await verifyOtp('a@b.com', '123456')
    expect(result.valid).toBe(false)
    expect(mocks.deleteFn).toHaveBeenCalled()
  })
})
