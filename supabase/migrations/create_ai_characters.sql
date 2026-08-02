-- ============================================================
-- Migration: 龙灵工坊 - AI 角色扮演对话功能
-- 执行位置：Supabase Dashboard → SQL Editor 或 Management API
-- ============================================================

-- 1. ai_characters 表：用户的 AI 角色（每个账号可创建多个）
--    name           - AI 角色昵称（AI 的名字）
--    avatar_url     - AI 头像
--    persona        - 人设（角色性格、背景、说话风格）
--    greeting       - 开场白（进入对话时的问候语）
--    user_nickname  - 称呼（AI 对用户的称呼，如"主人""朋友"）
CREATE TABLE IF NOT EXISTS public.ai_characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 30),
  avatar_url text,
  persona text CHECK (persona IS NULL OR char_length(persona) <= 2000),
  greeting text CHECK (greeting IS NULL OR char_length(greeting) <= 300),
  user_nickname text CHECK (user_nickname IS NULL OR char_length(user_nickname) <= 20),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. ai_chat_messages 表：对话记录（按账号 + 角色保存）
CREATE TABLE IF NOT EXISTS public.ai_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.ai_characters(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL CHECK (char_length(content) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. RLS 策略：用户只能访问自己的角色和消息
ALTER TABLE public.ai_characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

-- ai_characters：用户仅可读写自己的角色
DROP POLICY IF EXISTS "ai_characters_own_all" ON public.ai_characters;
CREATE POLICY "ai_characters_own_all" ON public.ai_characters
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ai_chat_messages：用户仅可读写自己角色的消息
DROP POLICY IF EXISTS "ai_chat_messages_own_all" ON public.ai_chat_messages;
CREATE POLICY "ai_chat_messages_own_all" ON public.ai_chat_messages
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. 索引：按用户查角色、按角色查消息
CREATE INDEX IF NOT EXISTS idx_ai_characters_user_id ON public.ai_characters(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_character ON public.ai_chat_messages(character_id, created_at ASC);

-- 5. updated_at 自动更新触发器（复用已有的 update_updated_at_column 函数）
DROP TRIGGER IF EXISTS trigger_ai_characters_updated_at ON public.ai_characters;
CREATE TRIGGER trigger_ai_characters_updated_at
  BEFORE UPDATE ON public.ai_characters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 6. 角色数量限制：每个账号最多 20 个角色（防止滥用）
CREATE OR REPLACE FUNCTION prevent_excessive_ai_characters()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT count(*) FROM public.ai_characters WHERE user_id = NEW.user_id) >= 20 THEN
    RAISE EXCEPTION '每个账号最多创建 20 个角色';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_limit_ai_characters ON public.ai_characters;
CREATE TRIGGER trigger_limit_ai_characters
  BEFORE INSERT ON public.ai_characters
  FOR EACH ROW
  EXECUTE FUNCTION prevent_excessive_ai_characters();
