-- ============================================================
-- Migration: 创建 rate_limits 表（速率限制基础设施）
-- 执行位置：Supabase Dashboard → SQL Editor → 运行
-- ============================================================
-- 背景：代码库中 checkRateLimit/peekRateLimit 依赖 rate_limits 表
-- 与 check_rate_limit RPC 函数，但该表未在数据库中创建，
-- 导致登录失败锁定、订单创建限流、AI 对话限流等全部失效。
--
-- 请在 Supabase Dashboard 执行本文件，然后刷新 schema cache：
--   Dashboard → Settings → API → 点击 "Reload schema cache"
-- ============================================================

-- 1. 创建 rate_limits 表
CREATE TABLE IF NOT EXISTS rate_limits (
  id BIGSERIAL PRIMARY KEY,
  key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 查询索引：key + created_at（限流计数核心查询）
CREATE INDEX IF NOT EXISTS idx_rate_limits_key_created ON rate_limits(key, created_at);
-- 清理索引：按过期时间删除旧记录
CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON rate_limits(expires_at);

-- 2. 开启 RLS 并允许 service_role 访问
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- service_role 绕过 RLS（服务端 admin client 使用）
CREATE POLICY "service_role_all" ON rate_limits
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 3. 创建清理过期记录的辅助函数（可选，供定时任务调用）
CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits() RETURNS void AS $$
BEGIN
  DELETE FROM rate_limits WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 原子速率限制 RPC 函数（解决 TOCTOU 竞态）
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key TEXT,
  p_max_count INTEGER,
  p_window_ms BIGINT
) RETURNS TABLE(allowed BOOLEAN, remaining INTEGER, reset_at BIGINT) AS $$
DECLARE
  v_count INTEGER;
  v_now_ms BIGINT;
  v_window_start_ts TIMESTAMPTZ;
BEGIN
  v_now_ms := (extract(epoch from now()) * 1000)::BIGINT;
  v_window_start_ts := to_timestamp((v_now_ms - p_window_ms) / 1000.0);

  -- 基于 key 哈希的事务级咨询锁，序列化同一 key 的并发调用
  PERFORM pg_advisory_xact_lock(hashtext(p_key));

  -- 统计窗口内的记录数
  SELECT count(*) INTO v_count
  FROM rate_limits
  WHERE key = p_key AND created_at >= v_window_start_ts;

  IF v_count >= p_max_count THEN
    RETURN QUERY SELECT false, 0, v_now_ms + p_window_ms;
    RETURN;
  END IF;

  -- 插入新记录
  INSERT INTO rate_limits (key, expires_at)
  VALUES (p_key, to_timestamp((v_now_ms + p_window_ms) / 1000.0));

  RETURN QUERY SELECT true, p_max_count - v_count - 1, v_now_ms + p_window_ms;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
