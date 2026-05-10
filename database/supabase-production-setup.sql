-- ============================================================================
-- 🚀 BETWEENUS — PRODUCTION DATABASE SETUP (Single File)
-- ============================================================================
-- Generated: March 29, 2026
--
-- This file combines ALL migrations into one idempotent script:
--   • supabase-full-setup.sql        (tables, indexes, functions, RLS, storage)
--   • supabase-audit-fixes.sql       (notification_log, profile trigger, cron)
--   • supabase-security-hardening.sql (search_path, row_security, anti-spoof)
--   • supabase-realtime-replica-identity.sql (REPLICA IDENTITY FULL)
--   • supabase-unique-user-couple.sql (single-couple constraint)
--
-- HOW TO RUN:
--   1. Open Supabase Dashboard → SQL Editor → New query
--   2. Paste this entire file
--   3. Click "Run"
--
-- Fully idempotent: safe to re-run on an existing database.
-- ============================================================================


-- ############################################################################
-- PART 1: EXTENSIONS
-- ############################################################################

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron;


-- ############################################################################
-- PART 2: CORE TABLES
-- ############################################################################

-- Profiles
CREATE TABLE IF NOT EXISTS profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email text,
  display_name text,
  is_premium boolean DEFAULT false,
  preferences jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Couples
CREATE TABLE IF NOT EXISTS couples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES auth.users NOT NULL,
  relationship_start_date date,
  couple_name text,
  is_active boolean DEFAULT true,
  preferences jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Premium columns on couples
ALTER TABLE couples ADD COLUMN IF NOT EXISTS is_premium boolean DEFAULT false;
ALTER TABLE couples ADD COLUMN IF NOT EXISTS premium_since timestamptz;
DO $$ BEGIN
  ALTER TABLE couples ADD COLUMN premium_source text DEFAULT 'none'
    CHECK (premium_source = 'none' OR premium_source ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$');
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

UPDATE couples
SET premium_source = 'none'
WHERE premium_source IS NULL
   OR premium_source IN ('user_a', 'user_b')
   OR NOT (
     premium_source = 'none'
     OR premium_source ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
   );

DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'couples_premium_source_check'
      AND conrelid = 'couples'::regclass
  ) THEN
    ALTER TABLE couples DROP CONSTRAINT couples_premium_source_check;
  END IF;

  ALTER TABLE couples ADD CONSTRAINT couples_premium_source_check
    CHECK (
      premium_source = 'none'
      OR premium_source ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Couple members
CREATE TABLE IF NOT EXISTS couple_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id uuid REFERENCES couples(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users NOT NULL,
  role text DEFAULT 'member',
  created_at timestamptz DEFAULT now(),
  UNIQUE(couple_id, user_id)
);

-- Single-couple membership constraint (one user = one couple)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'couple_members_user_id_unique') THEN
    ALTER TABLE couple_members ADD CONSTRAINT couple_members_user_id_unique UNIQUE (user_id);
  END IF;
END $$;

-- Couple data (generic key-value store for all couple content)
CREATE TABLE IF NOT EXISTS couple_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id uuid REFERENCES couples(id) ON DELETE CASCADE NOT NULL,
  key text NOT NULL,
  value jsonb,
  data_type text NOT NULL DEFAULT 'unknown',
  created_by uuid REFERENCES auth.users NOT NULL,
  is_private boolean DEFAULT false,
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tombstone columns for soft-delete sync
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='couple_data' AND column_name='is_deleted') THEN
    ALTER TABLE couple_data ADD COLUMN is_deleted boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='couple_data' AND column_name='deleted_at') THEN
    ALTER TABLE couple_data ADD COLUMN deleted_at timestamptz;
  END IF;
END $$;

-- Unique constraint for upsert (couple_id + key)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='couple_data_couple_id_key_unique') THEN
    ALTER TABLE couple_data ADD CONSTRAINT couple_data_couple_id_key_unique UNIQUE (couple_id, key);
  END IF;
END $$;

-- Calendar events
CREATE TABLE IF NOT EXISTS calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id uuid REFERENCES couples(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  event_date timestamptz NOT NULL,
  event_type text NOT NULL DEFAULT 'date_night',
  recurrence text,
  location text,
  heat_level int DEFAULT 1 CHECK (heat_level BETWEEN 1 AND 5),
  is_completed boolean DEFAULT false,
  metadata jsonb DEFAULT '{}',
  created_by uuid REFERENCES auth.users NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Moments
CREATE TABLE IF NOT EXISTS moments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id uuid REFERENCES couples(id) ON DELETE CASCADE NOT NULL,
  moment_type text NOT NULL DEFAULT 'note',
  title text,
  content text,
  media_path text,
  prompt_id text,
  is_private boolean DEFAULT false,
  tags text[] DEFAULT '{}',
  metadata jsonb DEFAULT '{}',
  created_by uuid REFERENCES auth.users NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Partner link codes
CREATE TABLE IF NOT EXISTS partner_link_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash text NOT NULL,
  created_by uuid REFERENCES auth.users NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  used_by uuid REFERENCES auth.users,
  couple_id uuid REFERENCES couples(id),
  created_at timestamptz DEFAULT now()
);

-- User entitlements (server-side premium from RevenueCat)
CREATE TABLE IF NOT EXISTS user_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL UNIQUE,
  is_premium boolean DEFAULT false,
  entitlement_id text,
  product_id text,
  expires_at timestamptz,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Usage events (freemium daily limits)
CREATE TABLE IF NOT EXISTS usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id uuid REFERENCES couples(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users NOT NULL,
  event_type text NOT NULL,
  local_day_key text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Analytics events
CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text,
  event text NOT NULL,
  properties jsonb DEFAULT '{}',
  timestamp timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Remote experiment config
CREATE TABLE IF NOT EXISTS experiments (
  id text PRIMARY KEY,
  variants jsonb NOT NULL DEFAULT '["control", "treatment"]'::jsonb,
  weights jsonb,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Rate limit buckets
CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tokens INT NOT NULL DEFAULT 60,
  max_tokens INT NOT NULL DEFAULT 60,
  last_refill TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Password recovery code vault (service-role Edge Function only)
CREATE TABLE IF NOT EXISTS password_recovery_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  attempts int NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Password recovery request rate limits (service-role Edge Function only)
CREATE TABLE IF NOT EXISTS password_recovery_request_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier_hash text NOT NULL,
  action text NOT NULL,
  request_count int NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  window_started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(identifier_hash, action)
);

-- Push tokens (Expo push notification tokens per user/device)
CREATE TABLE IF NOT EXISTS push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  token text NOT NULL,
  platform text DEFAULT 'ios',
  device_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, token)
);

-- Push token last_used_at tracking (for stale token cleanup)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'push_tokens' AND column_name = 'last_used_at'
  ) THEN
    ALTER TABLE push_tokens ADD COLUMN last_used_at timestamptz;
  END IF;
END $$;

-- Notification audit log
CREATE TABLE IF NOT EXISTS notification_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  token       text,
  title       text,
  body        text,
  status      text DEFAULT 'sent',
  error_msg   text,
  created_at  timestamptz DEFAULT now()
);

-- Date shortlist (shared by couple when paired, per-user when solo)
CREATE TABLE IF NOT EXISTS date_shortlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  couple_id uuid REFERENCES couples(id) ON DELETE CASCADE,
  date_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  CONSTRAINT date_shortlist_user_date_unique UNIQUE (user_id, date_id),
  CONSTRAINT date_shortlist_couple_date_unique UNIQUE (couple_id, date_id)
);


-- ############################################################################
-- PART 3: INDEXES
-- ############################################################################

-- profiles
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_premium ON profiles(is_premium);

-- couples
CREATE INDEX IF NOT EXISTS idx_couples_created_by ON couples(created_by);
CREATE INDEX IF NOT EXISTS idx_couples_active ON couples(is_active);
CREATE INDEX IF NOT EXISTS idx_couples_premium ON couples(is_premium) WHERE is_premium = true;

-- couple_members
CREATE INDEX IF NOT EXISTS idx_couple_members_couple ON couple_members(couple_id);
CREATE INDEX IF NOT EXISTS idx_couple_members_user ON couple_members(user_id);

-- couple_data
CREATE INDEX IF NOT EXISTS idx_couple_data_couple_id ON couple_data(couple_id);
CREATE INDEX IF NOT EXISTS idx_couple_data_key ON couple_data(key);
CREATE INDEX IF NOT EXISTS idx_couple_data_type ON couple_data(data_type);
CREATE INDEX IF NOT EXISTS idx_couple_data_created_by ON couple_data(created_by);
CREATE INDEX IF NOT EXISTS idx_couple_data_private ON couple_data(is_private);
CREATE INDEX IF NOT EXISTS idx_couple_data_created_at ON couple_data(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_couple_data_sync ON couple_data(couple_id, data_type, updated_at);
CREATE INDEX IF NOT EXISTS idx_couple_data_updated ON couple_data(updated_at);
CREATE INDEX IF NOT EXISTS idx_couple_data_not_deleted ON couple_data(couple_id, data_type, updated_at) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_couple_data_type_user ON couple_data(couple_id, data_type, created_by);

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY couple_id, created_by, value->>'promptId', value->>'dateKey'
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM couple_data
  WHERE data_type = 'prompt_answer'
    AND COALESCE(is_deleted, false) = false
    AND value->>'promptId' IS NOT NULL
    AND value->>'dateKey' IS NOT NULL
)
UPDATE couple_data cd
SET is_deleted = true,
    deleted_at = now(),
    updated_at = now()
FROM ranked r
WHERE cd.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS couple_data_prompt_answer_unique_live
  ON couple_data (
    couple_id,
    created_by,
    (value->>'promptId'),
    (value->>'dateKey')
  )
  WHERE data_type = 'prompt_answer'
    AND COALESCE(is_deleted, false) = false
    AND value->>'promptId' IS NOT NULL
    AND value->>'dateKey' IS NOT NULL;

CREATE INDEX IF NOT EXISTS couple_data_prompt_answer_status_lookup_idx
  ON couple_data (
    couple_id,
    created_by,
    (value->>'promptId'),
    (value->>'dateKey')
  )
  WHERE data_type = 'prompt_answer_status'
    AND COALESCE(is_deleted, false) = false;

-- calendar_events
CREATE INDEX IF NOT EXISTS idx_calendar_events_couple ON calendar_events(couple_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(event_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_type ON calendar_events(event_type);
CREATE INDEX IF NOT EXISTS idx_calendar_events_created_by ON calendar_events(created_by);

-- moments
CREATE INDEX IF NOT EXISTS idx_moments_couple ON moments(couple_id);
CREATE INDEX IF NOT EXISTS idx_moments_type ON moments(moment_type);
CREATE INDEX IF NOT EXISTS idx_moments_created_by ON moments(created_by);
CREATE INDEX IF NOT EXISTS idx_moments_created_at ON moments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moments_private ON moments(is_private);

-- partner_link_codes
CREATE INDEX IF NOT EXISTS idx_link_codes_hash ON partner_link_codes(code_hash);
CREATE INDEX IF NOT EXISTS idx_link_codes_created_by ON partner_link_codes(created_by);
CREATE INDEX IF NOT EXISTS idx_link_codes_expires ON partner_link_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_link_codes_couple ON partner_link_codes(couple_id);

-- user_entitlements
CREATE INDEX IF NOT EXISTS idx_entitlements_user ON user_entitlements(user_id);
CREATE INDEX IF NOT EXISTS idx_entitlements_premium ON user_entitlements(is_premium);

-- usage_events
CREATE INDEX IF NOT EXISTS idx_usage_events_daily ON usage_events(couple_id, user_id, event_type, local_day_key);
CREATE INDEX IF NOT EXISTS idx_usage_events_couple_day ON usage_events(couple_id, local_day_key);
CREATE INDEX IF NOT EXISTS idx_usage_events_user_day ON usage_events(user_id, local_day_key);

-- analytics_events
CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp ON analytics_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_events_event ON analytics_events(event);

-- experiments
CREATE INDEX IF NOT EXISTS idx_experiments_enabled ON experiments(enabled) WHERE enabled = true;

-- push_tokens
CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON push_tokens(token);

-- notification_log
CREATE INDEX IF NOT EXISTS idx_notification_log_created   ON notification_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_log_status    ON notification_log(status) WHERE status = 'failed';
CREATE INDEX IF NOT EXISTS idx_notification_log_recipient ON notification_log(recipient);

-- password recovery
CREATE INDEX IF NOT EXISTS idx_password_recovery_codes_email
  ON password_recovery_codes(email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_password_recovery_codes_user_id
  ON password_recovery_codes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_password_recovery_request_limits_updated_at
  ON password_recovery_request_limits(updated_at DESC);

-- date shortlist
CREATE INDEX IF NOT EXISTS date_shortlist_user_active_idx
  ON date_shortlist(user_id, created_at DESC)
  WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS date_shortlist_couple_active_idx
  ON date_shortlist(couple_id, created_at DESC)
  WHERE removed_at IS NULL AND couple_id IS NOT NULL;

-- partial indexes for cron cleanup queries
CREATE INDEX IF NOT EXISTS idx_link_codes_unused      ON partner_link_codes(expires_at) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_push_tokens_last_used   ON push_tokens(last_used_at) WHERE last_used_at IS NOT NULL;


-- ############################################################################
-- PART 4: HELPER FUNCTIONS (all with SET search_path = public)
-- ############################################################################

-- updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Sync-aware updated_at (preserves future client timestamps)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = GREATEST(NEW.updated_at, now());
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION guard_couple_data_immutable_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.couple_id IS DISTINCT FROM OLD.couple_id
    OR NEW.key IS DISTINCT FROM OLD.key
    OR NEW.data_type IS DISTINCT FROM OLD.data_type
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
  THEN
    RAISE EXCEPTION 'couple_data identity fields cannot be changed';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION prompt_answer_value_revealed(input_value jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(COALESCE(input_value->>'isRevealed', input_value->>'is_revealed', 'false')) IN ('true', '1', 'yes', 'on')
$$;

CREATE OR REPLACE FUNCTION enforce_prompt_answer_privacy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.data_type <> 'prompt_answer' THEN
    RETURN NEW;
  END IF;

  IF current_setting('app.allow_prompt_answer_reveal', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- Once the server has revealed an answer pair, later creator edits remain readable.
  IF TG_OP = 'UPDATE'
    AND OLD.is_private IS NOT TRUE
    AND prompt_answer_value_revealed(OLD.value)
  THEN
    NEW.is_private := false;
    NEW.value := jsonb_set(COALESCE(NEW.value, '{}'::jsonb), '{isRevealed}', 'true'::jsonb, true);
    IF COALESCE(NEW.value->>'revealAt', '') = '' THEN
      NEW.value := jsonb_set(NEW.value, '{revealAt}', to_jsonb(now()), true);
    END IF;
    RETURN NEW;
  END IF;

  NEW.is_private := true;
  NEW.value := jsonb_set(COALESCE(NEW.value, '{}'::jsonb), '{isRevealed}', 'false'::jsonb, true);
  NEW.value := NEW.value - 'partnerAnswer' - 'revealAt';

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION sync_prompt_answer_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  status_key text;
  answered_at timestamptz;
BEGIN
  IF NEW.data_type <> 'prompt_answer' THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.value->>'promptId', '') = '' OR COALESCE(NEW.value->>'dateKey', '') = '' THEN
    RETURN NEW;
  END IF;

  status_key := 'prompt_answer_status:' || (NEW.value->>'promptId') || ':' || (NEW.value->>'dateKey') || ':' || NEW.created_by::text;
  answered_at := COALESCE(NEW.created_at, now());

  INSERT INTO couple_data (
    couple_id,
    key,
    value,
    data_type,
    created_by,
    is_private,
    is_deleted,
    deleted_at,
    created_at,
    updated_at
  )
  VALUES (
    NEW.couple_id,
    status_key,
    jsonb_build_object(
      'promptId', NEW.value->>'promptId',
      'dateKey', NEW.value->>'dateKey',
      'userId', NEW.created_by,
      'answeredAt', answered_at,
      'isRevealed', prompt_answer_value_revealed(NEW.value)
    ),
    'prompt_answer_status',
    NEW.created_by,
    false,
    COALESCE(NEW.is_deleted, false),
    NEW.deleted_at,
    answered_at,
    now()
  )
  ON CONFLICT (couple_id, key) DO UPDATE
  SET
    value = EXCLUDED.value,
    is_private = false,
    is_deleted = EXCLUDED.is_deleted,
    deleted_at = EXCLUDED.deleted_at,
    updated_at = now();

  RETURN NEW;
END;
$$;

-- Get couple ID for a user
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

-- Check if user is a member of a couple
CREATE OR REPLACE FUNCTION is_couple_member(couple_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM couple_members
    WHERE couple_id = couple_uuid AND user_id = user_uuid
  );
END;
$$;

-- Return current user's couple_ids (bypasses RLS — prevents recursion)
CREATE OR REPLACE FUNCTION get_my_couple_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT couple_id FROM couple_members WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION is_permanent_authenticated_user()
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE((auth.jwt()->>'is_anonymous')::boolean, false) IS FALSE;
$$;

-- Check premium via user_entitlements
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

-- Check premium via server-side entitlement truth
CREATE OR REPLACE FUNCTION is_user_premium()
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_entitlements ue
    WHERE ue.user_id = auth.uid()
      AND ue.is_premium = true
      AND (ue.expires_at IS NULL OR ue.expires_at > now())
  );
$$;

CREATE OR REPLACE FUNCTION guard_profile_premium_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.allow_profile_premium_update', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF auth.role() <> 'service_role'
    AND NEW.is_premium IS DISTINCT FROM OLD.is_premium
  THEN
    RAISE EXCEPTION 'profiles.is_premium is managed server-side';
  END IF;

  RETURN NEW;
END;
$$;

-- Count couple_data rows of a given type for the current user
CREATE OR REPLACE FUNCTION user_data_count(p_couple_id uuid, p_data_type text)
RETURNS bigint
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
  SELECT count(*) FROM couple_data
  WHERE couple_id = p_couple_id AND data_type = p_data_type AND created_by = auth.uid();
$$;

-- Check if EITHER partner has premium (shared premium)
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

-- Get couple premium status
CREATE OR REPLACE FUNCTION get_couple_premium_status(input_couple_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
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

-- Count daily usage for a user
CREATE OR REPLACE FUNCTION get_daily_usage_count(
  input_couple_id uuid, input_user_id uuid, input_event_type text, input_day_key text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF input_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Access denied: usage can only be read for the current user';
  END IF;

  IF NOT is_couple_member(input_couple_id, auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: not a member of this couple';
  END IF;
  RETURN (
    SELECT count(*)::integer FROM usage_events
    WHERE couple_id = input_couple_id AND user_id = auth.uid()
      AND local_day_key = input_day_key
      AND (
        event_type = input_event_type
        OR (input_event_type = 'prompt_viewed' AND event_type = 'prompts')
        OR (input_event_type = 'date_idea_viewed' AND event_type = 'dates')
      )
  );
END;
$$;

-- Set couple premium status
CREATE OR REPLACE FUNCTION set_couple_premium(
  input_couple_id uuid, input_is_premium boolean, input_source text DEFAULT 'none'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  active_premium_user uuid;
  should_be_premium boolean;
BEGIN
  IF NOT is_couple_member(input_couple_id, auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: not a member of this couple';
  END IF;

  -- Backward-compatible signature: ignore caller-provided premium flags and
  -- recompute shared premium solely from server-side entitlement truth.
  SELECT cm.user_id INTO active_premium_user
    FROM couple_members cm
    JOIN user_entitlements ue ON ue.user_id = cm.user_id
   WHERE cm.couple_id = input_couple_id
     AND ue.is_premium = true
     AND (ue.expires_at IS NULL OR ue.expires_at > now())
   ORDER BY CASE WHEN cm.user_id = auth.uid() THEN 0 ELSE 1 END, ue.updated_at DESC NULLS LAST
   LIMIT 1;

  should_be_premium := active_premium_user IS NOT NULL;

  PERFORM set_config('app.allow_profile_premium_update', 'true', true);

  UPDATE couples SET
    is_premium = should_be_premium,
    premium_since = CASE
      WHEN should_be_premium AND premium_since IS NULL THEN now()
      WHEN NOT should_be_premium THEN NULL
      ELSE premium_since
    END,
    premium_source = COALESCE(active_premium_user::text, 'none'),
    updated_at = now()
  WHERE id = input_couple_id;

  PERFORM set_config('app.allow_profile_premium_update', 'false', true);
END;
$$;

-- Sync couple premium to profile flags (trigger fn)
CREATE OR REPLACE FUNCTION sync_couple_premium_to_profiles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.allow_profile_premium_update', true) <> 'true'
    AND auth.role() <> 'service_role'
  THEN
    RAISE EXCEPTION 'couples.is_premium is managed server-side';
  END IF;

  UPDATE profiles SET is_premium = NEW.is_premium, updated_at = now()
  WHERE id IN (SELECT user_id FROM couple_members WHERE couple_id = NEW.id);

  RETURN NEW;
END;
$$;

-- Auto-create profile on auth.users signup
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


-- ############################################################################
-- PART 5: RATE LIMITING FUNCTIONS (with SET row_security = off)
-- ############################################################################

CREATE OR REPLACE FUNCTION check_rate_limit(p_user_id UUID, p_cost INT DEFAULT 1)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
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


-- ############################################################################
-- PART 6: PARTNER CODE REDEMPTION (hardened, 1-arg, with row_security = off)
-- ############################################################################

DROP FUNCTION IF EXISTS redeem_partner_code(text, uuid);
DROP FUNCTION IF EXISTS redeem_partner_code(text);
DROP FUNCTION IF EXISTS redeem_pairing_code(text, text);

CREATE OR REPLACE FUNCTION redeem_partner_code(input_code_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  code_row partner_link_codes%ROWTYPE;
  target_couple_id uuid;
  new_couple_id uuid;
  creator_id uuid;
  redeemer_id uuid;
  member_count integer;
BEGIN
  redeemer_id := auth.uid();
  IF redeemer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF NOT check_sensitive_rate_limit(redeemer_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Too many attempts. Try again in a minute.');
  END IF;

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

  IF creator_id = redeemer_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot pair with yourself');
  END IF;

  IF EXISTS (SELECT 1 FROM couple_members WHERE user_id = redeemer_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are already in a couple');
  END IF;

  IF code_row.couple_id IS NOT NULL THEN
    target_couple_id := code_row.couple_id;

    PERFORM 1 FROM couples WHERE id = target_couple_id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invite couple no longer exists');
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM couple_members
      WHERE couple_id = target_couple_id
        AND user_id = creator_id
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Code creator is no longer in this couple');
    END IF;

    SELECT count(*)::integer INTO member_count
      FROM couple_members
      WHERE couple_id = target_couple_id;

    IF member_count >= 2 THEN
      RETURN jsonb_build_object('success', false, 'error', 'This couple is already full');
    END IF;

    INSERT INTO couple_members (couple_id, user_id, role)
    VALUES (target_couple_id, redeemer_id, 'member');

    UPDATE partner_link_codes
       SET used_at = now(),
           used_by = redeemer_id
     WHERE id = code_row.id;

    INSERT INTO couple_data (couple_id, key, value, data_type, created_by)
    VALUES (
      target_couple_id,
      'system:partner_linked',
      jsonb_build_object(
        'creator_id', creator_id,
        'redeemer_id', redeemer_id,
        'linked_at', now()
      ),
      'couple_state',
      redeemer_id
    )
    ON CONFLICT (couple_id, key) DO UPDATE SET
      value = EXCLUDED.value,
      updated_at = now();

    RETURN jsonb_build_object(
      'success', true,
      'couple_id', target_couple_id,
      'creator_id', creator_id,
      'redeemer_id', redeemer_id
    );
  END IF;

  IF EXISTS (SELECT 1 FROM couple_members WHERE user_id = creator_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Code creator is already in a couple');
  END IF;

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

  -- Write system event so both partners see confirmation via Realtime
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

CREATE OR REPLACE FUNCTION cleanup_couple_storage_objects(
  input_couple_id uuid,
  input_owner uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
SET row_security = off
AS $$
DECLARE
  previous_allow_delete text;
BEGIN
  IF input_couple_id IS NULL THEN
    RETURN;
  END IF;

  previous_allow_delete := COALESCE(current_setting('storage.allow_delete_query', true), 'false');
  PERFORM set_config('storage.allow_delete_query', 'true', true);

  DELETE FROM storage.objects
  WHERE bucket_id = 'couple-media'
    AND (storage.foldername(name))[1] = 'couples'
    AND (storage.foldername(name))[2] = input_couple_id::text
    AND (input_owner IS NULL OR owner = input_owner);

  DELETE FROM storage.objects
  WHERE bucket_id IN ('attachments', 'whispers')
    AND (storage.foldername(name))[1] = input_couple_id::text
    AND (input_owner IS NULL OR owner = input_owner);

  PERFORM set_config('storage.allow_delete_query', previous_allow_delete, true);
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('storage.allow_delete_query', COALESCE(previous_allow_delete, 'false'), true);
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION cleanup_couple_storage_objects(uuid, uuid) FROM PUBLIC;

-- Create a new couple and add caller as owner (bypasses RLS — mirrors redeem_* pattern)
DROP FUNCTION IF EXISTS create_couple_for_qr(text);
DROP FUNCTION IF EXISTS create_couple_for_qr();
CREATE OR REPLACE FUNCTION create_couple_for_qr()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  caller_id     uuid;
  old_couple_id uuid;
  new_couple_id uuid;
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT couple_id INTO old_couple_id
    FROM couple_members WHERE user_id = caller_id LIMIT 1;
  IF old_couple_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Leave your current couple before creating a new invite.'
    );
  END IF;

  INSERT INTO couples (created_by) VALUES (caller_id)
    RETURNING id INTO new_couple_id;

  INSERT INTO couple_members (couple_id, user_id, role)
  VALUES (new_couple_id, caller_id, 'owner');

  RETURN jsonb_build_object(
    'success',   true,
    'couple_id', new_couple_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION create_couple_for_qr() TO authenticated;

-- Leave current couple (dissolve the couple for both partners, bypasses RLS)
DROP FUNCTION IF EXISTS leave_couple();
CREATE OR REPLACE FUNCTION leave_couple()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  caller_id           uuid;
  the_couple_id       uuid;
  affected_member_ids uuid[];
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT couple_id INTO the_couple_id
    FROM couple_members WHERE user_id = caller_id LIMIT 1;

  IF the_couple_id IS NULL THEN
    -- Already not in a couple — treat as success
    RETURN jsonb_build_object('success', true, 'couple_id', null);
  END IF;

  SELECT COALESCE(array_agg(user_id), ARRAY[]::uuid[]) INTO affected_member_ids
    FROM couple_members
   WHERE couple_id = the_couple_id;

  PERFORM cleanup_couple_storage_objects(the_couple_id, NULL);
  DELETE FROM date_shortlist WHERE user_id = ANY(affected_member_ids);

  -- Dissolve the couple entirely so neither partner remains linked locally or remotely.
  DELETE FROM couple_members WHERE couple_id = the_couple_id;
  DELETE FROM partner_link_codes WHERE couple_id = the_couple_id;
  DELETE FROM couples WHERE id = the_couple_id;

  -- Reset each former member's profile premium to their own entitlement status.
  PERFORM set_config('app.allow_profile_premium_update', 'true', true);

  UPDATE profiles SET
    is_premium = EXISTS (
      SELECT 1 FROM user_entitlements ue
      WHERE ue.user_id = profiles.id
        AND ue.is_premium = true
        AND (ue.expires_at IS NULL OR ue.expires_at > now())
    ),
    updated_at = now()
  WHERE id = ANY(affected_member_ids);

  PERFORM set_config('app.allow_profile_premium_update', 'false', true);

  RETURN jsonb_build_object('success', true, 'couple_id', the_couple_id);
END;
$$;

GRANT EXECUTE ON FUNCTION leave_couple() TO authenticated;

DROP FUNCTION IF EXISTS get_partner_profile_summary();
CREATE OR REPLACE FUNCTION get_partner_profile_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  caller_id uuid;
  the_couple_id uuid;
  partner_id uuid;
  profile_row profiles%rowtype;
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT couple_id INTO the_couple_id
    FROM couple_members
   WHERE user_id = caller_id
   LIMIT 1;

  IF the_couple_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT user_id INTO partner_id
    FROM couple_members
   WHERE couple_id = the_couple_id
     AND user_id <> caller_id
   LIMIT 1;

  IF partner_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO profile_row
    FROM profiles
   WHERE id = partner_id
   LIMIT 1;

  RETURN jsonb_build_object(
    'id', partner_id,
    'user_id', partner_id,
    'display_name', profile_row.display_name,
    'displayName', profile_row.display_name,
    'name', profile_row.display_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_partner_profile_summary() TO authenticated;

DROP FUNCTION IF EXISTS reveal_prompt_answer(uuid);
CREATE OR REPLACE FUNCTION reveal_prompt_answer(input_answer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  caller_id uuid;
  own_answer couple_data%rowtype;
  partner_answer couple_data%rowtype;
  reveal_ts timestamptz := now();
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO own_answer
    FROM couple_data
   WHERE id = input_answer_id
     AND data_type = 'prompt_answer'
     AND created_by = caller_id
     AND COALESCE(is_deleted, false) = false
   FOR UPDATE;

  IF own_answer.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No saved prompt answer was found.');
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM couple_members cm
     WHERE cm.couple_id = own_answer.couple_id
       AND cm.user_id = caller_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are no longer connected to this couple.');
  END IF;

  SELECT * INTO partner_answer
    FROM couple_data
   WHERE couple_id = own_answer.couple_id
     AND data_type = 'prompt_answer'
     AND created_by <> caller_id
     AND COALESCE(is_deleted, false) = false
     AND value->>'promptId' = own_answer.value->>'promptId'
     AND value->>'dateKey' = own_answer.value->>'dateKey'
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF partner_answer.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Partner has not answered yet.');
  END IF;

  PERFORM set_config('app.allow_prompt_answer_reveal', 'true', true);

  UPDATE couple_data
     SET is_private = false,
         value = jsonb_set(
           jsonb_set(COALESCE(value, '{}'::jsonb), '{isRevealed}', 'true'::jsonb, true),
           '{revealAt}',
           to_jsonb(reveal_ts),
           true
         ),
         updated_at = reveal_ts
   WHERE id IN (own_answer.id, partner_answer.id);

  PERFORM set_config('app.allow_prompt_answer_reveal', 'false', true);

  RETURN jsonb_build_object(
    'success', true,
    'prompt_id', own_answer.value->>'promptId',
    'date_key', own_answer.value->>'dateKey',
    'revealed_at', reveal_ts
  );
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('app.allow_prompt_answer_reveal', 'false', true);
  RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION reveal_prompt_answer(uuid) TO authenticated;


-- ############################################################################
-- PART 7: ACCOUNT DELETION (with row_security = off)
-- ############################################################################

CREATE OR REPLACE FUNCTION delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  _couple_id     uuid;
  _member_count  int;
  _partner_count int;
BEGIN
  SELECT couple_id INTO _couple_id
    FROM couple_members WHERE user_id = auth.uid() LIMIT 1;

  IF _couple_id IS NOT NULL THEN
    SELECT count(*) INTO _member_count
      FROM couple_members WHERE couple_id = _couple_id;

    IF COALESCE(_member_count, 0) <= 1 THEN
      PERFORM cleanup_couple_storage_objects(_couple_id, NULL);
    ELSE
      PERFORM cleanup_couple_storage_objects(_couple_id, auth.uid());
    END IF;

    DELETE FROM couple_data      WHERE couple_id = _couple_id AND created_by = auth.uid();
    DELETE FROM calendar_events  WHERE couple_id = _couple_id AND created_by = auth.uid();
    DELETE FROM moments          WHERE couple_id = _couple_id AND created_by = auth.uid();
    DELETE FROM couple_members   WHERE couple_id = _couple_id AND user_id    = auth.uid();
    SELECT count(*) INTO _partner_count
      FROM couple_members WHERE couple_id = _couple_id;
    IF _partner_count = 0 THEN
      DELETE FROM couple_data     WHERE couple_id = _couple_id;
      DELETE FROM calendar_events WHERE couple_id = _couple_id;
      DELETE FROM moments         WHERE couple_id = _couple_id;
      DELETE FROM partner_link_codes WHERE couple_id = _couple_id;
      DELETE FROM couples         WHERE id = _couple_id;
    ELSE
      -- Partner remains — reassign ownership so couples.created_by FK doesn't block deletion
      UPDATE couples SET created_by = (
        SELECT user_id FROM couple_members WHERE couple_id = _couple_id LIMIT 1
      ) WHERE id = _couple_id AND created_by = auth.uid();
    END IF;
  END IF;

  -- Clean up remaining FK references outside the couple.
  BEGIN
    DELETE FROM partner_link_codes
      WHERE created_by = auth.uid()
         OR used_by = auth.uid();
  EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM date_shortlist     WHERE user_id = auth.uid();   EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM usage_events       WHERE user_id = auth.uid();   EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM user_entitlements   WHERE user_id = auth.uid();   EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM push_tokens        WHERE user_id = auth.uid();   EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM analytics_events   WHERE user_id = auth.uid();   EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM notification_log   WHERE recipient = auth.uid(); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM rate_limit_buckets WHERE user_id = auth.uid();   EXCEPTION WHEN undefined_table THEN NULL; END;

  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION delete_own_account() TO authenticated;


-- ############################################################################
-- PART 8: PUSH NOTIFICATION FUNCTIONS (with search_path + anti-spoof)
-- ############################################################################

-- Send push via Expo API (with notification_log + recipient tracking)
CREATE OR REPLACE FUNCTION send_expo_push(
  p_token text,
  p_title text,
  p_body  text,
  p_data  jsonb DEFAULT '{}'
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

-- Notify partner with anti-spoof check + last_used_at tracking
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
SET row_security = off
AS $$
DECLARE
  partner_token RECORD;
  sender_couple_id uuid;
BEGIN
  -- Anti-spoof: only allow sending as yourself (triggers have auth.uid() = NULL)
  IF auth.uid() IS NOT NULL AND sender_id != auth.uid() THEN
    RAISE EXCEPTION 'Cannot send notifications as another user';
  END IF;

  SELECT couple_id INTO sender_couple_id
    FROM couple_members WHERE user_id = sender_id LIMIT 1;
  IF sender_couple_id IS NULL THEN RETURN; END IF;

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

    UPDATE push_tokens SET last_used_at = now() WHERE id = partner_token.token_id;
  END LOOP;
END;
$$;

-- ############################################################################
-- PART 9: TRIGGERS
-- ############################################################################

-- updated_at triggers
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS guard_profile_premium_fields_before_update ON profiles;
CREATE TRIGGER guard_profile_premium_fields_before_update
  BEFORE UPDATE OF is_premium ON profiles
  FOR EACH ROW EXECUTE FUNCTION guard_profile_premium_fields();

DROP TRIGGER IF EXISTS update_couples_updated_at ON couples;
CREATE TRIGGER update_couples_updated_at
  BEFORE UPDATE ON couples FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_couple_data_updated_at ON couple_data;
-- Use the sync-aware version (GREATEST) so client timestamps survive
DROP TRIGGER IF EXISTS couple_data_updated_at ON couple_data;
CREATE TRIGGER couple_data_updated_at
  BEFORE UPDATE ON couple_data FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS guard_couple_data_immutable_fields_before_update ON couple_data;
CREATE TRIGGER guard_couple_data_immutable_fields_before_update
  BEFORE UPDATE ON couple_data FOR EACH ROW EXECUTE FUNCTION guard_couple_data_immutable_fields();

DROP TRIGGER IF EXISTS enforce_prompt_answer_privacy_before_write ON couple_data;
CREATE TRIGGER enforce_prompt_answer_privacy_before_write
  BEFORE INSERT OR UPDATE ON couple_data
  FOR EACH ROW EXECUTE FUNCTION enforce_prompt_answer_privacy();

DROP TRIGGER IF EXISTS sync_prompt_answer_status_after_write ON couple_data;
CREATE TRIGGER sync_prompt_answer_status_after_write
  AFTER INSERT OR UPDATE ON couple_data
  FOR EACH ROW EXECUTE FUNCTION sync_prompt_answer_status();

DO $$
BEGIN
  PERFORM set_config('app.allow_prompt_answer_reveal', 'true', true);

  UPDATE couple_data
  SET
    is_private = NOT prompt_answer_value_revealed(value),
    value = CASE
      WHEN prompt_answer_value_revealed(value) THEN
        jsonb_set(COALESCE(value, '{}'::jsonb), '{isRevealed}', 'true'::jsonb, true)
      ELSE
        jsonb_set(COALESCE(value, '{}'::jsonb), '{isRevealed}', 'false'::jsonb, true) - 'partnerAnswer' - 'revealAt'
    END
  WHERE data_type = 'prompt_answer'
    AND COALESCE(is_deleted, false) = false;

  PERFORM set_config('app.allow_prompt_answer_reveal', 'false', true);
END $$;

DROP TRIGGER IF EXISTS update_calendar_events_updated_at ON calendar_events;
CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON calendar_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_moments_updated_at ON moments;
CREATE TRIGGER update_moments_updated_at
  BEFORE UPDATE ON moments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_entitlements_updated_at ON user_entitlements;
CREATE TRIGGER update_entitlements_updated_at
  BEFORE UPDATE ON user_entitlements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS experiments_updated_at ON experiments;
CREATE TRIGGER experiments_updated_at
  BEFORE UPDATE ON experiments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Premium sync trigger
DROP TRIGGER IF EXISTS trigger_sync_couple_premium ON couples;
CREATE TRIGGER trigger_sync_couple_premium
  AFTER UPDATE OF is_premium ON couples
  FOR EACH ROW WHEN (OLD.is_premium IS DISTINCT FROM NEW.is_premium)
  EXECUTE FUNCTION sync_couple_premium_to_profiles();

-- Auto-create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Notification trigger functions (with search_path hardening)
CREATE OR REPLACE FUNCTION notify_on_couple_data_insert()
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

  -- Default: use the sender's own chosen display name
  SELECT COALESCE(display_name, email, 'Your partner') INTO sender_name
    FROM profiles WHERE id = NEW.created_by;

  -- Prefer the name the recipient assigned to their partner over the sender's
  -- self-chosen display name. This respects what the user typed in Identity settings.
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

  -- Default notification data (overridden per type below)
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
          'couple_id', NEW.couple_id
        );
      END IF;
    WHEN 'check_in'      THEN notif_title := '🤗 Check-In';
                              notif_body  := sender_name || ' checked in';
    WHEN 'memory'        THEN
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
    ELSE                      notif_title := '💕 Between Us';
                              notif_body  := sender_name || ' shared something new';
  END CASE;

  PERFORM notify_partner(
    NEW.created_by,
    notif_title,
    notif_body,
    notif_data
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO notification_log (token, title, body, status, error_msg)
  VALUES ('trigger_error', 'couple_data_insert', '', 'failed', SQLERRM);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_couple_data ON couple_data;
CREATE TRIGGER trigger_notify_couple_data
  AFTER INSERT ON couple_data
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_couple_data_insert();

CREATE OR REPLACE FUNCTION delete_calendar_event_if_member(p_event_id uuid)
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
  FROM calendar_events ce
  WHERE ce.id = p_event_id;

  IF _couple_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM couple_members m
    WHERE m.couple_id = _couple_id
      AND m.user_id = auth.uid()
  ) THEN
    RETURN false;
  END IF;

  DELETE FROM calendar_events
  WHERE id = p_event_id;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_calendar_event_if_member(uuid) TO authenticated;

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
    jsonb_build_object('type', 'calendar_event', 'route', 'calendar', 'id', NEW.id, 'event_id', NEW.id, 'couple_id', NEW.couple_id)
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO notification_log (token, title, body, status, error_msg)
  VALUES ('trigger_error', 'calendar_event_insert', '', 'failed', SQLERRM);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_calendar_event ON calendar_events;
CREATE TRIGGER trigger_notify_calendar_event
  AFTER INSERT ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_calendar_event_insert();

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
    jsonb_build_object('type', 'moment', 'route', 'journal', 'id', NEW.id, 'moment_id', NEW.id, 'couple_id', NEW.couple_id)
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO notification_log (token, title, body, status, error_msg)
  VALUES ('trigger_error', 'moment_insert', '', 'failed', SQLERRM);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_moment ON moments;
CREATE TRIGGER trigger_notify_moment
  AFTER INSERT ON moments
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_moment_insert();

CREATE OR REPLACE FUNCTION notify_on_couple_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  partner_name   text;
  redeemer_name  text;
  the_creator_id uuid;
  the_redeemer_id uuid;
BEGIN
  IF (SELECT count(*) FROM couple_members WHERE couple_id = NEW.couple_id) = 2 THEN
    SELECT user_id INTO the_creator_id
      FROM couple_members
     WHERE couple_id = NEW.couple_id AND user_id != NEW.user_id
     LIMIT 1;
    the_redeemer_id := NEW.user_id;

    SELECT COALESCE(display_name, email, 'Your partner') INTO redeemer_name
      FROM profiles WHERE id = the_redeemer_id;

    PERFORM notify_partner(
      the_redeemer_id,
      '💕 You''re Linked!',
      redeemer_name || ' has joined your couple on Between Us',
      jsonb_build_object('type', 'partner_linked', 'couple_id', NEW.couple_id)
    );

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
  INSERT INTO notification_log (token, title, body, status, error_msg)
  VALUES ('trigger_error', 'couple_created', '', 'failed', SQLERRM);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_couple_created ON couple_members;
CREATE TRIGGER trigger_notify_couple_created
  AFTER INSERT ON couple_members
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_couple_created();


-- ############################################################################
-- PART 10: ENABLE RLS ON ALL TABLES
-- ############################################################################

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE couples ENABLE ROW LEVEL SECURITY;
ALTER TABLE couple_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE couple_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_link_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_recovery_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_recovery_request_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE date_shortlist ENABLE ROW LEVEL SECURITY;


-- ############################################################################
-- PART 11: RLS POLICIES (drop-then-create for idempotency)
-- ############################################################################

-- ─── PROFILES ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT TO authenticated USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE TO authenticated USING ((select auth.uid()) = id) WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = id);

-- ─── COUPLES ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Couple members can view couple" ON couples;
DROP POLICY IF EXISTS "couple_select" ON couples;
DROP POLICY IF EXISTS "couple_select_v2" ON couples;
CREATE POLICY "Couple members can view couple" ON couples
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM couple_members cm WHERE cm.couple_id = couples.id AND cm.user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Couple members can update couple" ON couples;
CREATE POLICY "Couple members can update couple" ON couples
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM couple_members cm WHERE cm.couple_id = couples.id AND cm.user_id = (select auth.uid()))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM couple_members cm WHERE cm.couple_id = couples.id AND cm.user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Users can create couples" ON couples;
DROP POLICY IF EXISTS "couple_insert" ON couples;
DROP POLICY IF EXISTS "couple_insert_v2" ON couples;
CREATE POLICY "Users can create couples" ON couples
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = created_by);

-- ─── COUPLE_MEMBERS ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own memberships" ON couple_members;
DROP POLICY IF EXISTS "Couple members can view memberships" ON couple_members;
DROP POLICY IF EXISTS "member_select" ON couple_members;
DROP POLICY IF EXISTS "member_select_v2" ON couple_members;
CREATE POLICY "Couple members can view memberships" ON couple_members
  FOR SELECT TO authenticated USING (couple_id IN (SELECT get_my_couple_ids()));

DROP POLICY IF EXISTS "Users can join couple" ON couple_members;
DROP POLICY IF EXISTS "member_insert" ON couple_members;
DROP POLICY IF EXISTS "member_insert_v2" ON couple_members;
CREATE POLICY "Users can join couple" ON couple_members
  FOR INSERT TO authenticated WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM couples c
      WHERE c.id = couple_members.couple_id
        AND c.created_by = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "member_update" ON couple_members;
DROP POLICY IF EXISTS "member_update_v2" ON couple_members;
DROP POLICY IF EXISTS "Users can update own membership" ON couple_members;
CREATE POLICY "Users can update own membership" ON couple_members
  FOR UPDATE TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "member_delete" ON couple_members;
DROP POLICY IF EXISTS "member_delete_v2" ON couple_members;
DROP POLICY IF EXISTS "Users can leave couple" ON couple_members;
CREATE POLICY "Users can leave couple" ON couple_members
  FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

-- ─── COUPLE_DATA ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Couple members can view shared data" ON couple_data;
DROP POLICY IF EXISTS "couple_read_data" ON couple_data;
DROP POLICY IF EXISTS "couple_data_select_v2" ON couple_data;
DROP POLICY IF EXISTS "Couple data select" ON couple_data;
CREATE POLICY "Couple data select" ON couple_data
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM couple_members cm WHERE cm.couple_id = couple_data.couple_id AND cm.user_id = (select auth.uid()))
    AND (is_private IS NOT TRUE OR created_by = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Couple members can insert data" ON couple_data;
DROP POLICY IF EXISTS "Couple members can insert data (premium-aware)" ON couple_data;
DROP POLICY IF EXISTS "couple_insert_data" ON couple_data;
DROP POLICY IF EXISTS "couple_data_insert_v2" ON couple_data;
DROP POLICY IF EXISTS "Couple data insert (premium-aware)" ON couple_data;
CREATE POLICY "Couple data insert (premium-aware)" ON couple_data
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM couple_members cm WHERE cm.couple_id = couple_data.couple_id AND cm.user_id = (select auth.uid()))
    AND created_by = (select auth.uid())
    AND (
      is_user_premium()
      OR data_type IN (
        'journal',
        'prompt_answer',
        'check_in',
        'vibe',
        'couple_state',
        'moment_signal',
        'attachment_meta',
        'date_plan',
        'daily_prompt',
        'daily_quiz',
        'custom_ritual',
        'love_note',
        'whisper'
      )
      OR (data_type = 'memory' AND user_data_count(couple_id, 'memory') < 10)
    )
  );

DROP POLICY IF EXISTS "Creators can update own data" ON couple_data;
DROP POLICY IF EXISTS "couple_update_data" ON couple_data;
DROP POLICY IF EXISTS "couple_data_update_v2" ON couple_data;
DROP POLICY IF EXISTS "Couple data update" ON couple_data;
CREATE POLICY "Couple data update" ON couple_data
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM couple_members cm WHERE cm.couple_id = couple_data.couple_id AND cm.user_id = (select auth.uid()))
    AND (
      created_by = (select auth.uid())
      OR data_type IN ('couple_state', 'daily_prompt', 'daily_quiz', 'date_plan', 'whisper')
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM couple_members cm WHERE cm.couple_id = couple_data.couple_id AND cm.user_id = (select auth.uid()))
    AND (
      created_by = (select auth.uid())
      OR data_type IN ('couple_state', 'daily_prompt', 'daily_quiz', 'date_plan', 'whisper')
    )
  );

DROP POLICY IF EXISTS "Creators can delete own data" ON couple_data;
DROP POLICY IF EXISTS "couple_delete_data" ON couple_data;
DROP POLICY IF EXISTS "couple_data_delete_v2" ON couple_data;
DROP POLICY IF EXISTS "Couple data delete" ON couple_data;
CREATE POLICY "Couple data delete" ON couple_data
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM couple_members cm WHERE cm.couple_id = couple_data.couple_id AND cm.user_id = (select auth.uid()))
    AND (
      created_by = (select auth.uid())
      OR data_type IN ('couple_state', 'daily_prompt', 'daily_quiz', 'date_plan')
    )
  );

-- ─── CALENDAR_EVENTS ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Couple members can view calendar events" ON calendar_events;
CREATE POLICY "Couple members can view calendar events" ON calendar_events
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM couple_members m WHERE m.couple_id = calendar_events.couple_id AND m.user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Premium members can create calendar events" ON calendar_events;
DROP POLICY IF EXISTS "Couple members can create calendar events" ON calendar_events;
CREATE POLICY "Couple members can create calendar events" ON calendar_events
  FOR INSERT TO authenticated WITH CHECK (
    created_by = (select auth.uid())
    AND EXISTS (SELECT 1 FROM couple_members m WHERE m.couple_id = calendar_events.couple_id AND m.user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Premium creators can update calendar events" ON calendar_events;
DROP POLICY IF EXISTS "Premium members can update calendar events" ON calendar_events;
DROP POLICY IF EXISTS "Couple members can update calendar events" ON calendar_events;
CREATE POLICY "Couple members can update calendar events" ON calendar_events
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM couple_members m WHERE m.couple_id = calendar_events.couple_id AND m.user_id = (select auth.uid()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM couple_members m WHERE m.couple_id = calendar_events.couple_id AND m.user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Premium creators can delete calendar events" ON calendar_events;
DROP POLICY IF EXISTS "Premium members can delete calendar events" ON calendar_events;
DROP POLICY IF EXISTS "Couple members can delete calendar events" ON calendar_events;
CREATE POLICY "Couple members can delete calendar events" ON calendar_events
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM couple_members m WHERE m.couple_id = calendar_events.couple_id AND m.user_id = (select auth.uid()))
  );

-- ─── MOMENTS ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Couple members can view moments" ON moments;
CREATE POLICY "Couple members can view moments" ON moments
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM couple_members m WHERE m.couple_id = moments.couple_id AND m.user_id = (select auth.uid()))
    AND (is_private = false OR created_by = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Couple members can create moments" ON moments;
CREATE POLICY "Couple members can create moments" ON moments
  FOR INSERT TO authenticated WITH CHECK (
    created_by = (select auth.uid())
    AND EXISTS (SELECT 1 FROM couple_members m WHERE m.couple_id = moments.couple_id AND m.user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Creators can update moments" ON moments;
CREATE POLICY "Creators can update moments" ON moments
  FOR UPDATE TO authenticated USING (
    created_by = (select auth.uid())
    AND EXISTS (SELECT 1 FROM couple_members m WHERE m.couple_id = moments.couple_id AND m.user_id = (select auth.uid()))
  )
  WITH CHECK (
    created_by = (select auth.uid())
    AND EXISTS (SELECT 1 FROM couple_members m WHERE m.couple_id = moments.couple_id AND m.user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Creators can delete moments" ON moments;
CREATE POLICY "Creators can delete moments" ON moments
  FOR DELETE TO authenticated USING (
    created_by = (select auth.uid())
    AND EXISTS (SELECT 1 FROM couple_members m WHERE m.couple_id = moments.couple_id AND m.user_id = (select auth.uid()))
  );

-- ─── PARTNER_LINK_CODES ───────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own link codes" ON partner_link_codes;
CREATE POLICY "Users can view own link codes" ON partner_link_codes
  FOR SELECT TO authenticated USING (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can create link codes" ON partner_link_codes;
CREATE POLICY "Authenticated users can create link codes" ON partner_link_codes
  FOR INSERT TO authenticated WITH CHECK (
    created_by = (select auth.uid())
    AND (
      couple_id IS NULL
      OR EXISTS (
        SELECT 1 FROM couple_members cm
        WHERE cm.couple_id = partner_link_codes.couple_id
          AND cm.user_id = (select auth.uid())
      )
    )
    AND (
      couple_id IS NOT NULL
      OR NOT EXISTS (SELECT 1 FROM couple_members WHERE user_id = (select auth.uid()))
    )
  );

-- ─── USER_ENTITLEMENTS ────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own entitlements" ON user_entitlements;
CREATE POLICY "Users can view own entitlements" ON user_entitlements
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));

-- Entitlements are managed server-side only (RevenueCat webhook → service_role).
-- Explicit deny prevents client-side privilege escalation.
DROP POLICY IF EXISTS "Deny client entitlement writes" ON user_entitlements;
CREATE POLICY "Deny client entitlement writes" ON user_entitlements
  FOR INSERT TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "Deny client entitlement updates" ON user_entitlements;
CREATE POLICY "Deny client entitlement updates" ON user_entitlements
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

-- ─── USAGE_EVENTS ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can insert own usage events" ON usage_events;
CREATE POLICY "Users can insert own usage events" ON usage_events
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id AND is_couple_member(couple_id, (select auth.uid())));

DROP POLICY IF EXISTS "Users can read couple usage events" ON usage_events;
DROP POLICY IF EXISTS "Users can read own usage events" ON usage_events;
CREATE POLICY "Users can read own usage events" ON usage_events
  FOR SELECT TO authenticated USING (
    user_id = (select auth.uid())
    AND is_couple_member(couple_id, (select auth.uid()))
  );

DROP POLICY IF EXISTS "Users can delete own usage events" ON usage_events;
CREATE POLICY "Users can delete own usage events" ON usage_events
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- ─── ANALYTICS_EVENTS ─────────────────────────────────────────────
DROP POLICY IF EXISTS "analytics_insert_own" ON analytics_events;
DROP POLICY IF EXISTS analytics_insert_own ON analytics_events;
CREATE POLICY "analytics_insert_own" ON analytics_events
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "analytics_select_own" ON analytics_events;
DROP POLICY IF EXISTS analytics_select_own ON analytics_events;
CREATE POLICY "analytics_select_own" ON analytics_events
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

-- ─── RATE_LIMIT_BUCKETS ───────────────────────────────────────────
DROP POLICY IF EXISTS "service_role_only" ON rate_limit_buckets;
CREATE POLICY "service_role_only" ON rate_limit_buckets
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── PUSH_TOKENS ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own push tokens" ON push_tokens;
CREATE POLICY "Users can view own push tokens" ON push_tokens
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own push tokens" ON push_tokens;
CREATE POLICY "Users can insert own push tokens" ON push_tokens
  FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own push tokens" ON push_tokens;
CREATE POLICY "Users can update own push tokens" ON push_tokens
  FOR UPDATE TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own push tokens" ON push_tokens;
CREATE POLICY "Users can delete own push tokens" ON push_tokens
  FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

-- ─── NOTIFICATION_LOG ─────────────────────────────────────────────
DROP POLICY IF EXISTS "notification_log_service_only" ON notification_log;
CREATE POLICY "notification_log_service_only" ON notification_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── EXPERIMENTS ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Enabled experiments are readable" ON experiments;
CREATE POLICY "Enabled experiments are readable" ON experiments
  FOR SELECT TO anon, authenticated USING (enabled = true);

DROP POLICY IF EXISTS "Service role can manage experiments" ON experiments;
CREATE POLICY "Service role can manage experiments" ON experiments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── PASSWORD_RECOVERY ─────────────────────────────────────────────
DROP POLICY IF EXISTS password_recovery_codes_service_only ON password_recovery_codes;
CREATE POLICY password_recovery_codes_service_only ON password_recovery_codes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS password_recovery_request_limits_service_only ON password_recovery_request_limits;
CREATE POLICY password_recovery_request_limits_service_only ON password_recovery_request_limits
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── DATE_SHORTLIST ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can read their own date shortlist" ON date_shortlist;
CREATE POLICY "Users can read their own date shortlist" ON date_shortlist
  FOR SELECT TO authenticated USING (
    (select auth.uid()) = user_id
    OR (
      couple_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM couple_members m
        WHERE m.couple_id = date_shortlist.couple_id
          AND m.user_id = (select auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "Users can insert their own date shortlist" ON date_shortlist;
CREATE POLICY "Users can insert their own date shortlist" ON date_shortlist
  FOR INSERT TO authenticated WITH CHECK (
    (select auth.uid()) = user_id
    AND (
      couple_id IS NULL
      OR EXISTS (
        SELECT 1 FROM couple_members m
        WHERE m.couple_id = date_shortlist.couple_id
          AND m.user_id = (select auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "Users can update their own date shortlist" ON date_shortlist;
CREATE POLICY "Users can update their own date shortlist" ON date_shortlist
  FOR UPDATE TO authenticated
  USING (
    (select auth.uid()) = user_id
    OR (
      couple_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM couple_members m
        WHERE m.couple_id = date_shortlist.couple_id
          AND m.user_id = (select auth.uid())
      )
    )
  )
  WITH CHECK (
    (select auth.uid()) = user_id
    OR (
      couple_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM couple_members m
        WHERE m.couple_id = date_shortlist.couple_id
          AND m.user_id = (select auth.uid())
      )
    )
  );

-- Restrictive policies block Supabase anonymous-auth users. Anonymous auth
-- receives the authenticated role, so this protects all private app tables.
DROP POLICY IF EXISTS block_anonymous_auth_users ON profiles;
CREATE POLICY block_anonymous_auth_users ON profiles
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((select is_permanent_authenticated_user()))
  WITH CHECK ((select is_permanent_authenticated_user()));

DROP POLICY IF EXISTS block_anonymous_auth_users ON couples;
CREATE POLICY block_anonymous_auth_users ON couples
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((select is_permanent_authenticated_user()))
  WITH CHECK ((select is_permanent_authenticated_user()));

DROP POLICY IF EXISTS block_anonymous_auth_users ON couple_members;
CREATE POLICY block_anonymous_auth_users ON couple_members
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((select is_permanent_authenticated_user()))
  WITH CHECK ((select is_permanent_authenticated_user()));

DROP POLICY IF EXISTS block_anonymous_auth_users ON couple_data;
CREATE POLICY block_anonymous_auth_users ON couple_data
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((select is_permanent_authenticated_user()))
  WITH CHECK ((select is_permanent_authenticated_user()));

DROP POLICY IF EXISTS block_anonymous_auth_users ON calendar_events;
CREATE POLICY block_anonymous_auth_users ON calendar_events
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((select is_permanent_authenticated_user()))
  WITH CHECK ((select is_permanent_authenticated_user()));

DROP POLICY IF EXISTS block_anonymous_auth_users ON moments;
CREATE POLICY block_anonymous_auth_users ON moments
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((select is_permanent_authenticated_user()))
  WITH CHECK ((select is_permanent_authenticated_user()));

DROP POLICY IF EXISTS block_anonymous_auth_users ON partner_link_codes;
CREATE POLICY block_anonymous_auth_users ON partner_link_codes
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((select is_permanent_authenticated_user()))
  WITH CHECK ((select is_permanent_authenticated_user()));

DROP POLICY IF EXISTS block_anonymous_auth_users ON user_entitlements;
CREATE POLICY block_anonymous_auth_users ON user_entitlements
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((select is_permanent_authenticated_user()))
  WITH CHECK ((select is_permanent_authenticated_user()));

DROP POLICY IF EXISTS block_anonymous_auth_users ON usage_events;
CREATE POLICY block_anonymous_auth_users ON usage_events
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((select is_permanent_authenticated_user()))
  WITH CHECK ((select is_permanent_authenticated_user()));

DROP POLICY IF EXISTS block_anonymous_auth_users ON analytics_events;
CREATE POLICY block_anonymous_auth_users ON analytics_events
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((select is_permanent_authenticated_user()))
  WITH CHECK ((select is_permanent_authenticated_user()));

DROP POLICY IF EXISTS block_anonymous_auth_users ON push_tokens;
CREATE POLICY block_anonymous_auth_users ON push_tokens
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((select is_permanent_authenticated_user()))
  WITH CHECK ((select is_permanent_authenticated_user()));

DROP POLICY IF EXISTS block_anonymous_auth_users ON date_shortlist;
CREATE POLICY block_anonymous_auth_users ON date_shortlist
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((select is_permanent_authenticated_user()))
  WITH CHECK ((select is_permanent_authenticated_user()));


-- ############################################################################
-- PART 12: STORAGE BUCKETS & POLICIES
-- ############################################################################

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'attachments',
  'attachments',
  false,
  52428800,
  ARRAY[
    'application/octet-stream',
    'video/mp4',
    'video/quicktime',
    'video/mov',
    'video/x-m4v'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'whispers',
  'whispers',
  false,
  10485760,
  ARRAY['audio/mp4', 'audio/m4a', 'audio/aac', 'audio/mpeg', 'audio/wav']::text[]
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'couple-media',
  'couple-media',
  false,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Attachments storage policies
DROP POLICY IF EXISTS "couple_upload_attachments" ON storage.objects;
DROP POLICY IF EXISTS "attachments_insert_v2" ON storage.objects;
DROP POLICY IF EXISTS "attachments_insert" ON storage.objects;
CREATE POLICY "attachments_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[2] = (select auth.uid())::text
    AND EXISTS (
      SELECT 1 FROM couple_members cm
      WHERE cm.couple_id = (storage.foldername(name))[1]::uuid AND cm.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "couple_read_attachments" ON storage.objects;
DROP POLICY IF EXISTS "attachments_select_v2" ON storage.objects;
DROP POLICY IF EXISTS "attachments_select" ON storage.objects;
CREATE POLICY "attachments_select" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'attachments'
    AND EXISTS (
      SELECT 1 FROM couple_members cm
      WHERE cm.couple_id = (storage.foldername(name))[1]::uuid AND cm.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "couple_delete_attachments" ON storage.objects;
DROP POLICY IF EXISTS "attachments_delete_v2" ON storage.objects;
DROP POLICY IF EXISTS "attachments_delete" ON storage.objects;
CREATE POLICY "attachments_delete" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[2] = (select auth.uid())::text
    AND EXISTS (
      SELECT 1 FROM couple_members cm
      WHERE cm.couple_id = (storage.foldername(name))[1]::uuid AND cm.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS storage_attachments_member_select ON storage.objects;
CREATE POLICY storage_attachments_member_select ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'attachments'
    AND EXISTS (
      SELECT 1 FROM couple_members cm
      WHERE cm.user_id = (select auth.uid())
        AND cm.couple_id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS storage_attachments_member_insert ON storage.objects;
CREATE POLICY storage_attachments_member_insert ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[2] = (select auth.uid())::text
    AND EXISTS (
      SELECT 1 FROM couple_members cm
      WHERE cm.user_id = (select auth.uid())
        AND cm.couple_id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS storage_attachments_member_update ON storage.objects;
CREATE POLICY storage_attachments_member_update ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'attachments'
    AND ((storage.foldername(name))[2] = (select auth.uid())::text OR owner = (select auth.uid()))
    AND EXISTS (
      SELECT 1 FROM couple_members cm
      WHERE cm.user_id = (select auth.uid())
        AND cm.couple_id::text = (storage.foldername(name))[1]
    )
  )
  WITH CHECK (
    bucket_id = 'attachments'
    AND ((storage.foldername(name))[2] = (select auth.uid())::text OR owner = (select auth.uid()))
    AND EXISTS (
      SELECT 1 FROM couple_members cm
      WHERE cm.user_id = (select auth.uid())
        AND cm.couple_id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS storage_attachments_member_delete ON storage.objects;
CREATE POLICY storage_attachments_member_delete ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'attachments'
    AND ((storage.foldername(name))[2] = (select auth.uid())::text OR owner = (select auth.uid()))
    AND EXISTS (
      SELECT 1 FROM couple_members cm
      WHERE cm.user_id = (select auth.uid())
        AND cm.couple_id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS storage_whispers_member_select ON storage.objects;
CREATE POLICY storage_whispers_member_select ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'whispers'
    AND EXISTS (
      SELECT 1 FROM couple_members cm
      WHERE cm.user_id = (select auth.uid())
        AND cm.couple_id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS storage_whispers_member_insert ON storage.objects;
CREATE POLICY storage_whispers_member_insert ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'whispers'
    AND EXISTS (
      SELECT 1 FROM couple_members cm
      WHERE cm.user_id = (select auth.uid())
        AND cm.couple_id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS storage_whispers_member_update ON storage.objects;
CREATE POLICY storage_whispers_member_update ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'whispers'
    AND EXISTS (
      SELECT 1 FROM couple_members cm
      WHERE cm.user_id = (select auth.uid())
        AND cm.couple_id::text = (storage.foldername(name))[1]
    )
  )
  WITH CHECK (
    bucket_id = 'whispers'
    AND EXISTS (
      SELECT 1 FROM couple_members cm
      WHERE cm.user_id = (select auth.uid())
        AND cm.couple_id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS storage_whispers_member_delete ON storage.objects;
CREATE POLICY storage_whispers_member_delete ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'whispers'
    AND EXISTS (
      SELECT 1 FROM couple_members cm
      WHERE cm.user_id = (select auth.uid())
        AND cm.couple_id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS "Couple members can upload media" ON storage.objects;
DROP POLICY IF EXISTS "Couple members can view media" ON storage.objects;
DROP POLICY IF EXISTS "Couple members can delete own media" ON storage.objects;

DROP POLICY IF EXISTS storage_couple_media_member_select ON storage.objects;
CREATE POLICY storage_couple_media_member_select ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'couple-media'
    AND (storage.foldername(name))[1] = 'couples'
    AND EXISTS (
      SELECT 1 FROM couple_members m
      WHERE m.user_id = (select auth.uid())
        AND (storage.foldername(name))[2] = m.couple_id::text
    )
  );

DROP POLICY IF EXISTS storage_couple_media_member_insert ON storage.objects;
CREATE POLICY storage_couple_media_member_insert ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'couple-media'
    AND (storage.foldername(name))[1] = 'couples'
    AND EXISTS (
      SELECT 1 FROM couple_members m
      WHERE m.user_id = (select auth.uid())
        AND (storage.foldername(name))[2] = m.couple_id::text
    )
  );

DROP POLICY IF EXISTS storage_couple_media_member_update ON storage.objects;
CREATE POLICY storage_couple_media_member_update ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'couple-media'
    AND (storage.foldername(name))[1] = 'couples'
    AND EXISTS (
      SELECT 1 FROM couple_members m
      WHERE m.user_id = (select auth.uid())
        AND (storage.foldername(name))[2] = m.couple_id::text
    )
  )
  WITH CHECK (
    bucket_id = 'couple-media'
    AND (storage.foldername(name))[1] = 'couples'
    AND EXISTS (
      SELECT 1 FROM couple_members m
      WHERE m.user_id = (select auth.uid())
        AND (storage.foldername(name))[2] = m.couple_id::text
    )
  );

DROP POLICY IF EXISTS storage_couple_media_member_delete ON storage.objects;
CREATE POLICY storage_couple_media_member_delete ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'couple-media'
    AND owner = (select auth.uid())
    AND (storage.foldername(name))[1] = 'couples'
    AND EXISTS (
      SELECT 1 FROM couple_members m
      WHERE m.user_id = (select auth.uid())
        AND (storage.foldername(name))[2] = m.couple_id::text
    )
  );

DROP POLICY IF EXISTS block_anonymous_auth_users ON storage.objects;
CREATE POLICY block_anonymous_auth_users ON storage.objects
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((select is_permanent_authenticated_user()))
  WITH CHECK ((select is_permanent_authenticated_user()));


-- ############################################################################
-- PART 13: REALTIME + REPLICA IDENTITY
-- ############################################################################

-- Add tables to realtime publication
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE couple_data;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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

-- couples must be in the publication so EntitlementsContext real-time
-- premium listener fires when the RevenueCat webhook updates is_premium.
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE couples;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- REPLICA IDENTITY FULL for RLS evaluation on UPDATE/DELETE events
ALTER TABLE couple_data     REPLICA IDENTITY FULL;
ALTER TABLE calendar_events REPLICA IDENTITY FULL;
ALTER TABLE moments         REPLICA IDENTITY FULL;
ALTER TABLE couple_members  REPLICA IDENTITY FULL;
ALTER TABLE couples         REPLICA IDENTITY FULL;


-- ############################################################################
-- PART 14: GRANTS
-- ############################################################################

REVOKE ALL ON FUNCTION check_rate_limit(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION check_sensitive_rate_limit(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION cleanup_couple_storage_objects(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION get_user_couple_id(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION guard_profile_premium_fields() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION guard_couple_data_immutable_fields() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION enforce_prompt_answer_privacy() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION sync_prompt_answer_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION prompt_answer_value_revealed(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION is_premium_user(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION notify_on_calendar_event_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION notify_on_couple_created() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION notify_on_couple_data_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION notify_on_moment_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION send_expo_push(text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION sync_couple_premium_to_profiles() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION create_couple_for_qr() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION delete_calendar_event_if_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION delete_own_account() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION get_couple_premium_status(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION get_daily_usage_count(uuid, uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION get_my_couple_ids() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION get_partner_profile_summary() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION is_couple_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION is_permanent_authenticated_user() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION is_user_premium() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION user_data_count(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION couple_has_premium(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION leave_couple() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION notify_partner(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION redeem_partner_code(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION reveal_prompt_answer(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION set_couple_premium(uuid, boolean, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION create_couple_for_qr() TO authenticated;
GRANT EXECUTE ON FUNCTION delete_calendar_event_if_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_own_account() TO authenticated;
GRANT EXECUTE ON FUNCTION get_couple_premium_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_daily_usage_count(uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_couple_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION get_partner_profile_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION is_couple_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION is_permanent_authenticated_user() TO authenticated;
GRANT EXECUTE ON FUNCTION is_user_premium() TO authenticated;
GRANT EXECUTE ON FUNCTION user_data_count(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION leave_couple() TO authenticated;
GRANT EXECUTE ON FUNCTION redeem_partner_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION reveal_prompt_answer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION set_couple_premium(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION send_expo_push(text, text, text, jsonb) TO service_role;


-- ############################################################################
-- PART 15: CRON JOBS (unschedule-then-schedule for idempotency)
-- ############################################################################

-- 1. Clean expired link codes (hourly)
SELECT cron.unschedule('cleanup-expired-codes')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-codes');
SELECT cron.schedule(
  'cleanup-expired-codes',
  '0 * * * *',
  $$DELETE FROM partner_link_codes WHERE expires_at < now() AND used_at IS NULL$$
);

-- 2. Remove push tokens for deleted users (daily 4 AM UTC)
SELECT cron.unschedule('cleanup-orphan-push-tokens')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-orphan-push-tokens');
SELECT cron.schedule(
  'cleanup-orphan-push-tokens',
  '0 4 * * *',
  $$DELETE FROM push_tokens WHERE user_id NOT IN (SELECT id FROM auth.users)$$
);

-- 3. Remove push tokens unused for 90 days (daily 4:30 AM UTC)
SELECT cron.unschedule('cleanup-stale-push-tokens')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-stale-push-tokens');
SELECT cron.schedule(
  'cleanup-stale-push-tokens',
  '30 4 * * *',
  $$DELETE FROM push_tokens WHERE (last_used_at IS NOT NULL AND last_used_at < now() - interval '90 days') OR (last_used_at IS NULL AND created_at < now() - interval '90 days')$$
);

-- 4. Rate-limit bucket refill (every 5 min)
SELECT cron.unschedule('rate-limit-refill')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rate-limit-refill');
SELECT cron.schedule(
  'rate-limit-refill',
  '*/5 * * * *',
  $$UPDATE rate_limit_buckets SET tokens = max_tokens, last_refill = now() WHERE tokens < max_tokens$$
);

-- 5. Prune old notification log entries (daily 5 AM UTC, keep 30 days)
SELECT cron.unschedule('cleanup-notification-log')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-notification-log');
SELECT cron.schedule(
  'cleanup-notification-log',
  '0 5 * * *',
  $$DELETE FROM notification_log WHERE created_at < now() - interval '30 days'$$
);

-- 6. Clean up rate-limit buckets for deleted users (daily 3 AM UTC)
SELECT cron.unschedule('rate-limit-cleanup')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rate-limit-cleanup');
SELECT cron.schedule(
  'rate-limit-cleanup',
  '0 3 * * *',
  $$DELETE FROM rate_limit_buckets WHERE user_id NOT IN (SELECT id FROM auth.users)$$
);

-- 7. Clean up orphaned couples (no couple_members rows) daily 3:30 AM UTC.
--    These accumulate when a user generates an invite code that is never redeemed
--    and the client cleans up the solo couple_members row but leaves the couples row.
SELECT cron.unschedule('cleanup-orphaned-couples')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-orphaned-couples');
SELECT cron.schedule(
  'cleanup-orphaned-couples',
  '30 3 * * *',
  $$DELETE FROM couples WHERE id NOT IN (SELECT couple_id FROM couple_members) AND created_at < now() - interval '1 hour'$$
);


-- ############################################################################
-- PART 16: BACKFILL + COMMENTS
-- ############################################################################

-- Backfill profiles for any existing users missing one
INSERT INTO profiles (id, email, display_name)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1))
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE analytics_events IS 'Privacy-respecting analytics events flushed from the mobile client';


-- ############################################################################
-- VERIFICATION QUERIES (uncomment to check after running)
-- ############################################################################
-- -- All SECURITY DEFINER functions have search_path set:
-- SELECT p.proname, pg_get_functiondef(p.oid)
--   FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
--  WHERE n.nspname = 'public' AND p.prosecdef = true
--  ORDER BY p.proname;
--
-- -- Realtime publication tables:
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
--
-- -- REPLICA IDENTITY is FULL on all realtime tables:
-- SELECT relname, relreplident FROM pg_class
--  WHERE relname IN ('couple_data','calendar_events','moments','couple_members','couples');
--
-- -- Cron jobs active:
-- SELECT jobname, schedule, command FROM cron.job ORDER BY jobname;


-- ############################################################################
-- DONE
-- ############################################################################
-- This file includes everything from:
--   supabase-full-setup.sql        — 12 tables, 40+ indexes, 20+ functions, all RLS
--   supabase-audit-fixes.sql       — notification_log, handle_new_user trigger, cron jobs
--   supabase-security-hardening.sql — SET search_path on all functions, anti-spoof, row_security
--   supabase-realtime-replica-identity.sql — REPLICA IDENTITY FULL on 5 tables
--   supabase-unique-user-couple.sql — single-couple-per-user constraint
--
-- Additional fixes (March 29, 2026):
--   • couples added to supabase_realtime publication (EntitlementsContext listener)
--   • cleanup-orphaned-couples cron job (solo couple rows left by generateInviteCode)
--   • create_couple_for_qr, leave_couple added to Part 14 grants
--
-- Fully idempotent — safe to re-run at any time.
