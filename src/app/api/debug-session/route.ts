import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import {
  readSessionCookieValue,
  getSessionFromCookieValue,
  verifyAccessToken,
  getSupabaseCookieName,
  decodeSessionCookie,
} from '@/lib/supabase/cookie-utils'

/**
 * 诊断 API：逐步排查 session 验证失败的原因
 *
 * 检查步骤：
 *   1. 读取所有 cookie
 *   2. 尝试自定义 cookie 读取（middleware 使用的路径）
 *   3. 尝试 SSR 客户端 getSession（session-check API 使用的路径）
 *   4. 尝试 token 验证
 *
 * 安全：仅限带 ?key=lw-debug-2026 查询参数时可用
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const key = url.searchParams.get('key')
  if (key !== 'lw-debug-2026') {
    return NextResponse.json({ error: 'Not available' }, { status: 403 })
  }

  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()
  const cookieName = getSupabaseCookieName()

  // ===== Step 1: 列出所有 cookie =====
  const cookieInfo = allCookies.map(c => ({
    name: c.name,
    valueLength: c.value.length,
    valuePreview: c.value.substring(0, 80),
    hasBase64Prefix: c.value.startsWith('base64-'),
    isAuthCookie: c.name === cookieName || c.name.startsWith(`${cookieName}.`),
  }))

  // ===== Step 2: 自定义 cookie 读取（middleware 路径） =====
  const customCookieValue = readSessionCookieValue(cookieStore)
  const customSession = getSessionFromCookieValue(customCookieValue)

  const customReading = {
    cookieName,
    cookieValueFound: customCookieValue !== null,
    cookieValueLength: customCookieValue?.length ?? 0,
    cookieValuePreview: customCookieValue?.substring(0, 80) ?? null,
    sessionDecoded: customSession !== null,
    sessionUserId: customSession?.user?.id ?? null,
    sessionUserEmail: customSession?.user?.email ?? null,
    sessionExpiresAt: customSession?.expires_at ?? null,
    currentTime: Math.floor(Date.now() / 1000),
    isExpired: customSession?.expires_at
      ? customSession.expires_at < Math.floor(Date.now() / 1000)
      : null,
    hasAccessToken: !!customSession?.access_token,
    accessTokenLength: customSession?.access_token?.length ?? 0,
  }

  // ===== Step 2b: 尝试直接解码（不经过 getSessionFromCookieValue） =====
  let directDecode = null
  if (customCookieValue) {
    const decoded = decodeSessionCookie(customCookieValue)
    directDecode = {
      decodeSuccess: decoded !== null,
      keys: decoded ? Object.keys(decoded) : [],
      hasAccessToken: decoded ? 'access_token' in decoded : false,
      hasUser: decoded ? 'user' in decoded : false,
      hasUserId: decoded ? (decoded as Record<string, { id?: string }>)?.user?.id != null : false,
    }
  }

  // ===== Step 3: SSR 客户端 getSession（session-check API 路径） =====
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  let ssrReading: Record<string, unknown> = {}
  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options))
        }
      }
    })

    const { data: { session: ssrSession }, error: ssrError } = await supabase.auth.getSession()

    ssrReading = {
      sessionFound: ssrSession !== null,
      sessionUserId: ssrSession?.user?.id ?? null,
      sessionUserEmail: ssrSession?.user?.email ?? null,
      hasAccessToken: !!ssrSession?.access_token,
      error: ssrError ? {
        message: ssrError.message,
        name: ssrError.name,
      } : null,
    }
  } catch (err) {
    ssrReading = {
      sessionFound: false,
      error: {
        message: err instanceof Error ? err.message : String(err),
        name: err instanceof Error ? err.name : 'Unknown',
      },
    }
  }

  // ===== Step 4: Token 验证（详细版） =====
  let tokenVerification: Record<string, unknown> = {}
  const tokenToVerify = customSession?.access_token ?? null

  if (tokenToVerify) {
    // 4a: 使用 verifyAccessToken 函数
    try {
      const verifiedUserId = await verifyAccessToken(tokenToVerify)
      tokenVerification = {
        tokenSource: 'customCookie',
        verified: verifiedUserId !== null,
        verifiedUserId,
        matchesSessionUserId: verifiedUserId === customSession?.user?.id,
      }
    } catch (err) {
      tokenVerification = {
        tokenSource: 'customCookie',
        verified: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }

    // 4b: 直接 fetch 调用 Supabase API，获取详细错误信息
    try {
      const directResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${tokenToVerify}`,
        },
      })

      const directBody = await directResp.text()

      tokenVerification = {
        ...tokenVerification,
        directFetch: {
          url: `${supabaseUrl}/auth/v1/user`,
          status: directResp.status,
          statusText: directResp.statusText,
          ok: directResp.ok,
          bodyPreview: directBody.substring(0, 300),
          bodyLength: directBody.length,
          responseHeaders: {
            'content-type': directResp.headers.get('content-type'),
            'www-authenticate': directResp.headers.get('www-authenticate'),
          },
        }
      }
    } catch (err) {
      tokenVerification = {
        ...tokenVerification,
        directFetch: {
          error: err instanceof Error ? {
            message: err.message,
            name: err.name,
            stack: err.stack?.substring(0, 200),
          } : String(err),
        }
      }
    }
  } else {
    tokenVerification = {
      tokenSource: null,
      reason: 'No access token found in custom cookie reading',
    }
  }

  // ===== Step 5: 环境信息 =====
  const envInfo = {
    nodeEnv: process.env.NODE_ENV,
    supabaseUrl: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'MISSING',
    supabaseAnonKey: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 10)}...` : 'MISSING',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING',
    debugAuth: process.env.DEBUG_AUTH,
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    envInfo,
    step1_cookies: {
      totalCount: allCookies.length,
      authCookieCount: cookieInfo.filter(c => c.isAuthCookie).length,
      cookies: cookieInfo,
    },
    step2_customReading: customReading,
    step2b_directDecode: directDecode,
    step3_ssrClientReading: ssrReading,
    step4_tokenVerification: tokenVerification,
    summary: {
      customCookieReads: customReading.sessionDecoded,
      ssrClientReads: ssrReading.sessionFound as boolean,
      tokenValid: tokenVerification.verified as boolean,
      rootCause: determineRootCause(
        customReading.sessionDecoded,
        ssrReading.sessionFound as boolean,
        tokenVerification.verified as boolean
      ),
    },
  })
}

function determineRootCause(
  customDecoded: boolean,
  ssrFound: boolean,
  tokenValid: boolean
): string {
  if (!customDecoded && !ssrFound) {
    return 'Cookie not found or cannot be decoded by either custom reader or SSR client'
  }
  if (customDecoded && !ssrFound) {
    return 'Custom reader decodes session but SSR client fails - possible cookie format mismatch'
  }
  if (!customDecoded && ssrFound) {
    return 'SSR client finds session but custom reader fails - possible cookie format mismatch'
  }
  if (customDecoded && ssrFound && !tokenValid) {
    return 'Session found but token verification fails - possible network issue or expired token'
  }
  if (customDecoded && ssrFound && tokenValid) {
    return 'All checks pass - session should be valid. Issue may be elsewhere.'
  }
  return 'Unknown - check individual steps for details'
}
