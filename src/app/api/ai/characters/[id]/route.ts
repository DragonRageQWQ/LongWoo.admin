import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionUser } from '@/lib/supabase/server'
import { validateApiCsrf } from '@/lib/api-csrf'
import { validateCharacterFields } from '@/lib/ai-character'
import { isValidUUID, validateUrl } from '@/lib/order-utils'

export const dynamic = 'force-dynamic'

// 参数校验：必须是合法 UUID
function validateId(request: NextRequest): string | null {
  const id = request.nextUrl.pathname.split('/').pop()
  if (!id || !isValidUUID(id)) return null
  return id
}

/**
 * GET /api/ai/characters/[id]
 * 获取单个角色详情（含全部消息历史）
 */
export async function GET(request: NextRequest) {
  const csrfError = validateApiCsrf(request)
  if (csrfError) return csrfError

  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
  }

  const id = validateId(request)
  if (!id) {
    return NextResponse.json({ success: false, error: '无效的角色 ID' }, { status: 400 })
  }

  try {
    const admin = createAdminClient()
    // 查询角色并校验归属
    const { data: character, error: charError } = await admin
      .from('ai_characters')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (charError) throw charError
    if (!character) {
      return NextResponse.json({ success: false, error: '角色不存在' }, { status: 404 })
    }

    // 查询消息历史（按时间正序）
    const { data: messages, error: msgError } = await admin
      .from('ai_chat_messages')
      .select('id, role, content, created_at')
      .eq('character_id', id)
      .order('created_at', { ascending: true })
      .limit(500)

    if (msgError) throw msgError

    return NextResponse.json({ success: true, character, messages: messages ?? [] })
  } catch (err) {
    console.error('[龙灵工坊] 获取角色详情失败:', err)
    return NextResponse.json({ success: false, error: '获取角色详情失败' }, { status: 500 })
  }
}

/**
 * PATCH /api/ai/characters/[id]
 * 更新角色信息（头像、名字、人设、称呼、开场白）
 * 请求体：{ name?, persona?, greeting?, user_nickname?, avatar_url? }
 */
export async function PATCH(request: NextRequest) {
  const csrfError = validateApiCsrf(request)
  if (csrfError) return csrfError

  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
  }

  const id = validateId(request)
  if (!id) {
    return NextResponse.json({ success: false, error: '无效的角色 ID' }, { status: 400 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: '请求体不是有效的 JSON' }, { status: 400 })
  }

  // 至少需要一个可更新字段
  const hasField = ['name', 'persona', 'tone', 'greeting', 'user_nickname', 'avatar_url'].some(k => k in body)
  if (!hasField) {
    return NextResponse.json({ success: false, error: '没有需要更新的内容' }, { status: 400 })
  }

  // 校验字段
  const errors = validateCharacterFields(body)
  if (errors.length > 0) {
    return NextResponse.json({ success: false, error: errors[0] }, { status: 400 })
  }

  try {
    const admin = createAdminClient()

    // 先确认角色属于当前用户
    const { data: existing, error: existError } = await admin
      .from('ai_characters')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (existError) throw existError
    if (!existing) {
      return NextResponse.json({ success: false, error: '角色不存在' }, { status: 404 })
    }

    // 构建更新字段
    const updates: Record<string, unknown> = {}
    if (typeof body.name === 'string') {
      const name = body.name.trim()
      if (!name) {
        return NextResponse.json({ success: false, error: '角色名字不能为空' }, { status: 400 })
      }
      updates.name = name
    }
    if (typeof body.persona === 'string') updates.persona = body.persona.trim()
    if (typeof body.tone === 'string') updates.tone = body.tone.trim()
    if (typeof body.greeting === 'string') updates.greeting = body.greeting.trim()
    if (typeof body.user_nickname === 'string') updates.user_nickname = body.user_nickname.trim()
    if (typeof body.avatar_url === 'string') {
      // 安全加固（L-2）：仅接受空串或 http/https 协议 URL
      const avatarUrl = body.avatar_url.trim()
      if (avatarUrl !== '' && !validateUrl(avatarUrl)) {
        return NextResponse.json({ success: false, error: '头像地址无效' }, { status: 400 })
      }
      updates.avatar_url = avatarUrl
    }

    const { data, error } = await admin
      .from('ai_characters')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, character: data })
  } catch (err) {
    console.error('[龙灵工坊] 更新角色失败:', err)
    return NextResponse.json({ success: false, error: '更新角色失败' }, { status: 500 })
  }
}

/**
 * DELETE /api/ai/characters/[id]
 * 删除角色（同时删除其所有对话记录，由数据库级联删除）
 */
export async function DELETE(request: NextRequest) {
  const csrfError = validateApiCsrf(request)
  if (csrfError) return csrfError

  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
  }

  const id = validateId(request)
  if (!id) {
    return NextResponse.json({ success: false, error: '无效的角色 ID' }, { status: 400 })
  }

  try {
    const admin = createAdminClient()
    // 只删除属于自己的角色
    const { data, error } = await admin
      .from('ai_characters')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id')

    if (error) throw error
    if (!data || data.length === 0) {
      return NextResponse.json({ success: false, error: '角色不存在' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[龙灵工坊] 删除角色失败:', err)
    return NextResponse.json({ success: false, error: '删除角色失败' }, { status: 500 })
  }
}
