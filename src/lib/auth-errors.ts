/**
 * 认证/登录错误码体系
 *
 * 统一约定：所有登录相关错误在响应体中附带 `code` 字段，
 * 便于前端展示、用户上报与后端日志定位（配合 console.error 中的真实异常信息）。
 *
 * 编码规则：
 * - 前缀：AUTH_（登录/认证）、CSRF_（跨站来源校验）
 * - 序号：四位数字，0001 起递增；9999 保留为「未知异常」兜底
 */

/** CSRF 来源校验错误码（通用，登录接口复用） */
export const CSRF_ERROR_CODES = {
  /** 跨站请求被拒绝（来源不在白名单） */
  FORBIDDEN: 'CSRF_0001',
  /** 缺少请求来源信息（无 Origin 且无 Referer） */
  MISSING_SOURCE: 'CSRF_0002',
  /** 无效的请求来源（头解析失败） */
  INVALID_SOURCE: 'CSRF_0003',
} as const
export type CsrfErrorCode = (typeof CSRF_ERROR_CODES)[keyof typeof CSRF_ERROR_CODES]

/** 登录错误码（AUTH_ 前缀） */
export const LOGIN_ERROR_CODES = {
  /** 请输入完整登录信息（缺少邮箱/验证码/密码） */
  MISSING_PARAMS: 'AUTH_0001',
  /** 请输入有效的邮箱地址 */
  INVALID_EMAIL: 'AUTH_0002',
  /** 邮箱或密码错误（凭证校验失败，含 Supabase invalid_credentials） */
  INVALID_CREDENTIALS: 'AUTH_0003',
  /** 密码长度不合法（<6 或 >64） */
  INVALID_PASSWORD_LENGTH: 'AUTH_0004',
  /** 登录失败次数过多，账户已临时锁定（15 分钟） */
  ACCOUNT_LOCKED: 'AUTH_0005',
  /** 登录尝试过于频繁（IP 或邮箱维度限流） */
  RATE_LIMITED: 'AUTH_0006',
  /** 登录会话创建失败（token 不完整） */
  SESSION_CREATE_FAILED: 'AUTH_0007',
  /** 账户已停用（is_active=false） */
  ACCOUNT_INACTIVE: 'AUTH_0008',
  /** 账户被硬封禁（伪装为请求超时） */
  ACCOUNT_BANNED: 'AUTH_0009',
  /** 请输入 6 位验证码（格式错误） */
  INVALID_OTP_FORMAT: 'AUTH_0010',
  /** 验证码系统繁忙（OTP 校验/魔法链接/verify 系统错误） */
  OTP_SYSTEM_ERROR: 'AUTH_0011',
  /** 验证码无效或已过期 */
  OTP_INVALID: 'AUTH_0012',
  /** 登录令牌异常（token_hash 缺失） */
  TOKEN_ABNORMAL: 'AUTH_0013',
  /** 未知异常（兜底，服务端已记录真实错误日志） */
  UNKNOWN: 'AUTH_9999',
} as const
export type LoginErrorCode = (typeof LOGIN_ERROR_CODES)[keyof typeof LOGIN_ERROR_CODES]

/** 登录错误响应体结构 */
export interface LoginErrorBody {
  success: false
  code: LoginErrorCode
  error: string
}

/** 构建登录错误响应体（服务端 return 用） */
export function buildLoginError(code: LoginErrorCode, message: string): LoginErrorBody {
  return { success: false, code, error: message }
}

/** 校验错误码格式：前缀_四位数字 */
const CODE_RE = /^(AUTH|CSRF)_\d{4}$/

export function isValidErrorCode(code: string): boolean {
  return CODE_RE.test(code)
}
