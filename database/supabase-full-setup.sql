-- ============================================================================
-- 🚀 BETWEENUS — COMPLETE DATABASE SETUP (All-in-One)
-- ============================================================================
-- Paste this entire file into Supabase SQL Editor → New query → Run
-- Fully idempotent: safe to re-run on an existing database.
-- ============================================================================


-- ============================================================================
-- PART 1: EXTENSIONS & CORE TABLES
-- ============================================================================

-- Enable pg_net for async HTTP requests (used by push notifications)
-- pg_net is pre-installed on Supabase — just needs to be enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

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

-- Add premium columns to couples (from couple-premium migration)
ALTER TABLE couples ADD COLUMN IF NOT EXISTS is_premium boolean DEFAULT false;
ALTER TABLE couples ADD COLUMN IF NOT EXISTS premium_since timestamptz;
DO $$ BEGIN
  ALTER TABLE couples ADD COLUMN premium_source text DEFAULT 'none'
    CHECK (premium_source IN ('none', 'user_a', 'user_b'));
EXCEPTION WHEN duplicate_column THEN NULL;
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

-- X25519 key exchange + multi-device columns (from v2 hardening)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='couple_members' AND column_name='public_key') THEN
    ALTER TABLE couple_members ADD COLUMN public_key text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='couple_members' AND column_name='device_id') THEN
    ALTER TABLE couple_members ADD COLUMN device_id text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='couple_members' AND column_name='wrapped_couple_key') THEN
    ALTER TABLE couple_members ADD COLUMN wrapped_couple_key text;
  END IF;
END $$;

-- Couple data (generic key-value store for all couple content)
CREATE TABLE IF NOT EXISTS couple_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id uuid REFERENCES couples(id) ON DELETE CASCADE NOT NULL,
  key text NOT NULL,
  value jsonb,
  encrypted_value text,
  data_type text NOT NULL DEFAULT 'unknown',
  created_by uuid REFERENCES auth.users NOT NULL,
  is_private boolean DEFAULT false,
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tombstone columns for soft-delete sync (from v2 hardening)
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
  encrypted_content text,
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

-- Rate limit buckets
CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tokens INT NOT NULL DEFAULT 60,
  max_tokens INT NOT NULL DEFAULT 60,
  last_refill TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
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


-- ============================================================================
-- PART 2: INDEXES
-- ============================================================================

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

-- push_tokens
CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON push_tokens(token);


-- ============================================================================
-- PART 3: HELPER FUNCTIONS
-- ============================================================================

-- updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Sync-aware updated_at (preserves future client timestamps)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = GREATEST(NEW.updated_at, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Get couple ID for a user
CREATE OR REPLACE FUNCTION get_user_couple_id(input_user_id uuid)
RETURNS uuid AS $$
BEGIN
  RETURN (SELECT couple_id FROM couple_members WHERE user_id = input_user_id LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is a member of a couple
CREATE OR REPLACE FUNCTION is_couple_member(couple_uuid uuid, user_uuid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM couple_members
    WHERE couple_id = couple_uuid AND user_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Return current user's couple_ids (bypasses RLS — prevents recursion)
CREATE OR REPLACE FUNCTION get_my_couple_ids()
RETURNS SETOF uuid AS $$
  SELECT couple_id FROM couple_members WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check premium via user_entitlements
CREATE OR REPLACE FUNCTION is_premium_user(check_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_entitlements
    WHERE user_id = check_user_id
      AND is_premium = true
      AND (expires_at IS NULL OR expires_at > now())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check premium via profiles (legacy)
CREATE OR REPLACE FUNCTION is_user_premium()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE((SELECT is_premium FROM profiles WHERE id = auth.uid()), false);
$$;

-- Count couple_data rows of a given type for the current user
CREATE OR REPLACE FUNCTION user_data_count(p_couple_id uuid, p_data_type text)
RETURNS bigint
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT count(*) FROM couple_data
  WHERE couple_id = p_couple_id AND data_type = p_data_type AND created_by = auth.uid();
$$;

-- Check if EITHER partner has premium (shared premium)
CREATE OR REPLACE FUNCTION couple_has_premium(check_couple_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM couple_members cm
    JOIN user_entitlements ue ON ue.user_id = cm.user_id
    WHERE cm.couple_id = check_couple_id
      AND ue.is_premium = true
      AND (ue.expires_at IS NULL OR ue.expires_at > now())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get couple premium status
CREATE OR REPLACE FUNCTION get_couple_premium_status(input_couple_id uuid)
RETURNS jsonb AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Count daily usage for a user
CREATE OR REPLACE FUNCTION get_daily_usage_count(
  input_couple_id uuid, input_user_id uuid, input_event_type text, input_day_key text
) RETURNS integer AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set couple premium status
CREATE OR REPLACE FUNCTION set_couple_premium(
  input_couple_id uuid, input_is_premium boolean, input_source text DEFAULT 'none'
) RETURNS void AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Sync couple premium to profile flags
CREATE OR REPLACE FUNCTION sync_couple_premium_to_profiles()
RETURNS trigger AS $$
BEGIN
  UPDATE profiles SET is_premium = NEW.is_premium, updated_at = now()
  WHERE id IN (SELECT user_id FROM couple_members WHERE couple_id = NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Redeem partner link code (atomic: validate → create couple → add members → mark used)
CREATE OR REPLACE FUNCTION redeem_partner_code(input_code_hash text, redeemer_id uuid)
RETURNS jsonb AS $$
DECLARE
  code_row partner_link_codes%ROWTYPE;
  new_couple_id uuid;
  creator_id uuid;
BEGIN
  SELECT * INTO code_row FROM partner_link_codes
  WHERE code_hash = input_code_hash AND used_at IS NULL AND expires_at > now()
  FOR UPDATE;

  IF code_row IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid, expired, or already-used code');
  END IF;

  creator_id := code_row.created_by;

  IF creator_id = redeemer_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot pair with yourself');
  END IF;
  IF EXISTS (SELECT 1 FROM couple_members WHERE user_id = creator_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Code creator is already in a couple');
  END IF;
  IF EXISTS (SELECT 1 FROM couple_members WHERE user_id = redeemer_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are already in a couple');
  END IF;

  INSERT INTO couples (created_by) VALUES (creator_id) RETURNING id INTO new_couple_id;
  INSERT INTO couple_members (couple_id, user_id, role) VALUES
    (new_couple_id, creator_id, 'member'),
    (new_couple_id, redeemer_id, 'member');
  UPDATE partner_link_codes SET used_at = now(), used_by = redeemer_id, couple_id = new_couple_id
  WHERE id = code_row.id;

  RETURN jsonb_build_object(
    'success', true, 'couple_id', new_couple_id,
    'creator_id', creator_id, 'redeemer_id', redeemer_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Rate-limit token bucket check
CREATE OR REPLACE FUNCTION check_rate_limit(p_user_id UUID, p_cost INT DEFAULT 1)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_bucket rate_limit_buckets%ROWTYPE;
  v_elapsed INTERVAL;
  v_refill INT;
  v_new_tokens INT;
BEGIN
  INSERT INTO rate_limit_buckets (user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO v_bucket FROM rate_limit_buckets WHERE user_id = p_user_id FOR UPDATE;
  v_elapsed := now() - v_bucket.last_refill;
  v_refill := GREATEST(0, EXTRACT(EPOCH FROM v_elapsed)::INT);
  v_new_tokens := LEAST(v_bucket.max_tokens, v_bucket.tokens + v_refill);
  IF v_new_tokens < p_cost THEN
    UPDATE rate_limit_buckets SET tokens = v_new_tokens, last_refill = now() WHERE user_id = p_user_id;
    RETURN FALSE;
  END IF;
  UPDATE rate_limit_buckets SET tokens = v_new_tokens - p_cost, last_refill = now() WHERE user_id = p_user_id;
  RETURN TRUE;
END;
$$;

-- Sensitive rate limit (10-token cost = ~6 attempts/min)
CREATE OR REPLACE FUNCTION check_sensitive_rate_limit(p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT check_rate_limit(p_user_id, 10);
$$;

-- Account self-deletion
CREATE OR REPLACE FUNCTION delete_own_account()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _couple_id uuid;
  _partner_count int;
BEGIN
  SELECT couple_id INTO _couple_id FROM couple_members WHERE user_id = auth.uid() LIMIT 1;
  IF _couple_id IS NOT NULL THEN
    DELETE FROM couple_data WHERE couple_id = _couple_id AND created_by = auth.uid();
    DELETE FROM couple_members WHERE couple_id = _couple_id AND user_id = auth.uid();
    SELECT count(*) INTO _partner_count FROM couple_members WHERE couple_id = _couple_id;
    IF _partner_count = 0 THEN
      DELETE FROM couple_data WHERE couple_id = _couple_id;
      DELETE FROM couples WHERE id = _couple_id;
    END IF;
  END IF;
  BEGIN DELETE FROM usage_events WHERE user_id = auth.uid(); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM user_entitlements WHERE user_id = auth.uid(); EXCEPTION WHEN undefined_table THEN NULL; END;
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION delete_own_account() TO authenticated;

-- Send push notification via Expo's push API (uses pg_net extension)
-- Falls back gracefully if pg_net is not enabled
CREATE OR REPLACE FUNCTION send_expo_push(
  p_token text,
  p_title text,
  p_body text,
  p_data jsonb DEFAULT '{}'
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Use pg_net to POST to Expo push API (non-blocking)
  PERFORM net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Accept', 'application/json'
    ),
    body := jsonb_build_object(
      'to', p_token,
      'title', p_title,
      'body', p_body,
      'sound', 'default',
      'data', p_data
    )
  );
EXCEPTION WHEN OTHERS THEN
  -- pg_net may not be enabled — silently ignore
  NULL;
END;
$$;

-- Notify partner: looks up partner's push tokens and sends a push to each device
CREATE OR REPLACE FUNCTION notify_partner(
  sender_id uuid,
  notification_title text,
  notification_body text,
  notification_data jsonb DEFAULT '{}'
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
    SELECT pt.token FROM push_tokens pt
    JOIN couple_members cm ON cm.user_id = pt.user_id
    WHERE cm.couple_id = sender_couple_id AND cm.user_id != sender_id
  LOOP
    PERFORM send_expo_push(
      partner_token.token,
      notification_title,
      notification_body,
      notification_data
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION notify_partner(uuid, text, text, jsonb) TO authenticated;


-- ============================================================================
-- PART 4: TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_couples_updated_at ON couples;
CREATE TRIGGER update_couples_updated_at
  BEFORE UPDATE ON couples FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_couple_data_updated_at ON couple_data;
CREATE TRIGGER update_couple_data_updated_at
  BEFORE UPDATE ON couple_data FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS couple_data_updated_at ON couple_data;
CREATE TRIGGER couple_data_updated_at
  BEFORE UPDATE ON couple_data FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_calendar_events_updated_at ON calendar_events;
CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON calendar_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_moments_updated_at ON moments;
CREATE TRIGGER update_moments_updated_at
  BEFORE UPDATE ON moments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_entitlements_updated_at ON user_entitlements;
CREATE TRIGGER update_entitlements_updated_at
  BEFORE UPDATE ON user_entitlements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_sync_couple_premium ON couples;
CREATE TRIGGER trigger_sync_couple_premium
  AFTER UPDATE OF is_premium ON couples
  FOR EACH ROW WHEN (OLD.is_premium IS DISTINCT FROM NEW.is_premium)
  EXECUTE FUNCTION sync_couple_premium_to_profiles();

-- Auto-notify partner when new couple_data is inserted
CREATE OR REPLACE FUNCTION notify_on_couple_data_insert()
RETURNS trigger AS $$
DECLARE
  sender_name text;
  notif_title text;
  notif_body text;
BEGIN
  -- Look up sender display name
  SELECT COALESCE(display_name, email, 'Your partner') INTO sender_name
    FROM profiles WHERE id = NEW.created_by;

  -- Build notification based on data_type
  CASE NEW.data_type
    WHEN 'vibe' THEN
      notif_title := '💗 New Heartbeat';
      notif_body := sender_name || ' just sent a heartbeat';
    WHEN 'love_note' THEN
      notif_title := '💌 Love Note';
      notif_body := sender_name || ' sent you a love note';
    WHEN 'journal' THEN
      notif_title := '📝 Journal Entry';
      notif_body := sender_name || ' shared a journal entry';
    WHEN 'prompt_answer' THEN
      notif_title := '💬 Prompt Answer';
      notif_body := sender_name || ' answered a prompt';
    WHEN 'check_in' THEN
      notif_title := '🤗 Check-In';
      notif_body := sender_name || ' checked in';
    WHEN 'memory' THEN
      notif_title := '📸 New Memory';
      notif_body := sender_name || ' shared a memory';
    WHEN 'custom_ritual' THEN
      notif_title := '🌙 New Ritual';
      notif_body := sender_name || ' created a ritual';
    ELSE
      notif_title := '💕 Between Us';
      notif_body := sender_name || ' shared something new';
  END CASE;

  -- Fire notification (non-blocking via pg_net)
  PERFORM notify_partner(
    NEW.created_by,
    notif_title,
    notif_body,
    jsonb_build_object('type', NEW.data_type, 'couple_id', NEW.couple_id)
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never let notification failure block the insert
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_couple_data ON couple_data;
CREATE TRIGGER trigger_notify_couple_data
  AFTER INSERT ON couple_data
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_couple_data_insert();

-- Auto-notify partner when new calendar_event is created
CREATE OR REPLACE FUNCTION notify_on_calendar_event_insert()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_calendar_event ON calendar_events;
CREATE TRIGGER trigger_notify_calendar_event
  AFTER INSERT ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_calendar_event_insert();

-- Auto-notify partner when new moment is shared
CREATE OR REPLACE FUNCTION notify_on_moment_insert()
RETURNS trigger AS $$
DECLARE
  sender_name text;
BEGIN
  -- Don't notify for private moments
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_moment ON moments;
CREATE TRIGGER trigger_notify_moment
  AFTER INSERT ON moments
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_moment_insert();

-- Notify code creator when partner redeems code (couple is formed)
CREATE OR REPLACE FUNCTION notify_on_couple_created()
RETURNS trigger AS $$
DECLARE
  partner_name text;
  the_creator_id uuid;
  the_redeemer_id uuid;
BEGIN
  -- Only fire for the second member (the couple is now complete)
  IF (SELECT count(*) FROM couple_members WHERE couple_id = NEW.couple_id) = 2 THEN
    -- Determine who the other member is
    SELECT user_id INTO the_creator_id FROM couple_members
      WHERE couple_id = NEW.couple_id AND user_id != NEW.user_id LIMIT 1;
    the_redeemer_id := NEW.user_id;

    -- Notify the creator that their partner joined
    SELECT COALESCE(display_name, email, 'Your partner') INTO partner_name
      FROM profiles WHERE id = the_redeemer_id;
    PERFORM notify_partner(
      the_redeemer_id,
      '💕 You''re Linked!',
      partner_name || ' has joined your couple on Between Us',
      jsonb_build_object('type', 'partner_linked', 'couple_id', NEW.couple_id)
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_couple_created ON couple_members;
CREATE TRIGGER trigger_notify_couple_created
  AFTER INSERT ON couple_members
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_couple_created();


-- ============================================================================
-- PART 5: ENABLE RLS ON ALL TABLES
-- ============================================================================

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
ALTER TABLE rate_limit_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- PART 6: RLS POLICIES (drop-then-create for idempotency)
-- ============================================================================

-- ─── PROFILES ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ─── COUPLES ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Couple members can view couple" ON couples;
DROP POLICY IF EXISTS "couple_select" ON couples;
DROP POLICY IF EXISTS "couple_select_v2" ON couples;
CREATE POLICY "Couple members can view couple" ON couples
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM couple_members cm WHERE cm.couple_id = couples.id AND cm.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Couple members can update couple" ON couples;
CREATE POLICY "Couple members can update couple" ON couples
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM couple_members cm WHERE cm.couple_id = couples.id AND cm.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can create couples" ON couples;
DROP POLICY IF EXISTS "couple_insert" ON couples;
DROP POLICY IF EXISTS "couple_insert_v2" ON couples;
CREATE POLICY "Users can create couples" ON couples
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- ─── COUPLE_MEMBERS ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own memberships" ON couple_members;
DROP POLICY IF EXISTS "Couple members can view memberships" ON couple_members;
DROP POLICY IF EXISTS "member_select" ON couple_members;
DROP POLICY IF EXISTS "member_select_v2" ON couple_members;
CREATE POLICY "Couple members can view memberships" ON couple_members
  FOR SELECT USING (couple_id IN (SELECT get_my_couple_ids()));

DROP POLICY IF EXISTS "Users can join couple" ON couple_members;
DROP POLICY IF EXISTS "member_insert" ON couple_members;
DROP POLICY IF EXISTS "member_insert_v2" ON couple_members;
CREATE POLICY "Users can join couple" ON couple_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "member_update" ON couple_members;
DROP POLICY IF EXISTS "member_update_v2" ON couple_members;
DROP POLICY IF EXISTS "Users can update own membership" ON couple_members;
CREATE POLICY "Users can update own membership" ON couple_members
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "member_delete" ON couple_members;
DROP POLICY IF EXISTS "member_delete_v2" ON couple_members;
DROP POLICY IF EXISTS "Users can leave couple" ON couple_members;
CREATE POLICY "Users can leave couple" ON couple_members
  FOR DELETE USING (user_id = auth.uid());

-- ─── COUPLE_DATA ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Couple members can view shared data" ON couple_data;
DROP POLICY IF EXISTS "couple_read_data" ON couple_data;
DROP POLICY IF EXISTS "couple_data_select_v2" ON couple_data;
DROP POLICY IF EXISTS "Couple data select" ON couple_data;
CREATE POLICY "Couple data select" ON couple_data
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM couple_members cm WHERE cm.couple_id = couple_data.couple_id AND cm.user_id = auth.uid())
    AND (is_private IS NOT TRUE OR created_by = auth.uid())
  );

DROP POLICY IF EXISTS "Couple members can insert data" ON couple_data;
DROP POLICY IF EXISTS "Couple members can insert data (premium-aware)" ON couple_data;
DROP POLICY IF EXISTS "couple_insert_data" ON couple_data;
DROP POLICY IF EXISTS "couple_data_insert_v2" ON couple_data;
DROP POLICY IF EXISTS "Couple data insert (premium-aware)" ON couple_data;
CREATE POLICY "Couple data insert (premium-aware)" ON couple_data
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM couple_members cm WHERE cm.couple_id = couple_data.couple_id AND cm.user_id = auth.uid())
    AND created_by = auth.uid()
    AND (
      is_user_premium()
      OR data_type IN ('journal', 'prompt_answer', 'check_in', 'vibe', 'couple_state')
      OR (data_type = 'memory'       AND user_data_count(couple_id, 'memory')       < 10)
      OR (data_type = 'custom_ritual' AND user_data_count(couple_id, 'custom_ritual') < 2)
      OR (data_type = 'love_note'     AND user_data_count(couple_id, 'love_note')     < 20)
    )
  );

DROP POLICY IF EXISTS "Creators can update own data" ON couple_data;
DROP POLICY IF EXISTS "couple_update_data" ON couple_data;
DROP POLICY IF EXISTS "couple_data_update_v2" ON couple_data;
DROP POLICY IF EXISTS "Couple data update" ON couple_data;
CREATE POLICY "Couple data update" ON couple_data
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() AND EXISTS (SELECT 1 FROM couple_members cm WHERE cm.couple_id = couple_data.couple_id AND cm.user_id = auth.uid()))
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Creators can delete own data" ON couple_data;
DROP POLICY IF EXISTS "couple_delete_data" ON couple_data;
DROP POLICY IF EXISTS "couple_data_delete_v2" ON couple_data;
DROP POLICY IF EXISTS "Couple data delete" ON couple_data;
CREATE POLICY "Couple data delete" ON couple_data
  FOR DELETE TO authenticated USING (
    created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM couple_members cm WHERE cm.couple_id = couple_data.couple_id AND cm.user_id = auth.uid())
  );

-- ─── CALENDAR_EVENTS ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Couple members can view calendar events" ON calendar_events;
CREATE POLICY "Couple members can view calendar events" ON calendar_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM couple_members m WHERE m.couple_id = calendar_events.couple_id AND m.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Premium members can create calendar events" ON calendar_events;
CREATE POLICY "Premium members can create calendar events" ON calendar_events
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM couple_members m WHERE m.couple_id = calendar_events.couple_id AND m.user_id = auth.uid())
    AND couple_has_premium(calendar_events.couple_id)
  );

DROP POLICY IF EXISTS "Premium creators can update calendar events" ON calendar_events;
CREATE POLICY "Premium creators can update calendar events" ON calendar_events
  FOR UPDATE USING (
    created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM couple_members m WHERE m.couple_id = calendar_events.couple_id AND m.user_id = auth.uid())
    AND couple_has_premium(calendar_events.couple_id)
  );

DROP POLICY IF EXISTS "Premium creators can delete calendar events" ON calendar_events;
CREATE POLICY "Premium creators can delete calendar events" ON calendar_events
  FOR DELETE USING (
    created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM couple_members m WHERE m.couple_id = calendar_events.couple_id AND m.user_id = auth.uid())
    AND couple_has_premium(calendar_events.couple_id)
  );

-- ─── MOMENTS ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Couple members can view moments" ON moments;
CREATE POLICY "Couple members can view moments" ON moments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM couple_members m WHERE m.couple_id = moments.couple_id AND m.user_id = auth.uid())
    AND (is_private = false OR created_by = auth.uid())
  );

DROP POLICY IF EXISTS "Couple members can create moments" ON moments;
CREATE POLICY "Couple members can create moments" ON moments
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM couple_members m WHERE m.couple_id = moments.couple_id AND m.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Creators can update moments" ON moments;
CREATE POLICY "Creators can update moments" ON moments
  FOR UPDATE USING (
    created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM couple_members m WHERE m.couple_id = moments.couple_id AND m.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Creators can delete moments" ON moments;
CREATE POLICY "Creators can delete moments" ON moments
  FOR DELETE USING (
    created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM couple_members m WHERE m.couple_id = moments.couple_id AND m.user_id = auth.uid())
  );

-- ─── PARTNER_LINK_CODES ───────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own link codes" ON partner_link_codes;
CREATE POLICY "Users can view own link codes" ON partner_link_codes
  FOR SELECT USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can create link codes" ON partner_link_codes;
CREATE POLICY "Authenticated users can create link codes" ON partner_link_codes
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND NOT EXISTS (SELECT 1 FROM couple_members WHERE user_id = auth.uid())
  );

-- ─── USER_ENTITLEMENTS ────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own entitlements" ON user_entitlements;
CREATE POLICY "Users can view own entitlements" ON user_entitlements
  FOR SELECT USING (user_id = auth.uid());

-- ─── USAGE_EVENTS ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can insert own usage events" ON usage_events;
CREATE POLICY "Users can insert own usage events" ON usage_events
  FOR INSERT WITH CHECK (auth.uid() = user_id AND is_couple_member(couple_id, auth.uid()));

DROP POLICY IF EXISTS "Users can read couple usage events" ON usage_events;
CREATE POLICY "Users can read couple usage events" ON usage_events
  FOR SELECT USING (is_couple_member(couple_id, auth.uid()));

DROP POLICY IF EXISTS "Users can delete own usage events" ON usage_events;
CREATE POLICY "Users can delete own usage events" ON usage_events
  FOR DELETE USING (auth.uid() = user_id);

-- ─── ANALYTICS_EVENTS ─────────────────────────────────────────────
DROP POLICY IF EXISTS "analytics_insert_own" ON analytics_events;
DROP POLICY IF EXISTS analytics_insert_own ON analytics_events;
CREATE POLICY "analytics_insert_own" ON analytics_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "analytics_select_own" ON analytics_events;
DROP POLICY IF EXISTS analytics_select_own ON analytics_events;
CREATE POLICY "analytics_select_own" ON analytics_events
  FOR SELECT USING (auth.uid() = user_id);

-- ─── RATE_LIMIT_BUCKETS ───────────────────────────────────────────
DROP POLICY IF EXISTS "service_role_only" ON rate_limit_buckets;
CREATE POLICY "service_role_only" ON rate_limit_buckets
  FOR ALL USING (auth.role() = 'service_role');

-- ─── PUSH_TOKENS ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own push tokens" ON push_tokens;
CREATE POLICY "Users can view own push tokens" ON push_tokens
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own push tokens" ON push_tokens;
CREATE POLICY "Users can insert own push tokens" ON push_tokens
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own push tokens" ON push_tokens;
CREATE POLICY "Users can update own push tokens" ON push_tokens
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own push tokens" ON push_tokens;
CREATE POLICY "Users can delete own push tokens" ON push_tokens
  FOR DELETE USING (user_id = auth.uid());


-- ============================================================================
-- PART 7: STORAGE BUCKETS & POLICIES
-- ============================================================================

-- Attachments bucket (E2EE blobs)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('attachments', 'attachments', false, 52428800, ARRAY['application/octet-stream'])
ON CONFLICT (id) DO NOTHING;

-- Couple media bucket (photos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('couple-media', 'couple-media', false)
ON CONFLICT (id) DO NOTHING;

-- Attachments storage policies
DROP POLICY IF EXISTS "couple_upload_attachments" ON storage.objects;
DROP POLICY IF EXISTS "attachments_insert_v2" ON storage.objects;
DROP POLICY IF EXISTS "attachments_insert" ON storage.objects;
CREATE POLICY "attachments_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM couple_members cm
      WHERE cm.couple_id = (storage.foldername(name))[1]::uuid AND cm.user_id = auth.uid()
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
      WHERE cm.couple_id = (storage.foldername(name))[1]::uuid AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "couple_delete_attachments" ON storage.objects;
DROP POLICY IF EXISTS "attachments_delete_v2" ON storage.objects;
DROP POLICY IF EXISTS "attachments_delete" ON storage.objects;
CREATE POLICY "attachments_delete" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM couple_members cm
      WHERE cm.couple_id = (storage.foldername(name))[1]::uuid AND cm.user_id = auth.uid()
    )
  );

-- Couple-media storage policies
DROP POLICY IF EXISTS "Couple members can upload media" ON storage.objects;
CREATE POLICY "Couple members can upload media" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'couple-media' AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM couple_members m WHERE m.user_id = auth.uid()
        AND (storage.foldername(name))[1] = 'couples'
        AND (storage.foldername(name))[2] = m.couple_id::text
    )
  );

DROP POLICY IF EXISTS "Couple members can view media" ON storage.objects;
CREATE POLICY "Couple members can view media" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'couple-media' AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM couple_members m WHERE m.user_id = auth.uid()
        AND (storage.foldername(name))[1] = 'couples'
        AND (storage.foldername(name))[2] = m.couple_id::text
    )
  );

DROP POLICY IF EXISTS "Couple members can delete own media" ON storage.objects;
CREATE POLICY "Couple members can delete own media" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'couple-media' AND auth.role() = 'authenticated' AND owner = auth.uid()
    AND EXISTS (
      SELECT 1 FROM couple_members m WHERE m.user_id = auth.uid()
        AND (storage.foldername(name))[1] = 'couples'
        AND (storage.foldername(name))[2] = m.couple_id::text
    )
  );


-- ============================================================================
-- PART 8: REALTIME
-- ============================================================================

-- Enable realtime sync for couple_data
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE couple_data;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================================
-- PART 9: COMMENTS
-- ============================================================================

COMMENT ON TABLE analytics_events IS 'Privacy-respecting analytics events flushed from the mobile client';
COMMENT ON COLUMN couple_members.public_key IS 'X25519 public key (base64) for Diffie-Hellman key exchange during pairing';
COMMENT ON COLUMN couple_members.wrapped_couple_key IS 'Couple symmetric key encrypted (wrapped) with this device public key via nacl.box';


-- ============================================================================
-- 🎉 COMPLETE SETUP DONE
-- ============================================================================
-- ✅ profiles, couples, couple_members, couple_data (core)
-- ✅ calendar_events, moments, partner_link_codes (v3)
-- ✅ user_entitlements (server-side premium)
-- ✅ usage_events (freemium limits)
-- ✅ analytics_events
-- ✅ rate_limit_buckets (token bucket)
-- ✅ push_tokens (Expo push notification tokens)
-- ✅ X25519 key exchange columns
-- ✅ Tombstone soft-delete columns
-- ✅ All helper functions (premium checks, code redemption, rate limiting, account deletion)
-- ✅ Push notification functions (send_expo_push, notify_partner)
-- ✅ Auto-notify triggers (couple_data, calendar_events, moments, couple_members)
-- ✅ RLS on every table (including push_tokens)
-- ✅ Storage: attachments + couple-media buckets with scoped policies
-- ✅ Realtime enabled for couple_data
-- ✅ Fully idempotent — safe to re-run
