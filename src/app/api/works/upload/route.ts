import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionUser } from '@/lib/supabase/server'
import { validateApiCsrf } from '@/lib/api-csrf'
import { checkRateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/server-utils'
import { validateFileMagicNumber } from '@/lib/file-validation'
import { AVATAR_ALLOWED_MIME_TYPES, RATE_LIMIT_AVATAR_WINDOW, RATE_LIMIT_AVATAR_MAX } from '@/lib/constants'

export const dynamic = 'force-dynamic'

/**
 * POST /api/works/upload
 * 上传作品图片（multipart/form-data，字段名 file）
 * 仅管理员（role=admin 且 is_active）可调用，与掉落图片上传保持一致
 * 返回：{ success, image_url }
 */
export async function POST(request: NextRequest) {
  const csrfError = validateApiCsrf(request)
  if (csrfError) return csrfError

  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
  }

  // 管理员校验：role=admin 且 is_active
  const admin = createAdminClient()
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single()
  if (profileError || !profile) {
    return NextResponse.json({ success: false, error: '未找到用户信息' }, { status: 401 })
  }
  if (profile.role !== 'admin' || profile.is_active !== true) {
    return NextResponse.json({ success: false, error: '无权操作，仅管理员可上传作品图片' }, { status: 403 })
  }

  // 速率限制
  const ip = await getClientIp()
  const rateLimit = await checkRateLimit(`works-upload:${ip}`, RATE_LIMIT_AVATAR_MAX, RATE_LIMIT_AVATAR_WINDOW)
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

  // 校验文件大小（作品图片允许 8MB，支持高清大图）
  const WORK_MAX_SIZE = 8 * 1024 * 1024
  if (file.size === 0 || file.size > WORK_MAX_SIZE) {
    return NextResponse.json({ success: false, error: '图片大小不能超过 8MB' }, { status: 400 })
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
    // 确保 works bucket 存在
    const { data: buckets } = await admin.storage.listBuckets()
    const bucketExists = buckets?.some(b => b.name === 'works')
    if (!bucketExists) {
      await admin.storage.createBucket('works', { public: true })
    }

    // 根据 MIME 映射扩展名
    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
    }
    const ext = extMap[file.type] || 'jpg'
    // 安全加固：随机 UUID 文件名，防止公开 bucket 路径枚举
    const fileName = `works/${randomUUID()}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await admin.storage
      .from('works')
      .upload(fileName, arrayBuffer, { contentType: file.type, upsert: true })

    if (uploadError) {
      console.error('作品图片上传失败:', uploadError.message)
      return NextResponse.json({ success: false, error: '图片上传失败' }, { status: 500 })
    }

    // 获取公开 URL
    const { data: urlData } = admin.storage.from('works').getPublicUrl(fileName)
    const imageUrl = urlData.publicUrl

    return NextResponse.json({ success: true, image_url: imageUrl })
  } catch (err) {
    console.error('[作品管理] 图片上传失败:', err)
    return NextResponse.json({ success: false, error: '图片上传失败' }, { status: 500 })
  }
}
