import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 性能优化（PERF-05）：作品为公开低频变更数据，CDN/ISR 缓存 30 秒，
// 首页与作品详情页不再每次访问实时查库（由 Vercel CDN 按 s-maxage 缓存响应）。
// 管理后台修改作品后最多 30 秒内生效。
export const revalidate = 30

/**
 * GET /api/works
 * 公开接口：返回启用中的作品列表（供首页/作品详情页展示）
 * 无需登录，仅返回 is_active=true 且有序的作品
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('works')
      .select('id, code, title, tag, description, work_type, delivery, craft, image_url, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('查询作品失败:', error.message)
      return NextResponse.json({ success: false, error: '查询失败，请稍后重试' }, { status: 500 })
    }

    return NextResponse.json({ success: true, items: data ?? [] })
  } catch (err) {
    console.error('[作品] 公开查询异常:', err)
    return NextResponse.json({ success: false, error: '查询失败，请稍后重试' }, { status: 500 })
  }
}
