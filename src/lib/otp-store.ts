/**
 * OTP 验证码存储（数据库版 + 内存 fallback）
 *
 * 生产环境使用 Supabase 数据库表 otp_codes 存储，
 * 支持 Serverless/多实例部署。
 *
 * 如果数据库不可用（如本地开发未执行迁移），自动降级为内存存储。
 */

import { createAdminClient } from '@/lib/supabase/admin'

// 有效期：10分钟
const OTP_TTL_MS = 10 * 60 * 1000

// 最大验证尝试次数：超过后验证码自动失效，防止暴力破解
const OTP_MAX_ATTEMPTS = 5

// ==================== 内存 Fallback ====================

interface OtpEntry {
  email: string
  code: string
  tokenHash: string
  expiresAt: number
}

const memoryStore = new Map<string, OtpEntry>()

// 验证码尝试次数跟踪（邮箱 → 已尝试次数）
// 用于防止暴力破解：同一验证码错误超过 OTP_MAX_ATTEMPTS 次后自动失效
const otpAttempts = new Map<string, number>()

// 定期清理过期项（每5分钟）
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of memoryStore.entries()) {
      if (entry.expiresAt < now) {
        memoryStore.delete(key)
        otpAttempts.delete(key)
      }
    }
  }, 5 * 60 * 1000)
}

// ==================== 公共接口 ====================

/**
 * 保存 OTP 验证码
 * 优先存入数据库，失败时降级为内存存储
 */
export async function saveOtp(email: string, code: string, tokenHash: string): Promise<void> {
  const emailKey = email.toLowerCase()
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString()

  // 保存新验证码时清除旧的尝试计数
  otpAttempts.delete(emailKey)

  try {
    const admin = createAdminClient()
    // 先删除该邮箱的旧验证码（同邮箱只保留最新的）
    await admin.from('otp_codes').delete().eq('email', email)
    // 插入新验证码
    const { error } = await admin.from('otp_codes').insert({
      email,
      code,
      token_hash: tokenHash,
      expires_at: expiresAt,
      used: false,
    })

    if (error) {
      console.warn('数据库存储 OTP 失败，降级为内存存储:', error.message)
      memoryStore.set(emailKey, { email, code, tokenHash, expiresAt: Date.now() + OTP_TTL_MS })
    }
  } catch (err) {
    console.warn('数据库连接失败，降级为内存存储:', err)
    memoryStore.set(emailKey, { email, code, tokenHash, expiresAt: Date.now() + OTP_TTL_MS })
  }
}

/**
 * 验证 OTP 验证码
 * 验证成功后自动标记为已使用（一次性）
 * 错误超过 OTP_MAX_ATTEMPTS 次后验证码自动失效，防止暴力破解
 */
export async function verifyOtp(email: string, code: string): Promise<{ valid: boolean; tokenHash?: string }> {
  const emailKey = email.toLowerCase()

  // 先尝试数据库
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('otp_codes')
      .select('id, code, token_hash, expires_at, used')
      .eq('email', email)
      .eq('used', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!error && data) {
      // 检查是否过期
      if (new Date(data.expires_at) < new Date()) {
        await admin.from('otp_codes').delete().eq('id', data.id)
        otpAttempts.delete(emailKey)
        return { valid: false }
      }

      // 验证码匹配
      if (data.code === code) {
        // 标记为已使用
        await admin.from('otp_codes').update({ used: true }).eq('id', data.id)
        otpAttempts.delete(emailKey)
        return { valid: true, tokenHash: data.token_hash }
      }

      // 验证码错误：增加尝试次数
      const attempts = (otpAttempts.get(emailKey) ?? 0) + 1
      otpAttempts.set(emailKey, attempts)

      // 超过最大尝试次数：删除验证码，强制用户重新获取
      if (attempts >= OTP_MAX_ATTEMPTS) {
        await admin.from('otp_codes').delete().eq('id', data.id)
        otpAttempts.delete(emailKey)
      }

      return { valid: false }
    }
  } catch (err) {
    console.warn('数据库验证 OTP 失败，降级为内存存储:', err)
  }

  // 降级：内存存储
  const entry = memoryStore.get(emailKey)

  if (!entry) {
    return { valid: false }
  }

  if (entry.expiresAt < Date.now()) {
    memoryStore.delete(emailKey)
    otpAttempts.delete(emailKey)
    return { valid: false }
  }

  if (entry.code !== code) {
    // 验证码错误：增加尝试次数
    const attempts = (otpAttempts.get(emailKey) ?? 0) + 1
    otpAttempts.set(emailKey, attempts)

    // 超过最大尝试次数：删除验证码
    if (attempts >= OTP_MAX_ATTEMPTS) {
      memoryStore.delete(emailKey)
      otpAttempts.delete(emailKey)
    }

    return { valid: false }
  }

  // 验证成功，删除记录（一次性使用）
  memoryStore.delete(emailKey)
  otpAttempts.delete(emailKey)
  return { valid: true, tokenHash: entry.tokenHash }
}

/**
 * 检查邮箱是否有活跃的验证码
 */
export async function hasActiveOtp(email: string): Promise<boolean> {
  const emailKey = email.toLowerCase()

  // 先尝试数据库
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('otp_codes')
      .select('expires_at')
      .eq('email', email)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .limit(1)

    if (!error && data && data.length > 0) {
      return true
    }
  } catch (err) {
    console.warn('数据库查询 OTP 失败，降级为内存存储:', err)
  }

  // 降级：内存存储
  const entry = memoryStore.get(emailKey)
  if (!entry) return false
  if (entry.expiresAt < Date.now()) {
    memoryStore.delete(emailKey)
    otpAttempts.delete(emailKey)
    return false
  }
  return true
}

/**
 * 清理过期记录（可定期调用）
 */
export async function cleanupExpiredOtps(): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('otp_codes').delete().lt('expires_at', new Date().toISOString())
  } catch {
    // 静默失败
  }
}
