import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionUser } from '@/lib/supabase/server'
import { validateApiCsrf } from '@/lib/api-csrf'
import { ZERO_USER_UID } from '@/lib/constants'
import type { DropItemInput, DropItemStatus } from '@/types/database'

export const dynamic = 'force-dynamic'

const DROP_STATUSES: DropItemStatus[] = ['on_sale', 'preparing', 'adopted']

/**
 * GET /api/drop-items
 * 公开接口：返回启用中的掉落列表（含全部三种状态，前端按状态渲染购买能力）
 * 无需登录，仅返回 is_active=true 且有序的掉落
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('drop_items')
      .select('id, title, description, image_url, price, status, copyright, delivery, includes, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('查询掉落失败:', error.message)
      return NextResponse.json({ success: false, error: '查询失败，请稍后重试' }, { status: 500 })
    }

    return NextResponse.json({ success: true, items: data ?? [] })
  } catch (err) {
    console.error('[掉落] 公开查询异常:', err)
    return NextResponse.json({ success: false, error: '查询失败，请稍后重试' }, { status: 500 })
  }
}

/**
 * 超管校验（API 层）：CSRF + 登录 + uid===ZERO_USER_UID 且 role=admin 且 is_active
 */
async function requireSuperAdmin(request: NextRequest): Promise<{ error: NextResponse | null }> {
  const csrfError = validateApiCsrf(request)
  if (csrfError) return { error: csrfError }

  const user = await getSessionUser()
  if (!user) {
    return { error: NextResponse.json({ success: false, error: '未登录' }, { status: 401 }) }
  }

  const admin = createAdminClient()
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('uid, role, is_active')
    .eq('id', user.id)
    .single()
  if (profileError || !profile) {
    return { error: NextResponse.json({ success: false, error: '未找到用户信息' }, { status: 401 }) }
  }
  if (profile.uid !== ZERO_USER_UID || profile.role !== 'admin' || profile.is_active !== true) {
    return { error: NextResponse.json({ success: false, error: '无权操作，仅超级管理员可执行此操作' }, { status: 403 }) }
  }
  return { error: null }
}

/** 校验掉落输入（API 层复用，与 Server Action 一致） */
function validateDropInput(input: DropItemInput): string | null {
  if (!input || typeof input !== 'object') return '参数错误'
  if (!input.title || typeof input.title !== 'string' || input.title.trim().length === 0) {
    return '请填写掉落标题'
  }
  if (input.title.trim().length > 50) return '掉落标题不能超过 50 个字符'
  if (!input.image_url || typeof input.image_url !== 'string' || input.image_url.trim().length === 0) {
    return '请上传介绍图片'
  }
  if (input.image_url.trim().length > 500) return '图片地址无效'
  if (typeof input.price !== 'number' || !Number.isFinite(input.price) || input.price < 0) {
    return '价格格式不正确'
  }
  if (input.price > 99999999) return '价格超出范围'
  if (!DROP_STATUSES.includes(input.status)) return '掉落状态不正确'
  if (typeof input.description !== 'string' || input.description.trim().length > 500) {
    return '介绍信息不能超过 500 个字符'
  }
  if (typeof input.copyright !== 'string' || input.copyright.trim().length > 100) {
    return '版权说明不能超过 100 个字符'
  }
  if (typeof input.delivery !== 'string' || input.delivery.trim().length > 300) {
    return '交付说明不能超过 300 个字符'
  }
  if (typeof input.includes !== 'string' || input.includes.trim().length > 200) {
    return '包含内容不能超过 200 个字符'
  }
  return null
}

/**
 * POST /api/drop-items
 * 新增掉落（仅超级管理员）
 * 供静态页管理员编辑模式调用
 */
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request)
  if (auth.error) return auth.error

  let body: DropItemInput
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: '请求体不是有效的 JSON' }, { status: 400 })
  }

  const invalid = validateDropInput(body)
  if (invalid) return NextResponse.json({ success: false, error: invalid }, { status: 400 })

  const admin = createAdminClient()
  try {
    const { data: maxRow } = await admin
      .from('drop_items')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)

    const nextOrder = (maxRow?.[0]?.sort_order ?? 0) + 1

    const { data: created, error } = await admin
      .from('drop_items')
      .insert({
        title: body.title.trim(),
        description: body.description.trim(),
        image_url: body.image_url.trim(),
        price: body.price,
        status: body.status,
        copyright: body.copyright.trim(),
        delivery: body.delivery.trim(),
        includes: body.includes.trim(),
        sort_order: nextOrder,
      })
      .select('*')
      .single()

    if (error) {
      console.error('新增掉落失败:', error.message)
      return NextResponse.json({ success: false, error: '新增失败，请稍后重试' }, { status: 500 })
    }

    return NextResponse.json({ success: true, item: created })
  } catch (err) {
    console.error('[掉落] 新增异常:', err)
    return NextResponse.json({ success: false, error: '操作时发生未知错误' }, { status: 500 })
  }
}
