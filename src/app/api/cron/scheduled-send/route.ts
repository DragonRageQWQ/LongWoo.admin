import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { executeDueScheduledSends } from '@/actions/notification-actions'
import { createAdminClient } from '@/lib/supabase/admin'

// 强制动态渲染，禁止缓存
export const dynamic = 'force-dynamic'

/** 恒定时间比较，防时序攻击 */
function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  return aBuf.length === bBuf.length && timingSafeEqual(aBuf, bBuf)
}

/**
 * 校验定时发送端点调用来源
 *
 * 两种合法来源（任一匹配即放行）：
 * 1. Vercel Cron（每天一次兜底）：Authorization: Bearer ${CRON_SECRET}（环境变量）
 * 2. Supabase pg_cron（每分钟准点）：Authorization: Bearer ${app_settings.pg_cron_call_secret}
 *    （secret 存于数据库 app_settings 表，不进公开仓库）
 */
async function isAuthorized(request: Request): Promise<boolean> {
  const header = request.headers.get('authorization') ?? ''

  // 1) Vercel Cron 环境变量 secret
  const envSecret = process.env.CRON_SECRET
  if (envSecret && safeEqual(header, `Bearer ${envSecret}`)) {
    return true
  }

  // 2) Supabase pg_cron secret（数据库存储）
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('app_settings')
      .select('value')
      .eq('key', 'pg_cron_call_secret')
      .maybeSingle()
    if (data?.value && safeEqual(header, `Bearer ${data.value}`)) {
      return true
    }
  } catch {
    // 静默失败，继续拒绝
  }

  return false
}

/**
 * Vercel Cron / Supabase pg_cron 定时发送任务 API 路由
 *
 * 扫描 scheduled_sends 表中 status='pending' 且 scheduled_at <= now 的
 * 任务并执行（通知/邮件），执行后回写 sent/failed 与结果。
 *
 * 触发方式：
 * - Supabase pg_cron：每分钟调用一次（准点执行定时任务）
 * - Vercel Cron（兜底）：vercel.json 配置每天一次（Hobby 套餐限制下亦可运行）
 */
export async function GET(request: Request) {
  try {
    // 验证请求来源（Vercel Cron 环境变量 secret 或 DB 中 pg_cron secret）
    if (!(await isAuthorized(request))) {
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
