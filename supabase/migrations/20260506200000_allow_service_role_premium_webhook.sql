BEGIN;

-- The RevenueCat webhook runs with the service_role key and updates couples
-- directly. Keep client-side premium writes blocked while allowing that trusted
-- backend path to refresh profile premium flags through the trigger.
CREATE OR REPLACE FUNCTION public.sync_couple_premium_to_profiles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.allow_profile_premium_update', true) <> 'true'
    AND auth.role() <> 'service_role'
  THEN
    RAISE EXCEPTION 'couples.is_premium is managed server-side';
  END IF;

  UPDATE public.profiles SET
    is_premium = NEW.is_premium,
    updated_at = now()
  WHERE id IN (
    SELECT user_id FROM public.couple_members WHERE couple_id = NEW.id
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_couple_premium_to_profiles() FROM PUBLIC, anon, authenticated;

COMMIT;
