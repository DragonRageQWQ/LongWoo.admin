-- ============================================================
-- Migration: 安全审计加固（FIND-03 / 07 / 10 / 11 / 13 / 14）
-- 依据：第三方安全审计报告 2026-08-03
-- 执行位置：Supabase Dashboard → SQL Editor
-- ============================================================
-- 覆盖项：
--   FIND-03  收紧 profiles_insert_own，禁止匿名插入提权为 admin
--   FIND-07  orders/order_replies RLS 策略 'studio' → 'user'
--   FIND-10  为所有 SECURITY DEFINER 函数固定 search_path
--   FIND-11  otp_codes.code 列声明"必须存哈希"
--   FIND-13  触发器重复创建冲突（DROP IF EXISTS）+ get_order_status_counts 签名统一
--   FIND-14  ai_characters 数量上限 TOCTOU 竞态（advisory lock）
-- ============================================================

-- ===== FIND-03：收紧 profiles INSERT 策略 =====
-- 原策略仅校验 auth.uid() = id，攻击者可自注册账号后直接 REST 插入
-- role='admin' 记录完成提权。收紧为：仅允许创建自己的普通用户档案，
-- role 强制为 'user'、is_active 强制为 true、uid 必须为空（由服务端分配）。
DROP POLICY IF EXISTS profiles_insert_own ON profiles;

CREATE POLICY profiles_insert_own ON profiles
  FOR INSERT WITH CHECK (
    auth.uid() = id
    AND role = 'user'
    AND is_active = true
    AND uid IS NULL
  );

-- 同时补充 INSERT 阶段的敏感字段保护触发器：
-- 普通用户（非 service_role）尝试 INSERT 时直接拒绝，
-- profile 创建统一由服务端（getOrCreateProfile，service_role）完成。
CREATE OR REPLACE FUNCTION prevent_anonymous_profile_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- service_role（admin client）上下文中 auth.uid() 返回 NULL，允许创建
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  -- 任何通过 anon/authenticated 角色的直接 INSERT 一律拒绝
  RAISE EXCEPTION '无权直接创建用户档案';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trigger_prevent_anonymous_profile_insert ON profiles;
CREATE TRIGGER trigger_prevent_anonymous_profile_insert
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_anonymous_profile_insert();

-- ===== FIND-07：orders / order_replies 策略 'studio' → 'user' =====
-- rbac 迁移已将角色体系从 'studio' 改为 'user'，但 orders 与 replies 的
-- 旧策略仍引用 'studio'，导致普通用户 RLS 层无法读取/更新订单与回复。
-- 注意：策略必须调用 current_user_role()（已 SET row_security = off），
-- 不能使用 EXISTS 子查询直接访问 profiles——否则会触发 profiles 表的
-- SELECT 策略再次评估，造成 infinite recursion（导致订单创建 500）。
DROP POLICY IF EXISTS orders_select_staff ON public.orders;
DROP POLICY IF EXISTS orders_update_staff ON public.orders;

CREATE POLICY orders_select_staff ON public.orders
  FOR SELECT USING (public.current_user_role() IN ('user', 'admin'));

CREATE POLICY orders_update_staff ON public.orders
  FOR UPDATE USING (public.current_user_role() IN ('user', 'admin'));

DROP POLICY IF EXISTS replies_staff ON public.order_replies;

CREATE POLICY replies_staff ON public.order_replies
  FOR ALL USING (public.current_user_role() IN ('user', 'admin'));

-- ===== FIND-07b：profiles_select_admin 策略递归修复 =====
-- 原策略使用 EXISTS (SELECT 1 FROM profiles p ...) 直接访问 profiles 表，
-- 触发 profiles 的 SELECT 策略自我评估，导致 infinite recursion。
-- 改为调用已绕过 RLS 的 current_user_role()。
DROP POLICY IF EXISTS profiles_select_admin ON public.profiles;

CREATE POLICY profiles_select_admin ON public.profiles
  FOR SELECT USING (public.current_user_role() = 'admin');

-- ===== FIND-10：SECURITY DEFINER 函数固定 search_path =====
-- 未固定 search_path 的函数存在搜索路径劫持/函数替换的理论风险。
-- 逐个重建所有 SECURITY DEFINER 函数并附加 SET search_path。

-- 10.1 current_user_role（被所有 RLS 策略调用，最关键）
-- 注意：必须同时 SET row_security = off，否则函数内查询 profiles 表会再次触发
-- profiles 的 SELECT 策略（profiles_select_admin 调用本函数），造成无限递归，
-- 导致所有依赖该函数判断权限的插入/更新操作（如订单创建）报错。
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text AS $$
  select role from public.profiles where id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp SET row_security = off;

-- 10.2 is_admin
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role FROM profiles WHERE id = user_id;
  RETURN user_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 10.3 is_zero_user
CREATE OR REPLACE FUNCTION is_zero_user(user_uid INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN user_uid = 10001;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp;

-- 10.4 prevent_role_escalation / prevent_sensitive_field_modification
-- （统一重建为最新版 prevent_sensitive_field_modification 并补 search_path）
CREATE OR REPLACE FUNCTION prevent_sensitive_field_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- service_role（admin client）上下文中 auth.uid() 返回 NULL，允许修改
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION '无权修改角色权限';
  END IF;

  IF NEW.uid IS DISTINCT FROM OLD.uid THEN
    RAISE EXCEPTION '无权修改 UID';
  END IF;

  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION '无权修改激活状态';
  END IF;

  IF NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION '无权修改认证邮箱';
  END IF;

  IF NEW.has_password IS DISTINCT FROM OLD.has_password THEN
    RAISE EXCEPTION '无权修改密码状态';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- FIND-13 修复：先 DROP 再重建同名触发器，消除重复创建冲突
DROP TRIGGER IF EXISTS trigger_prevent_role_escalation ON profiles;
DROP TRIGGER IF EXISTS trigger_prevent_sensitive_fields ON profiles;
CREATE TRIGGER trigger_prevent_sensitive_fields
  BEFORE UPDATE OF role, uid, is_active, email, has_password ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_sensitive_field_modification();

-- 10.5 check_rate_limit（原子限流，已使用 advisory lock）
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

  SELECT count(*) INTO v_count
  FROM rate_limits
  WHERE key = p_key AND created_at >= v_window_start_ts;

  IF v_count >= p_max_count THEN
    RETURN QUERY SELECT false, 0, v_now_ms + p_window_ms;
    RETURN;
  END IF;

  INSERT INTO rate_limits (key, expires_at)
  VALUES (p_key, to_timestamp((v_now_ms + p_window_ms) / 1000.0));

  RETURN QUERY SELECT true, p_max_count - v_count - 1, v_now_ms + p_window_ms;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 10.6 cleanup_expired_rate_limits
CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits() RETURNS void AS $$
BEGIN
  DELETE FROM rate_limits WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 10.7 get_order_status_counts
-- FIND-13 修复：统一为 TABLE(status, count) 返回类型（与前端 StatsOverview
-- 的 row.status/row.count 消费方式一致），废弃 JSON 版本。
CREATE OR REPLACE FUNCTION get_order_status_counts()
RETURNS TABLE(status TEXT, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT o.status::TEXT, count(*)::BIGINT
  FROM orders o
  GROUP BY o.status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 10.8 get_daily_order_counts
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ===== FIND-11：otp_codes 表约束声明 =====
-- 应用层已用 SHA-256 哈希存储验证码。此处加列注释与 CHECK 约束兜底，
-- 防止未来直接存储明文验证码（长度 64 = SHA-256 hex）。
COMMENT ON COLUMN otp_codes.code IS '验证码 SHA-256 哈希（hex，64 字符）。严禁存储明文验证码。';

ALTER TABLE otp_codes DROP CONSTRAINT IF EXISTS otp_codes_code_hash_format;
ALTER TABLE otp_codes ADD CONSTRAINT otp_codes_code_hash_format
  CHECK (code ~ '^[0-9a-f]{64}$');

-- ===== FIND-14：ai_characters 数量上限 TOCTOU 竞态修复 =====
-- 原实现 count 检查无锁，并发创建可突破每账号 20 个角色的上限。
-- 使用事务级 advisory lock 按 user_id 序列化插入。
CREATE OR REPLACE FUNCTION prevent_excessive_ai_characters()
RETURNS TRIGGER AS $$
BEGIN
  -- 事务级咨询锁：按用户序列化并发插入，防止 count 检查竞态
  PERFORM pg_advisory_xact_lock(hashtext('ai_characters_limit:' || NEW.user_id));

  IF (SELECT count(*) FROM public.ai_characters WHERE user_id = NEW.user_id) >= 20 THEN
    RAISE EXCEPTION '每个账号最多创建 20 个角色';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trigger_limit_ai_characters ON public.ai_characters;
CREATE TRIGGER trigger_limit_ai_characters
  BEFORE INSERT ON public.ai_characters
  FOR EACH ROW
  EXECUTE FUNCTION prevent_excessive_ai_characters();

-- ============================================================
-- 执行完毕后：
-- 1. 匿名/已登录用户无法通过 REST 直接向 profiles 插入 admin 记录
-- 2. 普通用户可正常读取/更新自己的订单与回复（RLS 角色语义一致）
-- 3. 所有 SECURITY DEFINER 函数已固定 search_path
-- 4. OTP 验证码强制 64 位 hex 哈希格式
-- 5. AI 角色数量限制并发安全
-- ============================================================
