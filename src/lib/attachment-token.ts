/**
 * 订单附件上传凭证工具
 *
 * 安全背景（审计 M-1）：/api/order/upload-attachment 原仅校验订单存在，
 * 任何知道订单 UUID 的人（含匿名）都可向任意订单挂附件（IDOR）。
 *
 * 方案：订单创建时返回一次性上传凭证 uploadToken =
 *   HMAC-SHA256(orderId, secret)，上传接口校验 token 与 orderId 匹配，
 *   且用恒定时间比较防时序攻击。token 无过期时间（订单生命周期内可补传），
 *   但仅对创建者本人有效——其他用户无法为其订单伪造凭证。
 */
import { createHmac, timingSafeEqual } from 'crypto'

/**
 * 生成订单上传凭证
 *
 * @param orderId - 订单 id（UUID）
 * @param secret - 服务端密钥（环境变量）
 */
export function generateUploadToken(orderId: string, secret: string): string {
  const hmac = createHmac('sha256', secret)
  hmac.update(orderId)
  return hmac.digest('hex')
}

/**
 * 校验上传凭证与订单 id 是否匹配（恒定时间比较）
 *
 * @param orderId - 请求中的订单 id
 * @param token - 请求携带的凭证
 * @param secret - 服务端密钥（环境变量）
 */
export function verifyUploadToken(
  orderId: string,
  token: string,
  secret: string
): boolean {
  if (!orderId || !token || !secret) return false

  const expected = generateUploadToken(orderId, secret)
  const actualBuf = Buffer.from(token)
  const expectedBuf = Buffer.from(expected)

  // 长度不同时直接失败（timingSafeEqual 要求等长）
  if (actualBuf.length !== expectedBuf.length) return false

  return timingSafeEqual(actualBuf, expectedBuf)
}
