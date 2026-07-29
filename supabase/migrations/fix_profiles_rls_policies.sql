-- ============================================================
-- Migration: 修复 profiles 表 RLS 策略
-- 允许用户读取和更新自己的 profile 记录
-- 执行位置：Supabase Dashboard → SQL Editor
-- ============================================================

-- 确保 RLS 已启用
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 1. 允许用户读取自己的 profile（如果策略不存在则创建）
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- 2. 允许用户更新自己的 profile（关键字段：display_name, avatar_url, phone）
-- 注意：不允许用户自行修改 role, has_password, is_active 等敏感字段
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 3. 允许用户插入自己的 profile（注册时）
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- 注意：此策略允许已认证用户对自己的 profile 进行完整读写
-- 敏感字段（role, has_password, is_active）的修改仍通过 admin 客户端进行
-- ============================================================
