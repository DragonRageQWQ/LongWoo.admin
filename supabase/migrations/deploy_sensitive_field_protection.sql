-- ============================================================
-- 安全加固部署脚本：profiles 表敏感字段保护（数据库层最后防线）
--
-- 背景：实测发现普通用户可通过 Supabase API 直接修改自己的
--   uid 和 is_active 字段（攻击模拟 HTTP 204 成功）。
--   role 字段已有触发器保护，但 uid/is_active/email/has_password 无保护。
--   若零号用户 uid=10001 被删除/停用，攻击者可抢占 10001 获得超管权限。
--
-- 执行方式：Supabase Dashboard → SQL Editor → 粘贴执行
-- ============================================================

-- ===== 1. 修正版敏感字段保护触发器 =====
-- 注意：判断 service_role 必须用 auth.role() = 'service_role'，
--   不能用 auth.uid() IS NULL（匿名用户的 auth.uid() 同样为 NULL，
--   会导致匿名请求也放行——旧版 fix_rls_and_security.sql 的 bug）。
CREATE OR REPLACE FUNCTION public.prevent_sensitive_field_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 仅 service_role（服务端 admin client）可修改敏感字段
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- 普通用户/匿名用户尝试修改敏感字段时一律阻止
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
$$;

-- 删除旧触发器（旧版 + 角色提升版），创建统一的敏感字段保护
DROP TRIGGER IF EXISTS trigger_prevent_role_escalation ON profiles;
DROP TRIGGER IF EXISTS trigger_prevent_sensitive_fields ON profiles;
DROP TRIGGER IF EXISTS trigger_prevent_sensitive_field_modification ON profiles;

CREATE TRIGGER trigger_prevent_sensitive_field_modification
  BEFORE UPDATE OF role, uid, is_active, email, has_password ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_sensitive_field_modification();

-- ===== 2. 收紧 profiles UPDATE 策略（WITH CHECK 双重防线） =====
DROP POLICY IF EXISTS profiles_update_own ON profiles;

CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ===== 3. 验证（可选，执行后运行） =====
-- SELECT tgname FROM pg_trigger WHERE tgname = 'trigger_prevent_sensitive_field_modification';
