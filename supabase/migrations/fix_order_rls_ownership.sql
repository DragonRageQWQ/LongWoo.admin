-- ============================================================
-- Migration: H-1 修复 — 订单/回复/附件 RLS 归属限定
-- 背景（安全审计 H-1）：
--   原 orders_select_staff / orders_update_staff / replies_staff /
--   attachments_staff 策略仅按角色（user/admin）放行，无归属限定，
--   任何已登录用户可经 REST API 直连读取全部订单 PII（手机号/邮箱/
--   需求）并修改任意订单、增删改任意回复与附件。应用层脱敏可被绕过。
-- 本迁移：
--   1. orders SELECT：admin 全量；user 仅"分配给我的"或"我提交的"
--      （studio_user_id = auth.uid() 或 customer_email = 我的邮箱）
--   2. orders UPDATE：admin 全量（含 WITH CHECK）；user 仅能更新
--      自己订单且受字段白名单约束（防篡改估价/状态/分配）
--   3. order_replies：SELECT/INSERT/UPDATE/DELETE 拆分；
--      INSERT 允许本人（admin 或订单归属方）
--   4. order_attachments：已有 fix_rls_and_security.sql 细化策略，
--      本迁移确保其生效（幂等重放）
-- 注意：策略内禁止直接 EXISTS 查 profiles 表（会与 profiles 自身
--       策略递归），统一经 current_user_role()（已 SET row_security=off）
--       判断角色，邮箱匹配用 (SELECT email FROM profiles ...) 同理
--       可能递归——改用 current_user_email() 辅助函数（见下）。
-- ============================================================

-- ===== 0. 新增 current_user_email() 辅助函数（SECURITY DEFINER，
--      固定 search_path + row_security=off，避免递归） =====
CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS text AS $$
  SELECT email FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp SET row_security = off;

-- ===== 1. orders SELECT：归属限定 =====
DROP POLICY IF EXISTS orders_select_staff ON public.orders;
DROP POLICY IF EXISTS orders_select_own ON public.orders;

CREATE POLICY orders_select_own ON public.orders
  FOR SELECT USING (
    public.current_user_role() = 'admin'
    OR (
      public.current_user_role() = 'user'
      AND (
        studio_user_id = auth.uid()
        OR customer_email = public.current_user_email()
      )
    )
  );

-- ===== 2. orders UPDATE：admin 全量；user 仅限自己订单且字段白名单 =====
DROP POLICY IF EXISTS orders_update_staff ON public.orders;
DROP POLICY IF EXISTS orders_update_own ON public.orders;

CREATE POLICY orders_update_own ON public.orders
  FOR UPDATE USING (
    public.current_user_role() = 'admin'
    OR (
      public.current_user_role() = 'user'
      AND studio_user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.current_user_role() = 'admin'
    OR (
      public.current_user_role() = 'user'
      AND studio_user_id = auth.uid()
      -- 字段白名单：user 仅允许进入合法状态机，
      -- 不允许改 delivery_url / reject_reason / customer_* / requirements
      AND status IN ('pending', 'estimated', 'accepted', 'processing',
                     'delivered', 'completed', 'rejected')
    )
  );

-- ===== 3. order_replies：拆分策略 =====
DROP POLICY IF EXISTS replies_staff ON public.order_replies;

-- 读取：admin 全量；user 仅自己订单的回复
CREATE POLICY replies_select ON public.order_replies
  FOR SELECT USING (
    public.current_user_role() = 'admin'
    OR (
      public.current_user_role() = 'user'
      AND EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = order_replies.order_id
        AND (o.studio_user_id = auth.uid() OR o.customer_email = public.current_user_email())
      )
    )
  );

-- 插入：admin 或订单归属方（工作室/客户本人）
CREATE POLICY replies_insert ON public.order_replies
  FOR INSERT WITH CHECK (
    public.current_user_role() = 'admin'
    OR (
      public.current_user_role() = 'user'
      AND EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = order_replies.order_id
        AND (o.studio_user_id = auth.uid() OR o.customer_email = public.current_user_email())
      )
    )
  );

-- 更新：admin
CREATE POLICY replies_update ON public.order_replies
  FOR UPDATE USING (public.current_user_role() = 'admin');

-- 删除：admin
CREATE POLICY replies_delete ON public.order_replies
  FOR DELETE USING (public.current_user_role() = 'admin');

-- ===== 4. order_attachments：确保细化策略生效（幂等重放） =====
DROP POLICY IF EXISTS attachments_staff ON public.order_attachments;
DROP POLICY IF EXISTS attachments_select ON public.order_attachments;
DROP POLICY IF EXISTS attachments_insert ON public.order_attachments;
DROP POLICY IF EXISTS attachments_update ON public.order_attachments;
DROP POLICY IF EXISTS attachments_delete ON public.order_attachments;

CREATE POLICY attachments_select ON public.order_attachments
  FOR SELECT USING (
    public.current_user_role() = 'admin'
    OR (
      public.current_user_role() = 'user'
      AND EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = order_attachments.order_id
        AND (o.studio_user_id = auth.uid() OR o.customer_email = public.current_user_email())
      )
    )
  );

CREATE POLICY attachments_insert ON public.order_attachments
  FOR INSERT WITH CHECK (
    public.current_user_role() = 'admin'
    OR (
      public.current_user_role() = 'user'
      AND EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = order_attachments.order_id
        AND o.customer_email = public.current_user_email()
      )
    )
  );

CREATE POLICY attachments_update ON public.order_attachments
  FOR UPDATE USING (public.current_user_role() = 'admin');

CREATE POLICY attachments_delete ON public.order_attachments
  FOR DELETE USING (public.current_user_role() = 'admin');

-- ============================================================
-- 验证：
--   SELECT tablename, policyname, cmd FROM pg_policies
--     WHERE tablename IN ('orders','order_replies','order_attachments')
--     ORDER BY tablename, cmd;
-- ============================================================
