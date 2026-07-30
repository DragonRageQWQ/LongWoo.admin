-- ============================================================
-- 性能与安全优化迁移
-- 1. 添加数据库索引
-- 2. 创建速率限制表
-- 3. OTP 表增加 attempts 字段
-- ============================================================

-- ===== 1. 数据库索引 =====

-- 订单查询索引
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_studio_user_id ON orders(studio_user_id);

-- 用户表索引
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- OTP 验证码索引
CREATE INDEX IF NOT EXISTS idx_otp_codes_email_used_expires ON otp_codes(email, used, expires_at);

-- 订单回复索引
CREATE INDEX IF NOT EXISTS idx_order_replies_sender_id ON order_replies(sender_id);
CREATE INDEX IF NOT EXISTS idx_order_replies_order_id ON order_replies(order_id);

-- 操作日志索引
CREATE INDEX IF NOT EXISTS idx_operation_logs_user_id ON operation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_operation_logs_order_id ON operation_logs(order_id);

-- 订单附件索引
CREATE INDEX IF NOT EXISTS idx_order_attachments_order_id ON order_attachments(order_id);

-- ===== 2. 速率限制表 =====
CREATE TABLE IF NOT EXISTS rate_limits (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_key_created ON rate_limits(key, created_at);
CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON rate_limits(expires_at);

-- 启用 RLS
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
-- 速率限制表仅通过 service_role 访问，不创建 anon 访问策略

-- ===== 3. OTP 表增加 attempts 字段 =====
ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;

-- ===== 4. 清理过期速率限制记录的函数 =====
CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits() RETURNS void AS $$
BEGIN
  DELETE FROM rate_limits WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===== 5. 聚合统计函数（优化 getOrderStatusCounts） =====
CREATE OR REPLACE FUNCTION get_order_status_counts()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_object_agg(status, cnt) INTO result
  FROM (
    SELECT status, COUNT(*) as cnt
    FROM orders
    GROUP BY status
  ) t;
  RETURN COALESCE(result, '{}'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===== 6. 每日订单趋势聚合函数（优化 StatsOverview） =====
CREATE OR REPLACE FUNCTION get_daily_order_counts(days_back INTEGER DEFAULT 7)
RETURNS TABLE(day DATE, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(created_at) AS day,
    COUNT(*) AS count
  FROM orders
  WHERE created_at >= now() - (days_back || ' days')::INTERVAL
  GROUP BY DATE(created_at)
  ORDER BY day;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
