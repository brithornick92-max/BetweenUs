-- Keep anonymous-auth blocking policies, but use the initplan-safe auth.jwt()
-- form recommended by Supabase's performance advisor.

DO $$
DECLARE
  table_name text;
  policy_sql text :=
    'AS RESTRICTIVE FOR ALL TO authenticated ' ||
    'USING (coalesce((select (auth.jwt()->>''is_anonymous'')::boolean), false) is false) ' ||
    'WITH CHECK (coalesce((select (auth.jwt()->>''is_anonymous'')::boolean), false) is false)';
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
  USING (coalesce((select (auth.jwt()->>'is_anonymous')::boolean), false) is false)
  WITH CHECK (coalesce((select (auth.jwt()->>'is_anonymous')::boolean), false) is false);
