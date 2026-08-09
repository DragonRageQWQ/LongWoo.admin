import { describe, it, expect } from 'vitest'
import {
  parseDataUrl,
  getImageExtension,
  validateMagicBuffer,
  buildAttachmentUploadPath,
  parseDataUrlSafe,
} from './attachment-utils'

describe('parseDataUrl', () => {
  it('合法图片 dataUrl → 返回 mime 与 base64', () => {
    const result = parseDataUrl('data:image/png;base64,iVBORw0KGgo=')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.mime).toBe('image/png')
      expect(result.base64).toBe('iVBORw0KGgo=')
    }
  })

  it('非 data URL → 返回错误', () => {
    const result = parseDataUrl('https://example.com/a.png')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('无效的图片数据')
  })

  it('非图片 mime → 返回错误', () => {
    const result = parseDataUrl('data:application/pdf;base64,AAAA')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('仅支持图片文件（JPG/PNG/GIF/WebP）')
  })

  it('base64 为空 → 返回错误', () => {
    const result = parseDataUrl('data:image/jpeg;base64,')
    expect(result.ok).toBe(false)
  })
})

describe('getImageExtension', () => {
  it('jpeg → jpg', () => {
    expect(getImageExtension('image/jpeg')).toBe('jpg')
  })
  it('png → png', () => {
    expect(getImageExtension('image/png')).toBe('png')
  })
  it('gif → gif', () => {
    expect(getImageExtension('image/gif')).toBe('gif')
  })
  it('webp → webp', () => {
    expect(getImageExtension('image/webp')).toBe('webp')
  })
  it('未知 mime → null', () => {
    expect(getImageExtension('application/pdf')).toBeNull()
  })
})

describe('validateMagicBuffer', () => {
  // 合法 JPEG：魔数头 + 中间数据 + EOI 结束标记（FF D9）
  const validJpeg = Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
    Buffer.from(Array(8).fill(0x00)),
    Buffer.from([0xff, 0xd9]),
  ])
  // 合法 PNG：魔数 + IHDR chunk（长度13 + "IHDR" + 宽1高1 + 位深/色型/压缩/滤波/隔行 7字节）
  const validPng = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from([0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]),
    Buffer.from([0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01]),
    Buffer.from([0x08, 0x06, 0x00, 0x00, 0x00]),
  ])

  it('合法 JPEG（含 EOI 标记）→ true', () => {
    expect(validateMagicBuffer(validJpeg, 'image/jpeg')).toBe(true)
  })

  it('合法 PNG（IHDR 尺寸非零）→ true', () => {
    expect(validateMagicBuffer(validPng, 'image/png')).toBe(true)
  })

  it('JPEG 无 EOI 结束标记 → false（SEC-09 结构校验）', () => {
    const buf = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
      Buffer.from(Array(8).fill(0x00)),
      Buffer.from([0x00, 0x00]), // 非 FF D9
    ])
    expect(validateMagicBuffer(buf, 'image/jpeg')).toBe(false)
  })

  it('PNG 声明零尺寸 → false（SEC-09 结构校验）', () => {
    const buf = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from([0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]),
      Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]), // 宽=0 高=0
      Buffer.from([0x08, 0x06, 0x00, 0x00, 0x00]),
    ])
    expect(validateMagicBuffer(buf, 'image/png')).toBe(false)
  })

  it('伪造 mime：内容为 JPEG 但声明 PNG → false', () => {
    expect(validateMagicBuffer(validJpeg, 'image/png')).toBe(false)
  })

  it('缓冲区过短 → false', () => {
    const buf = Buffer.from([0xff])
    expect(validateMagicBuffer(buf, 'image/jpeg')).toBe(false)
  })
})

describe('buildAttachmentUploadPath', () => {
  it('生成 {orderId}/{uuid}.{ext} 路径', () => {
    const path = buildAttachmentUploadPath('order-123', 'image/png', 'uuid-abc')
    expect(path).toBe('order-123/uuid-abc.png')
  })

  it('jpeg 使用 jpg 扩展名', () => {
    const path = buildAttachmentUploadPath('order-123', 'image/jpeg', 'uuid-abc')
    expect(path).toBe('order-123/uuid-abc.jpg')
  })
})

describe('parseDataUrlSafe', () => {
  it('不存在的 key → null', () => {
    expect(parseDataUrlSafe(undefined)).toBeNull()
  })
})
