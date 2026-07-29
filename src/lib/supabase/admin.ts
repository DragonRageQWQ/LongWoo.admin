import { createClient } from '@supabase/supabase-js'

/**
 * 服务端 admin 客户端（使用 service_role key）
 *
 * 绕过 RLS 策略，用于需要特权操作的场景：
 * - ensureProfileAfterLogin：客户端 OTP 验证后 cookie 未同步到服务端，
 *   普通服务端客户端无法通过 RLS 读取/写入 profiles 表
 * - QQ OAuth 回调：服务端创建用户和 profile
 *
 * 安全要求：仅可在 Server Action / Route Handler 中使用，严禁暴露到客户端
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
