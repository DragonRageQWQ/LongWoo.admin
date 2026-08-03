/**
 * 订单附件工具（纯函数，便于测试）
 *
 * 供静态下单流程的上传接口（POST /api/order/upload-attachment）使用：
 *   - parseDataUrl：解析前端传来的 base64 Data URL
 *   - getImageExtension：MIME → 扩展名映射
 *   - validateMagicBuffer：Buffer 版魔数校验（服务端，不依赖 File 对象）
 *   - buildAttachmentUploadPath：构造 Storage 存储路径
 */

export type AttachmentParseResult =
  | { ok: true; mime: string; base64: string }
  | { ok: false; error: string }

/** 允许的图片 MIME 类型（与头像上传一致） */
export const ATTACHMENT_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const

/** 附件大小上限：5MB */
export const ATTACHMENT_MAX_SIZE = 5 * 1024 * 1024

/** 常见图片格式魔数签名（与 file-validation.ts 一致，Buffer 版） */
const MAGIC_NUMBERS: Record<string, number[]> = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  'image/gif': [0x47, 0x49, 0x46, 0x38],
  'image/webp': [0x52, 0x49, 0x46, 0x46], // RIFF，偏移 8-11 为 "WEBP"
}

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

/**
 * 解析 base64 Data URL
 *
 * @param dataUrl - 形如 `data:image/png;base64,iVBOR...` 的字符串
 */
export function parseDataUrl(dataUrl: string): AttachmentParseResult {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    return { ok: false, error: '无效的图片数据' }
  }

  const commaIndex = dataUrl.indexOf(',')
  if (commaIndex === -1) {
    return { ok: false, error: '无效的图片数据' }
  }

  const header = dataUrl.slice(5, commaIndex) // 去掉 "data:"
  const base64 = dataUrl.slice(commaIndex + 1)

  // 解析 MIME：形如 "image/png;base64"
  const mimeMatch = header.match(/^([^;]+);base64$/)
  if (!mimeMatch) {
    return { ok: false, error: '无效的图片数据' }
  }

  const mime = mimeMatch[1].toLowerCase()
  if (!ATTACHMENT_ALLOWED_MIME_TYPES.includes(mime as (typeof ATTACHMENT_ALLOWED_MIME_TYPES)[number])) {
    return { ok: false, error: '仅支持图片文件（JPG/PNG/GIF/WebP）' }
  }

  if (!base64) {
    return { ok: false, error: '图片数据为空' }
  }

  return { ok: true, mime, base64 }
}

/**
 * MIME → 扩展名映射；未知返回 null
 */
export function getImageExtension(mime: string): string | null {
  return MIME_TO_EXT[mime] ?? null
}

/**
 * Buffer 版魔数校验（服务端使用，不依赖 File 对象）
 *
 * @param buf - 解码后的图片 Buffer
 * @param mime - 声明的 MIME 类型
 */
export function validateMagicBuffer(buf: Buffer, mime: string): boolean {
  const signature = MAGIC_NUMBERS[mime]
  if (!signature || buf.length < signature.length) return false

  const matches = signature.every((byte, index) => buf[index] === byte)
  if (!matches) return false

  // WebP 额外检查：偏移 8-11 为 "WEBP"
  if (mime === 'image/webp') {
    if (buf.length < 12) return false
    const tag = String.fromCharCode(buf[8], buf[9], buf[10], buf[11])
    if (tag !== 'WEBP') return false
  }

  return true
}

/**
 * 构造 Storage 上传路径：{orderId}/{uuid}.{ext}
 *
 * @param orderId - 订单 id
 * @param mime - 图片 MIME
 * @param uuid - 文件名 UUID（测试可注入，生产用 crypto.randomUUID()）
 */
export function buildAttachmentUploadPath(
  orderId: string,
  mime: string,
  uuid: string
): string {
  const ext = getImageExtension(mime) ?? 'img'
  return `${orderId}/${uuid}.${ext}`
}

/**
 * 安全读取可选值：无图片（undefined/null）返回 null，不视为错误
 */
export function parseDataUrlSafe(
  dataUrl: string | undefined | null
): AttachmentParseResult | null {
  if (!dataUrl || typeof dataUrl !== 'string') {
    return null
  }
  return parseDataUrl(dataUrl)
}
