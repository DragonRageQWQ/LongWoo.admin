-- 方案 A：订单关联账号（orders.user_id）
-- 已登录用户下单时写入 user_id；"我的订单"优先按 user_id 匹配，
-- 邮箱变更/输错不再影响订单归属；旧订单/匿名订单兜底按邮箱匹配。

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);

-- RLS：登录用户可按 user_id 查询自己的订单（与现有 email/studio 策略为 OR 关系）
DROP POLICY IF EXISTS "orders_select_user_id" ON public.orders;
CREATE POLICY "orders_select_user_id" ON public.orders
  FOR SELECT
  USING (auth.role() = 'authenticated' AND user_id = auth.uid());
