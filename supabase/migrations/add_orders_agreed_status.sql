-- ==================== 订单新增中间状态：agreed（已同意估价） ====================
--
-- 新流程：pending（待估价）→ estimated（已估价，管理员估价）
--         → agreed（已同意估价，客户在委托查询页确认估价金额）
--         → accepted（已接委托，工作室确认接单）
--         → processing → delivered → completed
--
-- 原约束不含 agreed，直接写入会违反 orders_status_check，需重建约束。

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_check,
  ADD CONSTRAINT orders_status_check CHECK (status IN (
    'pending', 'estimated', 'agreed', 'accepted', 'rejected',
    'processing', 'delivered', 'completed'
  ));
