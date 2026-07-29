/**
 * OTP 验证码存储（纯数据库版）
 *
 * Vercel Serverless 环境下多实例不共享内存，
 * 因此不再使用内存降级模式，所有验证码必须存入数据库。
 *
 * token_hash 不再提前生成和存储：
 * 验证码只用于验证用户身份，验证成功后重新调用 generateLink
 * 获取新的 token_hash 并立即建立会话（不会过期）。
 */

import { createAdminClient } from '@/lib/supabase/admin'

// 有效期：10分钟
const OTP_TTL_MS = 10 * 60 * 1000

// 最大验证尝试次数：超过后验证码自动失效，防止暴力破解
const OTP_MAX_ATTEMPTS = 5

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

  // 插入新验证码（token_hash 存空字符串，不再使用）
  const { error: insertError } = await admin.from('otp_codes').insert({
    email,
    code,
    token_hash: '',  // 不再提前存储 token_hash
    expires_at: expiresAt,
    used: false,
  })

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
  const { data, error } = await admin
    .from('otp_codes')
    .select('id, code, expires_at, used')
    .eq('email', email)
    .eq('used', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

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

  // 验证码匹配
  if (data.code === code) {
    if (consume) {
      await admin.from('otp_codes').update({ used: true }).eq('id', data.id)
    }
    return { valid: true }
  }

  // 验证码错误：删除验证码，要求重新获取
  await admin.from('otp_codes').delete().eq('id', data.id)
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
      .eq('code', code)
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
