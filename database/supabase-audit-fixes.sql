-- ============================================================================
-- 🔒 BETWEENUS — AUDIT FIXES (All-in-One Patch)
-- ============================================================================
-- Run this in Supabase SQL Editor → New query → Run
-- Fully idempotent: safe to re-run on an existing database.
--
-- Fixes applied:
--   H1  Expired link-code + orphan push-token cleanup (pg_cron)
--   H4  Same — cron jobs were commented out in original setup
--   S3  redeem_partner_code hardened to use auth.uid() (no client-supplied redeemer_id)
--   L3  Auto-create profile row on auth.users signup
--   M3  Rate-limit bucket refill cron added
--   M4  Notification failure logging table + improved send_expo_push
--   M5  Push-token dedup safety + last_used tracking
--   +   Grant fixes for new function signatures
-- ============================================================================


-- ============================================================================
-- FIX S3: Harden redeem_partner_code — use auth.uid(), not client param
-- ============================================================================
-- The old signature accepted (input_code_hash, redeemer_id).
-- The new signature accepts ONLY (input_code_hash). The redeemer_id is
-- always auth.uid(), preventing any user from redeeming on behalf of another.
--
-- NOTE: We first drop the OLD two-argument version so the new one-argument
-- version cleanly replaces it.
-- ============================================================================

-- Drop old 2-arg version (if it exists)
DROP FUNCTION IF EXISTS redeem_partner_code(text, uuid);

-- Create the hardened 1-arg version
CREATE OR REPLACE FUNCTION redeem_partner_code(input_code_hash text)
RETURNS jsonb AS $$
DECLARE
  code_row  partner_link_codes%ROWTYPE;
  new_couple_id uuid;
  creator_id    uuid;
  redeemer_id   uuid;
BEGIN
  -- Server-side only — never trust the client
  redeemer_id := auth.uid();
  IF redeemer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Rate-limit: burn 10 tokens per attempt (≈6 attempts/min)
  IF NOT check_sensitive_rate_limit(redeemer_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Too many attempts. Try again in a minute.');
  END IF;

  -- Lock the matching code row (prevents double-redeem race)
  SELECT * INTO code_row FROM partner_link_codes
  WHERE code_hash = input_code_hash
    AND used_at IS NULL
    AND expires_at > now()
  FOR UPDATE;

  IF code_row IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid, expired, or already-used code');
  END IF;

  creator_id := code_row.created_by;

  -- Guard: cannot pair with yourself
  IF creator_id = redeemer_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot pair with yourself');
  END IF;

  -- Guard: creator already linked
  IF EXISTS (SELECT 1 FROM couple_members WHERE user_id = creator_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Code creator is already in a couple');
  END IF;

  -- Guard: redeemer already linked
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

  RETURN jsonb_build_object(
    'success',     true,
    'couple_id',   new_couple_id,
    'creator_id',  creator_id,
    'redeemer_id', redeemer_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant to authenticated users
GRANT EXECUTE ON FUNCTION redeem_partner_code(text) TO authenticated;


-- ============================================================================
-- FIX L3: Auto-create profile on auth.users signup
-- ============================================================================
-- Without this, a new user has no profiles row until the client explicitly
-- creates one. RLS policies on profiles require id = auth.uid(), so this
-- is safe — it only creates the user's own row.
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ============================================================================
-- FIX M4: Notification audit log table
-- ============================================================================
-- Replaces the silent EXCEPTION WHEN OTHERS THEN NULL with a logged fallback.
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  token       text,
  title       text,
  body        text,
  status      text DEFAULT 'sent',    -- sent | failed
  error_msg   text,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

-- Only service_role can read/write (these are server-side logs)
DROP POLICY IF EXISTS "notification_log_service_only" ON notification_log;
CREATE POLICY "notification_log_service_only" ON notification_log
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_notification_log_created ON notification_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_log_status  ON notification_log(status) WHERE status = 'failed';

-- Improved send_expo_push with logging
CREATE OR REPLACE FUNCTION send_expo_push(
  p_token text,
  p_title text,
  p_body  text,
  p_data  jsonb DEFAULT '{}'
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Use pg_net to POST to Expo push API (non-blocking)
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
  INSERT INTO notification_log (token, title, body, status)
  VALUES (p_token, p_title, p_body, 'sent');

EXCEPTION WHEN OTHERS THEN
  -- Log failures instead of silently swallowing them
  INSERT INTO notification_log (token, title, body, status, error_msg)
  VALUES (p_token, p_title, p_body, 'failed', SQLERRM);
END;
$$;


-- ============================================================================
-- FIX M5: Push token dedup + last_used tracking
-- ============================================================================
-- Adds a last_used_at column so stale tokens can be identified and cleaned.
-- ============================================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'push_tokens' AND column_name = 'last_used_at'
  ) THEN
    ALTER TABLE push_tokens ADD COLUMN last_used_at timestamptz;
  END IF;
END $$;

-- Update notify_partner to stamp last_used_at on each send
CREATE OR REPLACE FUNCTION notify_partner(
  sender_id         uuid,
  notification_title text,
  notification_body  text,
  notification_data  jsonb DEFAULT '{}'
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  partner_token RECORD;
  sender_couple_id uuid;
BEGIN
  -- Find the sender's couple
  SELECT couple_id INTO sender_couple_id
    FROM couple_members WHERE user_id = sender_id LIMIT 1;
  IF sender_couple_id IS NULL THEN RETURN; END IF;

  -- Loop through partner's push tokens (partner = other member)
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

    -- Mark token as recently used
    UPDATE push_tokens SET last_used_at = now() WHERE id = partner_token.token_id;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION notify_partner(uuid, text, text, jsonb) TO authenticated;


-- ============================================================================
-- FIX: delete_own_account should also clean push_tokens
-- ============================================================================

CREATE OR REPLACE FUNCTION delete_own_account()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _couple_id     uuid;
  _partner_count int;
BEGIN
  -- Find couple membership
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

  -- Clean up ancillary tables
  BEGIN DELETE FROM usage_events      WHERE user_id = auth.uid(); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM user_entitlements  WHERE user_id = auth.uid(); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM push_tokens       WHERE user_id = auth.uid(); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM analytics_events  WHERE user_id = auth.uid(); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM notification_log  WHERE recipient = auth.uid(); EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Finally, delete the auth user (cascades to profiles)
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION delete_own_account() TO authenticated;


-- ============================================================================
-- FIX H1 + H4 + M3: pg_cron cleanup & maintenance jobs
-- ============================================================================
-- pg_cron is pre-installed on Supabase but the extension must be enabled.
-- These jobs handle:
--   1. Expired partner link codes (hourly)
--   2. Orphan push tokens from deleted users (daily)
--   3. Stale push tokens never used in 90 days (daily)
--   4. Rate-limit bucket refill (every 5 minutes)
--   5. Old notification log entries > 30 days (daily)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 1. Clean expired link codes (keep used ones for audit, delete unused expired)
SELECT cron.unschedule('cleanup-expired-codes')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-codes');

SELECT cron.schedule(
  'cleanup-expired-codes',
  '0 * * * *',   -- every hour
  $$DELETE FROM partner_link_codes WHERE expires_at < now() AND used_at IS NULL$$
);

-- 2. Remove push tokens for users who no longer exist
SELECT cron.unschedule('cleanup-orphan-push-tokens')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-orphan-push-tokens');

SELECT cron.schedule(
  'cleanup-orphan-push-tokens',
  '0 4 * * *',   -- daily at 4 AM UTC
  $$DELETE FROM push_tokens WHERE user_id NOT IN (SELECT id FROM auth.users)$$
);

-- 3. Remove push tokens not used in 90 days (likely stale/revoked)
SELECT cron.unschedule('cleanup-stale-push-tokens')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-stale-push-tokens');

SELECT cron.schedule(
  'cleanup-stale-push-tokens',
  '30 4 * * *',  -- daily at 4:30 AM UTC
  $$DELETE FROM push_tokens WHERE last_used_at IS NOT NULL AND last_used_at < now() - interval '90 days'$$
);

-- 4. Rate-limit bucket refill
SELECT cron.unschedule('rate-limit-refill')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rate-limit-refill');

SELECT cron.schedule(
  'rate-limit-refill',
  '*/5 * * * *', -- every 5 minutes
  $$UPDATE rate_limit_buckets SET tokens = max_tokens, last_refill = now() WHERE tokens < max_tokens$$
);

-- 5. Prune old notification log entries (keep 30 days)
SELECT cron.unschedule('cleanup-notification-log')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-notification-log');

SELECT cron.schedule(
  'cleanup-notification-log',
  '0 5 * * *',   -- daily at 5 AM UTC
  $$DELETE FROM notification_log WHERE created_at < now() - interval '30 days'$$
);

-- 6. Clean up stale rate-limit buckets for deleted users (daily)
SELECT cron.unschedule('rate-limit-cleanup')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rate-limit-cleanup');

SELECT cron.schedule(
  'rate-limit-cleanup',
  '0 3 * * *',   -- daily at 3 AM UTC
  $$DELETE FROM rate_limit_buckets WHERE user_id NOT IN (SELECT id FROM auth.users)$$
);


-- ============================================================================
-- BONUS: Backfill profiles for existing users who don't have one
-- ============================================================================
-- Run once — fills in any users that signed up before the trigger existed.

INSERT INTO profiles (id, email, display_name)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1))
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- VERIFICATION: List all scheduled cron jobs
-- ============================================================================
-- Uncomment to verify after running:
-- SELECT jobname, schedule, command FROM cron.job ORDER BY jobname;


-- ============================================================================
-- 🎉 AUDIT FIXES COMPLETE
-- ============================================================================
-- ✅ S3  redeem_partner_code uses auth.uid() — no client-supplied redeemer_id
-- ✅ L3  Auto-create profile on signup via trigger
-- ✅ M4  Notification audit log (replaces silent swallow)
-- ✅ M5  Push token last_used_at tracking
-- ✅ H1  Expired link-code cleanup cron (hourly)
-- ✅ H4  Orphan + stale push-token cleanup cron (daily)
-- ✅ M3  Rate-limit bucket refill cron (every 5 min)
-- ✅      delete_own_account cleans push_tokens + analytics + notification_log
-- ✅      Backfill profiles for existing users
-- ✅      Fully idempotent — safe to re-run
