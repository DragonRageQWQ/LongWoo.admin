-- ============================================================
-- Migration: notifications 批次标识（batch_id）
-- 背景：
--   notifications 是"每用户一条记录"的单表。超管需要按"已发送
--   公告"维度统一修改/删除（覆盖所有收件人记录），因此新增
--   batch_id 批次标识：同一次群发的所有收件人记录共享同一值。
-- 修改（静默）：按 batch_id 更新 title/content，不动 is_read/read_at
-- 删除：按 batch_id 删除该批次全部记录
-- 执行位置：Supabase Dashboard → SQL Editor
-- ============================================================

-- ===== 1. 新增 batch_id 列（可空，兼容旧数据） =====
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS batch_id uuid;

-- ===== 2. 批次查询索引（超管按批次修改/删除） =====
CREATE INDEX IF NOT EXISTS idx_notifications_batch_id
  ON public.notifications (batch_id);

-- ===== 3. 历史数据回填：按（发送人 + 标题 + 发送时间）分组生成 batch_id
--      同批次群发记录 created_at 相同（代码传入统一时间戳），
--      故该分组可精确还原历史批次。
DO $$
DECLARE
  grp RECORD;
BEGIN
  FOR grp IN
    SELECT sender_user_id, title, created_at
    FROM public.notifications
    WHERE batch_id IS NULL
    GROUP BY sender_user_id, title, created_at
  LOOP
    UPDATE public.notifications
    SET batch_id = gen_random_uuid()
    WHERE sender_user_id = grp.sender_user_id
      AND title = grp.title
      AND created_at = grp.created_at
      AND batch_id IS NULL;
  END LOOP;
END $$;

-- ============================================================
-- 验证：
--   SELECT batch_id, count(*) FROM notifications GROUP BY batch_id;
--   应无 batch_id IS NULL 的记录。
-- ============================================================
