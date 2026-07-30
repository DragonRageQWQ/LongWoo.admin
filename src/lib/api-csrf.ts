import { NextResponse } from 'next/server'

/**
 * API 路由 CSRF 保护
 *
 * 验证 Origin/Referer 头，防止跨站请求伪造。
 * 当 Origin 头缺失时回退到 Referer 头检查；
 * 两者均缺失时拒绝请求（不跳过校验）。
 *
 * @returns 验证通过返回 null，失败返回 403 响应
 */
export function validateApiCsrf(request: Request): NextResponse | null {
  const origin = request.headers.get('origin')
  const host = request.headers.get('host')

  // 优先检查 Origin 头
  if (origin) {
    if (host) {
      try {
        if (new URL(origin).host !== host) {
          return NextResponse.json(
            { success: false, error: '跨站请求被拒绝' },
            { status: 403 }
          )
        }
      } catch {
        return NextResponse.json(
          { success: false, error: '无效的请求来源' },
          { status: 403 }
        )
      }
    }
    return null
  }

  // 没有 Origin 头时，检查 Referer 头
  const referer = request.headers.get('referer')
  if (referer) {
    if (host) {
      try {
        if (new URL(referer).host !== host) {
          return NextResponse.json(
            { success: false, error: '跨站请求被拒绝' },
            { status: 403 }
          )
        }
      } catch {
        return NextResponse.json(
          { success: false, error: '无效的请求来源' },
          { status: 403 }
        )
      }
    }
    return null
  }

  // 既没有 Origin 也没有 Referer，拒绝请求
  return NextResponse.json(
    { success: false, error: '缺少请求来源信息' },
    { status: 403 }
  )
}
