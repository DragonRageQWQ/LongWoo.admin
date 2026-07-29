-- OTP 验证码存储表
-- 用于替代内存存储，支持 Serverless/多实例部署
CREATE TABLE IF NOT EXISTS otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 按邮箱查询索引
CREATE INDEX IF NOT EXISTS idx_otp_codes_email ON otp_codes(email);

-- 自动清理过期记录（pg_cron 扩展，如可用）
-- 每小时清理已过期或已使用的记录
-- 注：如 pg_cron 未启用，可通过应用层定期清理

-- RLS 策略：仅允许服务端（service_role）访问
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

-- service_role 绕过 RLS，无需额外策略
-- anon 和 authenticated 角色无任何权限
