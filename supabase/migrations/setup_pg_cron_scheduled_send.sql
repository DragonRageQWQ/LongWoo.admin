-- ============================================================
-- Migration: pg_cron 定时发送调度（每分钟准点调用端点）
--
-- 背景：Vercel Hobby 套餐将 Cron Jobs 限制为每天最多一次，
-- 无法满足「管理员指定时间定时发送」的分钟级精度需求。
-- 方案：改用 Supabase pg_cron（本项目已启用）+ pg_net 扩展，
-- 每分钟调用 /api/cron/scheduled-send 执行到点任务；
-- Vercel Cron 保留每天一次（0 3 * * *）作为兜底。
--
-- 安全：调用端点所需 secret 存于 app_settings 表
--   （pg_cron_call_secret），由部署流程通过 Management API
--   单独写入，不进入公开仓库；端点从该表读取并校验。
--   若需重新写入：
--   UPDATE public.app_settings
--   SET value = '<随机32字节hex>', updated_at = now()
--   WHERE key = 'pg_cron_call_secret';
--
-- 执行位置：Supabase Dashboard → SQL Editor（或 Management API）
-- ============================================================

-- ===== 1) 启用 pg_net（pg_cron 已启用） =====
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ===== 2) 内部设置表（存储 pg_cron 调用 secret） =====
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_settings (key, value)
VALUES ('pg_cron_call_secret', 'pending-setup')
ON CONFLICT (key) DO NOTHING;

-- ===== 3) 每分钟调用定时发送端点（幂等重建） =====
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'scheduled-send-every-minute') THEN
    PERFORM cron.unschedule('scheduled-send-every-minute');
  END IF;
END $$;

SELECT cron.schedule(
  'scheduled-send-every-minute',
  '* * * * *',
  $cron$
  select net.http_get(
    url := 'https://www.longwoo.studio/api/cron/scheduled-send',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select value from public.app_settings where key = 'pg_cron_call_secret')
    )
  );
  $cron$
);

-- ============================================================
-- 验证：
--   SELECT jobname, schedule, command FROM cron.job;
--   SELECT * FROM public.app_settings;
-- ============================================================
