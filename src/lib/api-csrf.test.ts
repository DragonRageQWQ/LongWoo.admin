import { describe, it, expect } from 'vitest'
import { validateOrigin } from './api-csrf'

describe('validateOrigin', () => {
  it('Origin 与 Host 匹配 → 通过', () => {
    expect(validateOrigin('https://longwoo.studio', null, 'longwoo.studio')).toBeNull()
  })

  it('Origin 与 Host 不匹配 → 拒绝', () => {
    expect(validateOrigin('https://evil.com', null, 'longwoo.studio')).toBe('跨站请求被拒绝')
  })

  it('无 Origin 用 Referer 且匹配 → 通过', () => {
    expect(validateOrigin(null, 'https://longwoo.studio/path', 'longwoo.studio')).toBeNull()
  })

  it('无 Origin 用 Referer 且不匹配 → 拒绝', () => {
    expect(validateOrigin(null, 'https://evil.com/path', 'longwoo.studio')).toBe('跨站请求被拒绝')
  })

  it('Origin 与 Referer 均缺失 → 拒绝', () => {
    expect(validateOrigin(null, null, 'longwoo.studio')).toBe('缺少请求来源信息')
  })

  it('Origin 存在但 Host 缺失 → 拒绝（fail-closed）', () => {
    expect(validateOrigin('https://longwoo.studio', null, null)).toBe('缺少请求来源信息')
  })

  it('Referer 存在但 Host 缺失 → 拒绝（fail-closed）', () => {
    expect(validateOrigin(null, 'https://longwoo.studio/path', null)).toBe('缺少请求来源信息')
  })

  it('畸形 Origin → 拒绝', () => {
    expect(validateOrigin('not-a-url', null, 'longwoo.studio')).toBe('无效的请求来源')
  })
})
