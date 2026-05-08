BEGIN;

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  _couple_id     uuid;
  _member_count  int;
  _partner_count int;
BEGIN
  SELECT couple_id INTO _couple_id
    FROM public.couple_members WHERE user_id = auth.uid() LIMIT 1;

  IF _couple_id IS NOT NULL THEN
    SELECT count(*) INTO _member_count
      FROM public.couple_members WHERE couple_id = _couple_id;

    IF COALESCE(_member_count, 0) <= 1 THEN
      PERFORM public.cleanup_couple_storage_objects(_couple_id, NULL);
    ELSE
      PERFORM public.cleanup_couple_storage_objects(_couple_id, auth.uid());
    END IF;

    DELETE FROM public.couple_data      WHERE couple_id = _couple_id AND created_by = auth.uid();
    DELETE FROM public.calendar_events  WHERE couple_id = _couple_id AND created_by = auth.uid();
    DELETE FROM public.moments          WHERE couple_id = _couple_id AND created_by = auth.uid();
    DELETE FROM public.couple_members   WHERE couple_id = _couple_id AND user_id    = auth.uid();

    SELECT count(*) INTO _partner_count
      FROM public.couple_members WHERE couple_id = _couple_id;

    IF _partner_count = 0 THEN
      DELETE FROM public.couple_data     WHERE couple_id = _couple_id;
      DELETE FROM public.calendar_events WHERE couple_id = _couple_id;
      DELETE FROM public.moments         WHERE couple_id = _couple_id;
      DELETE FROM public.partner_link_codes WHERE couple_id = _couple_id;
      DELETE FROM public.couples         WHERE id = _couple_id;
    ELSE
      UPDATE public.couples SET created_by = (
        SELECT user_id FROM public.couple_members WHERE couple_id = _couple_id LIMIT 1
      ) WHERE id = _couple_id AND created_by = auth.uid();
    END IF;
  END IF;

  BEGIN
    DELETE FROM public.partner_link_codes
      WHERE created_by = auth.uid()
         OR used_by = auth.uid();
  EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.date_shortlist     WHERE user_id = auth.uid();   EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.usage_events       WHERE user_id = auth.uid();   EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.user_entitlements  WHERE user_id = auth.uid();   EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.push_tokens        WHERE user_id = auth.uid();   EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.analytics_events   WHERE user_id = auth.uid();   EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.notification_log   WHERE recipient = auth.uid(); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.rate_limit_buckets WHERE user_id = auth.uid();   EXCEPTION WHEN undefined_table THEN NULL; END;

  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.delete_own_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;

COMMIT;
