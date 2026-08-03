-- ============================================================
-- Migration: 通知/站内信系统
-- 设计：
--   单表 + 每用户一条记录（管理员群发时按收件人批量插入）。
--   相比"消息表+收件人表"两表方案：RLS 天然隔离（收件人只能
--   读写自己的通知）、已读状态直接更新、未读数一条 SQL。
--   当前用户规模小（个位数），存储放大可忽略；用户量增长后
--   需重构为两表方案（notifications + notification_recipients）。
-- RLS：
--   收件人 FOR ALL USING (auth.uid() = user_id)，即"只能读写
--   自己的通知"，不可伪造他人收件（WITH CHECK 强制 user_id）。
--   管理员发送通过 service_role（admin client）绕过 RLS 执行。
-- 执行位置：Supabase Dashboard → SQL Editor
-- ============================================================

-- ===== 通知表 =====
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 收件人（每用户一条）
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 发送人（管理员），null 表示系统
  sender_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- 发送时的目标群体（记录用途，用于后台历史展示）
  target_role text NOT NULL DEFAULT 'all'
    CHECK (target_role IN ('all', 'admin', 'user')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ===== 索引 =====
-- 列表查询：按收件人 + 时间倒序
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);
-- 未读数查询：收件人 + 未读
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id) WHERE is_read = false;

-- ===== RLS =====
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 收件人只能读写自己的通知（含 INSERT WITH CHECK 防伪造收件人）
DROP POLICY IF EXISTS "notifications_own_all" ON public.notifications;
CREATE POLICY "notifications_own_all" ON public.notifications
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- service_role 可全量访问（管理员发送/后台历史）
DROP POLICY IF EXISTS "notifications_service_role_all" ON public.notifications;
CREATE POLICY "notifications_service_role_all" ON public.notifications
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 验证：
--   SELECT * FROM notifications LIMIT 1;  -- 空表
-- ============================================================
