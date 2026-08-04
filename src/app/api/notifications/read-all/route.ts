import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { validateApiCsrf } from '@/lib/api-csrf'

export const dynamic = 'force-dynamic'

/**
 * POST /api/notifications/read-all
 * 标记当前用户全部通知已读
 *
 * 鉴权：cookie session；RLS 保证只更新当前用户自己的通知。
 */
export async function POST(request: Request) {
  try {
    // CSRF 校验
    const csrfError = validateApiCsrf(request)
    if (csrfError) {
      return csrfError
    }

    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
    }

    const supabase = await createClient()
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', user.id) // 安全加固（M-7）：显式按用户过滤，不依赖 RLS 兜底
      .eq('is_read', false)

    if (error) {
      console.error('[Notifications] 全部已读失败:', error.message)
      return NextResponse.json({ success: false, error: '操作失败，请稍后重试' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Notifications] 异常:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ success: false, error: '操作时发生未知错误' }, { status: 500 })
  }
}
