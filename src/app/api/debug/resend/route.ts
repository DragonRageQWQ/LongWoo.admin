import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * 临时诊断 API：从 Vercel 服务器调用 Resend 发信，返回具体错误码
 * 仅限持有 CRON_SECRET 的请求，部署验证后移除
 */
export async function POST(request: NextRequest) {
  // 简单鉴权：x-debug-token 需等于 CRON_SECRET（临时诊断，不引入新密钥）
  const token = request.headers.get('x-debug-token') || ''
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 403 })
  }

  try {
    const apiKey = process.env.RESEND_API_KEY || '(未配置)'
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@longwoo.studio'
    const maskedKey = apiKey.length > 10 ? apiKey.slice(0, 6) + '...' + apiKey.slice(-4) : apiKey

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: ['2656839319@qq.com'],
        subject: '【LongWoo 龙坞】Resend 配置诊断',
        html: '<p>这是一封 Resend 诊断测试邮件。</p>',
      }),
    })
    const body = await response.text()

    return NextResponse.json({
      success: response.ok,
      httpStatus: response.status,
      key: maskedKey,
      fromEmail,
      responseBody: body.slice(0, 500),
    })
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
