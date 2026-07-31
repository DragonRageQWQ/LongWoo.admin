import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseCookieName, SECURE_COOKIE_OPTIONS } from '@/lib/supabase/cookie-utils'
import { validateApiCsrf } from '@/lib/api-csrf'

export const dynamic = 'force-dynamic'

/**
 * 从请求的 Cookie 头中解析出所有 cookie 名称
 */
function parseCookieNames(cookieHeader: string): string[] {
  if (!cookieHeader) return []
  return cookieHeader
    .split(';')
    .map(part => part.trim().split('=')[0])
    .filter(Boolean)
}

/**
 * 清除主 session cookie 及所有分片 cookie
 *
 * 分片 cookie 格式: sb-xxx-auth-token.0, sb-xxx-auth-token.1, ...
 * 如果只清除主 cookie 而不清理分片，攻击者可能利用残留的分片 cookie 恢复 session。
 */
function clearAllSessionCookies(
  response: NextResponse,
  request: Request
): void {
  const cookieName = getSupabaseCookieName()
  const cookieHeader = request.headers.get('cookie') || ''
  const allCookieNames = parseCookieNames(cookieHeader)

  // 安全修复：清除 cookie 时使用与设置时一致的安全属性（path, httpOnly, secure, sameSite），
  // 否则浏览器可能因属性不匹配而保留原始 cookie
  const clearOptions = { ...SECURE_COOKIE_OPTIONS, maxAge: 0 }

  // 1. 清除主 cookie
  response.cookies.set(cookieName, '', clearOptions)

  // 2. 清除所有分片 cookie (sb-xxx-auth-token.0, .1, .2, ...)
  for (const name of allCookieNames) {
    if (name.startsWith(`${cookieName}.`)) {
      response.cookies.set(name, '', clearOptions)
    }
  }
}

export async function POST(request: Request) {
  // ===== CSRF 校验 =====
  const csrfError = validateApiCsrf(request)
  if (csrfError) {
    return csrfError
  }

  try {
    const supabase = await createClient()
    await supabase.auth.signOut()
    const response = NextResponse.json({ success: true })
    // 无论 signOut 成功与否，都清除所有 session cookie（含分片）
    clearAllSessionCookies(response, request)
    return response
  } catch (error) {
    console.error(
      '[Logout API] 登出异常:',
      error instanceof Error ? error.message : String(error)
    )
    const response = NextResponse.json({ success: false })
    // 即使 signOut 失败，也清除所有 session cookie（含分片）
    clearAllSessionCookies(response, request)
    return response
  }
}
