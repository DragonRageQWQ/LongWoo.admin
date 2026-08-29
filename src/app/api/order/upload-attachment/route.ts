import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionUser } from '@/lib/supabase/server'
import { isSessionUserSoftBanned } from '@/lib/user-guard'
import { validateApiCsrf } from '@/lib/api-csrf'
import { checkRateLimit } from '@/lib/rate-limit'
import { isValidUUID } from '@/lib/order-utils'
import {
  parseDataUrlSafe,
  validateMagicBuffer,
  buildAttachmentUploadPath,
  ATTACHMENT_MAX_SIZE,
} from '@/lib/attachment-utils'
import { verifyUploadToken } from '@/lib/attachment-token'
import { extractClientIpFromRequest } from '@/lib/server-utils'
import { RATE_LIMIT_ORDER_MAX, RATE_LIMIT_ORDER_WINDOW } from '@/lib/constants'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const ATTACHMENT_BUCKET = 'order-attachments'

/**
 * POST /api/order/upload-attachment
 *
 * 供静态 HTML 下单流程（public/order-step3.html）调用：
 * 订单创建成功后，将用户选择的自设设定图（base64 Data URL）
 * 上传到 Supabase Storage 并写入 order_attachments 表，
 * 使管理员后台订单详情可查看图片。
 *
 * 请求体（JSON）：
 *   orderId      string  必填  已创建订单的 id（order/create 返回）
 *   uploadToken  string  必填  上传凭证（order/create 返回，用于归属校验）
 *   fileName     string  可选  原始文件名（仅展示用）
 *   dataUrl      string  必填  图片 base64 Data URL（data:image/xxx;base64,...）
 *
 * 返回（JSON）：
 *   成功 { success: true, attachment: { id, file_name, file_path, file_type } }
 *   失败 { success: false, error: string }
 */
export async function POST(request: NextRequest) {
  // 1) CSRF 保护
  const csrfError = validateApiCsrf(request)
  if (csrfError) {
    return csrfError
  }

  // 2) 仅接受 JSON
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: '请求体不是有效的 JSON' },
      { status: 400 }
    )
  }

  // 3) 参数解析
  const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : ''
  const uploadToken =
    typeof body.uploadToken === 'string' ? body.uploadToken.trim() : ''
  const fileName =
    typeof body.fileName === 'string' ? body.fileName.trim().slice(0, 255) : ''
  const dataUrl = typeof body.dataUrl === 'string' ? body.dataUrl : ''

  if (!orderId || !isValidUUID(orderId)) {
    return NextResponse.json(
      { success: false, error: '无效的订单' },
      { status: 400 }
    )
  }

  // 4) 归属校验（M-1 安全加固）：校验上传凭证与订单匹配，
  //    防止任意人向任意订单挂附件（IDOR）
  const tokenSecret = process.env.UPLOAD_TOKEN_SECRET ?? ''
  if (!verifyUploadToken(orderId, uploadToken, tokenSecret)) {
    return NextResponse.json(
      { success: false, error: '无权上传该订单的附件' },
      { status: 403 }
    )
  }

  // 4) 解析 Data URL（含 MIME 白名单校验）
  const parsed = parseDataUrlSafe(dataUrl)
  if (!parsed) {
    return NextResponse.json(
      { success: false, error: '无效的图片数据' },
      { status: 400 }
    )
  }
  if (!parsed.ok) {
    return NextResponse.json(
      { success: false, error: parsed.error },
      { status: 400 }
    )
  }

  // 5) base64 解码 + 大小上限
  let buffer: Buffer
  try {
    buffer = Buffer.from(parsed.base64, 'base64')
  } catch {
    return NextResponse.json(
      { success: false, error: '无效的图片数据' },
      { status: 400 }
    )
  }
  if (buffer.length === 0) {
    return NextResponse.json(
      { success: false, error: '图片数据为空' },
      { status: 400 }
    )
  }
  if (buffer.length > ATTACHMENT_MAX_SIZE) {
    return NextResponse.json(
      { success: false, error: '图片大小不能超过5MB' },
      { status: 400 }
    )
  }

  // 6) 魔数校验（防伪造 MIME）
  if (!validateMagicBuffer(buffer, parsed.mime)) {
    return NextResponse.json(
      { success: false, error: '图片内容校验失败' },
      { status: 400 }
    )
  }

  // 7) 速率限制
  const ip = extractClientIpFromRequest(request)
  const rateLimit = await checkRateLimit(
    `uploadattachment:${ip}`,
    RATE_LIMIT_ORDER_MAX,
    RATE_LIMIT_ORDER_WINDOW
  )
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: '操作过于频繁，请稍后再试' },
      { status: 429 }
    )
  }

  const admin = createAdminClient()

  try {
    // 8) 校验订单存在
    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id')
      .eq('id', orderId)
      .maybeSingle()

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, error: '订单不存在' },
        { status: 404 }
      )
    }

    // 9) 确保 bucket 存在（公开）
    const { data: buckets } = await admin.storage.listBuckets()
    const bucketExists = buckets?.some((b) => b.name === ATTACHMENT_BUCKET)
    if (!bucketExists) {
      await admin.storage.createBucket(ATTACHMENT_BUCKET, { public: true })
    }

    // 10) 上传：路径 {orderId}/{uuid}.{ext}（随机 UUID 防枚举）
    const uploadPath = buildAttachmentUploadPath(
      orderId,
      parsed.mime,
      randomUUID()
    )
    const { error: uploadError } = await admin.storage
      .from(ATTACHMENT_BUCKET)
      .upload(uploadPath, buffer, {
        contentType: parsed.mime,
        upsert: false,
      })

    if (uploadError) {
      console.error('设定图上传失败:', uploadError.message)
      return NextResponse.json(
        { success: false, error: '图片上传失败' },
        { status: 500 }
      )
    }

    const { data: urlData } = admin.storage
      .from(ATTACHMENT_BUCKET)
      .getPublicUrl(uploadPath)

    // 11) 关联上传者（匿名订单为 null）
    let uploadedBy: string | null = null
    try {
      const user = await getSessionUser()
      uploadedBy = user?.id ?? null
    } catch {
      uploadedBy = null
    }

    // 软封禁（blacklist）：已登录的拉黑用户禁止上传附件（匿名游客不受影响）
    if (uploadedBy && (await isSessionUserSoftBanned())) {
      return NextResponse.json(
        { success: false, error: '账户已被限制使用，请联系管理员' },
        { status: 403 }
      )
    }

    // 12) 写入 order_attachments（service_role 绕过 RLS）
    const { data: attachment, error: insertError } = await admin
      .from('order_attachments')
      .insert({
        order_id: orderId,
        file_name: fileName || uploadPath.split('/').pop() || '设定图',
        file_path: urlData.publicUrl,
        file_size: buffer.length,
        file_type: parsed.mime,
        uploaded_by: uploadedBy,
      })
      .select()
      .single()

    if (insertError || !attachment) {
      // 回滚：删除已上传的 Storage 对象，避免孤儿文件
      await admin.storage.from(ATTACHMENT_BUCKET).remove([uploadPath])
      console.error('写入附件记录失败:', insertError?.message)
      return NextResponse.json(
        { success: false, error: '图片保存失败' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      attachment: {
        id: attachment.id,
        file_name: attachment.file_name,
        file_path: attachment.file_path,
        file_type: attachment.file_type,
      },
    })
  } catch (error) {
    console.error('上传附件异常:', error)
    return NextResponse.json(
      { success: false, error: '上传时发生未知错误' },
      { status: 500 }
    )
  }
}
