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
})
