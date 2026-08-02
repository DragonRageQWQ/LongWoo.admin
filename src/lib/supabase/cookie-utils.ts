/**
 * Supabase Cookie 统一编解码工具
 *
 * 消除三处重复的 base64url 编码/解码/分片逻辑。
 * 所有 cookie 操作统一通过此模块完成。
 */

import { COOKIE_MAX_CHUNK_SIZE, COOKIE_BASE64_PREFIX, COOKIE_MAX_AGE } from '@/lib/constants'

/**
 * 从 Supabase URL 提取 project ref 并构造 cookie 名称
 * URL 格式: https://xxxxxxxxxxxx.supabase.co
 */
export function getSupabaseCookieName(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? ''
  return `sb-${projectRef}-auth-token`
}

/**
 * 统一的 Cookie 选项（与 @supabase/ssr 默认值对齐 + 安全加固）
 */
export const SECURE_COOKIE_OPTIONS = {
  path: '/',
  httpOnly: true, // 安全加固：禁止 JS 读取
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: COOKIE_MAX_AGE, // 7 天
}

/**
 * base64url 编码（Web API，兼容 Node.js 与 Edge Runtime）
 */
function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  bytes.forEach(byte => { binary += String.fromCharCode(byte) })
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * base64url 解码（Edge Runtime 兼容，使用 atob）
 */
function fromBase64Url(b64url: string): string {
  const base64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/**
 * 将 session 对象编码为 Supabase SSR 格式的 cookie(s)
 *
 * 格式: "base64-" + base64url(JSON.stringify(session))
 * 超过 3180 字符时自动分片
 */
export function encodeSessionCookie(
  session: Record<string, unknown>
): Array<{ name: string; value: string }> {
  const jsonStr = JSON.stringify(session)
  const encoded = `${COOKIE_BASE64_PREFIX}${toBase64Url(jsonStr)}`

  if (encoded.length <= COOKIE_MAX_CHUNK_SIZE) {
    return [{ name: getSupabaseCookieName(), value: encoded }]
  }

  const chunks: Array<{ name: string; value: string }> = []
  let remaining = encoded
  while (remaining.length > 0) {
    const chunk = remaining.slice(0, COOKIE_MAX_CHUNK_SIZE)
    chunks.push({
      name: `${getSupabaseCookieName()}.${chunks.length}`,
      value: chunk,
    })
    remaining = remaining.slice(COOKIE_MAX_CHUNK_SIZE)
  }
  return chunks
}

/**
 * 从 cookie 值解码出 session 对象
 *
 * 支持分片合并（调用方需先拼接分片）。
 * 返回 null 表示解码失败或格式不正确。
 */
export function decodeSessionCookie(cookieValue: string): Record<string, unknown> | null {
  try {
    if (!cookieValue.startsWith(COOKIE_BASE64_PREFIX)) return null
    const base64Part = cookieValue.substring(COOKIE_BASE64_PREFIX.length)
    const jsonStr = fromBase64Url(base64Part)
    return JSON.parse(jsonStr)
  } catch {
    return null
  }
}

/**
 * 从 Request cookies 中读取并合并分片 session cookie，返回完整值
 *
 * 适用于 middleware (NextRequest) 和 route handlers (cookies())
 */
export function readSessionCookieValue(
  cookies: { get: (name: string) => { value: string } | undefined; getAll: () => Array<{ name: string; value: string }> }
): string | null {
  const cookieName = getSupabaseCookieName()

  // 先尝试主 cookie
  const mainCookie = cookies.get(cookieName)
  if (mainCookie?.value?.startsWith(COOKIE_BASE64_PREFIX)) {
    return mainCookie.value
  }

  // 尝试分片 cookie
  const chunkCookies = cookies
    .getAll()
    .filter(c => c.name.startsWith(`${cookieName}.`))
    .sort((a, b) => {
      const aNum = parseInt(a.name.split('.').pop() || '0')
      const bNum = parseInt(b.name.split('.').pop() || '0')
      return aNum - bNum
    })

  if (chunkCookies.length > 0) {
    return chunkCookies.map(c => c.value).join('')
  }

  return null
}

// ===== JWT 验证 =====

export interface SupabaseSession {
  access_token: string
  refresh_token: string
  expires_at: number
  expires_in?: number
  token_type?: string
  user: {
    id: string
    email?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

/**
 * 从 cookie 中提取已解码的 session 对象
 */
export function getSessionFromCookieValue(cookieValue: string | null): SupabaseSession | null {
  if (!cookieValue) return null
  const decoded = decodeSessionCookie(cookieValue)
  if (!decoded) return null

  const session = decoded as unknown as SupabaseSession
  if (!session.access_token || !session.user?.id) return null

  return session
}

/**
 * 通过 Supabase API 验证 access_token 有效性
 *
 * 使用直接 fetch 调用 /auth/v1/user，显式设置 apikey 头，
 * 避免 @supabase/ssr 在 Edge Runtime 中的 "Invalid API key" 问题。
 *
 * 安全修复的核心：不再信任 cookie 内容，而是通过服务端验证 JWT。
 *
 * @returns 验证通过返回 userId，否则返回 null
 */
export async function verifyAccessToken(accessToken: string): Promise<string | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !anonKey) return null

    const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    })

    if (!resp.ok) return null

    const userData = await resp.json()
    return typeof userData?.id === 'string' ? userData.id : null
  } catch {
    return null
  }
}

/** 返回请求中属于当前 Supabase session 的全部 cookie 名称。 */
export function getSessionCookieNames(
  cookieValues: Array<{ name: string }>
): string[] {
  const cookieName = getSupabaseCookieName()
  return cookieValues
    .map(cookie => cookie.name)
    .filter(name => name === cookieName || name.startsWith(`${cookieName}.`))
}

/**
 * 使用 refresh_token 刷新 session，返回新的 access_token
 *
 * 在 access_token 过期时调用，通过 Supabase API 获取新的 token。
 * 仅在服务端使用（middleware + route handlers）。
 *
 * @returns 刷新成功返回新的 session 对象，失败返回 null
 */
export async function refreshSession(
  refreshToken: string
): Promise<{
  access_token: string
  refresh_token: string
  expires_at: number
  expires_in?: number
  token_type?: string
  user: { id: string; email?: string; [key: string]: unknown }
} | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !anonKey) return null

    const resp = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })

    if (!resp.ok) return null

    const data = await resp.json()
    if (!data.access_token || !data.refresh_token || !data.user?.id) {
      return null
    }

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at ?? Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
      expires_in: data.expires_in ?? 3600,
      token_type: data.token_type ?? 'bearer',
      user: data.user,
    }
  } catch {
    return null
  }
}

/**
 * 从 cookie 中获取已验证的 userId
 *
 * 完整流程：
 * 1. 从 cookie 解码 session
 * 2. 检查 token 是否过期
 * 3. 通过 Supabase API 验证 token 有效性
 *
 * @param cookieValue - 从 readSessionCookieValue 获取的 cookie 值
 * @returns 验证通过的 userId，失败返回 null
 */
export async function getVerifiedUserId(cookieValue: string | null): Promise<string | null> {
  const session = getSessionFromCookieValue(cookieValue)
  if (!session) return null

  // 通过 API 验证 token
  return verifyAccessToken(session.access_token)
}
