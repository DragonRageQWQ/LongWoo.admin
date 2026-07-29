/**
 * OTP 验证码存储（内存版，适用于 dev 模式）
 *
 * 生产环境应替换为数据库表存储：
 * CREATE TABLE otp_codes (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   email TEXT NOT NULL,
 *   code TEXT NOT NULL,
 *   token_hash TEXT NOT NULL,
 *   expires_at TIMESTAMPTZ NOT NULL,
 *   used BOOLEAN DEFAULT FALSE,
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * 当前实现：Map 存储，自动清理过期项，10分钟有效期
 */

interface OtpEntry {
  email: string
  code: string
  tokenHash: string
  expiresAt: number
}

// 内存存储
const store = new Map<string, OtpEntry>()

// 有效期：10分钟
const OTP_TTL = 10 * 60 * 1000

// 定期清理过期项（每5分钟）
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store.entries()) {
      if (entry.expiresAt < now) {
        store.delete(key)
      }
    }
  }, 5 * 60 * 1000)
}

export function saveOtp(email: string, code: string, tokenHash: string): void {
  store.set(email, {
    email,
    code,
    tokenHash,
    expiresAt: Date.now() + OTP_TTL,
  })
}

export function verifyOtp(email: string, code: string): { valid: boolean; tokenHash?: string } {
  const entry = store.get(email)

  if (!entry) {
    return { valid: false }
  }

  if (entry.expiresAt < Date.now()) {
    store.delete(email)
    return { valid: false }
  }

  if (entry.code !== code) {
    return { valid: false }
  }

  // 验证成功，删除记录（一次性使用）
  store.delete(email)
  return { valid: true, tokenHash: entry.tokenHash }
}

export function hasActiveOtp(email: string): boolean {
  const entry = store.get(email)
  if (!entry) return false
  if (entry.expiresAt < Date.now()) {
    store.delete(email)
    return false
  }
  return true
}
