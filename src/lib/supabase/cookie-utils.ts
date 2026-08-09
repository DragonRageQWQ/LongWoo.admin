/**
 * Supabase Cookie 统一编解码工具
 *
 * 消除三处重复的 base64url 编码/解码/分片逻辑。
 * 所有 cookie 操作统一通过此模块完成。
 */

import { NextResponse } from 'next/server'
import { importJWK, jwtVerify } from 'jose'
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
 * 安全修复的核心：不再信任 cookie 内容，而是通过服务端验证 JWT。
 *
 * 性能/可用性修复（H4）：优先在 Edge 本地验证 JWT 签名与过期时间
 * （零网络往返），失败时回退到 Supabase /auth/v1/user 网络验证，
 * 并为网络请求设置 3 秒超时（AbortSignal），避免无超时的悬挂请求
 * 拖垮 middleware。
 *
 * 本地验证支持两种签名（按配置依次尝试）：
 *   1. ES256（当前 Supabase ECC P-256 签名密钥，2026-07 起启用）
 *      - 配置 SUPABASE_JWT_PUBLIC_JWKS（JWKS JSON 字符串）
 *   2. HS256（历史 Shared Secret 签发的 token）
 *      - 配置 SUPABASE_JWT_SECRET
 * 两种都未配置或验证失败 → 网络回退。
 *
 * @returns 验证通过返回 userId，否则返回 null
 */
export async function verifyAccessToken(accessToken: string): Promise<string | null> {
  // 1) 本地 JWT 验证（Edge 零往返）
  const localUserId = await verifyTokenLocally(accessToken)
  if (localUserId) return localUserId

  // 2) 网络验证（回退路径）+ 3 秒超时
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !anonKey) return null

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    try {
      const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
        signal: controller.signal,
      })

      if (!resp.ok) return null

      const userData = await resp.json()
      return typeof userData?.id === 'string' ? userData.id : null
    } finally {
      clearTimeout(timeout)
    }
  } catch {
    return null
  }
}

/**
 * 验证 access_token 并返回【签名验证过】的受信用户信息
 *
 * 安全加固（SEC-08）：cookie 外层 JSON（base64url，无签名）可被攻击者
 * 任意改写 user.email 等字段。此函数仅返回 JWT payload（已验签）或
 * Supabase /auth/v1/user 响应（网络验证）中的受信字段，杜绝伪造。
 *
 * @returns 验证通过返回 { id, email, role, user_metadata }，失败返回 null
 */
export async function verifyAccessTokenWithUser(
  accessToken: string
): Promise<{ id: string; email?: string; role?: string; user_metadata?: Record<string, unknown> } | null> {
  // 1) 本地 JWT 验证（payload 已验签，字段受信）
  const localUser = await verifyTokenLocallyWithUser(accessToken)
  if (localUser) return localUser

  // 2) 网络验证（回退路径）
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !anonKey) return null

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    try {
      const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
        signal: controller.signal,
      })

      if (!resp.ok) return null

      const userData = await resp.json()
      if (typeof userData?.id !== 'string') return null
      return {
        id: userData.id,
        email: typeof userData.email === 'string' ? userData.email : undefined,
        role: typeof userData.role === 'string' ? userData.role : undefined,
        user_metadata:
          userData.user_metadata && typeof userData.user_metadata === 'object'
            ? userData.user_metadata as Record<string, unknown>
            : undefined,
      }
    } finally {
      clearTimeout(timeout)
    }
  } catch {
    return null
  }
}

/**
 * 本地 JWT 验证并返回受信 user 信息（payload 已验签）
 */
async function verifyTokenLocallyWithUser(
  accessToken: string
): Promise<{ id: string; email?: string; role?: string; user_metadata?: Record<string, unknown> } | null> {
  // 1) ES256
  const es256KeyPromiseResult = getEs256Key()
  if (es256KeyPromiseResult) {
    try {
      const { payload } = await jwtVerify(accessToken, await es256KeyPromiseResult, {
        algorithms: ['ES256'],
      })
      if (typeof payload.sub === 'string' && payload.sub) {
        return extractTrustedUser(payload)
      }
    } catch {
      // 签名/过期校验失败 → 尝试其他路径
    }
  }

  // 2) HS256
  const jwtSecret = process.env.SUPABASE_JWT_SECRET
  if (jwtSecret) {
    try {
      const { payload } = await jwtVerify(
        accessToken,
        new TextEncoder().encode(jwtSecret),
        { algorithms: ['HS256'] }
      )
      if (typeof payload.sub === 'string' && payload.sub) {
        return extractTrustedUser(payload)
      }
    } catch {
      // 失败 → 回退网络验证
    }
  }

  return null
}

/**
 * 从已验签的 JWT payload 提取受信用户字段
 */
function extractTrustedUser(payload: { sub?: string; email?: string; role?: string; user_metadata?: unknown }): {
  id: string
  email?: string
  role?: string
  user_metadata?: Record<string, unknown>
} {
  return {
    id: payload.sub!,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    role: typeof payload.role === 'string' ? payload.role : undefined,
    user_metadata:
      payload.user_metadata && typeof payload.user_metadata === 'object'
        ? payload.user_metadata as Record<string, unknown>
        : undefined,
  }
}

// ES256 公钥导入缓存（模块级，避免每个请求重复 importJWK）
let es256KeyPromise: Promise<CryptoKey | Uint8Array> | null = null

function getEs256Key(): Promise<CryptoKey | Uint8Array> | null {
  const jwksJson = process.env.SUPABASE_JWT_PUBLIC_JWKS
  if (!jwksJson) return null
  if (!es256KeyPromise) {
    try {
      const jwk = JSON.parse(jwksJson)?.keys?.[0]
      if (!jwk) return null
      es256KeyPromise = importJWK(jwk as JsonWebKey, 'ES256')
    } catch {
      return null
    }
  }
  return es256KeyPromise
}

/**
 * 本地 JWT 验证（零网络往返）
 *
 * 依次尝试 ES256（当前 Supabase ECC 签名）与 HS256（历史 Shared Secret），
 * 任一验证通过即返回 userId。全部失败返回 null（调用方回退网络验证）。
 *
 * 拆分为独立函数便于单元测试（测试中通过环境变量注入测试密钥）。
 */
export async function verifyTokenLocally(accessToken: string): Promise<string | null> {
  // 1) ES256：当前 Supabase 签名密钥（ECC P-256）
  const es256KeyPromiseResult = getEs256Key()
  if (es256KeyPromiseResult) {
    try {
      const { payload } = await jwtVerify(accessToken, await es256KeyPromiseResult, {
        algorithms: ['ES256'],
      })
      if (typeof payload.sub === 'string' && payload.sub) return payload.sub
    } catch {
      // 签名/过期校验失败 → 尝试其他路径
    }
  }

  // 2) HS256：历史 Shared Secret 签发的 token（保留兼容）
  const jwtSecret = process.env.SUPABASE_JWT_SECRET
  if (jwtSecret) {
    try {
      const { payload } = await jwtVerify(
        accessToken,
        new TextEncoder().encode(jwtSecret),
        { algorithms: ['HS256'] }
      )
      if (typeof payload.sub === 'string' && payload.sub) return payload.sub
    } catch {
      // 失败 → 回退网络验证
    }
  }

  return null
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

    // 网络请求设置 5 秒超时，避免悬挂请求阻塞登录/刷新流程
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    try {
      const resp = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: anonKey,
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
        signal: controller.signal,
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
    } finally {
      clearTimeout(timeout)
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

/**
 * 统一的 Session Cookie 清理函数
 *
 * 清除所有 Supabase session 相关的 cookie（主 cookie + 分片 cookie）
 * 适用于 NextResponse（middleware/route handler）和 Response（API route）
 *
 * @param response    - 响应对象（NextResponse 或 Response）
 * @param cookieNames - 当前请求中携带的 cookie 名称列表
 */
export function clearAllSessionCookies(
  response: NextResponse | Response,
  cookieNames: string[]
): void {
  const cookieName = getSupabaseCookieName()
  // 清除所有已知的 session cookie
  cookieNames.forEach(name => {
    if (name === cookieName || name.startsWith(`${cookieName}.`)) {
      // NextResponse 和 Response 的 cookie API 不同，需要兼容
      if (response instanceof NextResponse) {
        response.cookies.set(name, '', { ...SECURE_COOKIE_OPTIONS, maxAge: 0 })
      } else {
        response.headers.append(
          'Set-Cookie',
          `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
        )
      }
    }
  })
  // 也清除可能遗漏的主 cookie 及分片 cookie（兜底）
  for (let i = 0; i < 8; i++) {
    if (response instanceof NextResponse) {
      response.cookies.set(`${cookieName}.${i}`, '', { ...SECURE_COOKIE_OPTIONS, maxAge: 0 })
    }
  }
  if (response instanceof NextResponse) {
    response.cookies.set(cookieName, '', { ...SECURE_COOKIE_OPTIONS, maxAge: 0 })
  }
}
