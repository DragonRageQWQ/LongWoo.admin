import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionUser } from '@/lib/supabase/server'
import { validateApiCsrf } from '@/lib/api-csrf'
import { ZERO_USER_UID } from '@/lib/constants'
import type { DropItemInput, DropItemStatus } from '@/types/database'

export const dynamic = 'force-dynamic'

const DROP_STATUSES: DropItemStatus[] = ['on_sale', 'preparing', 'adopted']

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
 * PATCH /api/drop-items/[id]
 * 更新掉落（完整字段更新或仅状态切换），仅超级管理员
 * 供静态页管理员编辑模式调用
 */
export async function PATCH(request: NextRequest) {
  const auth = await requireSuperAdmin(request)
  if (auth.error) return auth.error

  const id = request.nextUrl.pathname.split('/').pop()
  if (!id) {
    return NextResponse.json({ success: false, error: '无效的掉落 ID' }, { status: 400 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: '请求体不是有效的 JSON' }, { status: 400 })
  }

  // 仅状态切换：{ status: 'on_sale' }
  if (body.status !== undefined && Object.keys(body).every(k => k === 'status')) {
    if (!DROP_STATUSES.includes(body.status as DropItemStatus)) {
      return NextResponse.json({ success: false, error: '掉落状态不正确' }, { status: 400 })
    }
    const admin = createAdminClient()
    const { data: updated, error } = await admin
      .from('drop_items')
      .update({ status: body.status as DropItemStatus, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single()
    if (error) {
      console.error('修改掉落状态失败:', error.message)
      return NextResponse.json({ success: false, error: '修改状态失败，请稍后重试' }, { status: 500 })
    }
    return NextResponse.json({ success: true, item: updated })
  }

  // 完整更新
  const invalid = validateDropInput(body as DropItemInput)
  if (invalid) return NextResponse.json({ success: false, error: invalid }, { status: 400 })

  const input = body as DropItemInput
  const admin = createAdminClient()
  try {
    const { data: updated, error } = await admin
      .from('drop_items')
      .update({
        title: input.title.trim(),
        description: input.description.trim(),
        image_url: input.image_url.trim(),
        price: input.price,
        status: input.status,
        copyright: input.copyright.trim(),
        delivery: input.delivery.trim(),
        includes: input.includes.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      console.error('修改掉落失败:', error.message)
      return NextResponse.json({ success: false, error: '修改失败，请稍后重试' }, { status: 500 })
    }

    return NextResponse.json({ success: true, item: updated })
  } catch (err) {
    console.error('[掉落] 修改异常:', err)
    return NextResponse.json({ success: false, error: '操作时发生未知错误' }, { status: 500 })
  }
}

/**
 * DELETE /api/drop-items/[id]
 * 删除掉落（并前移后续排序权重），仅超级管理员
 * 供静态页管理员编辑模式调用
 */
export async function DELETE(request: NextRequest) {
  const auth = await requireSuperAdmin(request)
  if (auth.error) return auth.error

  const id = request.nextUrl.pathname.split('/').pop()
  if (!id) {
    return NextResponse.json({ success: false, error: '无效的掉落 ID' }, { status: 400 })
  }

  const admin = createAdminClient()
  try {
    const { data: target, error: fetchError } = await admin
      .from('drop_items')
      .select('id, sort_order')
      .eq('id', id)
      .single()

    if (fetchError || !target) {
      return NextResponse.json({ success: false, error: '未找到该掉落' }, { status: 404 })
    }

    const { error: deleteError } = await admin.from('drop_items').delete().eq('id', id)
    if (deleteError) {
      console.error('删除掉落失败:', deleteError.message)
      return NextResponse.json({ success: false, error: '删除失败，请稍后重试' }, { status: 500 })
    }

    // 排序权重自适应：将 sort_order 大于被删项的前移一位
    const { data: afterList, error: listError } = await admin
      .from('drop_items')
      .select('id, sort_order')
      .order('sort_order', { ascending: true })

    if (!listError && afterList) {
      let nextOrder = target.sort_order
      for (const row of afterList) {
        if (row.sort_order > target.sort_order) {
          await admin
            .from('drop_items')
            .update({ sort_order: nextOrder, updated_at: new Date().toISOString() })
            .eq('id', row.id)
          nextOrder += 1
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[掉落] 删除异常:', err)
    return NextResponse.json({ success: false, error: '操作时发生未知错误' }, { status: 500 })
  }
}
