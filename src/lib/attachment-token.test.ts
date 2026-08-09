import { describe, it, expect } from 'vitest'
import {
  generateUploadToken,
  verifyUploadToken,
} from './attachment-token'

const SECRET = 'test-secret-for-upload-token'

describe('generateUploadToken', () => {
  it('为订单 id 生成 HMAC 签名 token', () => {
    const token = generateUploadToken('order-123', SECRET)
    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThan(20)
  })
})

describe('verifyUploadToken', () => {
  it('正确 token 且 orderId 匹配 → true', () => {
    const token = generateUploadToken('order-123', SECRET)
    expect(verifyUploadToken('order-123', token, SECRET)).toBe(true)
  })

  it('orderId 与 token 不匹配 → false', () => {
    const token = generateUploadToken('order-123', SECRET)
    expect(verifyUploadToken('order-456', token, SECRET)).toBe(false)
  })

  it('错误密钥签发的 token → false', () => {
    const token = generateUploadToken('order-123', 'wrong-secret')
    expect(verifyUploadToken('order-123', token, SECRET)).toBe(false)
  })

  it('空 token → false', () => {
    expect(verifyUploadToken('order-123', '', SECRET)).toBe(false)
  })

  it('畸形 token → false', () => {
    expect(verifyUploadToken('order-123', 'not-a-valid-token', SECRET)).toBe(false)
  })

  it('过期 token（超过 24h）→ false', () => {
    const issuedAt = Date.now() - 25 * 60 * 60 * 1000 // 25 小时前
    const token = generateUploadToken('order-123', SECRET, issuedAt)
    expect(verifyUploadToken('order-123', token, SECRET)).toBe(false)
  })

  it('24h 内 token → true', () => {
    const issuedAt = Date.now() - 23 * 60 * 60 * 1000 // 23 小时前
    const token = generateUploadToken('order-123', SECRET, issuedAt)
    expect(verifyUploadToken('order-123', token, SECRET)).toBe(true)
  })

  it('未来时间戳 token → false', () => {
    const issuedAt = Date.now() + 60 * 60 * 1000 // 1 小时后
    const token = generateUploadToken('order-123', SECRET, issuedAt)
    expect(verifyUploadToken('order-123', token, SECRET)).toBe(false)
  })

  it('篡改签发时间 → false', () => {
    const issuedAt = Date.now()
    const token = generateUploadToken('order-123', SECRET, issuedAt)
    // 篡改时间戳部分（hmac 不匹配）
    const tampered = `${token.split('.')[0]}.${issuedAt + 1000}`
    expect(verifyUploadToken('order-123', tampered, SECRET)).toBe(false)
  })
})
