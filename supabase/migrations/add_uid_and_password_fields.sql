-- ============================================================
-- Migration: 为 profiles 表添加 uid 和 has_password 字段
-- 执行位置：Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. 添加 uid 字段（用户唯一数字标识，用于展示和操作）
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS uid INTEGER;

-- 2. 添加 has_password 字段（标记用户是否已设置密码）
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_password BOOLEAN DEFAULT FALSE;

-- 3. 为已有用户生成 uid（基于序列，从 10001 开始）
-- 创建序列
CREATE SEQUENCE IF NOT EXISTS profiles_uid_seq START 10001;

-- 为 uid 为 NULL 的记录生成 uid
UPDATE profiles
SET uid = nextval('profiles_uid_seq')
WHERE uid IS NULL;

-- 4. 将 uid 设为唯一约束
ALTER TABLE profiles ADD CONSTRAINT profiles_uid_unique UNIQUE (uid);

-- 5. 创建触发器：新记录自动生成 uid
CREATE OR REPLACE FUNCTION generate_profile_uid()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.uid IS NULL THEN
    NEW.uid := nextval('profiles_uid_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_profile_uid ON profiles;
CREATE TRIGGER trigger_generate_profile_uid
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION generate_profile_uid();

-- 6. 将默认昵称未设置的用户更新为 "新朋友+uid"
UPDATE profiles
SET display_name = '新朋友' || uid::text
WHERE display_name = '新用户' OR display_name IS NULL OR display_name = '';

-- ============================================================
-- 注意：执行完毕后，新用户注册时会自动获得 uid 和默认昵称
-- ============================================================
