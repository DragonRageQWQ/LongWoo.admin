/**
 * 文件类型验证工具
 *
 * 通过读取文件头部魔数（magic number）验证实际文件类型，
 * 而非依赖客户端提供的 MIME 类型（可被伪造）。
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

      return true
    }

    return false
  } catch {
    return false
  }
}
