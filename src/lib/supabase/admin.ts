import { createClient, SupabaseClient } from '@supabase/supabase-js'

// 模块级单例缓存，避免每次调用都创建新的 SupabaseClient 实例
let _adminClient: SupabaseClient | null = null

/**
 * 服务端 admin 客户端（使用 service_role key）
 *
 * 绕过 RLS 策略，用于需要特权操作的场景：
 * - ensureProfileAfterLogin：客户端 OTP 验证后 cookie 未同步到服务端，
 *   普通服务端客户端无法通过 RLS 读取/写入 profiles 表
 * - QQ OAuth 回调：服务端创建用户和 profile
 *
 * 安全要求：仅可在 Server Action / Route Handler 中使用，严禁暴露到客户端
 *
 * 采用模块级单例模式：同一个进程内复用同一个客户端实例，
 * 减少重复创建带来的开销（连接池、初始化等）。
 */
export function createAdminClient() {
  if (_adminClient) return _adminClient

  _adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
  return _adminClient
}
