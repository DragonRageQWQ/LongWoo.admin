import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * 从请求头提取客户端 IP
 *
 * 安全策略（审计 M-6）：
 * - x-forwarded-for 的头部地址可由客户端伪造，Vercel/可信代理会
 *   在**末尾**追加真实客户端 IP，因此取数组**最后一项**。
 * - 优先使用平台提供的真实 IP 头（cf-connecting-ip / x-real-ip）。
 * 无法获取时返回 'unknown'。
 */
export async function getClientIp(): Promise<string> {
  const headersList = await headers()

  const realIp =
    headersList.get('cf-connecting-ip') ||
    headersList.get('x-real-ip')
  if (realIp) {
    return realIp.trim() || 'unknown'
  }

  const forwarded = headersList.get('x-forwarded-for')
  if (!forwarded) {
    return 'unknown'
  }
  // 取最后一项：由可信代理追加，客户端无法伪造
  const parts = forwarded.split(',').map((p) => p.trim()).filter(Boolean)
  return parts.length > 0 ? parts[parts.length - 1] : 'unknown'
}

/**
 * 从 Route Handler 的 Request 提取客户端 IP（同步版）
 *
 * 与 getClientIp 相同的安全策略：优先平台真实 IP 头，
 * x-forwarded-for 取最后一项（可信代理追加，客户端无法伪造）。
 */
export function extractClientIpFromRequest(request: Request): string {
  const realIp =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip')
  if (realIp) {
    return realIp.trim() || 'unknown'
  }

  const forwarded = request.headers.get('x-forwarded-for')
  if (!forwarded) {
    return 'unknown'
  }
  const parts = forwarded.split(',').map((p) => p.trim()).filter(Boolean)
  return parts.length > 0 ? parts[parts.length - 1] : 'unknown'
}

/**
 * 记录操作日志
 *
 * 通过 admin 客户端（service_role，绕过 RLS）写入 operation_logs 表，
 * 同时记录操作者 IP。失败时静默处理，不影响主流程。
 *
 * @param userId     - 操作者用户 ID
 * @param action     - 操作类型（如 'create_order'）
 * @param targetType - 操作目标类型（如 'order'）
 * @param targetId   - 操作目标 ID
 * @param detail     - 附加详情（可选）
 */
export async function logOperation(
  userId: string,
  action: string,
  targetType: string,
  targetId: string,
  detail?: Record<string, unknown>
): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('operation_logs').insert({
      user_id: userId,
      action,
      target_type: targetType,
      target_id: targetId,
      detail: detail || {},
      ip: await getClientIp(),
    })
  } catch {
    // 静默失败，日志不应影响主流程
  }
}

/**
 * 发送邮件（通过 Resend API）
 *
 * 未配置 RESEND_API_KEY 时返回 false（调用方据此决定后续行为）。
 * 发送成功返回 true，失败返回 false。
 *
 * @param to      - 收件人邮箱
 * @param subject - 邮件主题
 * @param html    - 邮件 HTML 内容
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  try {
    const apiKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@longwoo.studio'

    if (!apiKey) return false

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: fromEmail, to: [to], subject, html }),
    })

    if (!response.ok) {
      // 记录 Resend 具体错误（域名未验证/key 无效/区域限制等），便于排查
      const errText = await response.text().catch(() => '')
      console.error(
        `[sendEmail] Resend 发送失败: HTTP ${response.status} ${errText.slice(0, 300)}`
      )
      return false
    }

    return true
  } catch (err) {
    console.error('[sendEmail] Resend 调用异常:', err instanceof Error ? err.message : err)
    return false
  }
}
