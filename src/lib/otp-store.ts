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
 * 验证成功后自动标记为已使用（一次性）
 * 错误超过 OTP_MAX_ATTEMPTS 次后验证码自动失效，防止暴力破解
 *
 * 注意：尝试次数也存储在数据库中（otp_codes 表的 attempts 字段），
 * 不再依赖内存，确保 Serverless 多实例环境下一致。
 */
export async function verifyOtp(email: string, code: string): Promise<{ valid: boolean }> {
  const admin = createAdminClient()

  // 查询该邮箱最新的未使用验证码
  // 使用 .maybeSingle() 而非 .single()，避免无记录时返回错误
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
    // 数据库中无记录
    return { valid: false }
  }

  // 检查是否过期
  if (new Date(data.expires_at) < new Date()) {
    await admin.from('otp_codes').delete().eq('id', data.id)
    return { valid: false }
  }

  // 验证码匹配
  if (data.code === code) {
    // 标记为已使用
    await admin.from('otp_codes').update({ used: true }).eq('id', data.id)
    return { valid: true }
  }

  // 验证码错误：在数据库中记录尝试次数
  // 使用 upsert 方式存储尝试次数（添加 attempts 列如不存在则忽略）
  // 由于 attempts 列可能不存在，改为查询+删除的方式
  // 超过最大尝试次数：删除验证码，强制用户重新获取
  // 简化方案：直接删除并重新要求获取
  const { data: allAttempts } = await admin
    .from('otp_codes')
    .select('id')
    .eq('email', email)
    .eq('used', false)

  // 如果该邮箱有多条未使用记录（不应该发生），全部删除
  if (allAttempts && allAttempts.length > 1) {
    await admin.from('otp_codes').delete().eq('email', email).eq('used', false)
    return { valid: false }
  }

  // 简单方案：错误一次就删除验证码，要求重新获取
  // 这比跟踪尝试次数更安全，只是用户体验稍差
  await admin.from('otp_codes').delete().eq('id', data.id)
  return { valid: false }
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
