-- ============================================================
-- Migration: 修复 RLS 策略冲突 + 安全加固
-- 执行位置：Supabase Dashboard → SQL Editor
-- ============================================================
-- 修复内容：
-- 1. 恢复 profiles 表 UPDATE 策略的 WITH CHECK 字段级保护
-- 2. 扩展触发器保护 uid 和 is_active 字段
-- 3. 收紧 orders 表匿名插入策略
-- 4. 细化 order_attachments 和 operation_logs 的 RLS 策略
-- ============================================================

-- ===== 1. 修复 profiles 表 UPDATE 策略 =====
-- 恢复 WITH CHECK 子句，防止用户修改 role、uid、is_active 字段
DROP POLICY IF EXISTS profiles_update_own ON profiles;

CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ===== 2. 扩展触发器：保护 uid 和 is_active 字段 =====
-- 替换原有的 prevent_role_escalation，扩展为保护所有敏感字段
CREATE OR REPLACE FUNCTION prevent_sensitive_field_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- service_role（admin client）上下文中 auth.uid() 返回 NULL，允许修改
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- 普通用户尝试修改 role 字段时阻止
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION '无权修改角色权限';
  END IF;

  -- 普通用户尝试修改 uid 字段时阻止
  IF NEW.uid IS DISTINCT FROM OLD.uid THEN
    RAISE EXCEPTION '无权修改 UID';
  END IF;

  -- 普通用户尝试修改 is_active 字段时阻止
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 删除旧触发器，创建新触发器监听所有敏感字段变更
DROP TRIGGER IF EXISTS trigger_prevent_role_escalation ON profiles;
CREATE TRIGGER trigger_prevent_sensitive_fields
  BEFORE UPDATE OF role, uid, is_active, email, has_password ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_sensitive_field_modification();

-- ===== 3. 收紧 orders 表匿名插入策略 =====
-- 仅允许插入 pending 状态、未分配工作室、无估价的新订单
DROP POLICY IF EXISTS "orders_insert_anon" ON public.orders;

CREATE POLICY "orders_insert_anon" ON public.orders
  FOR INSERT WITH CHECK (
    status = 'pending'
    AND studio_user_id IS NULL
    AND estimated_price IS NULL
    AND reject_reason IS NULL
    AND delivery_url IS NULL
  );

-- ===== 4. 细化 order_attachments RLS 策略 =====
-- 原：for all using (staff)
-- 新：SELECT/INSERT/UPDATE/DELETE 分离，普通用户仅能操作与自己订单相关的附件
DROP POLICY IF EXISTS "attachments_staff" ON public.order_attachments;

-- 读取：管理员可读所有，工作室用户可读自己订单的附件
CREATE POLICY "attachments_select" ON public.order_attachments
  FOR SELECT USING (
    public.current_user_role() = 'admin'
    OR (
      public.current_user_role() = 'user'
      AND EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = order_attachments.order_id
        AND (o.studio_user_id = auth.uid() OR o.customer_email = (
          SELECT email FROM public.profiles WHERE id = auth.uid()
        ))
      )
    )
  );

-- 插入：仅管理员
CREATE POLICY "attachments_insert" ON public.order_attachments
  FOR INSERT WITH CHECK (public.current_user_role() = 'admin');

-- 更新：仅管理员
CREATE POLICY "attachments_update" ON public.order_attachments
  FOR UPDATE USING (public.current_user_role() = 'admin');

-- 删除：仅管理员
CREATE POLICY "attachments_delete" ON public.order_attachments
  FOR DELETE USING (public.current_user_role() = 'admin');

-- ===== 5. 细化 operation_logs RLS 策略 =====
-- 原：for all using (staff)
-- 新：管理员可读写所有，工作室用户仅读取自己订单的日志
DROP POLICY IF EXISTS "logs_staff" ON public.operation_logs;

-- 读取：管理员可读所有，工作室用户可读自己订单的日志
CREATE POLICY "logs_select" ON public.operation_logs
  FOR SELECT USING (
    public.current_user_role() = 'admin'
    OR (
      public.current_user_role() = 'user'
      AND EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = operation_logs.order_id
        AND o.studio_user_id = auth.uid()
      )
    )
  );

-- 插入：管理员和工作室用户均可（记录操作日志）
CREATE POLICY "logs_insert" ON public.operation_logs
  FOR INSERT WITH CHECK (public.current_user_role() IN ('user', 'admin'));

-- 更新和删除：仅管理员
CREATE POLICY "logs_update" ON public.operation_logs
  FOR UPDATE USING (public.current_user_role() = 'admin');

CREATE POLICY "logs_delete" ON public.operation_logs
  FOR DELETE USING (public.current_user_role() = 'admin');

-- ===== 6. 添加数据库层 CHECK 约束 =====
-- 验证手机号格式
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_customer_phone_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_customer_phone_check
  CHECK (customer_phone ~ '^1[3-9][0-9]{9}$');

-- 验证邮箱格式
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_customer_email_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_customer_email_check
  CHECK (customer_email ~ '^[^@]+@[^@]+\.[^@]+$');

-- 限制文本字段长度
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_customer_name_length;
ALTER TABLE public.orders ADD CONSTRAINT orders_customer_name_length
  CHECK (length(customer_name) <= 50);

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_requirements_length;
ALTER TABLE public.orders ADD CONSTRAINT orders_requirements_length
  CHECK (length(requirements) <= 5000);
