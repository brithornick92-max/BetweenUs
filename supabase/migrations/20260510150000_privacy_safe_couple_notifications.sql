BEGIN;

CREATE OR REPLACE FUNCTION public.notify_on_couple_data_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_name text;
  recipient_id uuid;
  recipient_label text;
  prompt_id text;
  prompt_date_key text;
  safe_id text;
  safe_date_key text;
  notif_title text;
  notif_body text;
  notif_data jsonb;
BEGIN
  IF NEW.data_type = 'couple_state' THEN
    RETURN NEW;
  END IF;

  IF lower(COALESCE(NEW.value::jsonb->>'notifyPartner', 'true')) IN ('false', '0', 'no', 'off') THEN
    RETURN NEW;
  END IF;

  SELECT NULLIF(left(btrim(regexp_replace(COALESCE(display_name, ''), '[[:space:]]+', ' ', 'g')), 40), '')
    INTO sender_name
    FROM public.profiles
   WHERE id = NEW.created_by;

  SELECT user_id
    INTO recipient_id
    FROM public.couple_members
   WHERE couple_id = NEW.couple_id
     AND user_id != NEW.created_by
   LIMIT 1;

  IF recipient_id IS NOT NULL THEN
    SELECT NULLIF(left(btrim(regexp_replace(COALESCE(preferences->>'partnerLabel', ''), '[[:space:]]+', ' ', 'g')), 40), '')
      INTO recipient_label
      FROM public.profiles
     WHERE id = recipient_id;

    IF recipient_label IS NOT NULL THEN
      sender_name := recipient_label;
    END IF;
  END IF;

  sender_name := COALESCE(sender_name, 'Your partner');
  notif_title := 'Between Us';
  notif_body := sender_name || ' shared something new.';
  notif_data := jsonb_build_object('type', NEW.data_type, 'route', 'home');

  CASE NEW.data_type
    WHEN 'moment_signal' THEN
      notif_title := sender_name || ' left a small moment';
      notif_body := 'Open Between Us when you are ready.';
      notif_data := jsonb_build_object('type', 'moment_signal', 'route', 'vibe');

    WHEN 'vibe' THEN
      notif_title := sender_name || ' left a small moment';
      notif_body := 'Open Between Us when you are ready.';
      notif_data := jsonb_build_object('type', 'vibe_sent', 'route', 'vibe');

    WHEN 'journal' THEN
      notif_title := sender_name || ' left a private note';
      notif_body := 'Open Between Us when you are ready.';
      notif_data := jsonb_build_object('type', 'journal_shared', 'route', 'journal');

    WHEN 'prompt_answer' THEN
      prompt_id := NEW.value::jsonb->>'promptId';
      prompt_date_key := NEW.value::jsonb->>'dateKey';
      safe_id := CASE
        WHEN prompt_id ~ '^[A-Za-z0-9_.:-]{1,128}$' THEN prompt_id
        ELSE NULL
      END;
      safe_date_key := CASE
        WHEN prompt_date_key ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN prompt_date_key
        ELSE NULL
      END;

      IF COALESCE(prompt_id, '') LIKE 'quiz:%' THEN
        notif_title := sender_name || ' answered the Daily Quiz';
        notif_body := 'Add yours to reveal both answers.';
        notif_data := jsonb_build_object('type', 'quiz_answered', 'route', 'quiz');
      ELSIF safe_id IS NOT NULL THEN
        notif_title := sender_name || ' answered today''s question';
        notif_body := 'A private answer is waiting. Add yours to reveal.';
        notif_data := jsonb_build_object(
          'type', 'prompt_answered',
          'route', 'prompt',
          'id', safe_id
        );

        IF safe_date_key IS NOT NULL THEN
          notif_data := notif_data || jsonb_build_object('dateKey', safe_date_key);
        END IF;
      ELSE
        notif_title := sender_name || ' answered today''s question';
        notif_body := 'A private answer is waiting. Add yours to reveal.';
        notif_data := jsonb_build_object('type', 'prompt_answered', 'route', 'prompts');
      END IF;

    WHEN 'check_in' THEN
      notif_title := sender_name || ' checked in';
      notif_body := 'Open Between Us when you are ready.';
      notif_data := jsonb_build_object('type', 'check_in', 'route', 'home');

    WHEN 'memory' THEN
      notif_title := sender_name || ' saved a moment';
      notif_body := 'Open Keepsake to see what changed.';
      notif_data := jsonb_build_object('type', 'memory_saved', 'route', 'our-story');

    WHEN 'date_plan' THEN
      notif_title := sender_name || ' picked a date idea';
      notif_body := 'Open Date Ideas to see what changed.';
      notif_data := jsonb_build_object('type', 'date_planned', 'route', 'date-ideas');

    WHEN 'whisper' THEN
      notif_title := sender_name || ' left something for you';
      notif_body := 'Open Between Us when you are ready.';
      notif_data := jsonb_build_object('type', 'whisper_shared', 'route', 'home');

    ELSE
      notif_title := 'Between Us';
      notif_body := sender_name || ' shared something new.';
      notif_data := jsonb_build_object('type', NEW.data_type, 'route', 'home');
  END CASE;

  PERFORM public.notify_partner(
    NEW.created_by,
    notif_title,
    notif_body,
    notif_data
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.notification_log (token, title, body, status, error_msg)
  VALUES ('trigger_error', 'couple_data_insert', '', 'failed', SQLERRM);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_on_couple_data_insert() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_on_couple_data_insert() TO service_role;

COMMIT;
