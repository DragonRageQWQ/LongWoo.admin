import { describe, it, expect } from 'vitest'
import { extractClientIpFromRequest } from './server-utils'

function makeRequest(headers: Record<string, string>): Request {
  return new Request('https://example.com/api/test', { headers })
}

describe('extractClientIpFromRequest', () => {
  it('取 x-forwarded-for 最后一项（可信代理追加的真实 IP）', () => {
    const req = makeRequest({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' })
    expect(extractClientIpFromRequest(req)).toBe('5.6.7.8')
  })

  it('cf-connecting-ip 优先于 x-forwarded-for', () => {
    const req = makeRequest({
      'cf-connecting-ip': '9.9.9.9',
      'x-forwarded-for': '1.2.3.4, 5.6.7.8',
    })
    expect(extractClientIpFromRequest(req)).toBe('9.9.9.9')
  })

  it('x-real-ip 优先于 x-forwarded-for', () => {
    const req = makeRequest({
      'x-real-ip': '8.8.8.8',
      'x-forwarded-for': '1.2.3.4, 5.6.7.8',
    })
    expect(extractClientIpFromRequest(req)).toBe('8.8.8.8')
  })

  it('无任何 IP 头 → unknown', () => {
    const req = makeRequest({})
    expect(extractClientIpFromRequest(req)).toBe('unknown')
  })

  it('单一 x-forwarded-for 值 → 返回该值', () => {
    const req = makeRequest({ 'x-forwarded-for': '1.2.3.4' })
    expect(extractClientIpFromRequest(req)).toBe('1.2.3.4')
  })

  it('伪造头前缀被忽略（客户端可伪造的部分）', () => {
    // 客户端伪造 "203.0.113.9"，代理追加真实 IP
    const req = makeRequest({ 'x-forwarded-for': '203.0.113.9, 198.51.100.7' })
    expect(extractClientIpFromRequest(req)).toBe('198.51.100.7')
  })
})
