/**
 * 订单附件上传凭证工具
 *
 * 安全背景（审计 M-1）：/api/order/upload-attachment 原仅校验订单存在，
 * 任何知道订单 UUID 的人（含匿名）都可向任意订单挂附件（IDOR）。
 *
 * 方案：订单创建时返回一次性上传凭证 uploadToken =
 *   HMAC-SHA256(orderId + ':' + issuedAt, secret)，上传接口校验 token 与
 *   orderId 匹配且未过期（恒定时间比较防时序攻击）。
 *
 * 安全加固（SEC-04）：token 嵌入签发时间戳并校验有效期（默认 24 小时）。
 * 即使 token 被泄露（XSS 窃取/日志泄露/中间人），也无法在订单生命周期内
 * 无限次上传附件，降低泄露后的滥用窗口。
 */
import { createHmac, timingSafeEqual } from 'crypto'

/** 上传凭证有效期（毫秒）：24 小时 */
export const UPLOAD_TOKEN_TTL_MS = 24 * 60 * 60 * 1000

/**
 * 生成订单上传凭证
 *
 * 格式：`<hmac>.<issuedAt>`，其中 hmac = HMAC-SHA256(orderId:issuedAt, secret)
 *
 * @param orderId - 订单 id（UUID）
 * @param secret - 服务端密钥（环境变量）
 * @param issuedAt - 签发时间戳（毫秒，可选，默认当前时间）
 */
export function generateUploadToken(
  orderId: string,
  secret: string,
  issuedAt: number = Date.now()
): string {
  const hmac = createHmac('sha256', secret)
  hmac.update(`${orderId}:${issuedAt}`)
  return `${hmac.digest('hex')}.${issuedAt}`
}

/**
 * 校验上传凭证是否有效（恒定时间比较 + 有效期校验）
 *
 * @param orderId - 请求中的订单 id
 * @param token - 请求携带的凭证
 * @param secret - 服务端密钥（环境变量）
 * @param now - 当前时间戳（毫秒，可选，默认当前时间）
 */
export function verifyUploadToken(
  orderId: string,
  token: string,
  secret: string,
  now: number = Date.now()
): boolean {
  if (!orderId || !token || !secret) return false

  // 解析 hmac 与签发时间
  const dotIndex = token.lastIndexOf('.')
  if (dotIndex <= 0) return false

  const hmacPart = token.slice(0, dotIndex)
  const issuedAtPart = token.slice(dotIndex + 1)
  const issuedAt = Number(issuedAtPart)
  if (!Number.isFinite(issuedAt) || issuedAt <= 0) return false

  // 有效期校验（SEC-04）：超过 TTL 拒绝
  if (now - issuedAt > UPLOAD_TOKEN_TTL_MS) return false
  // 未来时间戳（时钟异常）同样拒绝
  if (issuedAt > now + 5 * 60 * 1000) return false

  // 重新计算期望值（恒定时间比较）
  const expected = generateUploadToken(orderId, secret, issuedAt)
  const actualBuf = Buffer.from(hmacPart)
  const expectedBuf = Buffer.from(expected.split('.')[0])

  // 长度不同时直接失败（timingSafeEqual 要求等长）
  if (actualBuf.length !== expectedBuf.length) return false

  return timingSafeEqual(actualBuf, expectedBuf)
}
