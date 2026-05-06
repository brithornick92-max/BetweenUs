BEGIN;

-- Client profile writes must not be able to set premium status, but trusted
-- SECURITY DEFINER maintenance routines still need to recalculate cached
-- profile flags when a couple is unlinked or premium state changes.
CREATE OR REPLACE FUNCTION public.guard_profile_premium_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.allow_profile_premium_update', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF auth.role() <> 'service_role'
    AND NEW.is_premium IS DISTINCT FROM OLD.is_premium
  THEN
    RAISE EXCEPTION 'profiles.is_premium is managed server-side';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_profile_premium_fields() FROM PUBLIC, anon, authenticated;

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

CREATE OR REPLACE FUNCTION public.set_couple_premium(
  input_couple_id uuid,
  input_is_premium boolean,
  input_source text DEFAULT 'none'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  active_premium_user uuid;
  should_be_premium boolean;
BEGIN
  IF NOT public.is_couple_member(input_couple_id, auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: not a member of this couple';
  END IF;

  SELECT cm.user_id INTO active_premium_user
    FROM public.couple_members cm
    JOIN public.user_entitlements ue ON ue.user_id = cm.user_id
   WHERE cm.couple_id = input_couple_id
     AND ue.is_premium = true
     AND (ue.expires_at IS NULL OR ue.expires_at > now())
   ORDER BY CASE WHEN cm.user_id = auth.uid() THEN 0 ELSE 1 END, ue.updated_at DESC NULLS LAST
   LIMIT 1;

  should_be_premium := active_premium_user IS NOT NULL;

  PERFORM set_config('app.allow_profile_premium_update', 'true', true);

  UPDATE public.couples SET
    is_premium = should_be_premium,
    premium_since = CASE
      WHEN should_be_premium AND premium_since IS NULL THEN now()
      WHEN NOT should_be_premium THEN NULL
      ELSE premium_since
    END,
    premium_source = COALESCE(active_premium_user::text, 'none'),
    updated_at = now()
  WHERE id = input_couple_id;

  PERFORM set_config('app.allow_profile_premium_update', 'false', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_couple_premium(uuid, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_couple_for_qr()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  caller_id uuid;
  old_couple_id uuid;
  new_couple_id uuid;
  affected_member_ids uuid[];
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT couple_id INTO old_couple_id
    FROM public.couple_members
   WHERE user_id = caller_id
   LIMIT 1;

  IF old_couple_id IS NOT NULL THEN
    SELECT COALESCE(array_agg(user_id), ARRAY[]::uuid[]) INTO affected_member_ids
      FROM public.couple_members
     WHERE couple_id = old_couple_id;

    PERFORM public.cleanup_couple_storage_objects(old_couple_id, NULL);

    DELETE FROM public.couple_members WHERE couple_id = old_couple_id;
    DELETE FROM public.partner_link_codes WHERE couple_id = old_couple_id;
    DELETE FROM public.couples WHERE id = old_couple_id;

    PERFORM set_config('app.allow_profile_premium_update', 'true', true);

    UPDATE public.profiles SET
      is_premium = EXISTS (
        SELECT 1 FROM public.user_entitlements ue
        WHERE ue.user_id = profiles.id
          AND ue.is_premium = true
          AND (ue.expires_at IS NULL OR ue.expires_at > now())
      ),
      updated_at = now()
    WHERE id = ANY(affected_member_ids);

    PERFORM set_config('app.allow_profile_premium_update', 'false', true);
  END IF;

  INSERT INTO public.couples (created_by)
  VALUES (caller_id)
  RETURNING id INTO new_couple_id;

  INSERT INTO public.couple_members (couple_id, user_id, role)
  VALUES (new_couple_id, caller_id, 'owner');

  RETURN jsonb_build_object('success', true, 'couple_id', new_couple_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_couple_for_qr() TO authenticated;

CREATE OR REPLACE FUNCTION public.leave_couple()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  caller_id uuid;
  the_couple_id uuid;
  affected_member_ids uuid[];
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT couple_id INTO the_couple_id
    FROM public.couple_members WHERE user_id = caller_id LIMIT 1;

  IF the_couple_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'couple_id', null);
  END IF;

  SELECT COALESCE(array_agg(user_id), ARRAY[]::uuid[]) INTO affected_member_ids
    FROM public.couple_members
   WHERE couple_id = the_couple_id;

  PERFORM public.cleanup_couple_storage_objects(the_couple_id, NULL);

  DELETE FROM public.couple_members WHERE couple_id = the_couple_id;
  DELETE FROM public.partner_link_codes WHERE couple_id = the_couple_id;
  DELETE FROM public.couples WHERE id = the_couple_id;

  PERFORM set_config('app.allow_profile_premium_update', 'true', true);

  UPDATE public.profiles SET
    is_premium = EXISTS (
      SELECT 1 FROM public.user_entitlements ue
      WHERE ue.user_id = profiles.id
        AND ue.is_premium = true
        AND (ue.expires_at IS NULL OR ue.expires_at > now())
    ),
    updated_at = now()
  WHERE id = ANY(affected_member_ids);

  PERFORM set_config('app.allow_profile_premium_update', 'false', true);

  RETURN jsonb_build_object('success', true, 'couple_id', the_couple_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.leave_couple() TO authenticated;

COMMIT;
