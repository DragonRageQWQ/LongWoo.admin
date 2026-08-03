-- ============================================================
-- Migration: 关闭 orders 表匿名直插（H5）
-- 依据：安全审计复核（2026-08-03 第二轮）
--   H5【中】orders_insert_anon 策略允许 anon 通过 REST 直接 INSERT
--           pending 订单，绕过应用层 CSRF / 速率限制 / 输入校验，
--           可批量灌入垃圾订单（数据污染 DoS）。
--           实测：anon 直接 POST /rest/v1/orders 返回 201 成功。
-- 修复：删除该策略。应用唯一活跃订单入口 /api/order/create
--       使用 service_role（绕过 RLS）创建订单，不受影响；
--       src/actions/order-actions.ts 的 createOrder（anon 客户端）
--       已无调用方（死代码），删除策略不影响任何活跃功能。
-- 执行位置：Supabase Dashboard → SQL Editor
-- ============================================================

DROP POLICY IF EXISTS "orders_insert_anon" ON public.orders;

-- ============================================================
-- 执行完毕后验证：
--   1) anon POST /rest/v1/orders 应返回 401/403
--   2) 匿名下单 /api/order/create（service_role）仍正常
-- ============================================================
