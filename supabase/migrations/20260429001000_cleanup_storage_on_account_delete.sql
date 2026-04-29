BEGIN;

CREATE OR REPLACE FUNCTION public.cleanup_couple_storage_objects(
  input_couple_id uuid,
  input_owner uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
SET row_security = off
AS $$
BEGIN
  IF input_couple_id IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM storage.objects
  WHERE bucket_id = 'couple-media'
    AND (storage.foldername(name))[1] = 'couples'
    AND (storage.foldername(name))[2] = input_couple_id::text
    AND (input_owner IS NULL OR owner = input_owner);

  DELETE FROM storage.objects
  WHERE bucket_id IN ('attachments', 'whispers')
    AND (storage.foldername(name))[1] = input_couple_id::text
    AND (input_owner IS NULL OR owner = input_owner);
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_couple_storage_objects(uuid, uuid) FROM PUBLIC;

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
    FROM couple_members
   WHERE user_id = caller_id
   LIMIT 1;

  IF old_couple_id IS NOT NULL THEN
    SELECT COALESCE(array_agg(user_id), ARRAY[]::uuid[]) INTO affected_member_ids
      FROM couple_members
     WHERE couple_id = old_couple_id;

    PERFORM public.cleanup_couple_storage_objects(old_couple_id, NULL);

    DELETE FROM couple_members WHERE couple_id = old_couple_id;
    DELETE FROM partner_link_codes WHERE couple_id = old_couple_id;
    DELETE FROM couples WHERE id = old_couple_id;

    UPDATE profiles SET
      is_premium = EXISTS (
        SELECT 1 FROM user_entitlements ue
        WHERE ue.user_id = profiles.id
          AND ue.is_premium = true
          AND (ue.expires_at IS NULL OR ue.expires_at > now())
      ),
      updated_at = now()
    WHERE id = ANY(affected_member_ids);
  END IF;

  INSERT INTO couples (created_by)
  VALUES (caller_id)
  RETURNING id INTO new_couple_id;

  INSERT INTO couple_members (couple_id, user_id, role)
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
    FROM couple_members WHERE user_id = caller_id LIMIT 1;

  IF the_couple_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'couple_id', null);
  END IF;

  SELECT COALESCE(array_agg(user_id), ARRAY[]::uuid[]) INTO affected_member_ids
    FROM couple_members
   WHERE couple_id = the_couple_id;

  PERFORM public.cleanup_couple_storage_objects(the_couple_id, NULL);

  DELETE FROM couple_members WHERE couple_id = the_couple_id;
  DELETE FROM partner_link_codes WHERE couple_id = the_couple_id;
  DELETE FROM couples WHERE id = the_couple_id;

  UPDATE profiles SET
    is_premium = EXISTS (
      SELECT 1 FROM user_entitlements ue
      WHERE ue.user_id = profiles.id
        AND ue.is_premium = true
        AND (ue.expires_at IS NULL OR ue.expires_at > now())
    ),
    updated_at = now()
  WHERE id = ANY(affected_member_ids);

  RETURN jsonb_build_object('success', true, 'couple_id', the_couple_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.leave_couple() TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  _couple_id uuid;
  _member_count int;
  _partner_count int;
BEGIN
  SELECT couple_id INTO _couple_id
    FROM couple_members WHERE user_id = auth.uid() LIMIT 1;

  IF _couple_id IS NOT NULL THEN
    SELECT count(*) INTO _member_count
      FROM couple_members WHERE couple_id = _couple_id;

    IF COALESCE(_member_count, 0) <= 1 THEN
      PERFORM public.cleanup_couple_storage_objects(_couple_id, NULL);
    ELSE
      PERFORM public.cleanup_couple_storage_objects(_couple_id, auth.uid());
    END IF;

    DELETE FROM couple_data      WHERE couple_id = _couple_id AND created_by = auth.uid();
    DELETE FROM calendar_events  WHERE couple_id = _couple_id AND created_by = auth.uid();
    DELETE FROM moments          WHERE couple_id = _couple_id AND created_by = auth.uid();
    DELETE FROM couple_members   WHERE couple_id = _couple_id AND user_id    = auth.uid();
    SELECT count(*) INTO _partner_count
      FROM couple_members WHERE couple_id = _couple_id;
    IF _partner_count = 0 THEN
      DELETE FROM couple_data     WHERE couple_id = _couple_id;
      DELETE FROM calendar_events WHERE couple_id = _couple_id;
      DELETE FROM moments         WHERE couple_id = _couple_id;
      DELETE FROM partner_link_codes WHERE couple_id = _couple_id;
      DELETE FROM couples         WHERE id = _couple_id;
    ELSE
      UPDATE couples SET created_by = (
        SELECT user_id FROM couple_members WHERE couple_id = _couple_id LIMIT 1
      ) WHERE id = _couple_id AND created_by = auth.uid();
    END IF;
  END IF;

  BEGIN DELETE FROM partner_link_codes WHERE created_by = auth.uid(); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM usage_events       WHERE user_id = auth.uid();   EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM user_entitlements   WHERE user_id = auth.uid();   EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM push_tokens        WHERE user_id = auth.uid();   EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM analytics_events   WHERE user_id = auth.uid();   EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM notification_log   WHERE recipient = auth.uid(); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM rate_limit_buckets WHERE user_id = auth.uid();   EXCEPTION WHEN undefined_table THEN NULL; END;

  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;

COMMIT;
