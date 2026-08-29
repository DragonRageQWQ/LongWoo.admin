-- ============================================================
-- 用户标签（tag）体系
--
-- 标签类别（全部仅超管 uid=10001 可授予/撤销）：
--   blacklist  拉黑（软封禁）：可正常浏览网页，但禁止使用业务内容
--   ban        硬封禁：登录接口伪装超时失败，已有会话立即失效
--   testA~D    测试用户标记（灰度测试分组）
--   vip / svip 特殊用户标记（权限位，供未来业务扩展）
--
-- 使用方式：在 Supabase Dashboard → SQL Editor 中执行本文件
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.profiles.tags IS
  '用户标签：blacklist(拉黑/软封禁)、ban(硬封禁)、testA-D(测试用户)、vip/svip(特殊标记)；仅超管可修改';
