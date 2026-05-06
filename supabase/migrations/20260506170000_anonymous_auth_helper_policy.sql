-- Move anonymous-auth detection behind an invoker helper so restrictive RLS
-- policies stay readable and avoid per-row auth.jwt() advisor warnings.

CREATE OR REPLACE FUNCTION public.is_permanent_authenticated_user()
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE((auth.jwt()->>'is_anonymous')::boolean, false) IS FALSE;
$$;

REVOKE ALL ON FUNCTION public.is_permanent_authenticated_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_permanent_authenticated_user() TO authenticated;

DO $$
DECLARE
  table_name text;
  policy_sql text :=
    'AS RESTRICTIVE FOR ALL TO authenticated ' ||
    'USING ((select public.is_permanent_authenticated_user())) ' ||
    'WITH CHECK ((select public.is_permanent_authenticated_user()))';
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'profiles',
    'couples',
    'couple_members',
    'couple_data',
    'calendar_events',
    'moments',
    'partner_link_codes',
    'user_entitlements',
    'usage_events',
    'analytics_events',
    'push_tokens',
    'date_shortlist'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS block_anonymous_auth_users ON public.%I', table_name);
    EXECUTE format('CREATE POLICY block_anonymous_auth_users ON public.%I %s', table_name, policy_sql);
  END LOOP;
END $$;

DROP POLICY IF EXISTS block_anonymous_auth_users ON storage.objects;
CREATE POLICY block_anonymous_auth_users ON storage.objects
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((select public.is_permanent_authenticated_user()))
  WITH CHECK ((select public.is_permanent_authenticated_user()));
