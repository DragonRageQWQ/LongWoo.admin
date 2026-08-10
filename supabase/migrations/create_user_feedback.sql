-- ============================================================
-- 建议与反馈（user_feedback）
-- 用户向管理员反馈网页问题/建议；管理员回复或采纳；
-- 用户端通过 reply_read 标记"回复是否已读"实现红标提示。
--
-- 设计说明：
--  - 单表存储反馈 + 回复（一个反馈最多一轮回复，符合"建议与反馈"轻量场景）
--  - status 流转：pending(待处理) -> replied(已回复) / adopted(已采纳)
--  - reply_read 由用户侧标记，用于个人中心红标未读数统计
--  - RLS：用户仅可读写自己的反馈；管理员走 service_role admin 客户端（项目惯例）
--
-- 执行位置：Supabase Dashboard -> SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 提交人
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 反馈类别：bug=问题反馈 suggestion=建议 other=其他
  category text NOT NULL DEFAULT 'suggestion'
    CHECK (category IN ('bug', 'suggestion', 'other')),
  -- 简短标题
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 60),
  -- 详细内容
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  -- 处理状态：pending=待处理 replied=已回复 adopted=已采纳
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'replied', 'adopted')),
  -- 管理员回复内容（未回复时为空）
  reply text,
  -- 回复人（管理员 user_id）
  replied_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  replied_at timestamptz,
  -- 用户是否已读管理员回复（红标统计依据）
  reply_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 索引：用户按时间倒序查看自己的反馈
CREATE INDEX IF NOT EXISTS idx_user_feedback_user_created
  ON public.user_feedback (user_id, created_at DESC);

-- 索引：管理员按状态/时间筛选
CREATE INDEX IF NOT EXISTS idx_user_feedback_status_created
  ON public.user_feedback (status, created_at DESC);

-- 索引：用户未读回复计数（红标）
CREATE INDEX IF NOT EXISTS idx_user_feedback_user_unread
  ON public.user_feedback (user_id) WHERE status IN ('replied', 'adopted') AND reply_read = false;

-- ==================== RLS ====================
ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

-- 用户仅可查看/插入自己的反馈；更新仅限"标记回复已读"（列级由触发器兜底，此处靠应用层白名单）
DROP POLICY IF EXISTS "user_feedback_select_own" ON public.user_feedback;
CREATE POLICY "user_feedback_select_own" ON public.user_feedback
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_feedback_insert_own" ON public.user_feedback;
CREATE POLICY "user_feedback_insert_own" ON public.user_feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 用户可更新自己的反馈，但只允许更新 reply_read（应用层白名单 + 触发器强制校验）
DROP POLICY IF EXISTS "user_feedback_update_own" ON public.user_feedback;
CREATE POLICY "user_feedback_update_own" ON public.user_feedback
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 管理员（service_role）全量访问
DROP POLICY IF EXISTS "user_feedback_service_role_all" ON public.user_feedback;
CREATE POLICY "user_feedback_service_role_all" ON public.user_feedback
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ==================== 触发器：普通用户仅允许修改 reply_read ====================
-- 防止用户通过 RLS 更新通道篡改 status/reply 等管理员字段（纵深防御）
CREATE OR REPLACE FUNCTION public.user_feedback_guard_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  -- 管理员字段一律不允许普通用户修改
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.category IS DISTINCT FROM OLD.category
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.content IS DISTINCT FROM OLD.content
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.reply IS DISTINCT FROM OLD.reply
     OR NEW.replied_by IS DISTINCT FROM OLD.replied_by
     OR NEW.replied_at IS DISTINCT FROM OLD.replied_at THEN
    RAISE EXCEPTION '无权修改反馈内容';
  END IF;
  -- reply_read 仅允许 false -> true（标记已读），禁止其他变更
  IF NEW.reply_read IS DISTINCT FROM OLD.reply_read
     AND NOT (NEW.reply_read = true AND OLD.reply_read = false) THEN
    RAISE EXCEPTION '无权修改反馈内容';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_user_feedback_guard_update ON public.user_feedback;
CREATE TRIGGER trigger_user_feedback_guard_update
  BEFORE UPDATE ON public.user_feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.user_feedback_guard_update();

-- ==================== 验证 ====================
-- SELECT * FROM pg_policies WHERE tablename = 'user_feedback';
-- SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.user_feedback'::regclass AND NOT tgisinternal;
