import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * 从请求头提取客户端 IP
 *
 * 优先读取 x-forwarded-for 的第一个地址（客户端真实 IP），
 * 无法获取时返回 'unknown'。
 */
export async function getClientIp(): Promise<string> {
  const headersList = await headers()
  return headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
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

    return response.ok
  } catch {
    return false
  }
}
