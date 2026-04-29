BEGIN;

CREATE OR REPLACE FUNCTION public.is_user_premium()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_entitlements ue
    WHERE ue.user_id = auth.uid()
      AND ue.is_premium = true
      AND (ue.expires_at IS NULL OR ue.expires_at > now())
  );
$$;

CREATE OR REPLACE FUNCTION public.guard_profile_premium_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role'
    AND NEW.is_premium IS DISTINCT FROM OLD.is_premium
  THEN
    RAISE EXCEPTION 'profiles.is_premium is managed server-side';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_premium_fields_before_update ON public.profiles;
CREATE TRIGGER guard_profile_premium_fields_before_update
  BEFORE UPDATE OF is_premium ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_premium_fields();

COMMIT;
