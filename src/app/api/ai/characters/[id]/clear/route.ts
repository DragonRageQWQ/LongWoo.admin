import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionUser } from '@/lib/supabase/server'
import { validateApiCsrf } from '@/lib/api-csrf'
import { isValidUUID } from '@/lib/order-utils'

export const dynamic = 'force-dynamic'

/**
 * POST /api/ai/characters/[id]/clear
 * 清空角色的全部对话记录
 */
export async function POST(request: NextRequest) {
  const csrfError = validateApiCsrf(request)
  if (csrfError) return csrfError

  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
  }

  const segments = request.nextUrl.pathname.split('/')
  const characterId = segments[segments.length - 2]
  if (!characterId || !isValidUUID(characterId)) {
    return NextResponse.json({ success: false, error: '无效的角色 ID' }, { status: 400 })
  }

  try {
    const admin = createAdminClient()

    // 校验角色归属
    const { data: character, error: charError } = await admin
      .from('ai_characters')
      .select('id')
      .eq('id', characterId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (charError) throw charError
    if (!character) {
      return NextResponse.json({ success: false, error: '角色不存在' }, { status: 404 })
    }

    // 删除该角色的所有消息
    const { error: delError } = await admin
      .from('ai_chat_messages')
      .delete()
      .eq('character_id', characterId)
      .eq('user_id', user.id)

    if (delError) throw delError

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[龙灵工坊] 清空对话失败:', err)
    return NextResponse.json({ success: false, error: '清空对话失败' }, { status: 500 })
  }
}
