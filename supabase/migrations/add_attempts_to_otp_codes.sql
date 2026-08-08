-- 添加 attempts 列到 otp_codes 表
-- 用于跟踪 OTP 验证码的尝试次数，防止暴力破解
-- 此列是认证安全必需字段；应用不会在缺失时降级运行。

DO $$
BEGIN
  -- 兼容当前仓库非时间戳文件名的排序：表尚未创建时由后续修复迁移补齐。
  IF to_regclass('public.otp_codes') IS NOT NULL THEN
    ALTER TABLE public.otp_codes
      ADD COLUMN IF NOT EXISTS attempts integer DEFAULT 0 NOT NULL;
    COMMENT ON COLUMN public.otp_codes.attempts IS
      '验证码尝试次数，达到 OTP_MAX_ATTEMPTS 后自动删除验证码';
  END IF;
END $$;
