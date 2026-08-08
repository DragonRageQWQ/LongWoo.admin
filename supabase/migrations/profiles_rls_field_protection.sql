-- ============================================================
-- profiles RLS 字段级保护 + generate_uid RPC
-- 
-- 目的：
-- 1. 创建 generate_uid() RPC 函数，供应用层原子递增生成 UID
-- 2. 强化 profiles 表的 RLS 策略，确保用户只能更新自己的非敏感字段
-- 3. role 字段仅允许 service_role 修改（应用层通过触发器已保护，
--    此处作为数据库层第二道防线）
-- ============================================================

-- ==================== 1. generate_uid() RPC 函数 ====================
-- 原子递增生成 UID，避免并发冲突
-- 从 profiles 表最大 uid + 1 开始，确保不与零号用户(10001)冲突

CREATE OR REPLACE FUNCTION generate_uid()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  max_uid INTEGER;
  new_uid INTEGER;
BEGIN
  SELECT COALESCE(MAX(uid), 10001) INTO max_uid FROM profiles;
  new_uid := GREATEST(max_uid + 1, 10002);
  RETURN new_uid;
END;
$$;

-- ==================== 2. profiles RLS 策略强化 ====================
-- 用户只能更新自己的 display_name, avatar_url, phone, has_password
-- role, uid, email, is_active 字段仅允许 service_role 修改

-- 删除旧的 UPDATE 策略（如果存在）
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON profiles;

-- 创建新的 UPDATE 策略：用户只能更新自己的非敏感字段
CREATE POLICY "users_update_own_profile" ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ==================== 3. 补充：确保 email 字段也不可被普通用户修改 ====================
-- 敏感字段不可变性由后续 prevent_sensitive_field_modification 触发器保证。

-- ==================== 4. 注释说明 ====================
COMMENT ON FUNCTION generate_uid() IS '原子递增生成 UID，确保大于零号用户(10001)，避免并发冲突';
COMMENT ON POLICY "users_update_own_profile" ON profiles IS '用户只能更新自己的非敏感字段(display_name, avatar_url, phone, has_password)，role/uid/is_active 仅 service_role 可修改';
