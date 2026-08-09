import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { validateOrigin } from './api-csrf'

describe('validateOrigin - 固定白名单路径（生产配置 SITE_URL）', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.longwoo.studio')
    vi.stubEnv('NODE_ENV', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('Origin 匹配白名单（含 www）→ 通过', () => {
    expect(validateOrigin('https://www.longwoo.studio', null, 'ignored')).toBeNull()
  })

  it('Origin 匹配白名单（无 www 也被白名单精确匹配时通过）→ 拒绝（白名单不含无 www）', () => {
    // 白名单仅 https://www.longwoo.studio，无 www 域名不在列表
    expect(validateOrigin('https://longwoo.studio', null, 'www.longwoo.studio')).toBe('跨站请求被拒绝')
  })

  it('Origin 为恶意域名 → 拒绝（即使 Host 头伪造为相同恶意域名）', () => {
    // 关键安全用例：Host 头与 Origin 一致但均非白名单 → 必须拒绝
    expect(validateOrigin('https://evil.com', null, 'evil.com')).toBe('跨站请求被拒绝')
  })

  it('Origin 为 http 协议（非 https）→ 拒绝', () => {
    expect(validateOrigin('http://www.longwoo.studio', null, 'www.longwoo.studio')).toBe('跨站请求被拒绝')
  })

  it('无 Origin 用 Referer 且匹配白名单 → 通过', () => {
    expect(validateOrigin(null, 'https://www.longwoo.studio/path', 'ignored')).toBeNull()
  })

  it('无 Origin 用 Referer 且不匹配 → 拒绝', () => {
    expect(validateOrigin(null, 'https://evil.com/path', 'evil.com')).toBe('跨站请求被拒绝')
  })

  it('Origin 与 Referer 均缺失 → 拒绝（fail-closed）', () => {
    expect(validateOrigin(null, null, 'www.longwoo.studio')).toBe('缺少请求来源信息')
  })

  it('畸形 Origin → 拒绝', () => {
    expect(validateOrigin('not-a-url', null, 'www.longwoo.studio')).toBe('无效的请求来源')
  })
})

describe('validateOrigin - 降级路径（未配置 SITE_URL，且无 localhost 白名单）', () => {
  beforeEach(() => {
    // 模拟自托管未配置 SITE_URL：生产环境且白名单为空 → 走 Host 反射降级比对
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
    vi.stubEnv('NODE_ENV', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('开发环境 localhost Origin → 通过（白名单含 localhost）', () => {
    // 此用例置于开发环境逻辑：直接验证 getAllowedOrigins 的 localhost 放行
    vi.stubEnv('NODE_ENV', 'development')
    expect(validateOrigin('http://localhost:3000', null, 'localhost:3000')).toBeNull()
  })

  it('Origin 与 Host 匹配（降级比对）→ 通过', () => {
    expect(validateOrigin('https://longwoo.studio', null, 'longwoo.studio')).toBeNull()
  })

  it('Origin 与 Host 不匹配 → 拒绝', () => {
    expect(validateOrigin('https://evil.com', null, 'longwoo.studio')).toBe('跨站请求被拒绝')
  })

  it('无 Origin 用 Referer 且匹配 → 通过', () => {
    expect(validateOrigin(null, 'https://longwoo.studio/path', 'longwoo.studio')).toBeNull()
  })

  it('Origin 存在但 Host 缺失 → 拒绝（fail-closed）', () => {
    expect(validateOrigin('https://longwoo.studio', null, null)).toBe('缺少请求来源信息')
  })
})
