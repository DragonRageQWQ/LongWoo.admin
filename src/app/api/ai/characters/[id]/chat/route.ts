import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionUser } from '@/lib/supabase/server'
import { isSessionUserSoftBanned } from '@/lib/user-guard'
import { validateApiCsrf } from '@/lib/api-csrf'
import { checkRateLimit } from '@/lib/rate-limit'
import {
  buildCharacterSystemPrompt,
  callCharacterAi,
  AI_CHAT_HISTORY_LIMIT,
  AI_CHAT_MESSAGE_MAX,
  AI_CHAT_RATE_WINDOW_MS,
  AI_CHAT_RATE_MAX,
} from '@/lib/ai-character'
import { isValidUUID } from '@/lib/order-utils'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // DeepSeek 推理可能较慢

// 从路径中提取角色 ID
function extractCharacterId(request: NextRequest): string | null {
  const segments = request.nextUrl.pathname.split('/')
  // 路径格式: /api/ai/characters/[id]/chat
  const id = segments[segments.length - 2]
  return id && isValidUUID(id) ? id : null
}

/**
 * GET /api/ai/characters/[id]/chat
 * 获取角色的对话历史（最近 100 条，按时间正序）
 */
export async function GET(request: NextRequest) {
  const csrfError = validateApiCsrf(request)
  if (csrfError) return csrfError

  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
  }

  const characterId = extractCharacterId(request)
  if (!characterId) {
    return NextResponse.json({ success: false, error: '无效的角色 ID' }, { status: 400 })
  }

  try {
    const admin = createAdminClient()

    // 性能优化：角色归属校验与消息查询相互独立（均只依赖 characterId），
    // 并行执行省去 1 个 RTT（约 40-100ms）
    const [charResult, msgResult] = await Promise.all([
      admin
        .from('ai_characters')
        .select('id')
        .eq('id', characterId)
        .eq('user_id', user.id)
        .maybeSingle(),
      admin
        .from('ai_chat_messages')
        .select('id, role, content, created_at')
        .eq('character_id', characterId)
        .order('created_at', { ascending: false })
        .limit(100),
    ])

    const character = charResult.data
    const charError = charResult.error
    const messages = msgResult.data
    const msgError = msgResult.error

    if (charError) throw charError
    if (!character) {
      return NextResponse.json({ success: false, error: '角色不存在' }, { status: 404 })
    }
    if (msgError) throw msgError

    // 倒序翻转（时间正序返回）
    const sorted = (messages ?? []).reverse()
    return NextResponse.json({ success: true, messages: sorted })
  } catch (err) {
    console.error('[龙灵工坊] 获取对话历史失败:', err)
    return NextResponse.json({ success: false, error: '获取对话历史失败' }, { status: 500 })
  }
}

/**
 * POST /api/ai/characters/[id]/chat
 * 发送消息并获取角色回复
 *
 * 流程：
 * 1. 校验登录 + CSRF + 速率限制
 * 2. 校验角色归属
 * 3. 保存用户消息到数据库
 * 4. 读取最近 N 条历史作为上下文，构建人设 system prompt
 * 5. 调用 DeepSeek 获取角色回复
 * 6. 保存角色回复，返回给前端
 */
export async function POST(request: NextRequest) {
  const csrfError = validateApiCsrf(request)
  if (csrfError) return csrfError

  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
  }

  // 软封禁（blacklist）：拉黑用户禁止与 AI 角色对话
  if (await isSessionUserSoftBanned()) {
    return NextResponse.json(
      { success: false, error: '账户已被限制使用，请联系管理员' },
      { status: 403 }
    )
  }

  const characterId = extractCharacterId(request)
  if (!characterId) {
    return NextResponse.json({ success: false, error: '无效的角色 ID' }, { status: 400 })
  }

  // ===== 速率限制（按用户 + 角色） =====
  const rateLimit = await checkRateLimit(
    `ai:character:${user.id}:${characterId}`,
    AI_CHAT_RATE_MAX,
    AI_CHAT_RATE_WINDOW_MS
  )
  if (!rateLimit.allowed) {
    return NextResponse.json({ success: false, error: '对话过于频繁，请稍后再试' }, { status: 429 })
  }

  // ===== 解析消息 =====
  let body: { content?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: '请求体不是有效的 JSON' }, { status: 400 })
  }

  const content = typeof body.content === 'string' ? body.content.trim() : ''
  if (!content) {
    return NextResponse.json({ success: false, error: '消息不能为空' }, { status: 400 })
  }
  if (content.length > AI_CHAT_MESSAGE_MAX) {
    return NextResponse.json({ success: false, error: `消息不能超过 ${AI_CHAT_MESSAGE_MAX} 个字符` }, { status: 400 })
  }

  try {
    const admin = createAdminClient()

    // 校验角色归属 + 读取角色信息
    const { data: character, error: charError } = await admin
      .from('ai_characters')
      .select('*')
      .eq('id', characterId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (charError) throw charError
    if (!character) {
      return NextResponse.json({ success: false, error: '角色不存在' }, { status: 404 })
    }

    // 保存用户消息
    const { data: userMsg, error: userMsgError } = await admin
      .from('ai_chat_messages')
      .insert({ character_id: characterId, user_id: user.id, role: 'user', content })
      .select('id, role, content, created_at')
      .single()
    if (userMsgError) throw userMsgError

    // 读取最近历史作为上下文（含刚保存的用户消息）
    const { data: historyRows, error: histError } = await admin
      .from('ai_chat_messages')
      .select('role, content')
      .eq('character_id', characterId)
      .order('created_at', { ascending: false })
      .limit(AI_CHAT_HISTORY_LIMIT)
    if (histError) throw histError

    const history = (historyRows ?? []).reverse() as Array<{ role: 'user' | 'assistant'; content: string }>

    // 构建人设 system prompt 并调用 DeepSeek
    const systemPrompt = buildCharacterSystemPrompt(character)
    const reply = await callCharacterAi(systemPrompt, history)

    // 保存角色回复
    const { data: assistantMsg, error: asstError } = await admin
      .from('ai_chat_messages')
      .insert({ character_id: characterId, user_id: user.id, role: 'assistant', content: reply })
      .select('id, role, content, created_at')
      .single()
    if (asstError) throw asstError

    return NextResponse.json({ success: true, userMessage: userMsg, assistantMessage: assistantMsg })
  } catch (err) {
    console.error('[龙灵工坊] 对话失败:', err)
    // 安全加固（M-5）：不向客户端回传内部错误细节，统一通用文案
    const aiFailure =
      err instanceof Error && err.message.includes('AI')
    return NextResponse.json(
      { success: false, error: aiFailure ? 'AI 服务暂时不可用，请稍后重试' : '对话失败，请稍后重试' },
      { status: aiFailure ? 502 : 500 }
    )
  }
}
