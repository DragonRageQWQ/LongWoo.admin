-- ============================================================
-- Migration: 龙灵工坊增强 - ai_characters 增加 tone(语气风格) 列
-- 用户可随时调整 AI 的语气风格（温柔/活泼/傲娇/高冷等）
-- ============================================================

-- 添加 tone 列（可选，最多 50 字符）
ALTER TABLE public.ai_characters
  ADD COLUMN IF NOT EXISTS tone text CHECK (tone IS NULL OR char_length(tone) <= 50);
