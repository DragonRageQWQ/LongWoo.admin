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
  it('JPEG 魔数（FF D8 FF）→ true', () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00])
    expect(validateMagicBuffer(buf, 'image/jpeg')).toBe(true)
  })

  it('PNG 魔数 → true', () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])
    expect(validateMagicBuffer(buf, 'image/png')).toBe(true)
  })

  it('伪造 mime：内容为 JPEG 但声明 PNG → false', () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00])
    expect(validateMagicBuffer(buf, 'image/png')).toBe(false)
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
