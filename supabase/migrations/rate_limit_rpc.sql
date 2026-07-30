-- ============================================================
-- Migration: 原子速率限制 RPC 函数
-- 执行位置：Supabase Dashboard → SQL Editor
-- ============================================================
-- 解决 checkRateLimit 的 TOCTOU 竞态条件：
-- 原实现先查询计数再插入记录，两步之间存在窗口，
-- 并发请求可同时通过计数检查导致限流被绕过。
--
-- 本函数使用 pg_advisory_xact_lock 序列化同一 key 的并发调用，
-- 确保计数检查和记录插入在同一事务内原子完成。
-- ============================================================

CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key TEXT,
  p_max_count INTEGER,
  p_window_ms BIGINT
) RETURNS TABLE(allowed BOOLEAN, remaining INTEGER, reset_at BIGINT) AS $$
DECLARE
  v_count INTEGER;
  v_now_ts TIMESTAMPTZ;
  v_window_start_ts TIMESTAMPTZ;
  v_now_ms BIGINT;
BEGIN
  v_now_ms := (extract(epoch from now()) * 1000)::BIGINT;
  v_now_ts := now();
  v_window_start_ts := to_timestamp((v_now_ms - p_window_ms) / 1000.0);

  -- 获取基于 key 哈希的事务级咨询锁，序列化同一 key 的并发调用
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

-- ============================================================
-- 注意：执行完毕后
-- 1. check_rate_limit 函数会自动序列化同一 key 的并发请求
-- 2. 不同 key 之间不会互相阻塞（使用 hashtext 生成不同的锁 ID）
-- 3. 事务结束时咨询锁自动释放，无需手动清理
-- ============================================================
