'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'
import { validateCsrf } from '@/lib/csrf'
import type { Work, WorkInput } from '@/types/database'

// ==================== 作品管理（role=admin 可操作） ====================
//
// 功能：
// - 新增作品（图片编码序号自动分配）
// - 修改作品文案/图片
// - 删除作品（后续作品序号自动前移重排，保证序号连续自适应）
//
// 权限：所有操作经 requireAdmin() + validateCsrf() 双重校验（role=admin 即可），
//       与掉落管理（drop-actions）保持一致；后台作品管理与前台图鉴编辑共用。
// ====================

interface WorksActionResult {
  success: boolean
  error?: string
  data?: Work | Work[] | null
  /** 当前最大序号（供新增时提示下一个编码） */
  nextCode?: string
}

/** 序号 → 编码（'1' → '01'，'12' → '12'，'123' → '123'） */
function formatCode(n: number): string {
  if (n < 10) return `0${n}`
  return String(n)
}

/** 校验作品输入（统一在服务端做，防绕过前端校验） */
function validateWorkInput(input: WorkInput): string | null {
  if (!input || typeof input !== 'object') return '参数错误'
  if (!input.title || typeof input.title !== 'string' || input.title.trim().length === 0) {
    return '请填写作品名称'
  }
  if (input.title.trim().length > 50) return '作品名称不能超过 50 个字符'
  if (typeof input.tag !== 'string' || input.tag.trim().length === 0) {
    return '请填写类型标签'
  }
  if (input.tag.trim().length > 30) return '类型标签不能超过 30 个字符'
  if (typeof input.description !== 'string' || input.description.trim().length === 0) {
    return '请填写作品描述'
  }
  if (input.description.trim().length > 500) return '作品描述不能超过 500 个字符'
  if (!input.image_url || typeof input.image_url !== 'string' || input.image_url.trim().length === 0) {
    return '请上传作品图片'
  }
  if (input.image_url.trim().length > 500) return '图片地址无效'
  // 可选字段：类型/交付/工艺
  if (typeof input.work_type !== 'string' || input.work_type.trim().length > 30) {
    return '定制类型格式不正确'
  }
  if (typeof input.delivery !== 'string' || input.delivery.trim().length > 30) {
    return '交付周期格式不正确'
  }
  if (typeof input.craft !== 'string' || input.craft.trim().length > 50) {
    return '制作工艺格式不正确'
  }
  return null
}

/**
 * 列出全部作品（含未启用），按序号排序
 * 仅管理员可调用
 */
export async function listWorks(): Promise<WorksActionResult> {
  const authResult = await requireAdmin()
  if (!authResult.success) {
    return { success: false, error: authResult.error }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('works')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('查询作品列表失败:', error.message)
    return { success: false, error: '查询失败，请稍后重试' }
  }

  // 计算下一个可用编码
  const maxOrder = data?.reduce((m, w) => Math.max(m, w.sort_order ?? 0), 0) ?? 0

  return { success: true, data: data as Work[], nextCode: formatCode(maxOrder + 1) }
}

/**
 * 新增作品
 * 图片编码序号自动分配（当前最大序号 + 1）
 * 仅管理员可调用
 */
export async function createWork(input: WorkInput): Promise<WorksActionResult> {
  const csrfError = await validateCsrf()
  if (csrfError) return { success: false, error: csrfError }

  const authResult = await requireAdmin()
  if (!authResult.success) {
    return { success: false, error: authResult.error }
  }

  const invalid = validateWorkInput(input)
  if (invalid) return { success: false, error: invalid }

  const admin = createAdminClient()
  try {
    // 查询当前最大序号
    const { data: maxRow } = await admin
      .from('works')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)

    const nextOrder = (maxRow?.[0]?.sort_order ?? 0) + 1
    const nextCode = formatCode(nextOrder)

    const { data: created, error } = await admin
      .from('works')
      .insert({
        code: nextCode,
        sort_order: nextOrder,
        title: input.title.trim(),
        tag: input.tag.trim(),
        description: input.description.trim(),
        work_type: input.work_type?.trim() || '全装定制',
        delivery: input.delivery?.trim() || '预计 4-6 周',
        craft: input.craft?.trim() || '立体剪裁 · 手工缝制',
        image_url: input.image_url.trim(),
      })
      .select('*')
      .single()

    if (error) {
      console.error('新增作品失败:', error.message)
      return { success: false, error: '新增失败，请稍后重试' }
    }

    revalidatePath('/admin/dashboard')
    revalidatePath('/gallery')
    revalidatePath('/gallery/[id]')
    return { success: true, data: created as Work, nextCode: formatCode(nextOrder + 1) }
  } catch (err) {
    console.error('新增作品异常:', err)
    return { success: false, error: '操作时发生未知错误' }
  }
}

/**
 * 修改作品文案/图片（不改变编码序号）
 * 仅管理员可调用
 */
export async function updateWork(id: string, input: WorkInput): Promise<WorksActionResult> {
  const csrfError = await validateCsrf()
  if (csrfError) return { success: false, error: csrfError }

  const authResult = await requireAdmin()
  if (!authResult.success) {
    return { success: false, error: authResult.error }
  }

  if (!id || typeof id !== 'string') return { success: false, error: '参数错误' }

  const invalid = validateWorkInput(input)
  if (invalid) return { success: false, error: invalid }

  const admin = createAdminClient()
  try {
    const { data: updated, error } = await admin
      .from('works')
      .update({
        title: input.title.trim(),
        tag: input.tag.trim(),
        description: input.description.trim(),
        work_type: input.work_type?.trim() || '全装定制',
        delivery: input.delivery?.trim() || '预计 4-6 周',
        craft: input.craft?.trim() || '立体剪裁 · 手工缝制',
        image_url: input.image_url.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      console.error('修改作品失败:', error.message)
      return { success: false, error: '修改失败，请稍后重试' }
    }

    revalidatePath('/admin/dashboard')
    revalidatePath('/gallery')
    revalidatePath('/gallery/[id]')
    return { success: true, data: updated as Work }
  } catch (err) {
    console.error('修改作品异常:', err)
    return { success: false, error: '操作时发生未知错误' }
  }
}

/**
 * 删除作品，并自动前移后续作品序号（图片编码序号自适应重排）
 * 例如删除 03 后：04→03、05→04 ...
 * 仅管理员可调用
 */
export async function deleteWork(id: string): Promise<WorksActionResult> {
  const csrfError = await validateCsrf()
  if (csrfError) return { success: false, error: csrfError }

  const authResult = await requireAdmin()
  if (!authResult.success) {
    return { success: false, error: authResult.error }
  }

  if (!id || typeof id !== 'string') return { success: false, error: '参数错误' }

  const admin = createAdminClient()
  try {
    // 查询待删除作品（确认存在并取得其 sort_order）
    const { data: target, error: fetchError } = await admin
      .from('works')
      .select('id, sort_order')
      .eq('id', id)
      .single()

    if (fetchError || !target) {
      return { success: false, error: '未找到该作品' }
    }

    // 删除作品
    const { error: deleteError } = await admin.from('works').delete().eq('id', id)
    if (deleteError) {
      console.error('删除作品失败:', deleteError.message)
      return { success: false, error: '删除失败，请稍后重试' }
    }

    // 序号自适应：将 sort_order 大于被删序号的作品全部前移一位，并同步编码
    const { data: afterList, error: listError } = await admin
      .from('works')
      .select('id, sort_order')
      .order('sort_order', { ascending: true })

    if (!listError && afterList) {
      let nextOrder = target.sort_order
      for (const row of afterList) {
        if (row.sort_order > target.sort_order) {
          await admin
            .from('works')
            .update({ sort_order: nextOrder, code: formatCode(nextOrder), updated_at: new Date().toISOString() })
            .eq('id', row.id)
          nextOrder += 1
        }
      }
    }

    revalidatePath('/admin/dashboard')
    revalidatePath('/gallery')
    revalidatePath('/gallery/[id]')
    return { success: true }
  } catch (err) {
    console.error('删除作品异常:', err)
    return { success: false, error: '操作时发生未知错误' }
  }
}
