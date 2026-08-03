import { describe, it, expect, beforeEach } from 'vitest'
import { SignJWT, importJWK } from 'jose'
import { verifyTokenLocally } from './cookie-utils'

// 测试用 ES256 (P-256) 密钥对
let privateJwk: JsonWebKey
let publicJwk: JsonWebKey

beforeEach(async () => {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  )
  privateJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey)
  publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)
  // 清除环境变量，保证每个测试独立
  delete process.env.SUPABASE_JWT_PUBLIC_JWKS
  delete process.env.SUPABASE_JWT_SECRET
})

async function signEs256(payload: Record<string, unknown>, privateKeyJwk: JsonWebKey, expSec: number) {
  const key = await importJWK(privateKeyJwk, 'ES256')
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'ES256', kid: 'test-kid' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expSec)
    .sign(key)
}

describe('verifyTokenLocally - ES256 本地验证', () => {
  it('有效的 ES256 token → 本地验证通过，返回 sub（零网络往返）', async () => {
    process.env.SUPABASE_JWT_PUBLIC_JWKS = JSON.stringify({
      keys: [{ ...publicJwk, alg: 'ES256', kid: 'test-kid', use: 'sig', key_ops: ['verify'] }],
    })
    const token = await signEs256({ sub: 'user-123' }, privateJwk, 3600)
    const result = await verifyTokenLocally(token)
    expect(result).toBe('user-123')
  })

  it('已过期的 ES256 token → 本地验证失败返回 null', async () => {
    process.env.SUPABASE_JWT_PUBLIC_JWKS = JSON.stringify({
      keys: [{ ...publicJwk, alg: 'ES256', kid: 'test-kid', use: 'sig', key_ops: ['verify'] }],
    })
    const token = await signEs256({ sub: 'user-123' }, privateJwk, -100)
    const result = await verifyTokenLocally(token)
    expect(result).toBeNull()
  })

  it('签名被篡改的 token → 本地验证失败返回 null', async () => {
    process.env.SUPABASE_JWT_PUBLIC_JWKS = JSON.stringify({
      keys: [{ ...publicJwk, alg: 'ES256', kid: 'test-kid', use: 'sig', key_ops: ['verify'] }],
    })
    const token = await signEs256({ sub: 'user-123' }, privateJwk, 3600)
    // 篡改签名部分
    const [header, payload, sig] = token.split('.')
    const tampered = `${header}.${payload}.${sig.slice(0, -2)}AA`
    const result = await verifyTokenLocally(tampered)
    expect(result).toBeNull()
  })

  it('未配置 JWKS 环境变量 → 返回 null（走网络回退）', async () => {
    const token = await signEs256({ sub: 'user-123' }, privateJwk, 3600)
    const result = await verifyTokenLocally(token)
    expect(result).toBeNull()
  })
})
