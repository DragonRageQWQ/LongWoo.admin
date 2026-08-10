'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireZeroUser } from '@/lib/auth'
import { validateCsrf } from '@/lib/csrf'
import type { DropItem, DropItemInput, DropItemStatus } from '@/types/database'

// ==================== 购买掉落管理（仅超级管理员 uid=10001） ====================
//
// 功能：
// - 新增掉落（标题/介绍/图片/价格/状态/版权/交付/包含内容）
// - 修改掉落信息
// - 删除掉落
// - 修改掉落状态（on_sale 发售 / preparing 准备 / adopted 领养）
//
// 权限：所有写操作经 requireZeroUser() + validateCsrf() 双重校验，
//       公开读取走 /api/drop-items（anon + RLS is_active=true）
// ====================

const DROP_STATUSES: DropItemStatus[] = ['on_sale', 'preparing', 'adopted']

interface DropActionResult {
  success: boolean
  error?: string
  data?: DropItem | DropItem[] | null
}

/** 校验掉落输入（统一在服务端做，防绕过前端校验） */
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
 * 列出全部掉落（含全部状态），按排序权重排列
 * 仅超级管理员可调用
 */
export async function listDropItems(): Promise<DropActionResult> {
  const authResult = await requireZeroUser()
  if (!authResult.success) {
    return { success: false, error: authResult.error }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('drop_items')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('查询掉落列表失败:', error.message)
    return { success: false, error: '查询失败，请稍后重试' }
  }

  return { success: true, data: data as DropItem[] }
}

/**
 * 新增掉落
 * 排序权重自动分配（当前最大序号 + 1）
 * 仅超级管理员可调用
 */
export async function createDropItem(input: DropItemInput): Promise<DropActionResult> {
  const csrfError = await validateCsrf()
  if (csrfError) return { success: false, error: csrfError }

  const authResult = await requireZeroUser()
  if (!authResult.success) {
    return { success: false, error: authResult.error }
  }

  const invalid = validateDropInput(input)
  if (invalid) return { success: false, error: invalid }

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
        title: input.title.trim(),
        description: input.description.trim(),
        image_url: input.image_url.trim(),
        price: input.price,
        status: input.status,
        copyright: input.copyright.trim(),
        delivery: input.delivery.trim(),
        includes: input.includes.trim(),
        sort_order: nextOrder,
      })
      .select('*')
      .single()

    if (error) {
      console.error('新增掉落失败:', error.message)
      return { success: false, error: '新增失败，请稍后重试' }
    }

    revalidatePath('/admin/dashboard')
    return { success: true, data: created as DropItem }
  } catch (err) {
    console.error('新增掉落异常:', err)
    return { success: false, error: '操作时发生未知错误' }
  }
}

/**
 * 修改掉落信息（标题/介绍/图片/价格/版权/交付/包含内容 + 状态）
 * 仅超级管理员可调用
 */
export async function updateDropItem(id: string, input: DropItemInput): Promise<DropActionResult> {
  const csrfError = await validateCsrf()
  if (csrfError) return { success: false, error: csrfError }

  const authResult = await requireZeroUser()
  if (!authResult.success) {
    return { success: false, error: authResult.error }
  }

  if (!id || typeof id !== 'string') return { success: false, error: '参数错误' }

  const invalid = validateDropInput(input)
  if (invalid) return { success: false, error: invalid }

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
      return { success: false, error: '修改失败，请稍后重试' }
    }

    revalidatePath('/admin/dashboard')
    return { success: true, data: updated as DropItem }
  } catch (err) {
    console.error('修改掉落异常:', err)
    return { success: false, error: '操作时发生未知错误' }
  }
}

/**
 * 修改掉落状态（on_sale 发售 / preparing 准备 / adopted 领养）
 * 仅超级管理员可调用
 */
export async function updateDropStatus(id: string, status: DropItemStatus): Promise<DropActionResult> {
  const csrfError = await validateCsrf()
  if (csrfError) return { success: false, error: csrfError }

  const authResult = await requireZeroUser()
  if (!authResult.success) {
    return { success: false, error: authResult.error }
  }

  if (!id || typeof id !== 'string') return { success: false, error: '参数错误' }
  if (!DROP_STATUSES.includes(status)) return { success: false, error: '掉落状态不正确' }

  const admin = createAdminClient()
  try {
    const { data: updated, error } = await admin
      .from('drop_items')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      console.error('修改掉落状态失败:', error.message)
      return { success: false, error: '修改状态失败，请稍后重试' }
    }

    revalidatePath('/admin/dashboard')
    return { success: true, data: updated as DropItem }
  } catch (err) {
    console.error('修改掉落状态异常:', err)
    return { success: false, error: '操作时发生未知错误' }
  }
}

/**
 * 删除掉落
 * 仅超级管理员可调用
 */
export async function deleteDropItem(id: string): Promise<DropActionResult> {
  const csrfError = await validateCsrf()
  if (csrfError) return { success: false, error: csrfError }

  const authResult = await requireZeroUser()
  if (!authResult.success) {
    return { success: false, error: authResult.error }
  }

  if (!id || typeof id !== 'string') return { success: false, error: '参数错误' }

  const admin = createAdminClient()
  try {
    const { data: target, error: fetchError } = await admin
      .from('drop_items')
      .select('id, sort_order')
      .eq('id', id)
      .single()

    if (fetchError || !target) {
      return { success: false, error: '未找到该掉落' }
    }

    const { error: deleteError } = await admin.from('drop_items').delete().eq('id', id)
    if (deleteError) {
      console.error('删除掉落失败:', deleteError.message)
      return { success: false, error: '删除失败，请稍后重试' }
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

    revalidatePath('/admin/dashboard')
    return { success: true }
  } catch (err) {
    console.error('删除掉落异常:', err)
    return { success: false, error: '操作时发生未知错误' }
  }
}
