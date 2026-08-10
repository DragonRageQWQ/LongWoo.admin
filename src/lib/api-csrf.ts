import { NextResponse } from 'next/server'

/**
 * 获取允许的站点 Origin 白名单（固定列表，而非反射 Host 头）
 *
 * 安全加固（SEC-02）：CSRF 校验不再把请求方 Origin 与【客户端可控的 Host 头】比对，
 * 而是与服务器配置的固定站点域名严格比对，杜绝 Host 头伪造/DNS rebinding 绕过。
 *
 * 白名单来源（按优先级）：
 *   1. NEXT_PUBLIC_SITE_URL（主生产域名，如 https://www.longwoo.studio）
 *   2. NEXT_PUBLIC_ADDITIONAL_SITE_URLS（附加生产域名，逗号分隔，支持多站点部署，
 *      如 https://longwoo.com.cn,https://www.longwoo.com.cn）
 *   3. Vercel 部署域名（VERCEL_PROJECT_PRODUCTION_URL / VERCEL_URL /
 *      VERCEL_BRANCH_URL 等，自动适配预览与生产环境）
 *   4. localhost 开发地址（NODE_ENV !== 'production' 时加入）
 */
function getAllowedOrigins(): string[] {
  const origins: string[] = []

  const pushOrigin = (raw: string) => {
    const val = raw.trim()
    if (!val) return
    try {
      const u = val.startsWith('http') ? new URL(val) : new URL(`https://${val}`)
      if (u.protocol === 'https:' || u.protocol === 'http:') {
        origins.push(u.origin)
      }
    } catch { /* 忽略非法配置 */ }
  }

  // 1) 主生产域名
  pushOrigin(process.env.NEXT_PUBLIC_SITE_URL ?? '')

  // 2) 附加生产域名（逗号分隔，支持多站点）
  const additional = (process.env.NEXT_PUBLIC_ADDITIONAL_SITE_URLS ?? '').split(',')
  for (const item of additional) {
    pushOrigin(item)
  }

  // 3) Vercel 部署环境自动放行（生产域名、预览域名、分支域名）
  for (const key of [
    'VERCEL_PROJECT_PRODUCTION_URL',
    'VERCEL_URL',
    'VERCEL_BRANCH_URL',
    'VERCEL_PREVIEW_URL',
  ]) {
    pushOrigin(process.env[key] ?? '')
  }

  // 4) 开发环境放行 localhost（含常见端口），便于本地联调
  if (process.env.NODE_ENV !== 'production') {
    origins.push('http://localhost:3000')
    origins.push('http://localhost:3001')
  }

  return origins
}

/**
 * CSRF 核心校验：验证 Origin/Referer 头（固定白名单）
 *
 * 安全加固（SEC-02）：从"反射 Host 头比对"改为"固定 Origin 白名单比对"。
 * 当 Origin 头缺失时回退到 Referer 头检查；两者均缺失时拒绝请求（不跳过校验）。
 *
 * @param origin  - Origin 请求头（可能为 null）
 * @param referer - Referer 请求头（可能为 null）
 * @param host    - Host 请求头（保留参数，用于无白名单配置时的降级比对）
 * @returns 验证通过返回 null，失败返回错误消息字符串
 */
export function validateOrigin(
  origin: string | null,
  referer: string | null,
  host: string | null
): string | null {
  const allowedOrigins = getAllowedOrigins()

  // 从请求头中提取 Origin（优先）或 Referer 的 origin 部分
  const sourceHeader = origin ?? referer

  if (sourceHeader) {
    try {
      const sourceOrigin = new URL(sourceHeader).origin

      // 开发环境降级放行：Origin 与 Host 一致视为同源请求。
      // 覆盖局域网 IP / 自定义端口访问（如 http://192.168.x.x:3000、
      // 手机真机联调），这些来源无法预先列入固定白名单。
      if (process.env.NODE_ENV !== 'production' && host) {
        const sourceHost = new URL(sourceHeader).host
        if (sourceHost === host) {
          return null
        }
      }

      // 1) 已配置固定白名单（生产/预发推荐路径）：严格比对，不匹配直接拒绝
      if (allowedOrigins.length > 0) {
        if (allowedOrigins.includes(sourceOrigin)) {
          return null
        }
        return '跨站请求被拒绝'
      }

      // 2) 无白名单配置（本地/自托管未设 SITE_URL）：Host 反射比对 + 协议一致性校验
      if (!host) {
        return '缺少请求来源信息'
      }
      const sourceUrl = new URL(sourceHeader)
      if (sourceUrl.host !== host) {
        return '跨站请求被拒绝'
      }
      // 协议一致性：生产环境仅允许 https 来源
      const isSecureRequest = sourceUrl.protocol === 'https:'
      if (process.env.NODE_ENV === 'production' && !isSecureRequest) {
        return '跨站请求被拒绝'
      }
      return null
    } catch {
      return '无效的请求来源'
    }
  }

  // 既没有 Origin 也没有 Referer，拒绝请求（fail-closed）
  return '缺少请求来源信息'
}

/**
 * API 路由 CSRF 保护
 *
 * 验证 Origin/Referer 头，防止跨站请求伪造。
 * 当 Origin 头缺失时回退到 Referer 头检查；
 * 两者均缺失时拒绝请求（不跳过校验）。
 *
 * 内部委托给核心函数 validateOrigin，并将错误消息包装为 NextResponse。
 *
 * @returns 验证通过返回 null，失败返回 403 响应
 */
export function validateApiCsrf(request: Request): NextResponse | null {
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')
  const host = request.headers.get('host')

  // 调用核心校验逻辑
  const errorMessage = validateOrigin(origin, referer, host)

  if (errorMessage) {
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 403 }
    )
  }

  return null
}
