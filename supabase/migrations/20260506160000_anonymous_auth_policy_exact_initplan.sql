-- Use the exact anonymous-auth predicate shape recommended in Supabase docs.

DO $$
DECLARE
  table_name text;
  policy_sql text :=
    'AS RESTRICTIVE FOR ALL TO authenticated ' ||
    'USING ((select (auth.jwt()->>''is_anonymous'')::boolean) is false) ' ||
    'WITH CHECK ((select (auth.jwt()->>''is_anonymous'')::boolean) is false)';
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
  USING ((select (auth.jwt()->>'is_anonymous')::boolean) is false)
  WITH CHECK ((select (auth.jwt()->>'is_anonymous')::boolean) is false);
