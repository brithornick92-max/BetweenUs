BEGIN;

CREATE OR REPLACE FUNCTION public.notify_on_calendar_event_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notify_partner(
    NEW.created_by,
    'Your partner added something to your calendar',
    'Open Calendar to see what changed.',
    jsonb_build_object(
      'type', 'calendar_event_created',
      'route', 'calendar',
      'url', 'betweenus://calendar'
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.notification_log (token, title, body, status, error_msg)
  VALUES ('trigger_error', 'calendar_event_insert', '', 'failed', SQLERRM);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_on_calendar_event_insert() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_on_calendar_event_insert() TO service_role;

COMMIT;
