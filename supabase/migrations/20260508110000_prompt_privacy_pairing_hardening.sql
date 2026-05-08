-- Harden partner pairing, prompt reveal privacy, and couple-scoped media.

CREATE INDEX IF NOT EXISTS couple_data_prompt_answer_status_lookup_idx
  ON public.couple_data (
    couple_id,
    created_by,
    (value->>'promptId'),
    (value->>'dateKey')
  )
  WHERE data_type = 'prompt_answer_status'
    AND COALESCE(is_deleted, false) = false;

CREATE OR REPLACE FUNCTION public.prompt_answer_value_revealed(input_value jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(COALESCE(input_value->>'isRevealed', input_value->>'is_revealed', 'false')) IN ('true', '1', 'yes', 'on')
$$;

CREATE OR REPLACE FUNCTION public.enforce_prompt_answer_privacy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.data_type <> 'prompt_answer' THEN
    RETURN NEW;
  END IF;

  IF current_setting('app.allow_prompt_answer_reveal', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD.is_private IS NOT TRUE
    AND public.prompt_answer_value_revealed(OLD.value)
  THEN
    NEW.is_private := false;
    NEW.value := jsonb_set(COALESCE(NEW.value, '{}'::jsonb), '{isRevealed}', 'true'::jsonb, true);
    IF COALESCE(NEW.value->>'revealAt', '') = '' THEN
      NEW.value := jsonb_set(NEW.value, '{revealAt}', to_jsonb(now()), true);
    END IF;
    RETURN NEW;
  END IF;

  NEW.is_private := true;
  NEW.value := jsonb_set(COALESCE(NEW.value, '{}'::jsonb), '{isRevealed}', 'false'::jsonb, true);
  NEW.value := NEW.value - 'partnerAnswer' - 'revealAt';

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_prompt_answer_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  status_key text;
  answered_at timestamptz;
BEGIN
  IF NEW.data_type <> 'prompt_answer' THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.value->>'promptId', '') = '' OR COALESCE(NEW.value->>'dateKey', '') = '' THEN
    RETURN NEW;
  END IF;

  status_key := 'prompt_answer_status:' || (NEW.value->>'promptId') || ':' || (NEW.value->>'dateKey') || ':' || NEW.created_by::text;
  answered_at := COALESCE(NEW.created_at, now());

  INSERT INTO public.couple_data (
    couple_id,
    key,
    value,
    data_type,
    created_by,
    is_private,
    is_deleted,
    deleted_at,
    created_at,
    updated_at
  )
  VALUES (
    NEW.couple_id,
    status_key,
    jsonb_build_object(
      'promptId', NEW.value->>'promptId',
      'dateKey', NEW.value->>'dateKey',
      'userId', NEW.created_by,
      'answeredAt', answered_at,
      'isRevealed', public.prompt_answer_value_revealed(NEW.value)
    ),
    'prompt_answer_status',
    NEW.created_by,
    false,
    COALESCE(NEW.is_deleted, false),
    NEW.deleted_at,
    answered_at,
    now()
  )
  ON CONFLICT (couple_id, key) DO UPDATE
  SET
    value = EXCLUDED.value,
    is_private = false,
    is_deleted = EXCLUDED.is_deleted,
    deleted_at = EXCLUDED.deleted_at,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_prompt_answer_privacy_before_write ON public.couple_data;
CREATE TRIGGER enforce_prompt_answer_privacy_before_write
  BEFORE INSERT OR UPDATE ON public.couple_data
  FOR EACH ROW EXECUTE FUNCTION public.enforce_prompt_answer_privacy();

DROP TRIGGER IF EXISTS sync_prompt_answer_status_after_write ON public.couple_data;
CREATE TRIGGER sync_prompt_answer_status_after_write
  AFTER INSERT OR UPDATE ON public.couple_data
  FOR EACH ROW EXECUTE FUNCTION public.sync_prompt_answer_status();

DO $$
BEGIN
  PERFORM set_config('app.allow_prompt_answer_reveal', 'true', true);

  UPDATE public.couple_data
  SET
    is_private = NOT public.prompt_answer_value_revealed(value),
    value = CASE
      WHEN public.prompt_answer_value_revealed(value) THEN
        jsonb_set(COALESCE(value, '{}'::jsonb), '{isRevealed}', 'true'::jsonb, true)
      ELSE
        jsonb_set(COALESCE(value, '{}'::jsonb), '{isRevealed}', 'false'::jsonb, true) - 'partnerAnswer' - 'revealAt'
    END
  WHERE data_type = 'prompt_answer'
    AND COALESCE(is_deleted, false) = false;

  PERFORM set_config('app.allow_prompt_answer_reveal', 'false', true);
END $$;

DROP FUNCTION IF EXISTS public.reveal_prompt_answer(uuid);
CREATE OR REPLACE FUNCTION public.reveal_prompt_answer(input_answer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  caller_id uuid;
  own_answer public.couple_data%rowtype;
  partner_answer public.couple_data%rowtype;
  reveal_ts timestamptz := now();
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO own_answer
    FROM public.couple_data
   WHERE id = input_answer_id
     AND data_type = 'prompt_answer'
     AND created_by = caller_id
     AND COALESCE(is_deleted, false) = false
   FOR UPDATE;

  IF own_answer.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No saved prompt answer was found.');
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.couple_members cm
     WHERE cm.couple_id = own_answer.couple_id
       AND cm.user_id = caller_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are no longer connected to this couple.');
  END IF;

  SELECT * INTO partner_answer
    FROM public.couple_data
   WHERE couple_id = own_answer.couple_id
     AND data_type = 'prompt_answer'
     AND created_by <> caller_id
     AND COALESCE(is_deleted, false) = false
     AND value->>'promptId' = own_answer.value->>'promptId'
     AND value->>'dateKey' = own_answer.value->>'dateKey'
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF partner_answer.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Partner has not answered yet.');
  END IF;

  PERFORM set_config('app.allow_prompt_answer_reveal', 'true', true);

  UPDATE public.couple_data
     SET is_private = false,
         value = jsonb_set(
           jsonb_set(COALESCE(value, '{}'::jsonb), '{isRevealed}', 'true'::jsonb, true),
           '{revealAt}',
           to_jsonb(reveal_ts),
           true
         ),
         updated_at = reveal_ts
   WHERE id IN (own_answer.id, partner_answer.id);

  PERFORM set_config('app.allow_prompt_answer_reveal', 'false', true);

  RETURN jsonb_build_object(
    'success', true,
    'prompt_id', own_answer.value->>'promptId',
    'date_key', own_answer.value->>'dateKey',
    'revealed_at', reveal_ts
  );
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('app.allow_prompt_answer_reveal', 'false', true);
  RAISE;
END;
$$;

DROP FUNCTION IF EXISTS public.get_partner_profile_summary();
CREATE OR REPLACE FUNCTION public.get_partner_profile_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  caller_id uuid;
  the_couple_id uuid;
  partner_id uuid;
  profile_row public.profiles%rowtype;
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT couple_id INTO the_couple_id
    FROM public.couple_members
   WHERE user_id = caller_id
   LIMIT 1;

  IF the_couple_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT user_id INTO partner_id
    FROM public.couple_members
   WHERE couple_id = the_couple_id
     AND user_id <> caller_id
   LIMIT 1;

  IF partner_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO profile_row
    FROM public.profiles
   WHERE id = partner_id
   LIMIT 1;

  RETURN jsonb_build_object(
    'id', partner_id,
    'user_id', partner_id,
    'display_name', profile_row.display_name,
    'displayName', profile_row.display_name,
    'name', profile_row.display_name
  );
END;
$$;

DROP FUNCTION IF EXISTS public.create_couple_for_qr(text);
DROP FUNCTION IF EXISTS public.create_couple_for_qr();
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
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Leave your current couple before creating a new invite.'
    );
  END IF;

  INSERT INTO public.couples (created_by) VALUES (caller_id)
    RETURNING id INTO new_couple_id;

  INSERT INTO public.couple_members (couple_id, user_id, role)
  VALUES (new_couple_id, caller_id, 'owner');

  RETURN jsonb_build_object('success', true, 'couple_id', new_couple_id);
END;
$$;

DROP FUNCTION IF EXISTS public.leave_couple();
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
    FROM public.couple_members
   WHERE user_id = caller_id
   LIMIT 1;

  IF the_couple_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'couple_id', null);
  END IF;

  SELECT COALESCE(array_agg(user_id), ARRAY[]::uuid[]) INTO affected_member_ids
    FROM public.couple_members
   WHERE couple_id = the_couple_id;

  PERFORM public.cleanup_couple_storage_objects(the_couple_id, NULL);
  DELETE FROM public.date_shortlist WHERE user_id = ANY(affected_member_ids);

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

DROP POLICY IF EXISTS storage_attachments_member_insert ON storage.objects;
CREATE POLICY storage_attachments_member_insert ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[2] = (select auth.uid())::text
    AND EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.user_id = (select auth.uid())
        AND cm.couple_id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS storage_attachments_member_update ON storage.objects;
CREATE POLICY storage_attachments_member_update ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'attachments'
    AND ((storage.foldername(name))[2] = (select auth.uid())::text OR owner = (select auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.user_id = (select auth.uid())
        AND cm.couple_id::text = (storage.foldername(name))[1]
    )
  )
  WITH CHECK (
    bucket_id = 'attachments'
    AND ((storage.foldername(name))[2] = (select auth.uid())::text OR owner = (select auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.user_id = (select auth.uid())
        AND cm.couple_id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS storage_attachments_member_delete ON storage.objects;
CREATE POLICY storage_attachments_member_delete ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'attachments'
    AND ((storage.foldername(name))[2] = (select auth.uid())::text OR owner = (select auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.user_id = (select auth.uid())
        AND cm.couple_id::text = (storage.foldername(name))[1]
    )
  );

REVOKE ALL ON FUNCTION public.enforce_prompt_answer_privacy() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_prompt_answer_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prompt_answer_value_revealed(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reveal_prompt_answer(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_partner_profile_summary() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_couple_for_qr() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.leave_couple() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.reveal_prompt_answer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_partner_profile_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_couple_for_qr() TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_couple() TO authenticated;
