-- ============================================================
-- Migration: RPC 函数权限收紧 + 触发器角色判断修正
-- 依据：安全审计复核（2026-08-03）
--   H1【高危】get_order_status_counts / get_daily_order_counts
--             为 SECURITY DEFINER（owner=postgres），未 REVOKE 时
--             PUBLIC/anon/authenticated 均可通过 PostgREST RPC 端点
--             直接调用，绕过 RLS 读取全平台订单统计（商业情报泄露）。
--   H2【中高】check_rate_limit 同样 SECURITY DEFINER，anon 可调用
--             向 rate_limits 表写入任意 key 记录（锁定登录 / 表膨胀）。
--   H3【中】  触发器用 auth.uid() IS NULL 判断 service_role，无法区分
--             匿名用户（anon 的 auth.uid() 同样为 NULL），语义与注释相反。
-- 执行位置：Supabase Dashboard → SQL Editor
-- ============================================================

-- ===== H1 + H2：收紧内部 RPC 执行权限 =====
-- 以下函数均为服务端（service_role admin client）或 cron 调用，
-- 不对任何外部角色开放。REVOKE 后 anon/authenticated 调用将返回
-- permission denied，彻底关闭 RPC 暴露面。
-- 注意：绝不能 REVOKE current_user_role() / is_admin() / is_zero_user()
-- 等被 RLS 策略引用的函数，否则策略评估会失败。

REVOKE ALL ON FUNCTION public.get_order_status_counts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_status_counts() TO service_role;

REVOKE ALL ON FUNCTION public.get_daily_order_counts(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_daily_order_counts(integer) TO service_role;

REVOKE ALL ON FUNCTION public.check_rate_limit(text, integer, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, bigint) TO service_role;

REVOKE ALL ON FUNCTION public.cleanup_expired_rate_limits() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_rate_limits() TO service_role;

-- generate_order_no 仅由服务端调用（/api/order/create 使用 service_role，
-- order-actions.ts 已同步改为 admin client 调用），匿名/普通用户无需直接调用。
REVOKE ALL ON FUNCTION public.generate_order_no() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_order_no() TO service_role;

-- ===== H3：触发器按角色判断，不再依赖 auth.uid() IS NULL =====
-- 原逻辑 auth.uid() IS NULL 会把匿名用户（anon 的 auth.uid() 同为 NULL）
-- 一并放行，触发器形同虚设，安全仅依赖 RLS 策略。改为显式判断角色。

-- 3.1 profiles INSERT 触发器：仅 service_role 允许创建档案
CREATE OR REPLACE FUNCTION prevent_anonymous_profile_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- 仅 service_role（admin client）可创建用户档案
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  -- 任何通过 anon/authenticated 角色的直接 INSERT 一律拒绝
  RAISE EXCEPTION '无权直接创建用户档案';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 3.2 profiles 敏感字段修改触发器：仅 service_role 可修改敏感字段
CREATE OR REPLACE FUNCTION prevent_sensitive_field_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- 仅 service_role（admin client）可修改敏感字段
  IF auth.role() = 'service_role' THEN
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

-- ============================================================
-- 执行完毕后验证：
--   1) 以 anon key 调用 rpc/get_order_status_counts 应返回 401/403
--   2) 以 anon key 调用 rpc/check_rate_limit 应返回 401/403
--   3) 管理后台数据概览（service_role 调用）仍正常
--   4) 匿名下单（/api/order/create，service_role 调用 generate_order_no）仍正常
-- ============================================================
