-- ============================================================================
-- 🔐 BETWEENUS v3 SECURITY HARDENING
-- Full couple-privacy architecture with RLS, storage policies, and premium gates
-- Run in Supabase SQL Editor → New query → Paste → Run
-- ============================================================================

-- ============================================================================
-- PART 1: NEW TABLES (calendar_events, moments, partner_link_codes, user_entitlements)
-- ============================================================================

-- Calendar events: date nights, anniversaries, rituals
-- Both free and premium users can SELECT; only premium can INSERT/UPDATE/DELETE
CREATE TABLE IF NOT EXISTS calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id uuid REFERENCES couples(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  event_date timestamptz NOT NULL,
  event_type text NOT NULL DEFAULT 'date_night',  -- date_night | anniversary | ritual | custom
  recurrence text,                                  -- none | weekly | monthly | yearly
  location text,
  heat_level int DEFAULT 1 CHECK (heat_level BETWEEN 1 AND 5),
  is_completed boolean DEFAULT false,
  metadata jsonb DEFAULT '{}',
  created_by uuid REFERENCES auth.users NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Moments: love notes, photos, shared prompts
CREATE TABLE IF NOT EXISTS moments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id uuid REFERENCES couples(id) ON DELETE CASCADE NOT NULL,
  moment_type text NOT NULL DEFAULT 'note',  -- note | photo | prompt_response | memory
  title text,
  content text,                              -- plaintext or encrypted
  encrypted_content text,                    -- E2EE payload if applicable
  media_path text,                           -- storage path: couples/<couple_id>/<uuid>.jpg
  prompt_id text,                            -- references prompt if this is a response
  is_private boolean DEFAULT false,          -- true = only creator can see
  tags text[] DEFAULT '{}',
  metadata jsonb DEFAULT '{}',
  created_by uuid REFERENCES auth.users NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Partner link codes: secure, hashed, single-use, time-limited
CREATE TABLE IF NOT EXISTS partner_link_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash text NOT NULL,                   -- SHA-256 hash of the code (NEVER store plaintext)
  created_by uuid REFERENCES auth.users NOT NULL,
  expires_at timestamptz NOT NULL,           -- 15 minutes from creation
  used_at timestamptz,                       -- set when redeemed
  used_by uuid REFERENCES auth.users,        -- who redeemed it
  couple_id uuid REFERENCES couples(id),     -- the couple created on redemption
  created_at timestamptz DEFAULT now()
);

-- User entitlements: server-side premium status (synced from RevenueCat webhook)
-- This is the "source of truth" for RLS premium checks
CREATE TABLE IF NOT EXISTS user_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL UNIQUE,
  is_premium boolean DEFAULT false,
  entitlement_id text,                       -- RevenueCat entitlement identifier
  product_id text,                           -- RevenueCat product identifier
  expires_at timestamptz,                    -- subscription expiry
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- PART 2: INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_calendar_events_couple ON calendar_events(couple_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(event_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_type ON calendar_events(event_type);
CREATE INDEX IF NOT EXISTS idx_calendar_events_created_by ON calendar_events(created_by);

CREATE INDEX IF NOT EXISTS idx_moments_couple ON moments(couple_id);
CREATE INDEX IF NOT EXISTS idx_moments_type ON moments(moment_type);
CREATE INDEX IF NOT EXISTS idx_moments_created_by ON moments(created_by);
CREATE INDEX IF NOT EXISTS idx_moments_created_at ON moments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moments_private ON moments(is_private);

CREATE INDEX IF NOT EXISTS idx_link_codes_hash ON partner_link_codes(code_hash);
CREATE INDEX IF NOT EXISTS idx_link_codes_created_by ON partner_link_codes(created_by);
CREATE INDEX IF NOT EXISTS idx_link_codes_expires ON partner_link_codes(expires_at);

CREATE INDEX IF NOT EXISTS idx_entitlements_user ON user_entitlements(user_id);
CREATE INDEX IF NOT EXISTS idx_entitlements_premium ON user_entitlements(is_premium);

-- ============================================================================
-- PART 3: HELPER FUNCTIONS
-- ============================================================================

-- Check if a user has premium entitlement (server-side source of truth)
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

-- Check if EITHER member of the couple has premium (shared premium)
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

-- Redeem a partner link code (atomic: creates couple + memberships)
CREATE OR REPLACE FUNCTION redeem_partner_code(
  input_code_hash text,
  redeemer_id uuid
)
RETURNS jsonb AS $$
DECLARE
  code_row partner_link_codes%ROWTYPE;
  new_couple_id uuid;
  creator_id uuid;
BEGIN
  -- Find valid, unused, non-expired code
  SELECT * INTO code_row
  FROM partner_link_codes
  WHERE code_hash = input_code_hash
    AND used_at IS NULL
    AND expires_at > now()
  FOR UPDATE;  -- lock the row

  IF code_row IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid, expired, or already-used code');
  END IF;

  creator_id := code_row.created_by;

  -- Prevent self-pairing
  IF creator_id = redeemer_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot pair with yourself');
  END IF;

  -- Check neither user is already in a couple
  IF EXISTS (SELECT 1 FROM couple_members WHERE user_id = creator_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Code creator is already in a couple');
  END IF;

  IF EXISTS (SELECT 1 FROM couple_members WHERE user_id = redeemer_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are already in a couple');
  END IF;

  -- Create the couple
  INSERT INTO couples (created_by)
  VALUES (creator_id)
  RETURNING id INTO new_couple_id;

  -- Add both members
  INSERT INTO couple_members (couple_id, user_id, role) VALUES
    (new_couple_id, creator_id, 'member'),
    (new_couple_id, redeemer_id, 'member');

  -- Mark code as used
  UPDATE partner_link_codes
  SET used_at = now(),
      used_by = redeemer_id,
      couple_id = new_couple_id
  WHERE id = code_row.id;

  RETURN jsonb_build_object(
    'success', true,
    'couple_id', new_couple_id,
    'creator_id', creator_id,
    'redeemer_id', redeemer_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Timestamps triggers for new tables
CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_moments_updated_at
  BEFORE UPDATE ON moments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_entitlements_updated_at
  BEFORE UPDATE ON user_entitlements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PART 4: ENABLE RLS ON ALL NEW TABLES
-- ============================================================================

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_link_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_entitlements ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 5: RLS POLICIES
-- Pattern: "User can access rows only if they're a member of the couple"
-- ============================================================================

-- ─── CALENDAR_EVENTS ───────────────────────────────────────────────
-- SELECT: Both Free and Premium users can view all shared events
CREATE POLICY "Couple members can view calendar events"
  ON calendar_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM couple_members m
      WHERE m.couple_id = calendar_events.couple_id
        AND m.user_id = auth.uid()
    )
  );

-- INSERT: Only Premium users can create events
CREATE POLICY "Premium members can create calendar events"
  ON calendar_events FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM couple_members m
      WHERE m.couple_id = calendar_events.couple_id
        AND m.user_id = auth.uid()
    )
    AND couple_has_premium(calendar_events.couple_id)
  );

-- UPDATE: Only Premium + original creator can update
CREATE POLICY "Premium creators can update calendar events"
  ON calendar_events FOR UPDATE
  USING (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM couple_members m
      WHERE m.couple_id = calendar_events.couple_id
        AND m.user_id = auth.uid()
    )
    AND couple_has_premium(calendar_events.couple_id)
  );

-- DELETE: Only Premium + original creator can delete
CREATE POLICY "Premium creators can delete calendar events"
  ON calendar_events FOR DELETE
  USING (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM couple_members m
      WHERE m.couple_id = calendar_events.couple_id
        AND m.user_id = auth.uid()
    )
    AND couple_has_premium(calendar_events.couple_id)
  );

-- ─── MOMENTS ───────────────────────────────────────────────────────
-- SELECT: Couple members can see shared moments (private only by creator)
CREATE POLICY "Couple members can view moments"
  ON moments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM couple_members m
      WHERE m.couple_id = moments.couple_id
        AND m.user_id = auth.uid()
    )
    AND (
      is_private = false
      OR created_by = auth.uid()
    )
  );

-- INSERT: Couple members can add moments
CREATE POLICY "Couple members can create moments"
  ON moments FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM couple_members m
      WHERE m.couple_id = moments.couple_id
        AND m.user_id = auth.uid()
    )
  );

-- UPDATE: Only creator can update their moments
CREATE POLICY "Creators can update moments"
  ON moments FOR UPDATE
  USING (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM couple_members m
      WHERE m.couple_id = moments.couple_id
        AND m.user_id = auth.uid()
    )
  );

-- DELETE: Only creator can delete their moments
CREATE POLICY "Creators can delete moments"
  ON moments FOR DELETE
  USING (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM couple_members m
      WHERE m.couple_id = moments.couple_id
        AND m.user_id = auth.uid()
    )
  );

-- ─── PARTNER_LINK_CODES ─────────────────────────────────────────────
-- SELECT: Only creator can view their own codes
CREATE POLICY "Users can view own link codes"
  ON partner_link_codes FOR SELECT
  USING (created_by = auth.uid());

-- INSERT: Authenticated users can create codes
CREATE POLICY "Authenticated users can create link codes"
  ON partner_link_codes FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    -- Prevent creating codes if already in a couple
    AND NOT EXISTS (
      SELECT 1 FROM couple_members WHERE user_id = auth.uid()
    )
  );

-- No UPDATE/DELETE policies — codes are immutable once created
-- Redemption happens via the redeem_partner_code() SECURITY DEFINER function

-- ─── USER_ENTITLEMENTS ──────────────────────────────────────────────
-- SELECT: Users can only see their own entitlements
CREATE POLICY "Users can view own entitlements"
  ON user_entitlements FOR SELECT
  USING (user_id = auth.uid());

-- INSERT/UPDATE/DELETE: Only service role (webhook) can modify
-- No client-side policies for write — entitlements are server-managed

-- ─── COUPLE_MEMBERS (additional policy) ─────────────────────────────
-- Allow couple members to see their partner's membership too
-- (needed for the couple container to work)
DROP POLICY IF EXISTS "Users can view own memberships" ON couple_members;

CREATE POLICY "Couple members can view memberships"
  ON couple_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM couple_members my_membership
      WHERE my_membership.couple_id = couple_members.couple_id
        AND my_membership.user_id = auth.uid()
    )
  );

-- ============================================================================
-- PART 6: STORAGE POLICIES (for photos bucket)
-- ============================================================================

-- First, create the private bucket (run this in Supabase Dashboard → Storage)
-- Or via SQL:
INSERT INTO storage.buckets (id, name, public)
VALUES ('couple-media', 'couple-media', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: Authenticated couple members can upload to their couple folder
-- Path format: couples/<couple_id>/<filename>
CREATE POLICY "Couple members can upload media"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'couple-media'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM couple_members m
      WHERE m.user_id = auth.uid()
        AND (storage.foldername(name))[1] = 'couples'
        AND (storage.foldername(name))[2] = m.couple_id::text
    )
  );

-- Storage policy: Couple members can view files in their couple folder
CREATE POLICY "Couple members can view media"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'couple-media'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM couple_members m
      WHERE m.user_id = auth.uid()
        AND (storage.foldername(name))[1] = 'couples'
        AND (storage.foldername(name))[2] = m.couple_id::text
    )
  );

-- Storage policy: Couple members can delete their own uploads
CREATE POLICY "Couple members can delete own media"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'couple-media'
    AND auth.role() = 'authenticated'
    AND owner = auth.uid()
    AND EXISTS (
      SELECT 1 FROM couple_members m
      WHERE m.user_id = auth.uid()
        AND (storage.foldername(name))[1] = 'couples'
        AND (storage.foldername(name))[2] = m.couple_id::text
    )
  );

-- ============================================================================
-- PART 7: CLEANUP — Expire old partner link codes (pg_cron)
-- Requires: CREATE EXTENSION IF NOT EXISTS pg_cron;
-- Run hourly to clean expired, unused partner link codes older than 1 day.
-- ============================================================================

SELECT cron.schedule('cleanup-expired-codes', '0 * * * *',
  $$DELETE FROM partner_link_codes WHERE expires_at < now() - interval '1 day' AND used_at IS NULL$$
);

-- 🎉 v3 SECURITY HARDENING COMPLETE
-- ✅ calendar_events with Free-can-view / Premium-can-edit model
-- ✅ moments with couple-scoped privacy
-- ✅ partner_link_codes: hashed, single-use, time-limited
-- ✅ user_entitlements: server-side premium source of truth
-- ✅ RLS on ALL tables
-- ✅ Storage bucket: private, couple-scoped, signed URLs
-- ✅ Helper functions: is_premium_user(), couple_has_premium(), redeem_partner_code()
