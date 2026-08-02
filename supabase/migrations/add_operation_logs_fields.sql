-- 为 operation_logs 表添加通用日志字段
--
-- 配合 src/lib/server-utils.ts 的 logOperation() 函数使用。
-- 原有 order_id / details 列保留不变（向后兼容），新增以下列：
--   target_type - 操作目标类型（如 'order'）
--   target_id   - 操作目标 ID
--   detail      - 附加详情（jsonb）
--   ip          - 操作者客户端 IP
--
-- 所有新列均可为 NULL，不影响现有数据与写入逻辑。

ALTER TABLE public.operation_logs
  ADD COLUMN IF NOT EXISTS target_type text,
  ADD COLUMN IF NOT EXISTS target_id uuid,
  ADD COLUMN IF NOT EXISTS detail jsonb,
  ADD COLUMN IF NOT EXISTS ip text;

-- 为按目标查询日志添加索引
CREATE INDEX IF NOT EXISTS idx_logs_target ON public.operation_logs(target_type, target_id);
