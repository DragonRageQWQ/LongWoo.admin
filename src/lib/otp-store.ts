/**
 * OTP 验证码存储（纯数据库版）
 *
 * Vercel Serverless 环境下多实例不共享内存，
 * 因此不再使用内存降级模式，所有验证码必须存入数据库。
 *
 * 安全：验证码以 SHA-256 哈希存储，即使数据库泄露也无法直接读取验证码。
 *
 * token_hash 不再提前生成和存储：
 * 验证码只用于验证用户身份，验证成功后重新调用 generateLink
 * 获取新的 token_hash 并立即建立会话（不会过期）。
 */

import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { OTP_MAX_ATTEMPTS, OTP_TTL_MS } from '@/lib/constants'

/**
 * 将验证码哈希为 SHA-256 hex 字符串
 * 数据库中仅存储哈希值，防止数据库泄露时验证码被直接读取
 */
function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code, 'utf-8').digest('hex')
}

/**
 * 恒定时间字符串比较
 * 防止时序攻击：长度不同时直接返回 false，长度相同时使用 crypto.timingSafeEqual
 */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf-8')
  const bufB = Buffer.from(b, 'utf-8')
  if (bufA.length !== bufB.length) {
    return false
  }
  return crypto.timingSafeEqual(bufA, bufB)
}

// ==================== 公共接口 ====================

/**
 * 保存 OTP 验证码到数据库
 * @throws 如果数据库操作失败（调用方应捕获并返回错误）
 */
export async function saveOtp(email: string, code: string): Promise<void> {
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString()

  const admin = createAdminClient()
  // 先删除该邮箱的旧验证码（同邮箱只保留最新的）
  const { error: deleteError } = await admin
    .from('otp_codes')
    .delete()
    .eq('email', email)

  if (deleteError) {
    console.error('删除旧 OTP 失败:', deleteError.message)
  }

  // 插入新验证码（存储 SHA-256 哈希，非明文）
  // 尝试包含 attempts 列（用于暴力破解防护），如果列不存在则降级插入
  const insertPayload = {
    email,
    code: hashCode(code),
    token_hash: '',  // 不再提前存储 token_hash
    expires_at: expiresAt,
    used: false,
    attempts: 0,
  }

  let { error: insertError } = await admin.from('otp_codes').insert(insertPayload)

  // 如果 attempts 列不存在，降级为不含 attempts 的插入
  if (insertError && insertError.message.includes('attempts')) {
    console.warn('attempts 列不存在，降级插入（建议执行迁移 SQL 添加该列）')
    const fallbackPayload = { ...insertPayload }
    delete (fallbackPayload as Record<string, unknown>).attempts
    const fallbackResult = await admin.from('otp_codes').insert(fallbackPayload)
    insertError = fallbackResult.error
  }

  if (insertError) {
    console.error('数据库存储 OTP 失败:', insertError.message)
    throw new Error('验证码存储失败')
  }
}

/**
 * 验证 OTP 验证码
 *
 * @param email   邮箱
 * @param code    验证码
 * @param consume 是否在验证成功后标记为已使用（默认 true）
 *                设为 false 时仅校验不消费，用于延迟消费场景：
 *                先校验验证码 → 建立会话 → 成功后再调用 consumeOtp 消费
 *                这样如果建立会话失败，验证码仍然有效，用户可重试
 */
export async function verifyOtp(
  email: string,
  code: string,
  consume: boolean = true
): Promise<{ valid: boolean }> {
  const admin = createAdminClient()

  // 查询该邮箱最新的未使用验证码
  // 尝试包含 attempts 列，如果列不存在则降级查询
  let { data, error } = await admin
    .from('otp_codes')
    .select('id, code, expires_at, used, attempts')
    .eq('email', email)
    .eq('used', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // 如果 attempts 列不存在，降级为不含 attempts 的查询
  if (error && error.message.includes('attempts')) {
    console.warn('attempts 列不存在，降级查询（建议执行迁移 SQL 添加该列）')
    const fallbackResult = await admin
      .from('otp_codes')
      .select('id, code, expires_at, used')
      .eq('email', email)
      .eq('used', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    data = fallbackResult.data as typeof data
    error = fallbackResult.error
  }

  if (error) {
    console.error('数据库查询 OTP 失败:', error.message)
    return { valid: false }
  }

  if (!data) {
    return { valid: false }
  }

  // 检查是否过期
  if (new Date(data.expires_at) < new Date()) {
    await admin.from('otp_codes').delete().eq('id', data.id)
    return { valid: false }
  }

  // 恒定时间比较验证码哈希，防止时序攻击
  if (safeEqual(data.code, hashCode(code))) {
    if (consume) {
      await admin.from('otp_codes').update({ used: true }).eq('id', data.id)
    }
    return { valid: true }
  }

  // 验证码错误：增加尝试次数（如果 attempts 列存在）
  const currentAttempts = (data as Record<string, unknown>).attempts as number | undefined
  const newAttempts = (currentAttempts ?? 0) + 1
  if (newAttempts >= OTP_MAX_ATTEMPTS) {
    // 达到最大尝试次数，删除验证码使其失效，防止暴力破解
    await admin.from('otp_codes').delete().eq('id', data.id)
  } else {
    // 未达到上限，保留验证码，更新尝试次数（attempts 列可能不存在，静默失败）
    try {
      await admin.from('otp_codes').update({ attempts: newAttempts }).eq('id', data.id)
    } catch {
      // attempts 列不存在时忽略错误
    }
  }
  return { valid: false }
}

/**
 * 消费验证码（标记为已使用）
 *
 * 在会话成功建立后调用，确保建立会话失败时验证码仍有效。
 */
export async function consumeOtp(email: string, code: string): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin
      .from('otp_codes')
      .update({ used: true })
      .eq('email', email)
      .eq('code', hashCode(code))
      .eq('used', false)
  } catch (err) {
    console.warn('消费 OTP 失败:', err)
  }
}

/**
 * 检查邮箱是否有活跃的验证码
 */
export async function hasActiveOtp(email: string): Promise<boolean> {
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
    console.warn('数据库查询 OTP 失败:', err)
  }

  return false
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
