import { describe, it, expect, vi } from 'vitest'
import { fetchWithRetry } from './network-utils'

describe('fetchWithRetry', () => {
  it('首次调用成功时直接返回，不重复调用', async () => {
    const fn = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'x' }) })
    const result = await fetchWithRetry(fn)
    expect(result).toEqual({ id: 'x' })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('临时性错误（网络异常）自动重试后成功', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValue({ ok: true, json: async () => ({ id: 'ok' }) })
    const result = await fetchWithRetry(fn, { retries: 2 })
    expect(result).toEqual({ id: 'ok' })
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('5xx 状态码视为临时错误自动重试', async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValue({ ok: true, json: async () => ({ id: 'recovered' }) })
    const result = await fetchWithRetry(fn, { retries: 2 })
    expect(result).toEqual({ id: 'recovered' })
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('4xx 状态码不重试（业务错误，重试无意义）', async () => {
    const fn = vi.fn().mockResolvedValue({ ok: false, status: 400 })
    const result = await fetchWithRetry(fn, { retries: 2 })
    expect(result).toBeNull()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('重试耗尽后返回 null 并抛出最后一次错误', async () => {
    const fn = vi.fn().mockRejectedValue(new TypeError('fetch failed'))
    const result = await fetchWithRetry(fn, { retries: 2 })
    expect(result).toBeNull()
    expect(fn).toHaveBeenCalledTimes(3)
  })
})
