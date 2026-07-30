/**
 * 订单相关工具函数
 *
 * 从 order-actions.ts 中拆分出来，因为 'use server' 文件要求所有导出函数必须是 async。
 * 这些纯同步验证函数放在此处供 Server Action 和 API Route 共享调用。
 */

/**
 * 验证订单输入数据
 * @returns 错误信息字符串，null 表示验证通过
 */
export function validateOrderInput(data: {
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  requirements?: string
}): string | null {
  if (!data.customerName || data.customerName.trim().length === 0) {
    return '请填写联系人姓名'
  }
  if (data.customerName.length > 50) {
    return '联系人姓名不能超过50个字符'
  }
  if (!data.customerPhone || !/^1[3-9]\d{9}$/.test(data.customerPhone)) {
    return '请输入有效的手机号码'
  }
  if (!data.customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.customerEmail)) {
    return '请输入有效的邮箱地址'
  }
  if (!data.requirements || data.requirements.trim().length < 10) {
    return '需求描述至少需要10个字符'
  }
  if (data.requirements.length > 5000) {
    return '需求描述不能超过5000个字符'
  }
  return null
}

/**
 * 验证 URL 协议仅允许 http/https，防止 javascript: 等 XSS
 */
export function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * 验证 UUID 格式（防止通过 orderId 参数进行 SQL 注入）
 *
 * Supabase 使用 UUID 主键，接受非 UUID 格式的参数可能导致意外行为。
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id)
}
