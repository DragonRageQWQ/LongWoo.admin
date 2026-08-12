-- 通知/邮件模板表（系统设置页管理）
-- 发送站内通知/邮件时优先读取此表，未配置时回退内置默认模板（见 src/lib/notification-templates.ts）

CREATE TABLE IF NOT EXISTS public.notification_templates (
  key text PRIMARY KEY,
  title text NOT NULL,
  content text NOT NULL,
  email_subject text NOT NULL,
  email_body text NOT NULL,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

-- 服务端（service_role）读写；客户端不直接访问
DROP POLICY IF EXISTS "service_role_all" ON public.notification_templates;
CREATE POLICY "service_role_all" ON public.notification_templates
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
