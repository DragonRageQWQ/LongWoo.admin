import { NextResponse } from 'next/server'

/**
 * CSRF 核心校验：验证 Origin/Referer 头
 *
 * 这是 api-csrf.ts（API 路由）与 csrf.ts（Server Actions）共用的核心逻辑。
 * 验证 Origin/Referer 头，防止跨站请求伪造。
 * 当 Origin 头缺失时回退到 Referer 头检查；
 * 两者均缺失时拒绝请求（不跳过校验）。
 *
 * @param origin  - Origin 请求头（可能为 null）
 * @param referer - Referer 请求头（可能为 null）
 * @param host    - Host 请求头（可能为 null）
 * @returns 验证通过返回 null，失败返回错误消息字符串
 */
export function validateOrigin(
  origin: string | null,
  referer: string | null,
  host: string | null
): string | null {
  // 安全加固（L-4）：Host 头缺失时 fail-closed，不跳过校验
  // （异常代理配置下可能缺失 Host，放行会导致 CSRF 校验被绕过）
  if (!host) {
    return '缺少请求来源信息'
  }

  // 优先检查 Origin 头
  if (origin) {
    try {
      if (new URL(origin).host !== host) {
        return '跨站请求被拒绝'
      }
    } catch {
      return '无效的请求来源'
    }
    return null
  }

  // 没有 Origin 头时，检查 Referer 头
  if (referer) {
    try {
      if (new URL(referer).host !== host) {
        return '跨站请求被拒绝'
      }
    } catch {
      return '无效的请求来源'
    }
    return null
  }

  // 既没有 Origin 也没有 Referer，拒绝请求
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
