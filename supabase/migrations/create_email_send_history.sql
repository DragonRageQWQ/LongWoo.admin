-- ============================================================
-- Migration: 邮件发送历史 + 通知目标群体扩展
--
-- 1) 新增 email_send_history 表（管理后台「邮件发送历史」，
--    每次广播记录一条，含成功/失败计数）
-- 2) notifications.target_role 检查约束扩展支持 'tag' / 'users'
-- 3) notifications 增加 target_tags / target_user_ids 列，
--    供发送历史展示"指定 tag 成员 / 指定成员"的具体对象
--
-- 执行位置：Supabase Dashboard → SQL Editor（或 Management API）
-- ============================================================

-- ===== 1) 邮件发送历史表 =====
CREATE TABLE IF NOT EXISTS public.email_send_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL,
  subject text NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 100),
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  target_role text NOT NULL DEFAULT 'all'
    CHECK (target_role IN ('all', 'admin', 'user', 'tag', 'users')),
  target_tags text[],
  target_user_ids text[],
  recipient_count integer NOT NULL DEFAULT 0,
  success_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  sender_uid integer,
  sender_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 列表查询：按时间倒序
CREATE INDEX IF NOT EXISTS idx_email_history_created
  ON public.email_send_history (created_at DESC);

-- ===== RLS：仅管理员可读；写入走 service_role（admin client） =====
ALTER TABLE public.email_send_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_history_admin_read" ON public.email_send_history;
CREATE POLICY "email_history_admin_read" ON public.email_send_history
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "email_history_service_role_all" ON public.email_send_history;
CREATE POLICY "email_history_service_role_all" ON public.email_send_history
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ===== 2) notifications.target_role 约束扩展（支持 tag/users） =====
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_target_role_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_target_role_check
  CHECK (target_role IN ('all', 'admin', 'user', 'tag', 'users'));

-- ===== 3) notifications 增加目标明细列 =====
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS target_tags text[];
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS target_user_ids text[];

-- ============================================================
-- 验证：
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name = 'email_send_history' ORDER BY ordinal_position;
--   \d notifications  -- 确认 target_role 约束与新增列
-- ============================================================
