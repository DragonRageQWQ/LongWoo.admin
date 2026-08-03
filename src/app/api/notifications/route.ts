import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * 通知/站内信 API
 *
 * GET /api/notifications?limit=20 → 当前用户的通知列表 + 未读数
 *
 * 鉴权：cookie session 识别用户；数据访问走 RLS
 * （notifications 表策略：收件人只能读写自己的通知）。
 * 供 React Header 与静态首页（内联 JS）共用。
 */
export async function GET(request: Request) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
    }

    const url = new URL(request.url)
    const rawLimit = parseInt(url.searchParams.get('limit') || '20', 10)
    const limit = Math.min(Number.isFinite(rawLimit) ? rawLimit : 20, 50)

    const supabase = await createClient()

    // 列表 + 未读数并行查询（RLS 自动限定当前用户）
    const [listResult, unreadResult] = await Promise.all([
      supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit),
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('is_read', false),
    ])

    if (listResult.error) {
      console.error('[Notifications] 查询列表失败:', listResult.error.message)
      return NextResponse.json({ success: false, error: '查询失败，请稍后重试' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      items: listResult.data,
      unreadCount: unreadResult.count ?? 0,
    })
  } catch (error) {
    console.error('[Notifications] 异常:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ success: false, error: '查询时发生未知错误' }, { status: 500 })
  }
}
