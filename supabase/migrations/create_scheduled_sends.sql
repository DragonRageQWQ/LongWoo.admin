-- ============================================================
-- Migration: 定时发送任务表（通知 / 邮件）
--
-- 管理员在管理后台创建定时发送任务（北京时间），
-- Vercel Cron 每分钟扫描本表，到点执行并回写结果。
--
-- status 流转：
--   pending → sending → sent / failed
--   pending → cancelled（管理员手动取消）
--
-- 执行位置：Supabase Dashboard → SQL Editor（或 Management API）
-- ============================================================

CREATE TABLE IF NOT EXISTS public.scheduled_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 渠道：notification=站内通知，email=邮件
  channel text NOT NULL CHECK (channel IN ('notification', 'email')),
  -- 目标群体（与通知/邮件发送一致）
  target_role text NOT NULL
    CHECK (target_role IN ('all', 'admin', 'user', 'tag', 'users')),
  target_tags text[],
  target_user_ids text[],
  -- 通知标题 / 邮件主题
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  -- 计划执行时间（UTC，UI 按北京时间选择/展示）
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'cancelled')),
  -- 执行结果摘要（success/count/successCount/failedCount/error）
  result jsonb,
  created_by_uid integer,
  created_by_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  executed_at timestamptz
);

-- 到点任务扫描索引（cron 查询：pending 且 scheduled_at <= now）
CREATE INDEX IF NOT EXISTS idx_scheduled_sends_due
  ON public.scheduled_sends (status, scheduled_at)
  WHERE status = 'pending';

-- ===== RLS：仅管理员可读写；cron 执行走 service_role（admin client） =====
ALTER TABLE public.scheduled_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scheduled_sends_admin_all" ON public.scheduled_sends;
CREATE POLICY "scheduled_sends_admin_all" ON public.scheduled_sends
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ============================================================
-- 验证：
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name = 'scheduled_sends' ORDER BY ordinal_position;
-- ============================================================
