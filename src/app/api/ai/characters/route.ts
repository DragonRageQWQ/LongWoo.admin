import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionUser } from '@/lib/supabase/server'
import { validateApiCsrf } from '@/lib/api-csrf'
import { validateCharacterFields, AI_CHARACTER_MAX_COUNT } from '@/lib/ai-character'

export const dynamic = 'force-dynamic'

/**
 * GET /api/ai/characters
 * 获取当前用户的所有 AI 角色列表（含最后一条消息摘要）
 */
export async function GET(request: NextRequest) {
  // CSRF 校验
  const csrfError = validateApiCsrf(request)
  if (csrfError) return csrfError

  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
  }

  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('ai_characters')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ success: true, characters: data })
  } catch (err) {
    console.error('[龙灵工坊] 获取角色列表失败:', err)
    return NextResponse.json({ success: false, error: '获取角色列表失败' }, { status: 500 })
  }
}

/**
 * POST /api/ai/characters
 * 创建新的 AI 角色
 * 请求体：{ name, persona?, greeting?, user_nickname? }
 */
export async function POST(request: NextRequest) {
  // CSRF 校验
  const csrfError = validateApiCsrf(request)
  if (csrfError) return csrfError

  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: '请求体不是有效的 JSON' }, { status: 400 })
  }

  // 校验字段
  const errors = validateCharacterFields(body)
  if (errors.length > 0) {
    return NextResponse.json({ success: false, error: errors[0] }, { status: 400 })
  }

  // 角色名必填
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) {
    return NextResponse.json({ success: false, error: '角色名字不能为空' }, { status: 400 })
  }

  try {
    const admin = createAdminClient()

    // 检查角色数量上限
    const { count, error: countError } = await admin
      .from('ai_characters')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_active', true)
    if (countError) throw countError
    if (count !== null && count >= AI_CHARACTER_MAX_COUNT) {
      return NextResponse.json(
        { success: false, error: `每个账号最多创建 ${AI_CHARACTER_MAX_COUNT} 个角色` },
        { status: 400 }
      )
    }

    const { data, error } = await admin
      .from('ai_characters')
      .insert({
        user_id: user.id,
        name,
        persona: typeof body.persona === 'string' ? body.persona.trim() : null,
        greeting: typeof body.greeting === 'string' ? body.greeting.trim() : null,
        user_nickname: typeof body.user_nickname === 'string' ? body.user_nickname.trim() : null,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, character: data }, { status: 201 })
  } catch (err) {
    console.error('[龙灵工坊] 创建角色失败:', err)
    return NextResponse.json({ success: false, error: '创建角色失败' }, { status: 500 })
  }
}
