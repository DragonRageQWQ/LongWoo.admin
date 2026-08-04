import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { cleanupExpiredRateLimits } from '@/lib/rate-limit'
import { cleanupExpiredOtps } from '@/lib/otp-store'

// 强制动态渲染，禁止缓存
export const dynamic = 'force-dynamic'

/**
 * Vercel Cron 定时清理任务 API 路由
 *
 * 作为 pg_cron 的备用方案：如果 pg_cron 扩展未启用，
 * 则通过 Vercel Cron 每小时触发此 API 路由来执行清理任务。
 *
 * 触发方式：vercel.json 中配置的 cron schedule 每小时调用一次
 * 安全验证：通过 Authorization: Bearer ${CRON_SECRET} 头验证请求来源
 * （恒定时间比较，防时序攻击；错误细节仅进日志，不回传客户端）
 */
export async function GET(request: Request) {
  try {
    // 验证请求是否来自 Vercel Cron（检查 Authorization 头）
    const authHeader = request.headers.get('authorization')
    const secret = process.env.CRON_SECRET

    if (!secret) {
      console.error('[Cron Cleanup] CRON_SECRET 未配置')
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      )
    }

    const expected = `Bearer ${secret}`
    const authBuf = Buffer.from(authHeader ?? '')
    const expectedBuf = Buffer.from(expected)
    const authorized =
      authBuf.length === expectedBuf.length && timingSafeEqual(authBuf, expectedBuf)

    if (!authorized) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      )
    }

    // 并行执行清理任务，互不阻塞
    const results = await Promise.allSettled([
      cleanupExpiredRateLimits(),
      cleanupExpiredOtps(),
    ])

    // 汇总清理结果（错误细节只进日志，不回传客户端）
    const [rateLimitsResult, otpsResult] = results
    const summary = {
      rateLimitsCleanup: rateLimitsResult.status === 'fulfilled' ? '成功' : '失败',
      otpsCleanup: otpsResult.status === 'fulfilled' ? '成功' : '失败',
    }

    if (rateLimitsResult.status === 'rejected') {
      console.error(
        '[Cron Cleanup] rate_limits 清理失败:',
        rateLimitsResult.reason instanceof Error
          ? rateLimitsResult.reason.message
          : String(rateLimitsResult.reason)
      )
    }
    if (otpsResult.status === 'rejected') {
      console.error(
        '[Cron Cleanup] otp_codes 清理失败:',
        otpsResult.reason instanceof Error
          ? otpsResult.reason.message
          : String(otpsResult.reason)
      )
    }

    console.log('[Cron Cleanup] 清理完成:', summary)

    return NextResponse.json(
      { success: true, ...summary },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error(
      '[Cron Cleanup] 异常:',
      error instanceof Error ? error.message : String(error)
    )
    return NextResponse.json(
      { success: false, error: '清理任务执行失败' },
      { status: 500 }
    )
  }
}
