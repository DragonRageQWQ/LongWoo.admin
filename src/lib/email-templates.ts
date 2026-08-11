/**
 * 邮件模板模块
 *
 * 集中管理所有邮件 HTML 模板，便于维护和统一品牌风格。
 */

/**
 * 登录验证码邮件模板
 *
 * 品牌色：#0D3B3B（深青绿）+ #1A5050（次级）
 * 字体：PingFang SC / Microsoft YaHei / Noto Sans CJK SC
 */
export function loginOtpEmailTemplate(otpCode: string): string {
  return `
    <!DOCTYPE html>
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
              <h2 style="color:#0D3B3B;font-size:18px;font-weight:700;margin:0 0 16px;">登录验证码</h2>
              <p style="color:#666;font-size:15px;line-height:1.7;margin:0 0 20px;">您好，您正在登录 LongWoo 龙坞，验证码为：</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                <tr><td style="background-color:#F0F7F7;border-left:3px solid #0D3B3B;border-radius:0 8px 8px 0;padding:24px;text-align:center;">
                  <span style="font-size:36px;font-weight:700;letter-spacing:10px;color:#0D3B3B;">${otpCode}</span>
                </td></tr>
              </table>
              <p style="color:#999;font-size:13px;line-height:1.6;margin:0;">验证码 10 分钟内有效，请勿泄露给他人。如非本人操作，请忽略此邮件。</p>
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
    </html>
  `
}

/**
 * 密码重置验证码邮件模板
 *
 * 用于"忘记密码"流程：验证码校验通过后可重置密码（无需旧密码）
 */
export function passwordResetOtpEmailTemplate(otpCode: string): string {
  return `
    <!DOCTYPE html>
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
              <h2 style="color:#0D3B3B;font-size:18px;font-weight:700;margin:0 0 16px;">密码重置验证码</h2>
              <p style="color:#666;font-size:15px;line-height:1.7;margin:0 0 20px;">您好，您正在重置 LongWoo 龙坞账号的登录密码，验证码为：</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                <tr><td style="background-color:#F0F7F7;border-left:3px solid #0D3B3B;border-radius:0 8px 8px 0;padding:24px;text-align:center;">
                  <span style="font-size:36px;font-weight:700;letter-spacing:10px;color:#0D3B3B;">${otpCode}</span>
                </td></tr>
              </table>
              <p style="color:#999;font-size:13px;line-height:1.6;margin:0;">验证码 10 分钟内有效，请勿泄露给他人。如非本人操作，请忽略此邮件，您的密码不会改变。</p>
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
    </html>
  `
}
