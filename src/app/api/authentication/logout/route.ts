import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { clearAllSessionCookies } from '@/lib/supabase/cookie-utils'
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
    // 使用统一的 cookie 清理函数，兼容 NextResponse
    const cookieNames = parseCookieNames(request.headers.get('cookie') || '')
    clearAllSessionCookies(response, cookieNames)
    return response
  } catch (error) {
    console.error(
      '[Logout API] 登出异常:',
      error instanceof Error ? error.message : String(error)
    )
    const response = NextResponse.json({ success: false })
    // 即使 signOut 失败，也清除所有 session cookie（含分片）
    const cookieNames = parseCookieNames(request.headers.get('cookie') || '')
    clearAllSessionCookies(response, cookieNames)
    return response
  }
}
