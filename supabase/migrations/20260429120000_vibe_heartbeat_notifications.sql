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
    WHEN 'vibe'          THEN notif_title := '💗 New Heartbeat';
                              notif_body  := sender_name || ' just sent a heartbeat';
    WHEN 'journal'       THEN notif_title := '📝 Journal Entry';
                              notif_body  := sender_name || ' shared a journal entry';
    WHEN 'prompt_answer' THEN notif_title := '💬 Prompt Answer';
                              notif_body  := sender_name || ' answered a prompt';
    WHEN 'check_in'      THEN notif_title := '🤗 Check-In';
                              notif_body  := sender_name || ' checked in';
    WHEN 'memory'        THEN notif_title := '📸 New Memory';
                              notif_body  := sender_name || ' shared a memory';
    ELSE                      notif_title := '💕 Between Us';
                              notif_body  := sender_name || ' shared something new';
  END CASE;

  PERFORM notify_partner(NEW.created_by, notif_title, notif_body, notif_data);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_expo_push(
  p_token text,
  p_title text,
  p_body text,
  p_data jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, extensions
AS $$
BEGIN
  PERFORM net.http_post(
    url     := 'https://exp.host/--/api/v2/push/send',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Accept',       'application/json'
    ),
    body := jsonb_build_object(
      'to',    p_token,
      'title', p_title,
      'body',  p_body,
      'sound', 'default',
      'data',  p_data
    ) || CASE
      WHEN p_data ? 'vibe_color' THEN jsonb_build_object('color', p_data->>'vibe_color')
      ELSE '{}'::jsonb
    END
  );

  INSERT INTO notification_log (recipient, token, title, body, status)
  VALUES (
    (SELECT user_id FROM push_tokens WHERE token = p_token LIMIT 1),
    p_token, p_title, p_body, 'sent'
  );

EXCEPTION WHEN OTHERS THEN
  INSERT INTO notification_log (recipient, token, title, body, status, error_msg)
  VALUES (
    (SELECT user_id FROM push_tokens WHERE token = p_token LIMIT 1),
    p_token, p_title, p_body, 'failed', SQLERRM
  );
END;
$$;
