BEGIN;

CREATE OR REPLACE FUNCTION public.notify_on_couple_data_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_name     text;
  recipient_id    uuid;
  recipient_label text;
  notif_title     text;
  notif_body      text;
  moment_type_val text;
  vibe_label_val  text;
  vibe_name_val   text;
  vibe_color_val  text;
  vibe_icon_val   text;
  vibe_emoji_val  text;
  notif_data      jsonb;
BEGIN
  IF NEW.data_type = 'couple_state' THEN RETURN NEW; END IF;

  IF lower(COALESCE(NEW.value::jsonb->>'notifyPartner', 'true')) IN ('false', '0', 'no', 'off') THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(display_name, email, 'Your partner') INTO sender_name
    FROM profiles WHERE id = NEW.created_by;

  SELECT user_id INTO recipient_id
    FROM couple_members
   WHERE couple_id = NEW.couple_id
     AND user_id  != NEW.created_by
   LIMIT 1;

  IF recipient_id IS NOT NULL THEN
    SELECT trim(preferences->>'partnerLabel') INTO recipient_label
      FROM profiles WHERE id = recipient_id;
    IF recipient_label IS NOT NULL AND length(recipient_label) > 0 THEN
      sender_name := recipient_label;
    END IF;
  END IF;

  notif_data := jsonb_build_object('type', NEW.data_type, 'couple_id', NEW.couple_id);

  CASE NEW.data_type
    WHEN 'moment_signal' THEN
      moment_type_val := NEW.value::jsonb->>'moment_type';
      vibe_label_val := COALESCE(NULLIF(NEW.value::jsonb->>'vibe_label', ''), 'passionate');
      vibe_name_val  := COALESCE(NULLIF(NEW.value::jsonb->>'vibe_name', ''), initcap(vibe_label_val));
      vibe_color_val := COALESCE(NULLIF(NEW.value::jsonb->>'vibe_color', ''), '#D2121A');
      vibe_icon_val  := COALESCE(NULLIF(NEW.value::jsonb->>'vibe_icon', ''), 'flame-outline');
      vibe_emoji_val := COALESCE(NULLIF(NEW.value::jsonb->>'vibe_emoji', ''), '🔥');
      CASE moment_type_val
        WHEN 'thinking' THEN notif_title := '💭 Thinking of You';
                             notif_body  := sender_name || ' is thinking of you';
        WHEN 'grateful' THEN notif_title := '🙏 Grateful for You';
                             notif_body  := sender_name || ' is grateful for you';
        WHEN 'missing'  THEN notif_title := '💔 Missing You';
                             notif_body  := sender_name || ' is missing you right now';
        WHEN 'proud'    THEN notif_title := '⭐ Proud of You';
                             notif_body  := sender_name || ' is so proud of you';
        WHEN 'want'     THEN notif_title := '🔥 Thinking of You';
                             notif_body  := sender_name || ' is thinking about you';
        WHEN 'love'     THEN notif_title := '❤️ Love You';
                             notif_body  := sender_name || ' loves you';
        ELSE                 notif_title := vibe_emoji_val || ' ' || vibe_name_val || ' Heartbeat';
                             notif_body  := sender_name || ' sent a ' || lower(vibe_label_val) || ' heartbeat';
      END CASE;
      notif_data := jsonb_build_object(
        'type',        'moment_signal',
        'moment_type', COALESCE(moment_type_val, 'heartbeat'),
        'vibe_id',     COALESCE(NEW.value::jsonb->>'vibe_id', vibe_label_val),
        'vibe_type',   vibe_label_val,
        'vibe_label',  vibe_label_val,
        'vibe_name',   vibe_name_val,
        'vibe_color',  vibe_color_val,
        'vibe_icon',   vibe_icon_val,
        'vibe_emoji',  vibe_emoji_val,
        'couple_id',   NEW.couple_id,
        'route',       'vibe'
      );
    WHEN 'vibe' THEN
      notif_title := '💗 New Heartbeat';
      notif_body  := sender_name || ' just sent a heartbeat';
      notif_data := jsonb_build_object('type', 'vibe_sent', 'route', 'vibe', 'couple_id', NEW.couple_id);
    WHEN 'journal' THEN
      notif_title := '📝 Journal Entry';
      notif_body  := sender_name || ' shared a journal entry';
      notif_data := jsonb_build_object(
        'type', 'journal_shared',
        'route', 'journal',
        'id', NEW.id,
        'journal_id', NEW.id,
        'couple_id', NEW.couple_id
      );
    WHEN 'prompt_answer' THEN
      IF COALESCE(NEW.value::jsonb->>'promptId', '') LIKE 'quiz:%' THEN
        notif_title := 'Daily Quiz';
        notif_body := sender_name || ' answered the Daily Quiz';
        notif_data := jsonb_build_object('type', 'quiz_answered', 'route', 'quiz', 'couple_id', NEW.couple_id);
      ELSE
        notif_title := '💬 Prompt Answer';
        notif_body := sender_name || ' answered a prompt';
        notif_data := jsonb_build_object(
          'type', 'prompt_answered',
          'route', 'prompt',
          'id', NEW.value::jsonb->>'promptId',
          'prompt_id', NEW.value::jsonb->>'promptId',
          'dateKey', NEW.value::jsonb->>'dateKey',
          'date_key', NEW.value::jsonb->>'dateKey',
          'couple_id', NEW.couple_id
        );
      END IF;
    WHEN 'check_in' THEN
      notif_title := '🤗 Check-In';
      notif_body  := sender_name || ' checked in';
      notif_data := jsonb_build_object('type', 'check_in', 'route', 'home', 'couple_id', NEW.couple_id);
    WHEN 'memory' THEN
      IF COALESCE(NEW.value::jsonb->>'type', '') = 'thinking_of_you' THEN
        notif_title := sender_name || ' left you a photo';
        notif_body := 'A private photo is waiting.';
        notif_data := jsonb_build_object('type', 'thinking_of_you_photo', 'route', 'our-story', 'couple_id', NEW.couple_id);
      ELSE
        notif_title := '📸 New Memory';
        notif_body := sender_name || ' shared a memory';
        notif_data := jsonb_build_object(
          'type', 'memory_saved',
          'route', 'our-story',
          'id', NEW.id,
          'memory_id', NEW.id,
          'couple_id', NEW.couple_id
        );
      END IF;
    ELSE
      notif_title := '💕 Between Us';
      notif_body  := sender_name || ' shared something new';
      notif_data := jsonb_build_object('type', NEW.data_type, 'route', 'home', 'couple_id', NEW.couple_id);
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

COMMIT;
