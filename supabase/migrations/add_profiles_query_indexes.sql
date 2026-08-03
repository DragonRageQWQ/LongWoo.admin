-- ============================================================
-- Migration: profiles 表查询性能索引
-- 依据：用户管理加载速度优化（2026-08-03）
--   实测当前 profiles 表仅有 id 主键与 uid 唯一索引：
--     - profiles_pkey      (id)
--     - profiles_uid_unique (uid)
--   用户管理列表默认按 created_at 降序排序（无索引 → 全表排序），
--   搜索用 email/display_name ilike %kw%（无索引 → 全表扫描）。
-- 本迁移：
--   1. created_at 降序索引：加速默认排序的列表查询
--   2. 启用 pg_trgm 扩展：为 ilike '%kw%' 提供 GIN 索引支持
--   3. email / display_name 的 GIN trgm 索引：加速关键词搜索
-- 执行位置：Supabase Dashboard → SQL Editor
-- ============================================================

-- ===== 1. created_at 降序索引（用户管理默认排序） =====
DROP INDEX IF EXISTS idx_profiles_created_at_desc;
CREATE INDEX idx_profiles_created_at_desc
  ON public.profiles (created_at DESC);

-- ===== 2. 启用 pg_trgm 扩展（模糊搜索索引支持） =====
-- 注意：CREATE EXTENSION 后 GIN 索引才能使用 gin_trgm_ops
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ===== 3. email / display_name 模糊搜索 GIN 索引 =====
-- ilike '%keyword%' 无法走普通 B-tree，需 pg_trgm GIN 索引
DROP INDEX IF EXISTS idx_profiles_email_trgm;
CREATE INDEX idx_profiles_email_trgm
  ON public.profiles USING gin (email gin_trgm_ops);

DROP INDEX IF EXISTS idx_profiles_display_name_trgm;
CREATE INDEX idx_profiles_display_name_trgm
  ON public.profiles USING gin (display_name gin_trgm_ops);

-- ============================================================
-- 验证：
--   SELECT indexname FROM pg_indexes WHERE tablename = 'profiles'
--   应包含以上 4 个新索引（含 pkey 共 6 个）。
-- ============================================================
