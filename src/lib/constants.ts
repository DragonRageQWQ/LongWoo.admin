/**
 * 全局常量集中管理
 *
 * 避免魔法数字/字符串散布在各个文件中，统一维护。
 */

// ===== Supabase Cookie =====
export const COOKIE_MAX_CHUNK_SIZE = 3180
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 天
export const COOKIE_BASE64_PREFIX = 'base64-'

// ===== OTP 验证码 =====
export const OTP_TTL_MS = 10 * 60 * 1000 // 10 分钟
export const OTP_MAX_ATTEMPTS = 5 // 最大尝试次数

// ===== 速率限制 =====
export const RATE_LIMIT_OTP_WINDOW = 60 * 1000 // 1 分钟
export const RATE_LIMIT_OTP_MAX = 3 // 每窗口最多 3 次
export const RATE_LIMIT_LOGIN_MAX_FAILS = 5
export const RATE_LIMIT_LOGIN_LOCK_MS = 15 * 60 * 1000 // 15 分钟
export const RATE_LIMIT_ORDER_WINDOW = 60 * 1000
export const RATE_LIMIT_ORDER_MAX = 10

// ===== 用户角色 =====
// 零号用户 UID — 超级管理员。安全加固（FIND-08）：支持通过环境变量 ZERO_USER_UID
// 显式配置，避免依赖可预测的 uid 序列值；默认 10001 仅为兼容历史数据。
// 生产环境建议在部署平台显式设置该变量并确保对应账号为管理员。
export const ZERO_USER_UID = parseInt(process.env.ZERO_USER_UID || '', 10) || 10001

// ===== 分页安全 =====
export const MAX_PAGE_LIMIT = 100 // 分页查询每页最大记录数

// ===== 文件上传 =====
export const AVATAR_MAX_SIZE = 2 * 1024 * 1024 // 2MB
export const AVATAR_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const

// ===== 估价价格范围 =====
export const ESTIMATE_PRICE_MIN = 100       // 最低 100 RMB
export const ESTIMATE_PRICE_MAX = 1000000   // 最高 100 万 RMB

// ===== 敏感操作速率限制 =====
export const RATE_LIMIT_AVATAR_WINDOW = 60 * 1000   // 1 分钟
export const RATE_LIMIT_AVATAR_MAX = 3               // 每分钟最多 3 次头像上传
export const RATE_LIMIT_EMAIL_REPLY_WINDOW = 60 * 1000
export const RATE_LIMIT_EMAIL_REPLY_MAX = 5           // 每分钟最多 5 次邮件回复
export const RATE_LIMIT_PASSWORD_WINDOW = 60 * 1000
export const RATE_LIMIT_PASSWORD_MAX = 3              // 每分钟最多 3 次密码修改
export const RATE_LIMIT_CHECK_EMAIL_WINDOW = 60 * 1000
export const RATE_LIMIT_CHECK_EMAIL_MAX = 10          // 每分钟最多 10 次邮箱查询
export const RATE_LIMIT_NOTIFY_WINDOW = 60 * 1000
export const RATE_LIMIT_NOTIFY_MAX = 5                // 每分钟最多 5 次通知发送

// ===== 邮件 =====
export const DEFAULT_FROM_EMAIL = 'noreply@longwoo.studio'
export const CONTACT_EMAIL = 'hello@longwoo.studio'
