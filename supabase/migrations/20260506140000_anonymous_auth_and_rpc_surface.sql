-- Further reduce exposed RPC surface and block Supabase anonymous-auth users
-- from private app tables. Anonymous-auth users receive the authenticated role,
-- so restrictive policies are needed when anonymous sign-ins are enabled.

CREATE OR REPLACE FUNCTION public.is_couple_member(couple_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM public.couple_members
    WHERE couple_id = couple_uuid AND user_id = user_uuid
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_user_premium()
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_entitlements ue
    WHERE ue.user_id = auth.uid()
      AND ue.is_premium = true
      AND (ue.expires_at IS NULL OR ue.expires_at > now())
  );
$$;

CREATE OR REPLACE FUNCTION public.user_data_count(p_couple_id uuid, p_data_type text)
RETURNS bigint
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
  SELECT count(*) FROM public.couple_data
  WHERE couple_id = p_couple_id
    AND data_type = p_data_type
    AND created_by = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_couple_premium_status(input_couple_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_couple_member(input_couple_id, auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: not a member of this couple';
  END IF;

  SELECT jsonb_build_object(
    'is_premium', COALESCE(c.is_premium, false),
    'premium_since', c.premium_since,
    'premium_source', COALESCE(c.premium_source, 'none')
  ) INTO result
  FROM public.couples c
  WHERE c.id = input_couple_id;

  RETURN COALESCE(result, '{"is_premium": false, "premium_source": "none"}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_daily_usage_count(
  input_couple_id uuid,
  input_user_id uuid,
  input_event_type text,
  input_day_key text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_couple_member(input_couple_id, auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: not a member of this couple';
  END IF;

  RETURN (
    SELECT count(*)::integer FROM public.usage_events
    WHERE couple_id = input_couple_id AND user_id = input_user_id
      AND local_day_key = input_day_key
      AND (
        event_type = input_event_type
        OR (input_event_type = 'prompt_viewed' AND event_type = 'prompts')
        OR (input_event_type = 'date_idea_viewed' AND event_type = 'dates')
      )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_calendar_event_if_member(p_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _couple_id uuid;
BEGIN
  SELECT ce.couple_id
    INTO _couple_id
  FROM public.calendar_events ce
  WHERE ce.id = p_event_id;

  IF _couple_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.couple_members m
    WHERE m.couple_id = _couple_id
      AND m.user_id = auth.uid()
  ) THEN
    RETURN false;
  END IF;

  DELETE FROM public.calendar_events
  WHERE id = p_event_id;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.couple_has_premium(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_partner(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.delete_calendar_event_if_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_couple_premium_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_daily_usage_count(uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_couple_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_premium() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_data_count(uuid, text) TO authenticated;

DROP POLICY IF EXISTS block_anonymous_auth_users ON public.profiles;
CREATE POLICY block_anonymous_auth_users ON public.profiles
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((select coalesce((auth.jwt()->>'is_anonymous')::boolean, false)) is false)
  WITH CHECK ((select coalesce((auth.jwt()->>'is_anonymous')::boolean, false)) is false);

DROP POLICY IF EXISTS block_anonymous_auth_users ON public.couples;
CREATE POLICY block_anonymous_auth_users ON public.couples
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((select coalesce((auth.jwt()->>'is_anonymous')::boolean, false)) is false)
  WITH CHECK ((select coalesce((auth.jwt()->>'is_anonymous')::boolean, false)) is false);

DROP POLICY IF EXISTS block_anonymous_auth_users ON public.couple_members;
CREATE POLICY block_anonymous_auth_users ON public.couple_members
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((select coalesce((auth.jwt()->>'is_anonymous')::boolean, false)) is false)
  WITH CHECK ((select coalesce((auth.jwt()->>'is_anonymous')::boolean, false)) is false);

DROP POLICY IF EXISTS block_anonymous_auth_users ON public.couple_data;
CREATE POLICY block_anonymous_auth_users ON public.couple_data
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((select coalesce((auth.jwt()->>'is_anonymous')::boolean, false)) is false)
  WITH CHECK ((select coalesce((auth.jwt()->>'is_anonymous')::boolean, false)) is false);

DROP POLICY IF EXISTS block_anonymous_auth_users ON public.calendar_events;
CREATE POLICY block_anonymous_auth_users ON public.calendar_events
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((select coalesce((auth.jwt()->>'is_anonymous')::boolean, false)) is false)
  WITH CHECK ((select coalesce((auth.jwt()->>'is_anonymous')::boolean, false)) is false);

DROP POLICY IF EXISTS block_anonymous_auth_users ON public.moments;
CREATE POLICY block_anonymous_auth_users ON public.moments
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((select coalesce((auth.jwt()->>'is_anonymous')::boolean, false)) is false)
  WITH CHECK ((select coalesce((auth.jwt()->>'is_anonymous')::boolean, false)) is false);

DROP POLICY IF EXISTS block_anonymous_auth_users ON public.partner_link_codes;
CREATE POLICY block_anonymous_auth_users ON public.partner_link_codes
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((select coalesce((auth.jwt()->>'is_anonymous')::boolean, false)) is false)
  WITH CHECK ((select coalesce((auth.jwt()->>'is_anonymous')::boolean, false)) is false);

DROP POLICY IF EXISTS block_anonymous_auth_users ON public.user_entitlements;
CREATE POLICY block_anonymous_auth_users ON public.user_entitlements
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((select coalesce((auth.jwt()->>'is_anonymous')::boolean, false)) is false)
  WITH CHECK ((select coalesce((auth.jwt()->>'is_anonymous')::boolean, false)) is false);

DROP POLICY IF EXISTS block_anonymous_auth_users ON public.usage_events;
CREATE POLICY block_anonymous_auth_users ON public.usage_events
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((select coalesce((auth.jwt()->>'is_anonymous')::boolean, false)) is false)
  WITH CHECK ((select coalesce((auth.jwt()->>'is_anonymous')::boolean, false)) is false);

DROP POLICY IF EXISTS block_anonymous_auth_users ON public.analytics_events;
CREATE POLICY block_anonymous_auth_users ON public.analytics_events
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((select coalesce((auth.jwt()->>'is_anonymous')::boolean, false)) is false)
  WITH CHECK ((select coalesce((auth.jwt()->>'is_anonymous')::boolean, false)) is false);

DROP POLICY IF EXISTS block_anonymous_auth_users ON public.push_tokens;
CREATE POLICY block_anonymous_auth_users ON public.push_tokens
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((select coalesce((auth.jwt()->>'is_anonymous')::boolean, false)) is false)
  WITH CHECK ((select coalesce((auth.jwt()->>'is_anonymous')::boolean, false)) is false);

DROP POLICY IF EXISTS block_anonymous_auth_users ON public.date_shortlist;
CREATE POLICY block_anonymous_auth_users ON public.date_shortlist
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((select coalesce((auth.jwt()->>'is_anonymous')::boolean, false)) is false)
  WITH CHECK ((select coalesce((auth.jwt()->>'is_anonymous')::boolean, false)) is false);

DROP POLICY IF EXISTS block_anonymous_auth_users ON storage.objects;
CREATE POLICY block_anonymous_auth_users ON storage.objects
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((select coalesce((auth.jwt()->>'is_anonymous')::boolean, false)) is false)
  WITH CHECK ((select coalesce((auth.jwt()->>'is_anonymous')::boolean, false)) is false);
