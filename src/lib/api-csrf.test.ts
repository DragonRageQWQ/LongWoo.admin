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

  it('Vercel 预览域名（VERCEL_URL 白名单）→ 通过', () => {
    vi.stubEnv('VERCEL_URL', 'longwoo-preview-abc123.vercel.app')
    expect(validateOrigin('https://longwoo-preview-abc123.vercel.app', null, 'longwoo-preview-abc123.vercel.app')).toBeNull()
    vi.unstubAllEnvs()
  })

  it('Vercel 生产域名（VERCEL_PROJECT_PRODUCTION_URL）→ 通过', () => {
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'longwoo.studio')
    expect(validateOrigin('https://longwoo.studio', null, 'longwoo.studio')).toBeNull()
    vi.unstubAllEnvs()
  })

  it('附加域名（NEXT_PUBLIC_ADDITIONAL_SITE_URLS）→ 通过', () => {
    vi.stubEnv('NEXT_PUBLIC_ADDITIONAL_SITE_URLS', 'https://longwoo.com.cn,https://www.longwoo.com.cn')
    expect(validateOrigin('https://longwoo.com.cn', null, 'longwoo.com.cn')).toBeNull()
    expect(validateOrigin('https://www.longwoo.com.cn', null, 'www.longwoo.com.cn')).toBeNull()
    vi.unstubAllEnvs()
  })

  it('主域名 + 附加域名同时配置，两个站点均可通过', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.longwoo.studio')
    vi.stubEnv('NEXT_PUBLIC_ADDITIONAL_SITE_URLS', 'https://longwoo.com.cn,https://www.longwoo.com.cn')
    expect(validateOrigin('https://www.longwoo.studio', null, 'www.longwoo.studio')).toBeNull()
    expect(validateOrigin('https://longwoo.com.cn', null, 'longwoo.com.cn')).toBeNull()
    vi.unstubAllEnvs()
  })

  it('未列入白名单的域名 → 拒绝', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.longwoo.studio')
    vi.stubEnv('NEXT_PUBLIC_ADDITIONAL_SITE_URLS', 'https://longwoo.com.cn')
    expect(validateOrigin('https://other-evil.com', null, 'other-evil.com')).toBe('跨站请求被拒绝')
    vi.unstubAllEnvs()
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

  it('开发环境局域网 IP 同源访问 → 通过（Origin.host === Host 降级放行）', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.longwoo.studio')
    expect(validateOrigin('http://192.168.10.1:3000', null, '192.168.10.1:3000')).toBeNull()
  })

  it('开发环境自定义端口同源访问 → 通过（Origin.host === Host）', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.longwoo.studio')
    expect(validateOrigin('http://localhost:8080', null, 'localhost:8080')).toBeNull()
  })

  it('开发环境同源请求（Origin.host === Host）→ 放行（联调场景）', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.longwoo.studio')
    // 开发环境同源降级只要求 Origin.host === Host（真实浏览器 CSRF 中
    // 攻击者无法同时控制 Origin 与 Host，Host 始终为受害者站点）。
    // 生产环境仍走严格白名单，此放宽仅限开发联调。
    expect(validateOrigin('https://evil.com', null, 'evil.com')).toBeNull()
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
