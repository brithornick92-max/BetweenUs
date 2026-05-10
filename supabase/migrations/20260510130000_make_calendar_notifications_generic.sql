CREATE OR REPLACE FUNCTION public.notify_on_calendar_event_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_name text;
BEGIN
  SELECT COALESCE(display_name, email, 'Your partner') INTO sender_name
    FROM profiles
    WHERE id = NEW.created_by;

  PERFORM notify_partner(
    NEW.created_by,
    sender_name || ' added something to your calendar',
    'Open Calendar to see what changed.',
    jsonb_build_object(
      'type', 'calendar_event_created',
      'event_id', NEW.id,
      'couple_id', NEW.couple_id,
      'url', 'betweenus://calendar'
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO notification_log (token, title, body, status, error_msg)
  VALUES ('trigger_error', 'calendar_event_insert', '', 'failed', SQLERRM);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_on_calendar_event_insert() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_on_calendar_event_insert() TO service_role;
