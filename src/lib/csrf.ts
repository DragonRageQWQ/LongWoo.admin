import { headers } from 'next/headers'
import { validateOrigin } from '@/lib/api-csrf'

/**
 * CSRF 保护：验证请求来源
 *
 * Server Actions 虽然有 Next.js 内置的加密 action ID 保护，
 * 但攻击者仍可能通过 XSS 或其他方式触发 Server Action 调用。
 * 此函数通过验证 Origin/Referer 头来提供额外的 CSRF 防护。
 *
 * 内部委托给核心函数 validateOrigin（与 api-csrf.ts 共用同一套校验逻辑）。
 *
 * @returns 验证通过返回 null，失败返回错误消息
 */
export async function validateCsrf(): Promise<string | null> {
  const headersList = await headers()
  const origin = headersList.get('origin')
  const referer = headersList.get('referer')
  const host = headersList.get('host')

  // 调用核心校验逻辑
  return validateOrigin(origin, referer, host)
}
