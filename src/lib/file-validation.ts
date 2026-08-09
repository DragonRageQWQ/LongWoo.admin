/**
 * 文件类型验证工具
 *
 * 通过读取文件头部魔数（magic number）验证实际文件类型，
 * 而非依赖客户端提供的 MIME 类型（可被伪造）。
 *
 * 安全加固（SEC-09）：在魔数校验基础上增加结构完整性检查，
 * 降低"合法魔数头 + HTML/JS 载荷"polyglot 文件的绕过风险：
 * - JPEG：校验文件尾部存在 EOI 结束标记（FF D9）
 * - PNG：校验 IHDR chunk 声明了合理（非零）的尺寸
 */

/**
 * 常见图片格式的魔数签名
 */
const MAGIC_NUMBERS: Record<string, number[]> = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  'image/gif': [0x47, 0x49, 0x46, 0x38],
  'image/webp': [0x52, 0x49, 0x46, 0x46], // RIFF header, WebP 位置 8-11 为 "WEBP"
}

/**
 * 通过魔数验证文件实际类型
 *
 * @param file - 上传的 File 对象
 * @param allowedMimeTypes - 允许的 MIME 类型列表
 * @returns 验证通过返回 true，失败返回 false
 */
export async function validateFileMagicNumber(
  file: File,
  allowedMimeTypes: readonly string[]
): Promise<boolean> {
  try {
    // 读取文件头部前 16 字节（足以覆盖所有常见图片格式的魔数）
    const header = new Uint8Array(await file.slice(0, 16).arrayBuffer())

    for (const mimeType of allowedMimeTypes) {
      const signature = MAGIC_NUMBERS[mimeType]
      if (!signature) continue

      // 逐字节比较魔数
      const matches = signature.every((byte, index) => header[index] === byte)
      if (!matches) continue

      // WebP 额外检查：偏移 8-11 字节为 "WEBP"
      if (mimeType === 'image/webp') {
        const webpTag = String.fromCharCode(header[8], header[9], header[10], header[11])
        if (webpTag !== 'WEBP') continue
      }

      // 安全加固（SEC-09）：结构完整性二次检查
      const structureValid = await validateImageStructure(file, mimeType)
      if (!structureValid) return false

      return true
    }

    return false
  } catch {
    return false
  }
}

/**
 * 图片结构完整性检查（SEC-09）
 *
 * 魔数只能证明文件头是合法图片标记，无法阻止 polyglot 文件
 * （合法图片头 + 附加恶意载荷）。此处对 JPEG/PNG 做轻量结构校验：
 * - JPEG：文件末尾必须存在 EOI 标记 FF D9（有效 JPEG 的结束标志）
 * - PNG：IHDR 块（偏移 16-24）声明的宽度/高度必须非零
 *
 * @param file - 上传的 File 对象
 * @param mime - 匹配的 MIME 类型
 * @returns 结构合理返回 true
 */
async function validateImageStructure(
  file: File,
  mime: string
): Promise<boolean> {
  if (mime === 'image/jpeg') {
    // 读取文件尾部 2 字节，应为 EOI 标记 0xFF 0xD9
    const fileSize = file.size
    if (fileSize < 3) return false
    const tail = new Uint8Array(await file.slice(fileSize - 2, fileSize).arrayBuffer())
    return tail[0] === 0xff && tail[1] === 0xd9
  }

  if (mime === 'image/png') {
    // 读取 IHDR chunk 头（偏移 16-24）：宽/高字段
    if (file.size < 24) return false
    const ihdr = new Uint8Array(await file.slice(16, 24).arrayBuffer())
    // 大端序读取 width/height，非零即合理
    const width = (ihdr[0] << 24) | (ihdr[1] << 16) | (ihdr[2] << 8) | ihdr[3]
    const height = (ihdr[4] << 24) | (ihdr[5] << 16) | (ihdr[6] << 8) | ihdr[7]
    return width > 0 && height > 0
  }

  // GIF / WebP 不做额外结构校验（魔数已足够）
  return true
}
