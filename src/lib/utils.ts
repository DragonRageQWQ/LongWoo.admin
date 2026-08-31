export function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return phone
  return phone.slice(0, 3) + '****' + phone.slice(-4)
}

export function maskEmail(email: string): string {
  if (!email) return email
  const atIndex = email.indexOf('@')
  if (atIndex <= 0) return email
  const local = email.slice(0, atIndex)
  const domain = email.slice(atIndex)
  const maskedLocal = local.length <= 2
    ? local[0] + '*'
    : local.slice(0, 2) + '*'.repeat(Math.min(local.length - 2, 4))
  return maskedLocal + domain
}

export function formatDate(date: string): string {
  // 固定 Asia/Shanghai 时区：SSR（Vercel UTC）与客户端（浏览器本地时区）
  // 渲染结果必须一致，否则 SSR 直出数据时产生 hydration mismatch（React #418）。
  return new Date(date).toLocaleDateString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Shanghai',
    hour12: false,
  })
}

export const statusLabels: Record<string, string> = {
  pending: '待估价',
  estimated: '已估价',
  agreed: '已同意估价',
  accepted: '已接单',
  rejected: '已拒单',
  processing: '处理中',
  delivered: '已交付',
  completed: '已完成'
}

export const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  estimated: 'bg-blue-100 text-blue-800',
  agreed: 'bg-teal-100 text-teal-800',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  processing: 'bg-purple-100 text-purple-800',
  delivered: 'bg-indigo-100 text-indigo-800',
  completed: 'bg-gray-100 text-gray-800'
}
