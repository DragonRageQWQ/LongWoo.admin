import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionUser } from '@/lib/supabase/server'
import { validateApiCsrf } from '@/lib/api-csrf'
import { checkRateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/server-utils'
import { isValidUUID } from '@/lib/order-utils'
import { validateFileMagicNumber } from '@/lib/file-validation'
import { AVATAR_MAX_SIZE, AVATAR_ALLOWED_MIME_TYPES, RATE_LIMIT_AVATAR_WINDOW, RATE_LIMIT_AVATAR_MAX } from '@/lib/constants'

export const dynamic = 'force-dynamic'

/**
 * POST /api/ai/characters/[id]/avatar
 * 上传角色头像（multipart/form-data，字段名 file）
 * 返回：{ success, avatar_url }
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

  // 速率限制
  const ip = await getClientIp()
  const rateLimit = await checkRateLimit(`ai-avatar:${ip}`, RATE_LIMIT_AVATAR_MAX, RATE_LIMIT_AVATAR_WINDOW)
  if (!rateLimit.allowed) {
    return NextResponse.json({ success: false, error: '操作过于频繁，请稍后再试' }, { status: 429 })
  }

  // 解析 multipart 表单
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ success: false, error: '无效的上传请求' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, error: '请选择图片文件' }, { status: 400 })
  }

  // 校验文件大小
  if (file.size === 0 || file.size > AVATAR_MAX_SIZE) {
    return NextResponse.json({ success: false, error: '图片大小不能超过 2MB' }, { status: 400 })
  }

  // 校验 MIME 类型
  if (!AVATAR_ALLOWED_MIME_TYPES.includes(file.type as typeof AVATAR_ALLOWED_MIME_TYPES[number])) {
    return NextResponse.json({ success: false, error: '仅支持 JPG、PNG、GIF、WebP 格式' }, { status: 400 })
  }

  // 魔数校验（防止伪造 MIME 上传恶意文件）
  const isMagicValid = await validateFileMagicNumber(file, AVATAR_ALLOWED_MIME_TYPES)
  if (!isMagicValid) {
    return NextResponse.json({ success: false, error: '文件内容与声明类型不符' }, { status: 400 })
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

    // 确保 character-avatars bucket 存在
    const { data: buckets } = await admin.storage.listBuckets()
    const bucketExists = buckets?.some(b => b.name === 'character-avatars')
    if (!bucketExists) {
      await admin.storage.createBucket('character-avatars', { public: true })
    }

    // 根据 MIME 映射扩展名
    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
    }
    const ext = extMap[file.type] || 'jpg'
    const fileName = `${user.id}/${characterId}/avatar-${Date.now()}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await admin.storage
      .from('character-avatars')
      .upload(fileName, arrayBuffer, { contentType: file.type, upsert: true })

    if (uploadError) {
      console.error('角色头像上传失败:', uploadError.message)
      return NextResponse.json({ success: false, error: '头像上传失败' }, { status: 500 })
    }

    // 获取公开 URL
    const { data: urlData } = admin.storage.from('character-avatars').getPublicUrl(fileName)
    const avatarUrl = urlData.publicUrl

    // 更新角色头像
    const { error: updateError } = await admin
      .from('ai_characters')
      .update({ avatar_url: avatarUrl })
      .eq('id', characterId)
      .eq('user_id', user.id)

    if (updateError) throw updateError

    return NextResponse.json({ success: true, avatar_url: avatarUrl })
  } catch (err) {
    console.error('[龙灵工坊] 头像上传失败:', err)
    return NextResponse.json({ success: false, error: '头像上传失败' }, { status: 500 })
  }
}
