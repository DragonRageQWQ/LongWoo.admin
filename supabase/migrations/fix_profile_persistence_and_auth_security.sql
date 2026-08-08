-- 修复普通用户 profile 持久化、OTP 尝试计数和 profiles 字段保护。
-- 可安全重复执行；生产环境应在应用代码部署前执行。

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS uid integer,
  ADD COLUMN IF NOT EXISTS has_password boolean;

UPDATE public.profiles SET has_password = false WHERE has_password IS NULL;
ALTER TABLE public.profiles ALTER COLUMN has_password SET DEFAULT false;
ALTER TABLE public.profiles ALTER COLUMN has_password SET NOT NULL;

CREATE SEQUENCE IF NOT EXISTS public.profiles_uid_seq START WITH 10001;
SELECT setval(
  'public.profiles_uid_seq',
  GREATEST(COALESCE((SELECT MAX(uid) FROM public.profiles), 10001), 10001),
  EXISTS (SELECT 1 FROM public.profiles WHERE uid IS NOT NULL)
);

CREATE OR REPLACE FUNCTION public.prepare_profile_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.uid IS NULL THEN
    NEW.uid := nextval('public.profiles_uid_seq');
  END IF;
  IF NEW.display_name IS NULL OR btrim(NEW.display_name) = '' THEN
    NEW.display_name := '新朋友' || NEW.uid::text;
  END IF;
  IF NEW.role IS NULL THEN
    NEW.role := 'user';
  END IF;
  IF NEW.is_active IS NULL THEN
    NEW.is_active := true;
  END IF;
  IF NEW.has_password IS NULL THEN
    NEW.has_password := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_generate_profile_uid ON public.profiles;
DROP TRIGGER IF EXISTS trigger_prepare_profile_defaults ON public.profiles;
CREATE TRIGGER trigger_prepare_profile_defaults
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prepare_profile_defaults();

UPDATE public.profiles
SET display_name = '新朋友' || uid::text
WHERE display_name IS NULL OR btrim(display_name) = '' OR display_name = '新用户';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND contype = 'u'
      AND conname = 'profiles_uid_unique'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_uid_unique UNIQUE (uid);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.prevent_sensitive_field_modification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- service_role 绕过 RLS，且 auth.uid() 为 NULL；允许服务端管理操作。
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.uid IS DISTINCT FROM OLD.uid
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.has_password IS DISTINCT FROM OLD.has_password THEN
    RAISE EXCEPTION '无权修改 profile 敏感字段';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_prevent_role_escalation ON public.profiles;
DROP TRIGGER IF EXISTS trigger_prevent_sensitive_fields ON public.profiles;
CREATE TRIGGER trigger_prevent_sensitive_fields
  BEFORE UPDATE OF role, uid, is_active, email, has_password ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_sensitive_field_modification();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON public.profiles;

CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

ALTER TABLE public.otp_codes
  ADD COLUMN IF NOT EXISTS attempts integer DEFAULT 0 NOT NULL;
