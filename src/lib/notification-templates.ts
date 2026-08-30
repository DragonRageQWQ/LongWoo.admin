/**
 * 通知/邮件模板系统
 *
 * 模板存储于 notification_templates 表（管理员可在系统设置页维护），
 * 发送时优先读取数据库模板，未配置时回退到内置默认模板。
 *
 * 占位符：{orderNo} 订单号、{price} 估价金额、{status} 状态文本、
 *         {reason} 拒单原因、{reply} 回复内容、{deliveryUrl} 交付链接
 */
import { createAdminClient } from '@/lib/supabase/admin'

export type TemplateKey =
  | 'estimate'
  | 'accepted'
  | 'rejected'
  | 'reply'
  | 'progress'

export interface NotificationTemplate {
  key: TemplateKey
  title: string
  content: string
  email_subject: string
  email_body: string
}

// ==================== 内置默认模板（数据库未配置时的回退） ====================
const EMAIL_SHELL_HEAD = `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#F3F3F3;font-family:'PingFang SC','Microsoft YaHei','Noto Sans CJK SC',-apple-system,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F3F3F3;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,0.06);">
        <tr><td style="background-color:#0D3B3B;padding:28px 40px;text-align:center;">
          <h1 style="color:#FFFFFF;font-size:22px;font-weight:700;margin:0;letter-spacing:3px;">龙坞 LONGWOO</h1>
          <p style="color:rgba(255,255,255,0.5);font-size:10px;margin:4px 0 0;letter-spacing:2px;">Creative Design Studio</p>
        </td></tr>
        <tr><td style="background-color:#1A5050;height:4px;line-height:4px;font-size:4px;">&nbsp;</td></tr>
        <tr><td style="padding:32px 40px;">
          <h2 style="color:#0D3B3B;font-size:18px;font-weight:700;margin:0 0 16px;">{{EMAIL_TITLE}}</h2>
          <p style="color:#666;font-size:15px;line-height:1.7;margin:0 0 20px;">{{EMAIL_BODY}}</p>
          <p style="color:#999;font-size:13px;line-height:1.6;margin:0;">委托单号：{{ORDER_NO}}</p>
          <a href="{{SITE_URL}}/?tab=check&no={{ORDER_NO}}" style="display:inline-block;margin-top:16px;padding:10px 28px;background-color:#0D3B3B;color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">查看委托单</a>
        </td></tr>
        <tr><td style="padding:0 40px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #EEE;"><tr><td style="height:1px;line-height:1px;font-size:1px;">&nbsp;</td></tr></table>
        </td></tr>
        <tr><td style="padding:20px 40px 28px;">
          <p style="color:#AAA;font-size:12px;line-height:1.6;margin:0;">此邮件由 LongWoo 龙坞系统自动发送，请勿直接回复。</p>
          <p style="color:#CCC;font-size:11px;margin:4px 0 0;">© 2026 LongWoo 龙坞. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

function shell(title: string, body: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.longwoo.studio'
  return EMAIL_SHELL_HEAD
    .replace('{{EMAIL_TITLE}}', title)
    .replace('{{EMAIL_BODY}}', body)
    .replaceAll('{{ORDER_NO}}', '{orderNo}')
    .replace('{{SITE_URL}}', siteUrl)
}

export const DEFAULT_TEMPLATES: Record<TemplateKey, NotificationTemplate> = {
  estimate: {
    key: 'estimate',
    title: '委托单估价完成',
    content: '您的委托单已完成估价，估价金额 RMB {price}。请登录个人中心查看详情。',
    email_subject: '【LongWoo 龙坞】委托单估价完成',
    email_body: shell(
      '委托单估价完成',
      '您好，您的委托单已完成估价，估价金额为 <b style="color:#0D3B3B;">RMB {price}</b>。请登录系统查看估价明细，并与工作室进一步沟通确认。'
    ),
  },
  accepted: {
    key: 'accepted',
    title: '委托单已接单',
    content: '工作室已接受您的委托单，即将开始制作，请留意后续进度更新。',
    email_subject: '【LongWoo 龙坞】委托单已接单',
    email_body: shell(
      '委托单已接单',
      '您好，工作室已接受您的委托单，即将开始制作。我们会在每个进度节点通过站内通知与邮件告知您，请留意查收。'
    ),
  },
  rejected: {
    key: 'rejected',
    title: '委托单已被拒单',
    content: '很抱歉，您的委托单未通过审核：{reason}',
    email_subject: '【LongWoo 龙坞】委托单未通过审核',
    email_body: shell(
      '委托单未通过审核',
      '您好，很抱歉您的委托单未通过审核。原因：<b style="color:#0D3B3B;">{reason}</b>。如有疑问可联系工作室沟通。'
    ),
  },
  reply: {
    key: 'reply',
    title: '委托单有新的回复',
    content: '工作室对您的委托单进行了回复，请登录个人中心查看。',
    email_subject: '【LongWoo 龙坞】委托单回复通知',
    email_body: shell('委托单回复通知', '您好，您的委托单有新的回复：<br/><br/><i>“{reply}”</i>'),
  },
  progress: {
    key: 'progress',
    title: '委托单进度更新',
    content: '您的委托单状态已更新为：{status}{deliveryUrl}',
    email_subject: '【LongWoo 龙坞】委托单进度更新',
    email_body: shell('委托单进度更新', '您好，您的委托单状态已更新为：<b style="color:#0D3B3B;">{status}</b>{deliveryUrl}'),
  },
}

// ==================== 占位符替换 ====================
export interface TemplateVars {
  orderNo?: string
  price?: number | string
  status?: string
  reason?: string
  reply?: string
  deliveryUrl?: string
}

export function renderTemplate(tpl: string, vars: TemplateVars): string {
  let out = tpl
  if (vars.orderNo != null) out = out.replaceAll('{orderNo}', String(vars.orderNo))
  if (vars.price != null) out = out.replaceAll('{price}', String(vars.price))
  if (vars.status != null) out = out.replaceAll('{status}', String(vars.status))
  if (vars.reason != null) out = out.replaceAll('{reason}', String(vars.reason))
  if (vars.reply != null) out = out.replaceAll('{reply}', String(vars.reply))
  if (vars.deliveryUrl != null) out = out.replaceAll('{deliveryUrl}', String(vars.deliveryUrl))
  // 清理未替换的占位符
  return out.replace(/\{orderNo\}|\{price\}|\{status\}|\{reason\}|\{reply\}|\{deliveryUrl\}/g, '')
}

/**
 * 获取模板（优先数据库，回退内置默认）
 * 数据库模板按 key 查询；查询失败/为空时使用内置默认，保证功能不中断。
 */
export async function getNotificationTemplate(
  key: TemplateKey
): Promise<NotificationTemplate> {
  const fallback = DEFAULT_TEMPLATES[key]
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('notification_templates')
      .select('key,title,content,email_subject,email_body')
      .eq('key', key)
      .maybeSingle()
    if (data) {
      return {
        key,
        title: data.title || fallback.title,
        content: data.content || fallback.content,
        email_subject: data.email_subject || fallback.email_subject,
        email_body: data.email_body || fallback.email_body,
      }
    }
  } catch (error) {
    console.error('[getNotificationTemplate] 读取模板异常:', error)
  }
  return fallback
}
