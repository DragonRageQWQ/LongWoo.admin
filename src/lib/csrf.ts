import { headers } from 'next/headers'

/**
 * CSRF 保护：验证请求来源
 *
 * Server Actions 虽然有 Next.js 内置的加密 action ID 保护，
 * 但攻击者仍可能通过 XSS 或其他方式触发 Server Action 调用。
 * 此函数通过验证 Origin/Referer 头来提供额外的 CSRF 防护。
 *
 * @returns 验证通过返回 null，失败返回错误消息
 */
export async function validateCsrf(): Promise<string | null> {
  const headersList = await headers()
  const origin = headersList.get('origin')
  const host = headersList.get('host')

  // 优先检查 Origin 头
  if (origin) {
    if (host) {
      try {
        if (new URL(origin).host !== host) {
          return '跨站请求被拒绝'
        }
      } catch {
        return '无效的请求来源'
      }
    }
    return null
  }

  // 没有 Origin 头时，检查 Referer 头作为备选
  const referer = headersList.get('referer')
  if (referer) {
    if (host) {
      try {
        if (new URL(referer).host !== host) {
          return '跨站请求被拒绝'
        }
      } catch {
        return '无效的请求来源'
      }
    }
    return null
  }

  // 既没有 Origin 也没有 Referer，拒绝请求
  return '缺少请求来源信息'
}
