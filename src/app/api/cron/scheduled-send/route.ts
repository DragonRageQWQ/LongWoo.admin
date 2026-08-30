import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { executeDueScheduledSends } from '@/actions/notification-actions'

// 强制动态渲染，禁止缓存
export const dynamic = 'force-dynamic'

/**
 * Vercel Cron 定时发送任务 API 路由
 *
 * 每分钟触发一次（vercel.json crons 配置），扫描 scheduled_sends 表中
 * status='pending' 且 scheduled_at <= now 的任务并执行（通知/邮件），
 * 执行后回写 sent/failed 与结果。
 *
 * 安全验证：通过 Authorization: Bearer ${CRON_SECRET} 头验证请求来源
 * （恒定时间比较，防时序攻击；错误细节仅进日志，不回传客户端）
 */
export async function GET(request: Request) {
  try {
    // 验证请求是否来自 Vercel Cron（检查 Authorization 头）
    const authHeader = request.headers.get('authorization')
    const secret = process.env.CRON_SECRET

    if (!secret) {
      console.error('[Cron ScheduledSend] CRON_SECRET 未配置')
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

    // 执行到点的定时发送任务
    const { scanned, executed } = await executeDueScheduledSends()

    console.log('[Cron ScheduledSend] 完成:', { scanned, executed })

    return NextResponse.json(
      { success: true, scanned, executed },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error(
      '[Cron ScheduledSend] 异常:',
      error instanceof Error ? error.message : String(error)
    )
    return NextResponse.json(
      { success: false, error: '定时发送任务执行失败' },
      { status: 500 }
    )
  }
}
