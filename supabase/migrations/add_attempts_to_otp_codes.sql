-- 添加 attempts 列到 otp_codes 表
-- 用于跟踪 OTP 验证码的尝试次数，防止暴力破解
-- 如果此列不存在，代码会降级运行（不跟踪尝试次数），但建议添加以启用完整的安全防护

ALTER TABLE otp_codes
ADD COLUMN IF NOT EXISTS attempts integer DEFAULT 0 NOT NULL;

-- 添加注释说明
COMMENT ON COLUMN otp_codes.attempts IS '验证码尝试次数，达到 OTP_MAX_ATTEMPTS 后自动删除验证码';
