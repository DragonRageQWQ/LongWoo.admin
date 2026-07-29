-- ============================================================
-- Migration: 三级权限体系 - 角色重命名 + 零号用户机制
-- 执行位置：Supabase Dashboard → SQL Editor
-- ============================================================
-- 权限模型：
--   游客 (guest)   - 未登录，仅可浏览公开页面
--   普通用户 (user) - 已登录，role='user'，可管理个人信息和查看自己的订单
--   管理员 (admin)  - 已登录，role='admin'，可访问管理后台和工作台
--
-- 零号用户 (uid=10001) 是超级管理员，可授予/撤销其他用户的管理员权限
-- ============================================================

-- 1. 将现有 role='studio' 的记录更新为 'user'
UPDATE profiles SET role = 'user' WHERE role = 'studio';

-- 2. 添加 CHECK 约束，确保 role 只能是 'user' 或 'admin'
-- 先删除旧约束（如果存在）
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('user', 'admin'));

-- 3. 确保零号用户 (uid=10001) 为管理员
-- 如果 uid=10001 的用户存在但不是 admin，则提升为 admin
UPDATE profiles SET role = 'admin' WHERE uid = 10001;

-- 4. 创建管理员操作审计表
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_uid INTEGER NOT NULL,
  operator_email TEXT,
  action TEXT NOT NULL,
  target_uid INTEGER,
  target_email TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. RLS: admin_audit_log 仅允许 service_role 访问
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- 6. 创建函数：检查是否为零号用户（uid=10001）
CREATE OR REPLACE FUNCTION is_zero_user(user_uid INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN user_uid = 10001;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 7. 创建函数：检查用户是否为管理员
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role FROM profiles WHERE id = user_id;
  RETURN user_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. 更新 RLS 策略：profiles 表
-- 普通用户只能读取和修改自己的 profile
-- 管理员可以读取所有 profile（但不能直接通过 RLS 修改角色字段）

-- 删除旧策略
DROP POLICY IF EXISTS profiles_select_own ON profiles;
DROP POLICY IF EXISTS profiles_update_own ON profiles;
DROP POLICY IF EXISTS profiles_insert_own ON profiles;

-- 读取策略：用户只能读取自己的 profile
CREATE POLICY profiles_select_own ON profiles
  FOR SELECT USING (auth.uid() = id);

-- 更新策略：用户只能更新自己的 profile，且不能修改 role 字段
-- 通过触发器阻止非 admin 用户修改 role
CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- 插入策略：用户只能插入自己的 profile
CREATE POLICY profiles_insert_own ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 9. 创建触发器：阻止非管理员修改 role 字段
CREATE OR REPLACE FUNCTION prevent_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  -- 如果是 service_role（admin client），允许修改
  -- auth.uid() 在 service_role 上下文中返回 NULL
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- 普通用户尝试修改 role 字段时阻止
  IF NEW.role IS DISTINCT FROM OLD.role AND auth.uid() = OLD.id THEN
    RAISE EXCEPTION '无权修改角色权限';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_prevent_role_escalation ON profiles;
CREATE TRIGGER trigger_prevent_role_escalation
  BEFORE UPDATE OF role ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_role_escalation();

-- ============================================================
-- 注意：执行完毕后
-- 1. 所有原 'studio' 角色已变为 'user'
-- 2. uid=10001 的用户自动成为管理员
-- 3. 普通用户无法通过任何方式自行提升角色
-- 4. 角色修改只能通过 service_role（admin client）在服务端执行
-- ============================================================
