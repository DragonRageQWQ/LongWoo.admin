/**
 * 基于数据库的速率限制
 *
 * 替代内存 Map 方案，在 Vercel Serverless 多实例环境下有效。
 * 使用 Supabase 数据库 RPC 函数（check_rate_limit）实现原子计数，
 * 通过 pg_advisory_xact_lock 解决 TOCTOU 竞态条件。
 *
 * 如果 RPC 函数不可用（未执行迁移），回退到 insert-first 模式，
 * 比原来的 check-first 模式更安全。
 */

import { createAdminClient } from '@/lib/supabase/admin'

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

/**
 * 检查速率限制
 *
 * @param key      - 限流键（如 "ip:1.2.3.4" 或 "email:xxx@yyy.com"）
 * @param maxCount - 窗口内最大请求数
 * @param windowMs - 窗口大小（毫秒）
 * @returns 是否允许、剩余次数、重置时间
 */
export async function checkRateLimit(
  key: string,
  maxCount: number,
  windowMs: number
): Promise<RateLimitResult> {
  try {
    const admin = createAdminClient()

    // 优先使用原子 RPC 函数（需执行 rate_limit_rpc.sql 迁移）
    const { data: rpcResult, error: rpcError } = await admin
      .rpc('check_rate_limit', {
        p_key: key,
        p_max_count: maxCount,
        p_window_ms: windowMs,
      })

    if (!rpcError && rpcResult && rpcResult.length > 0) {
      const row = rpcResult[0]
      return {
        allowed: row.allowed,
        remaining: row.remaining ?? 0,
        resetAt: row.reset_at ?? Date.now() + windowMs,
      }
    }

    // RPC 不可用时回退到 insert-first 模式（比原 check-first 更安全）
    return await fallbackRateLimit(key, maxCount, windowMs)
  } catch (error) {
    console.error('速率限制服务异常:', error)
    return { allowed: false, remaining: 0, resetAt: Date.now() + windowMs }
  }
}

/**
 * 回退方案：insert-first 模式
 *
 * 先插入记录再计数，每个请求的插入对自己可见。
 * 虽然并发事务间不可见未提交数据，但比 check-first 模式
 * 大幅减少了竞态窗口。
 */
async function fallbackRateLimit(
  key: string,
  maxCount: number,
  windowMs: number
): Promise<RateLimitResult> {
  const admin = createAdminClient()
  const now = Date.now()
  const windowStart = new Date(now - windowMs).toISOString()

  // 先插入记录
  const { error: insertError } = await admin.from('rate_limits').insert({
    key,
    expires_at: new Date(now + windowMs).toISOString(),
  })

  if (insertError) {
    console.error('速率限制记录失败:', insertError.message)
    return { allowed: false, remaining: 0, resetAt: now + windowMs }
  }

  // 再计数（包含刚插入的记录）
  const { count, error: countError } = await admin
    .from('rate_limits')
    .select('*', { count: 'exact', head: true })
    .eq('key', key)
    .gte('created_at', windowStart)

  if (countError) {
    console.error('速率限制查询失败:', countError.message)
    return { allowed: false, remaining: 0, resetAt: now + windowMs }
  }

  const currentCount = count ?? 0

  if (currentCount > maxCount) {
    return { allowed: false, remaining: 0, resetAt: now + windowMs }
  }

  return {
    allowed: true,
    remaining: Math.max(0, maxCount - currentCount),
    resetAt: now + windowMs,
  }
}

/**
 * 仅检查速率限制状态（不递增计数器）
 *
 * 用于"检查但不消费"的场景，例如登录前检查是否已被锁定。
 * 与 checkRateLimit 不同，此函数不会插入新记录，
 * 仅查询当前窗口内已有的记录数。
 */
export async function peekRateLimit(
  key: string,
  maxCount: number,
  windowMs: number
): Promise<RateLimitResult> {
  try {
    const admin = createAdminClient()
    const now = Date.now()
    const windowStart = new Date(now - windowMs).toISOString()

    const { count, error } = await admin
      .from('rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('key', key)
      .gte('created_at', windowStart)

    if (error) {
      console.error('速率限制查询失败:', error.message)
      return { allowed: false, remaining: 0, resetAt: now + windowMs }
    }

    const currentCount = count ?? 0
    if (currentCount >= maxCount) {
      return { allowed: false, remaining: 0, resetAt: now + windowMs }
    }

    return {
      allowed: true,
      remaining: Math.max(0, maxCount - currentCount),
      resetAt: now + windowMs,
    }
  } catch (error) {
    console.error('速率限制状态查询异常:', error)
    return { allowed: false, remaining: 0, resetAt: Date.now() + windowMs }
  }
}

/**
 * 清理过期的速率限制记录（可在任意请求中顺带调用）
 */
export async function cleanupExpiredRateLimits(): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin
      .from('rate_limits')
      .delete()
      .lt('expires_at', new Date().toISOString())
  } catch {
    // 静默失败
  }
}
