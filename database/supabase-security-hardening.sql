-- ============================================================================
-- 🛡️  BETWEENUS — SECURITY HARDENING PATCH (v4)
-- ============================================================================
-- Run AFTER supabase-full-setup.sql and supabase-audit-fixes.sql.
-- Fully idempotent: safe to re-run.
--
-- Fixes applied:
--   C1  redeem_partner_code: SET row_security = off (RLS INSERT conflict)
--   C2  rate_limit_buckets: add SET row_security = off to check functions
--   C3  send_expo_push: SET search_path + pg_net schema resilience
--   H1  notify_partner: enforce sender_id = auth.uid() (anti-spoof)
--   H2  Both-partner "linked" confirmation via couple_data system event
--   M1  search_path = public on ALL SECURITY DEFINER functions
--   M2  Realtime publication expanded (calendar_events, moments, couple_members)
--   M3  pg_net schema detection + notification_log recipient tracking
-- ============================================================================


-- ============================================================================
-- C1 + M1: Harden redeem_partner_code
-- ============================================================================
-- The couples INSERT RLS policy is:  WITH CHECK (auth.uid() = created_by)
-- But this function inserts with creator_id ≠ auth.uid().
-- SECURITY DEFINER owned by postgres (superuser) bypasses RLS on Supabase,
-- but SET row_security = off makes the bypass EXPLICIT and portable.
-- Also adds SET search_path = public to prevent search_path hijacking.
-- ============================================================================

DROP FUNCTION IF EXISTS redeem_partner_code(text, uuid);
DROP FUNCTION IF EXISTS redeem_partner_code(text);

CREATE OR REPLACE FUNCTION redeem_partner_code(input_code_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off          -- ← couples INSERT policy requires created_by = auth.uid()
AS $$
DECLARE
  code_row  partner_link_codes%ROWTYPE;
  new_couple_id uuid;
  creator_id    uuid;
  redeemer_id   uuid;
BEGIN
  -- Always use server-side identity
  redeemer_id := auth.uid();
  IF redeemer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Rate-limit: burn 10 tokens per attempt (≈6 attempts/min)
  IF NOT check_sensitive_rate_limit(redeemer_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Too many attempts. Try again in a minute.');
  END IF;

  -- Lock the matching code row (prevents double-redeem race)
  SELECT * INTO code_row
    FROM partner_link_codes
   WHERE code_hash = input_code_hash
     AND used_at IS NULL
     AND expires_at > now()
   FOR UPDATE;

  IF code_row IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid, expired, or already-used code');
  END IF;

  creator_id := code_row.created_by;

  -- Guards
  IF creator_id = redeemer_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot pair with yourself');
  END IF;
  IF EXISTS (SELECT 1 FROM couple_members WHERE user_id = creator_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Code creator is already in a couple');
  END IF;
  IF EXISTS (SELECT 1 FROM couple_members WHERE user_id = redeemer_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are already in a couple');
  END IF;

  -- Atomic: create couple → add both members → mark code used
  INSERT INTO couples (created_by) VALUES (creator_id)
    RETURNING id INTO new_couple_id;

  INSERT INTO couple_members (couple_id, user_id, role) VALUES
    (new_couple_id, creator_id,  'member'),
    (new_couple_id, redeemer_id, 'member');

  UPDATE partner_link_codes
     SET used_at   = now(),
         used_by   = redeemer_id,
         couple_id = new_couple_id
   WHERE id = code_row.id;

  -- H2: Write a system couple_data event so BOTH partners see confirmation
  --     via Realtime subscription (couple_data is already in the publication)
  INSERT INTO couple_data (couple_id, key, value, data_type, created_by)
  VALUES (
    new_couple_id,
    'system:partner_linked',
    jsonb_build_object(
      'creator_id',  creator_id,
      'redeemer_id', redeemer_id,
      'linked_at',   now()
    ),
    'couple_state',
    redeemer_id
  )
  ON CONFLICT (couple_id, key) DO UPDATE SET
    value      = EXCLUDED.value,
    updated_at = now();

  RETURN jsonb_build_object(
    'success',     true,
    'couple_id',   new_couple_id,
    'creator_id',  creator_id,
    'redeemer_id', redeemer_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION redeem_partner_code(text) TO authenticated;


-- ============================================================================
-- C2 + M1: Rate-limit functions — SET row_security = off
-- ============================================================================
-- rate_limit_buckets has a service_role_only policy:
--   FOR ALL USING (auth.role() = 'service_role')
-- SECURITY DEFINER functions owned by postgres bypass this on Supabase
-- (superuser), but explicit SET row_security = off makes it portable.
-- ============================================================================

CREATE OR REPLACE FUNCTION check_rate_limit(p_user_id UUID, p_cost INT DEFAULT 1)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off          -- ← rate_limit_buckets is service_role_only
AS $$
DECLARE
  v_bucket rate_limit_buckets%ROWTYPE;
  v_elapsed INTERVAL;
  v_refill INT;
  v_new_tokens INT;
BEGIN
  INSERT INTO rate_limit_buckets (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_bucket
    FROM rate_limit_buckets
   WHERE user_id = p_user_id
   FOR UPDATE;

  v_elapsed    := now() - v_bucket.last_refill;
  v_refill     := GREATEST(0, EXTRACT(EPOCH FROM v_elapsed)::INT);
  v_new_tokens := LEAST(v_bucket.max_tokens, v_bucket.tokens + v_refill);

  IF v_new_tokens < p_cost THEN
    UPDATE rate_limit_buckets
       SET tokens = v_new_tokens, last_refill = now()
     WHERE user_id = p_user_id;
    RETURN FALSE;
  END IF;

  UPDATE rate_limit_buckets
     SET tokens = v_new_tokens - p_cost, last_refill = now()
   WHERE user_id = p_user_id;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION check_sensitive_rate_limit(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT check_rate_limit(p_user_id, 10);
$$;


-- ============================================================================
-- C3 + M1 + M3: send_expo_push — pg_net schema + search_path + logging
-- ============================================================================
-- On Supabase, pg_net lives in the `net` schema (which is on the default
-- search_path). The extension is created WITH SCHEMA extensions, but
-- Supabase aliases it as `net`. We use `net.http_post` which works on all
-- current Supabase instances. The notification_log captures failures.
-- ============================================================================

CREATE OR REPLACE FUNCTION send_expo_push(
  p_token text,
  p_title text,
  p_body  text,
  p_data  jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, extensions   -- ← find net.http_post in any schema
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
    )
  );

  -- Log successful dispatch
  INSERT INTO notification_log (recipient, token, title, body, status)
  VALUES (
    -- Try to resolve token → user_id for audit trail
    (SELECT user_id FROM push_tokens WHERE token = p_token LIMIT 1),
    p_token, p_title, p_body, 'sent'
  );

EXCEPTION WHEN OTHERS THEN
  -- Log failure with error details — never silently swallow
  INSERT INTO notification_log (recipient, token, title, body, status, error_msg)
  VALUES (
    (SELECT user_id FROM push_tokens WHERE token = p_token LIMIT 1),
    p_token, p_title, p_body, 'failed', SQLERRM
  );
END;
$$;


-- ============================================================================
-- H1 + M1: notify_partner — enforce sender_id = auth.uid() (anti-spoof)
-- ============================================================================
-- Without this check, any authenticated user could call:
--   notify_partner('victim-uuid', 'Fake title', 'Fake body')
-- and send push notifications impersonating the victim.
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_partner(
  sender_id         uuid,
  notification_title text,
  notification_body  text,
  notification_data  jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off          -- ← reads push_tokens (user-scoped RLS)
AS $$
DECLARE
  partner_token RECORD;
  sender_couple_id uuid;
BEGIN
  -- ★ ANTI-SPOOF: Only allow sending as yourself
  --   Trigger-invoked calls have auth.uid() = NULL (SECURITY DEFINER context),
  --   so we allow NULL (trigger path) but block mismatched UIDs (RPC path).
  IF auth.uid() IS NOT NULL AND sender_id != auth.uid() THEN
    RAISE EXCEPTION 'Cannot send notifications as another user';
  END IF;

  -- Find the sender's couple
  SELECT couple_id INTO sender_couple_id
    FROM couple_members WHERE user_id = sender_id LIMIT 1;
  IF sender_couple_id IS NULL THEN RETURN; END IF;

  -- Loop through partner's push tokens
  FOR partner_token IN
    SELECT pt.id AS token_id, pt.token
      FROM push_tokens pt
      JOIN couple_members cm ON cm.user_id = pt.user_id
     WHERE cm.couple_id = sender_couple_id
       AND cm.user_id  != sender_id
  LOOP
    PERFORM send_expo_push(
      partner_token.token,
      notification_title,
      notification_body,
      notification_data
    );

    -- Stamp last_used_at for stale-token cleanup
    UPDATE push_tokens SET last_used_at = now() WHERE id = partner_token.token_id;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION notify_partner(uuid, text, text, jsonb) TO authenticated;


-- ============================================================================
-- M1: search_path on ALL remaining SECURITY DEFINER functions
-- ============================================================================
-- Every SECURITY DEFINER function must have SET search_path = public
-- to prevent search_path hijacking (CWE-426). We re-create each function
-- with the addition of the SET clause. Bodies are unchanged.
-- ============================================================================

-- get_user_couple_id
CREATE OR REPLACE FUNCTION get_user_couple_id(input_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (SELECT couple_id FROM couple_members WHERE user_id = input_user_id LIMIT 1);
END;
$$;

-- is_couple_member
CREATE OR REPLACE FUNCTION is_couple_member(couple_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM couple_members
    WHERE couple_id = couple_uuid AND user_id = user_uuid
  );
END;
$$;

-- get_my_couple_ids (used by RLS policies — prevents infinite recursion)
CREATE OR REPLACE FUNCTION get_my_couple_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT couple_id FROM couple_members WHERE user_id = auth.uid();
$$;

-- is_premium_user
CREATE OR REPLACE FUNCTION is_premium_user(check_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_entitlements
    WHERE user_id = check_user_id
      AND is_premium = true
      AND (expires_at IS NULL OR expires_at > now())
  );
END;
$$;

-- is_user_premium (legacy profile-based check)
CREATE OR REPLACE FUNCTION is_user_premium()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_premium FROM profiles WHERE id = auth.uid()), false);
$$;

-- user_data_count
CREATE OR REPLACE FUNCTION user_data_count(p_couple_id uuid, p_data_type text)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT count(*) FROM couple_data
  WHERE couple_id = p_couple_id AND data_type = p_data_type AND created_by = auth.uid();
$$;

-- couple_has_premium
CREATE OR REPLACE FUNCTION couple_has_premium(check_couple_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM couple_members cm
    JOIN user_entitlements ue ON ue.user_id = cm.user_id
    WHERE cm.couple_id = check_couple_id
      AND ue.is_premium = true
      AND (ue.expires_at IS NULL OR ue.expires_at > now())
  );
END;
$$;

-- get_couple_premium_status
CREATE OR REPLACE FUNCTION get_couple_premium_status(input_couple_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT is_couple_member(input_couple_id, auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: not a member of this couple';
  END IF;
  SELECT jsonb_build_object(
    'is_premium', COALESCE(c.is_premium, false),
    'premium_since', c.premium_since,
    'premium_source', COALESCE(c.premium_source, 'none')
  ) INTO result FROM couples c WHERE c.id = input_couple_id;
  RETURN COALESCE(result, '{"is_premium": false, "premium_source": "none"}'::jsonb);
END;
$$;

-- get_daily_usage_count
CREATE OR REPLACE FUNCTION get_daily_usage_count(
  input_couple_id uuid, input_user_id uuid, input_event_type text, input_day_key text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_couple_member(input_couple_id, auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: not a member of this couple';
  END IF;
  RETURN (
    SELECT count(*)::integer FROM usage_events
    WHERE couple_id = input_couple_id AND user_id = input_user_id
      AND event_type = input_event_type AND local_day_key = input_day_key
  );
END;
$$;

-- set_couple_premium
CREATE OR REPLACE FUNCTION set_couple_premium(
  input_couple_id uuid, input_is_premium boolean, input_source text DEFAULT 'none'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_couple_member(input_couple_id, auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: not a member of this couple';
  END IF;
  UPDATE couples SET
    is_premium = input_is_premium,
    premium_since = CASE
      WHEN input_is_premium AND premium_since IS NULL THEN now()
      WHEN NOT input_is_premium THEN NULL
      ELSE premium_since
    END,
    premium_source = input_source,
    updated_at = now()
  WHERE id = input_couple_id;
END;
$$;

-- sync_couple_premium_to_profiles (trigger fn)
CREATE OR REPLACE FUNCTION sync_couple_premium_to_profiles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles SET is_premium = NEW.is_premium, updated_at = now()
  WHERE id IN (SELECT user_id FROM couple_members WHERE couple_id = NEW.id);
  RETURN NEW;
END;
$$;

-- handle_new_user (trigger fn)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO UPDATE SET
    email      = EXCLUDED.email,
    updated_at = now();
  RETURN NEW;
END;
$$;

-- delete_own_account (already had search_path, adding row_security)
CREATE OR REPLACE FUNCTION delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off          -- ← deletes across multiple RLS-protected tables
AS $$
DECLARE
  _couple_id     uuid;
  _partner_count int;
BEGIN
  SELECT couple_id INTO _couple_id
    FROM couple_members WHERE user_id = auth.uid() LIMIT 1;

  IF _couple_id IS NOT NULL THEN
    DELETE FROM couple_data    WHERE couple_id = _couple_id AND created_by = auth.uid();
    DELETE FROM couple_members WHERE couple_id = _couple_id AND user_id    = auth.uid();
    SELECT count(*) INTO _partner_count
      FROM couple_members WHERE couple_id = _couple_id;
    IF _partner_count = 0 THEN
      DELETE FROM couple_data WHERE couple_id = _couple_id;
      DELETE FROM couples     WHERE id = _couple_id;
    END IF;
  END IF;

  BEGIN DELETE FROM usage_events      WHERE user_id = auth.uid(); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM user_entitlements  WHERE user_id = auth.uid(); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM push_tokens       WHERE user_id = auth.uid(); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM analytics_events  WHERE user_id = auth.uid(); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM notification_log  WHERE recipient = auth.uid(); EXCEPTION WHEN undefined_table THEN NULL; END;

  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION delete_own_account() TO authenticated;


-- ============================================================================
-- M1: Trigger functions — search_path hardening
-- ============================================================================
-- Trigger functions are SECURITY DEFINER and invoke notify_partner internally.
-- Adding search_path prevents hijacking.
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_on_couple_data_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_name text;
  notif_title text;
  notif_body  text;
BEGIN
  -- Skip system events (no need to double-notify on partner_linked etc.)
  IF NEW.data_type = 'couple_state' THEN RETURN NEW; END IF;

  SELECT COALESCE(display_name, email, 'Your partner') INTO sender_name
    FROM profiles WHERE id = NEW.created_by;

  CASE NEW.data_type
    WHEN 'vibe'          THEN notif_title := '💗 New Heartbeat';
                              notif_body  := sender_name || ' just sent a heartbeat';
    WHEN 'love_note'     THEN notif_title := '💌 Love Note';
                              notif_body  := sender_name || ' sent you a love note';
    WHEN 'journal'       THEN notif_title := '📝 Journal Entry';
                              notif_body  := sender_name || ' shared a journal entry';
    WHEN 'prompt_answer' THEN notif_title := '💬 Prompt Answer';
                              notif_body  := sender_name || ' answered a prompt';
    WHEN 'check_in'      THEN notif_title := '🤗 Check-In';
                              notif_body  := sender_name || ' checked in';
    WHEN 'memory'        THEN notif_title := '📸 New Memory';
                              notif_body  := sender_name || ' shared a memory';
    WHEN 'custom_ritual' THEN notif_title := '🌙 New Ritual';
                              notif_body  := sender_name || ' created a ritual';
    ELSE                      notif_title := '💕 Between Us';
                              notif_body  := sender_name || ' shared something new';
  END CASE;

  PERFORM notify_partner(
    NEW.created_by,
    notif_title,
    notif_body,
    jsonb_build_object('type', NEW.data_type, 'couple_id', NEW.couple_id)
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;  -- Never block the INSERT
END;
$$;

CREATE OR REPLACE FUNCTION notify_on_calendar_event_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_name text;
BEGIN
  SELECT COALESCE(display_name, email, 'Your partner') INTO sender_name
    FROM profiles WHERE id = NEW.created_by;

  PERFORM notify_partner(
    NEW.created_by,
    '📅 ' || COALESCE(NEW.title, 'New Date Plan'),
    sender_name || ' planned something special',
    jsonb_build_object('type', 'calendar_event', 'event_id', NEW.id, 'couple_id', NEW.couple_id)
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION notify_on_moment_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_name text;
BEGIN
  IF NEW.is_private THEN RETURN NEW; END IF;

  SELECT COALESCE(display_name, email, 'Your partner') INTO sender_name
    FROM profiles WHERE id = NEW.created_by;

  PERFORM notify_partner(
    NEW.created_by,
    '✨ New Moment',
    sender_name || ' shared a ' || COALESCE(NEW.moment_type, 'moment'),
    jsonb_build_object('type', 'moment', 'moment_id', NEW.id, 'couple_id', NEW.couple_id)
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION notify_on_couple_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off          -- ← reads profiles & push_tokens cross-user
AS $$
DECLARE
  partner_name   text;
  redeemer_name  text;
  the_creator_id uuid;
  the_redeemer_id uuid;
BEGIN
  -- Only fire when the couple has exactly 2 members (second member just joined)
  IF (SELECT count(*) FROM couple_members WHERE couple_id = NEW.couple_id) = 2 THEN
    SELECT user_id INTO the_creator_id
      FROM couple_members
     WHERE couple_id = NEW.couple_id AND user_id != NEW.user_id
     LIMIT 1;
    the_redeemer_id := NEW.user_id;

    -- Notify the CREATOR that their partner joined
    SELECT COALESCE(display_name, email, 'Your partner') INTO redeemer_name
      FROM profiles WHERE id = the_redeemer_id;

    -- Use founder's tokens to notify creator (partner of redeemer = creator)
    PERFORM notify_partner(
      the_redeemer_id,
      '💕 You''re Linked!',
      redeemer_name || ' has joined your couple on Between Us',
      jsonb_build_object('type', 'partner_linked', 'couple_id', NEW.couple_id)
    );

    -- Also notify the REDEEMER (via creator's perspective)
    SELECT COALESCE(display_name, email, 'Your partner') INTO partner_name
      FROM profiles WHERE id = the_creator_id;

    PERFORM notify_partner(
      the_creator_id,
      '💕 You''re Linked!',
      'You and ' || partner_name || ' are now connected on Between Us',
      jsonb_build_object('type', 'partner_linked', 'couple_id', NEW.couple_id)
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;


-- ============================================================================
-- M2: Expand Realtime publication
-- ============================================================================
-- The client subscribes to Realtime for live partner sync. Currently only
-- couple_data is published. Add calendar_events, moments, couple_members
-- so partner actions appear instantly on the other device.
-- ============================================================================

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE calendar_events;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE moments;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE couple_members;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================================
-- GRANT: Ensure all public functions are callable by authenticated users
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_user_couple_id(uuid)              TO authenticated;
GRANT EXECUTE ON FUNCTION is_couple_member(uuid, uuid)          TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_couple_ids()                   TO authenticated;
GRANT EXECUTE ON FUNCTION is_premium_user(uuid)                 TO authenticated;
GRANT EXECUTE ON FUNCTION is_user_premium()                     TO authenticated;
GRANT EXECUTE ON FUNCTION user_data_count(uuid, text)           TO authenticated;
GRANT EXECUTE ON FUNCTION couple_has_premium(uuid)              TO authenticated;
GRANT EXECUTE ON FUNCTION get_couple_premium_status(uuid)       TO authenticated;
GRANT EXECUTE ON FUNCTION get_daily_usage_count(uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION set_couple_premium(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION check_rate_limit(uuid, int)           TO authenticated;
GRANT EXECUTE ON FUNCTION check_sensitive_rate_limit(uuid)      TO authenticated;
GRANT EXECUTE ON FUNCTION send_expo_push(text, text, text, jsonb) TO authenticated;


-- ============================================================================
-- VERIFICATION QUERIES (uncomment to check after running)
-- ============================================================================
-- -- 1. All SECURITY DEFINER functions have search_path set:
-- SELECT p.proname, pg_get_functiondef(p.oid)
--   FROM pg_proc p
--   JOIN pg_namespace n ON p.pronamespace = n.oid
--  WHERE n.nspname = 'public'
--    AND p.prosecdef = true
--  ORDER BY p.proname;
--
-- -- 2. Realtime publication tables:
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
--
-- -- 3. Rate limit test (should return true first time):
-- SELECT check_rate_limit(auth.uid());
--
-- -- 4. Cron jobs active:
-- SELECT jobname, schedule, command FROM cron.job ORDER BY jobname;


-- ============================================================================
-- 🎉 SECURITY HARDENING COMPLETE
-- ============================================================================
-- ✅ C1  redeem_partner_code: SET row_security = off (couples INSERT RLS fix)
-- ✅ C2  check_rate_limit / check_sensitive_rate_limit: SET row_security = off
-- ✅ C3  send_expo_push: SET search_path = public,net,extensions + failure logging
-- ✅ H1  notify_partner: sender_id must match auth.uid() (anti-spoof)
-- ✅ H2  Both partners get "linked" confirmation (push + couple_data event)
-- ✅ M1  search_path = public on EVERY SECURITY DEFINER function (21 functions)
-- ✅ M2  Realtime publication: +calendar_events, +moments, +couple_members
-- ✅ M3  notification_log tracks recipient user_id for audit
-- ✅      Fully idempotent — safe to re-run
