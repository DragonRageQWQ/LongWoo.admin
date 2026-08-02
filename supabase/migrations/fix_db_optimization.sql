-- ============================================================
-- Migration: 数据库优化修复
-- 执行位置：Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. 修复 rate_limits 表定义冲突
-- performance_security_optimization.sql 中的 rate_limits 表定义与 create_rate_limits_table.sql 冲突
-- 统一为 BIGSERIAL + 默认值 + RLS 策略（如果表已存在则只补齐缺失的策略）
DO $$
BEGIN
  -- 检查 expires_at 列是否有默认值，如果没有则添加
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rate_limits' AND column_name = 'expires_at'
    AND column_default IS NOT NULL
  ) THEN
    ALTER TABLE rate_limits ALTER COLUMN expires_at SET DEFAULT now();
  END IF;
END $$;

-- 确保 RLS 策略存在（如果之前没有创建）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rate_limits' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY "service_role_all" ON rate_limits
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- 2. 为 orders.updated_at 添加自动更新触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_orders_updated_at ON orders;
CREATE TRIGGER trigger_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 3. 添加复合索引 (status, created_at DESC) — 订单列表最常见查询模式
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at
  ON orders(status, created_at DESC);

-- 4. 添加其他缺失索引
CREATE INDEX IF NOT EXISTS idx_orders_service_type_id ON orders(service_type_id);
CREATE INDEX IF NOT EXISTS idx_case_items_service_type_id ON case_items(service_type_id);
CREATE INDEX IF NOT EXISTS idx_order_attachments_uploaded_by ON order_attachments(uploaded_by);

-- 5. 确保 get_order_status_counts RPC 函数存在
-- 注意：使用 o.status 表名限定，避免与 RETURNS TABLE 的 status 输出参数冲突
CREATE OR REPLACE FUNCTION get_order_status_counts()
RETURNS TABLE(status TEXT, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT o.status::TEXT, count(*)::BIGINT
  FROM orders o
  GROUP BY o.status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. 确保 get_daily_order_counts RPC 函数存在
CREATE OR REPLACE FUNCTION get_daily_order_counts(days INTEGER DEFAULT 30)
RETURNS TABLE(date DATE, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT DATE(o.created_at), count(*)::BIGINT
  FROM orders o
  WHERE o.created_at >= now() - (days || ' days')::INTERVAL
  GROUP BY DATE(o.created_at)
  ORDER BY DATE(o.created_at);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. 启用 pg_cron 扩展并配置定时清理任务
-- 注意：需要在 Supabase Dashboard → Database → Extensions 中先启用 pg_cron 扩展
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 每小时清理过期的 rate_limits 记录
SELECT cron.schedule(
  'cleanup-rate-limits',
  '0 * * * *',
  'SELECT cleanup_expired_rate_limits();'
);

-- 每小时清理过期的 otp_codes 记录
SELECT cron.schedule(
  'cleanup-otp-codes',
  '0 * * * *',
  'DELETE FROM otp_codes WHERE expires_at < now();'
);

-- 每天清理30天前的 operation_logs
SELECT cron.schedule(
  'cleanup-operation-logs',
  '0 3 * * *',
  'DELETE FROM operation_logs WHERE created_at < now() - INTERVAL ''30 days'';'
);

-- 8. 清理重复的触发器函数定义
-- 确保 prevent_sensitive_field_modification 只保留最新版本
-- （这个函数在多个迁移文件中重复定义，CREATE OR REPLACE 会自动覆盖）
