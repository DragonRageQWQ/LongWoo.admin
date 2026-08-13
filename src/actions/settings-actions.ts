'use server'

/**
 * 系统设置页 Server Actions
 *
 * 权限模型：
 * - 查看（getSystemSettings/getOperationLogs/getTemplates/getRateLimits）：所有 admin
 * - 修改（updateTemplate/sendTestEmail）：仅超级管理员（uid === ZERO_USER_UID）
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser, requireAdmin } from '@/lib/auth'
import { ZERO_USER_UID } from '@/lib/constants'
import { sendEmail } from '@/lib/server-utils'
import { DEFAULT_TEMPLATES } from '@/lib/notification-templates'
import type { TemplateKey } from '@/lib/notification-templates'
import { validateCsrf } from '@/lib/csrf'
import {
  RATE_LIMIT_OTP_MAX,
  RATE_LIMIT_LOGIN_MAX_FAILS,
  RATE_LIMIT_LOGIN_LOCK_MS,
  RATE_LIMIT_ORDER_MAX,
  RATE_LIMIT_AVATAR_MAX,
  RATE_LIMIT_EMAIL_REPLY_MAX,
  RATE_LIMIT_PASSWORD_MAX,
  RATE_LIMIT_CHECK_EMAIL_MAX,
  RATE_LIMIT_NOTIFY_MAX,
  RATE_LIMIT_FEEDBACK_MAX,
  RATE_LIMIT_FEEDBACK_REPLY_MAX,
  OTP_TTL_MS,
  OTP_MAX_ATTEMPTS,
  ESTIMATE_PRICE_MIN,
  ESTIMATE_PRICE_MAX,
  DEFAULT_FROM_EMAIL,
  CONTACT_EMAIL,
  MAX_PAGE_LIMIT,
} from '@/lib/constants'

// ==================== 权限辅助 ====================
async function requireSuperAdmin() {
  const currentUser = await getCurrentUser()
  if (!currentUser?.userId || currentUser.profile?.role !== 'admin') {
    return null
  }
  const isSuper = currentUser.profile.uid === ZERO_USER_UID
  if (!isSuper) return null
  return currentUser
}

// ==================== 系统信息 ====================
export interface SystemSettingsData {
  environment: {
    nodeEnv: string
    siteUrl: string
    appVersion: string
    buildNumber: string
    deployedAt: string | null
    zeroUserUid: number
  }
  database: Array<{ table: string; label: string; count: number | null }>
  services: {
    supabase: boolean
    resend: boolean
    deepseek: boolean
    fromEmail: string
    contactEmail: string
  }
  security: {
    jwtSecret: boolean
    uploadTokenSecret: boolean
    cronSecret: boolean
    csrfEnabled: boolean
    zeroUserUidConfigured: boolean
  }
  cron: {
    scheduled: string[]
    rateLimitsRows: number | null
    otpRows: number | null
    logRetentionDays: number
  }
  rateLimits: Array<{ key: string; label: string; value: string }>
}

export async function getSystemSettings(): Promise<{
  success: boolean
  data?: SystemSettingsData
  error?: string
  isSuperAdmin?: boolean
}> {
  const adminCheck = await requireAdmin()
  if (!adminCheck.success) {
    return { success: false, error: adminCheck.error }
  }
  const currentUser = adminCheck.user
  const isSuper = currentUser.profile?.uid === ZERO_USER_UID

  const admin = createAdminClient()

  // 数据库统计（head 查询仅取 count，不拉数据）
  const tables: Array<{ table: string; label: string }> = [
    { table: 'orders', label: '订单' },
    { table: 'profiles', label: '用户' },
    { table: 'notifications', label: '站内通知' },
    { table: 'order_replies', label: '订单回复' },
    { table: 'operation_logs', label: '操作日志' },
    { table: 'drop_items', label: '掉落物品' },
    { table: 'works', label: '作品' },
    { table: 'user_feedback', label: '用户反馈' },
    { table: 'otp_codes', label: '验证码记录' },
    { table: 'rate_limits', label: '限流记录' },
  ]
  const database = await Promise.all(
    tables.map(async ({ table, label }) => {
      try {
        const { count } = await admin
          .from(table)
          .select('*', { count: 'exact', head: true })
        return { table, label, count }
      } catch {
        return { table, label, count: null }
      }
    })
  )

  const data: SystemSettingsData = {
    environment: {
      nodeEnv: process.env.NODE_ENV || 'development',
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL || '未配置',
      appVersion: 'v1.1.4(813)',
      buildNumber: '813',
      deployedAt: null,
      zeroUserUid: ZERO_USER_UID,
    },
    database,
    services: {
      supabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      resend: !!process.env.RESEND_API_KEY,
      deepseek: !!process.env.DEEPSEEK_API_KEY,
      fromEmail: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM_EMAIL,
      contactEmail: CONTACT_EMAIL,
    },
    security: {
      // JWT 本地校验：支持 SUPABASE_JWT_SECRET（HS256）或 SUPABASE_JWT_PUBLIC_JWKS（ES256）任一配置即视为已配置
      jwtSecret: !!(process.env.SUPABASE_JWT_SECRET || process.env.SUPABASE_JWT_PUBLIC_JWKS),
      uploadTokenSecret: !!process.env.UPLOAD_TOKEN_SECRET,
      cronSecret: !!process.env.CRON_SECRET,
      csrfEnabled: true,
      zeroUserUidConfigured: !!process.env.ZERO_USER_UID,
    },
    cron: {
      scheduled: [
        'cleanup-rate-limits（每小时清理过期限流记录）',
        'cleanup-otp-codes（每小时清理过期验证码）',
        'cleanup-operation-logs（每天清理 30 天前的操作日志）',
      ],
      rateLimitsRows: database.find((d) => d.table === 'rate_limits')?.count ?? null,
      otpRows: database.find((d) => d.table === 'otp_codes')?.count ?? null,
      logRetentionDays: 30,
    },
    rateLimits: [
      { key: 'order-query', label: '订单查询', value: `每分钟 ${5} 次（IP+手机号）` },
      { key: 'order-create', label: '下单提交', value: `每分钟 ${RATE_LIMIT_ORDER_MAX} 次（IP）` },
      { key: 'login', label: '登录', value: `${RATE_LIMIT_LOGIN_MAX_FAILS} 次失败锁定 ${RATE_LIMIT_LOGIN_LOCK_MS / 60000} 分钟` },
      { key: 'otp', label: '验证码发送', value: `每分钟 ${RATE_LIMIT_OTP_MAX} 次，${OTP_TTL_MS / 60000} 分钟有效，最多尝试 ${OTP_MAX_ATTEMPTS} 次` },
      { key: 'avatar', label: '头像上传', value: `每分钟 ${RATE_LIMIT_AVATAR_MAX} 次` },
      { key: 'email-reply', label: '邮件/站内回复', value: `每分钟 ${RATE_LIMIT_EMAIL_REPLY_MAX} 次` },
      { key: 'password', label: '密码修改', value: `每分钟 ${RATE_LIMIT_PASSWORD_MAX} 次` },
      { key: 'check-email', label: '邮箱查询', value: `每分钟 ${RATE_LIMIT_CHECK_EMAIL_MAX} 次` },
      { key: 'notify', label: '通知发送', value: `每分钟 ${RATE_LIMIT_NOTIFY_MAX} 次` },
      { key: 'feedback', label: '反馈提交', value: `每分钟 ${RATE_LIMIT_FEEDBACK_MAX} 次` },
      { key: 'feedback-reply', label: '反馈回复', value: `每分钟 ${RATE_LIMIT_FEEDBACK_REPLY_MAX} 次` },
      { key: 'estimate-range', label: '估价范围', value: `RMB ${ESTIMATE_PRICE_MIN} - ${ESTIMATE_PRICE_MAX}` },
      { key: 'page-limit', label: '分页上限', value: `${MAX_PAGE_LIMIT} 条` },
    ],
  }

  return { success: true, data, isSuperAdmin: isSuper }
}

// ==================== 操作日志（时间线） ====================
export interface OperationLogItem {
  id: string
  action: string
  target_type: string | null
  details: Record<string, unknown> | null
  created_at: string
  operator: string | null
  order_no?: string | null
}

export async function getOperationLogs(
  limit = 100
): Promise<{ success: boolean; data?: OperationLogItem[]; error?: string }> {
  const adminCheck = await requireAdmin()
  if (!adminCheck.success) {
    return { success: false, error: adminCheck.error }
  }

  const admin = createAdminClient()
  const safeLimit = Math.min(Math.max(limit, 1), 300)

  try {
    // 并行：操作日志 + 操作者姓名 + 关联订单号
    const { data, error } = await admin
      .from('operation_logs')
      .select('id, action, target_type, target_id, details, created_at, profiles(display_name)')
      .order('created_at', { ascending: false })
      .limit(safeLimit)

    if (error) {
      return { success: false, error: '加载操作日志失败' }
    }

    // 提取涉及的订单号（批量查询，避免 N+1）
    const orderIds = (data || [])
      .filter((log) => log.target_type === 'order' && log.target_id)
      .map((log) => log.target_id)
    let orderMap: Record<string, string> = {}
    if (orderIds.length) {
      const { data: orders } = await admin
        .from('orders')
        .select('id, order_no')
        .in('id', orderIds)
      orderMap = Object.fromEntries(
        (orders || []).map((o) => [o.id, o.order_no])
      )
    }

    const items: OperationLogItem[] = (data || []).map((log) => ({
      id: log.id,
      action: log.action,
      target_type: log.target_type,
      details: log.details,
      created_at: log.created_at,
      operator: log.profiles?.[0]?.display_name ?? null,
      order_no: log.target_id && orderMap[log.target_id]
        ? orderMap[log.target_id]
        : null,
    }))
    return { success: true, data: items }
  } catch (error) {
    console.error('加载操作日志异常:', error)
    return { success: false, error: '加载操作日志时发生未知错误' }
  }
}

// ==================== 邮件发送测试（超管） ====================
export async function sendTestEmail(
  toEmail: string
): Promise<{ success: boolean; error?: string }> {
  const csrfError = await validateCsrf()
  if (csrfError) return { success: false, error: csrfError }

  const superAdmin = await requireSuperAdmin()
  if (!superAdmin) {
    return { success: false, error: '仅超级管理员可执行此操作' }
  }
  if (!process.env.RESEND_API_KEY) {
    return { success: false, error: '未配置 RESEND_API_KEY，邮件服务不可用' }
  }
  const trimmed = toEmail.trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { success: false, error: '邮箱格式不正确' }
  }

  try {
    const sent = await sendEmail(
      trimmed,
      '【LongWoo 龙坞】系统邮件测试',
      `<!DOCTYPE html><html lang="zh-CN"><body style="margin:0;padding:0;background-color:#F3F3F3;font-family:'PingFang SC','Microsoft YaHei',sans-serif;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F3F3F3;">
          <tr><td align="center" style="padding:32px 16px;">
            <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,0.06);">
              <tr><td style="background-color:#0D3B3B;padding:28px 40px;text-align:center;">
                <h1 style="color:#FFFFFF;font-size:22px;font-weight:700;margin:0;letter-spacing:3px;">龙坞 LONGWOO</h1>
                <p style="color:rgba(255,255,255,0.5);font-size:10px;margin:4px 0 0;letter-spacing:2px;">Creative Design Studio</p>
              </td></tr>
              <tr><td style="padding:32px 40px;">
                <h2 style="color:#0D3B3B;font-size:18px;font-weight:700;margin:0 0 16px;">邮件服务测试</h2>
                <p style="color:#666;font-size:15px;line-height:1.7;margin:0;">这是一封来自 LongWoo 龙坞系统的测试邮件，收到本邮件说明邮件发送通道配置正常。</p>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body></html>`
    )
    return sent
      ? { success: true }
      : { success: false, error: '邮件发送失败，请检查 Resend 配置与发件域名' }
  } catch (error) {
    console.error('发送测试邮件异常:', error)
    return { success: false, error: '发送测试邮件时发生未知错误' }
  }
}

// ==================== 通知/邮件模板管理 ====================
const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  estimate: '估价完成',
  accepted: '接单通知',
  rejected: '拒单通知',
  reply: '回复通知',
  progress: '进度更新',
}

export async function getTemplates(): Promise<{
  success: boolean
  data?: Array<{
    key: TemplateKey
    label: string
    title: string
    content: string
    email_subject: string
    email_body: string
    fromDb: boolean
    updated_at: string | null
  }>
  error?: string
  isSuperAdmin?: boolean
}> {
  const adminCheck = await requireAdmin()
  if (!adminCheck.success) {
    return { success: false, error: adminCheck.error }
  }
  const isSuper = adminCheck.user.profile?.uid === ZERO_USER_UID
  const admin = createAdminClient()

  const { data: dbRows } = await admin
    .from('notification_templates')
    .select('key,title,content,email_subject,email_body,updated_at')

  const dbMap = new Map((dbRows || []).map((r) => [r.key, r]))

  const keys = Object.keys(DEFAULT_TEMPLATES) as TemplateKey[]
  const data = keys.map((key) => {
    const db = dbMap.get(key)
    const def = DEFAULT_TEMPLATES[key]
    return {
      key,
      label: TEMPLATE_LABELS[key],
      title: db?.title ?? def.title,
      content: db?.content ?? def.content,
      email_subject: db?.email_subject ?? def.email_subject,
      email_body: db?.email_body ?? def.email_body,
      fromDb: !!db,
      updated_at: db?.updated_at ?? null,
    }
  })
  return { success: true, data, isSuperAdmin: isSuper }
}

export async function updateTemplate(
  key: string,
  fields: {
    title?: string
    content?: string
    email_subject?: string
    email_body?: string
  }
): Promise<{ success: boolean; error?: string }> {
  const csrfError = await validateCsrf()
  if (csrfError) return { success: false, error: csrfError }

  const superAdmin = await requireSuperAdmin()
  if (!superAdmin) {
    return { success: false, error: '仅超级管理员可修改模板' }
  }
  if (!(key in DEFAULT_TEMPLATES)) {
    return { success: false, error: '无效的模板键' }
  }

  const admin = createAdminClient()
  const patch: Record<string, string> = {}
  if (typeof fields.title === 'string' && fields.title.trim()) patch.title = fields.title.trim()
  if (typeof fields.content === 'string' && fields.content.trim()) patch.content = fields.content.trim()
  if (typeof fields.email_subject === 'string' && fields.email_subject.trim()) patch.email_subject = fields.email_subject.trim()
  if (typeof fields.email_body === 'string' && fields.email_body.trim()) patch.email_body = fields.email_body.trim()

  if (Object.keys(patch).length === 0) {
    return { success: false, error: '没有可保存的修改' }
  }

  try {
    const { error } = await admin.from('notification_templates').upsert(
      {
        key,
        ...patch,
        updated_at: new Date().toISOString(),
        updated_by: superAdmin.userId,
      },
      { onConflict: 'key' }
    )
    if (error) {
      return { success: false, error: '保存模板失败' }
    }
    return { success: true }
  } catch (error) {
    console.error('更新模板异常:', error)
    return { success: false, error: '更新模板时发生未知错误' }
  }
}

export async function resetTemplate(
  key: string
): Promise<{ success: boolean; error?: string }> {
  const csrfError = await validateCsrf()
  if (csrfError) return { success: false, error: csrfError }

  const superAdmin = await requireSuperAdmin()
  if (!superAdmin) {
    return { success: false, error: '仅超级管理员可重置模板' }
  }
  if (!(key in DEFAULT_TEMPLATES)) {
    return { success: false, error: '无效的模板键' }
  }

  const admin = createAdminClient()
  const { error } = await admin.from('notification_templates').delete().eq('key', key)
  if (error) {
    return { success: false, error: '重置模板失败' }
  }
  return { success: true }
}
