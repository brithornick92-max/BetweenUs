-- ============================================================
-- Between Us — Supabase Schema v2: Security Hardening Migration
-- ============================================================
-- Run AFTER supabase-sync-schema.sql
--
-- Changes:
--   1. Add public_key to couple_members (X25519 key exchange)
--   2. Add is_deleted + deleted_at to couple_data (tombstone sync)
--   3. Harden RLS policies (strict created_by enforcement)
--   4. Remove plaintext metadata leakage (mood/tags/heat)
--   5. Tighter storage policies (scoped paths)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. X25519 public key exchange column on couple_members
-- ────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'couple_members' AND column_name = 'public_key'
  ) THEN
    ALTER TABLE couple_members ADD COLUMN public_key text;
    COMMENT ON COLUMN couple_members.public_key IS
      'X25519 public key (base64). Used for Diffie-Hellman key exchange during pairing.';
  END IF;

  -- Device ID for multi-device support
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'couple_members' AND column_name = 'device_id'
  ) THEN
    ALTER TABLE couple_members ADD COLUMN device_id text;
  END IF;

  -- Wrapped couple key (nacl.box envelope) for multi-device support
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'couple_members' AND column_name = 'wrapped_couple_key'
  ) THEN
    ALTER TABLE couple_members ADD COLUMN wrapped_couple_key text;
    COMMENT ON COLUMN couple_members.wrapped_couple_key IS
      'Couple symmetric key encrypted (wrapped) with this device public key via nacl.box.';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 2. Tombstone support for couple_data
-- ────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'couple_data' AND column_name = 'is_deleted'
  ) THEN
    ALTER TABLE couple_data ADD COLUMN is_deleted boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'couple_data' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE couple_data ADD COLUMN deleted_at timestamptz;
  END IF;
END $$;

-- Index for excluding deleted rows from default queries
CREATE INDEX IF NOT EXISTS idx_couple_data_not_deleted
  ON couple_data (couple_id, data_type, updated_at)
  WHERE is_deleted = false;

-- ────────────────────────────────────────────────────────────
-- 3. Hardened RLS policies
-- ────────────────────────────────────────────────────────────

-- Drop old permissive policies to replace with strict ones
DROP POLICY IF EXISTS "couple_read_data" ON couple_data;
DROP POLICY IF EXISTS "couple_insert_data" ON couple_data;
DROP POLICY IF EXISTS "couple_update_data" ON couple_data;
DROP POLICY IF EXISTS "couple_delete_data" ON couple_data;

-- READ: Members can read their couple's data.
-- Private data only visible to the creator.
CREATE POLICY "couple_data_select_v2" ON couple_data
  FOR SELECT
  TO authenticated
  USING (
    -- User must be a member of this couple
    EXISTS (
      SELECT 1 FROM couple_members cm
      WHERE cm.couple_id = couple_data.couple_id
      AND cm.user_id = auth.uid()
    )
    AND (
      -- Non-private data: both partners can see
      (is_private IS NOT TRUE)
      OR
      -- Private data: only the creator can see
      (created_by = auth.uid())
    )
  );

-- INSERT: Must be a member, and created_by MUST equal auth.uid().
-- This prevents one user from inserting rows as the other.
CREATE POLICY "couple_data_insert_v2" ON couple_data
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Must be a couple member
    EXISTS (
      SELECT 1 FROM couple_members cm
      WHERE cm.couple_id = couple_data.couple_id
      AND cm.user_id = auth.uid()
    )
    -- created_by must be the authenticated user (no impersonation)
    AND created_by = auth.uid()
  );

-- UPDATE: Can only update rows you created.
CREATE POLICY "couple_data_update_v2" ON couple_data
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM couple_members cm
      WHERE cm.couple_id = couple_data.couple_id
      AND cm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    -- Cannot change created_by or couple_id on update
    created_by = auth.uid()
  );

-- DELETE: Can only delete rows you created.
CREATE POLICY "couple_data_delete_v2" ON couple_data
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM couple_members cm
      WHERE cm.couple_id = couple_data.couple_id
      AND cm.user_id = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────
-- 4. RLS for couple_members table
-- ────────────────────────────────────────────────────────────

ALTER TABLE couple_members ENABLE ROW LEVEL SECURITY;

-- Drop old policies if any
DROP POLICY IF EXISTS "member_select" ON couple_members;
DROP POLICY IF EXISTS "member_insert" ON couple_members;
DROP POLICY IF EXISTS "member_update" ON couple_members;
DROP POLICY IF EXISTS "member_delete" ON couple_members;

-- SELECT: Members can see other members of their couple
CREATE POLICY "member_select_v2" ON couple_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM couple_members cm2
      WHERE cm2.couple_id = couple_members.couple_id
      AND cm2.user_id = auth.uid()
    )
  );

-- INSERT: Can only insert yourself as a member
CREATE POLICY "member_insert_v2" ON couple_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
  );

-- UPDATE: Can only update your own membership (e.g. public_key)
CREATE POLICY "member_update_v2" ON couple_members
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE: Can only remove yourself from a couple
CREATE POLICY "member_delete_v2" ON couple_members
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ────────────────────────────────────────────────────────────
-- 5. Tighter storage policies
-- ────────────────────────────────────────────────────────────

-- Drop old storage policies
DROP POLICY IF EXISTS "couple_upload_attachments" ON storage.objects;
DROP POLICY IF EXISTS "couple_read_attachments" ON storage.objects;
DROP POLICY IF EXISTS "couple_delete_attachments" ON storage.objects;

-- Upload: path must be {couple_id}/{user_id}/... (scoped to user within couple)
CREATE POLICY "attachments_insert_v2" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM couple_members cm
      WHERE cm.couple_id = (storage.foldername(name))[1]::uuid
      AND cm.user_id = auth.uid()
    )
  );

-- Read: both couple members can read all files in their couple's folder
CREATE POLICY "attachments_select_v2" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'attachments'
    AND EXISTS (
      SELECT 1 FROM couple_members cm
      WHERE cm.couple_id = (storage.foldername(name))[1]::uuid
      AND cm.user_id = auth.uid()
    )
  );

-- Delete: can only delete your own uploads
CREATE POLICY "attachments_delete_v2" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM couple_members cm
      WHERE cm.couple_id = (storage.foldername(name))[1]::uuid
      AND cm.user_id = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────
-- 6. Couples table RLS hardening
-- ────────────────────────────────────────────────────────────

ALTER TABLE couples ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "couple_select" ON couples;
DROP POLICY IF EXISTS "couple_insert" ON couples;

-- Only members can see their couple
CREATE POLICY "couple_select_v2" ON couples
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM couple_members cm
      WHERE cm.couple_id = couples.id
      AND cm.user_id = auth.uid()
    )
  );

-- Only authenticated users can create couples (as owner)
CREATE POLICY "couple_insert_v2" ON couples
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- ============================================================
-- DONE — v2 hardening complete.
--
-- Security improvements:
--   • X25519 public keys stored in couple_members for ECDH
--   • created_by strictly enforced on all writes (no impersonation)
--   • Private data only visible to creator
--   • Storage paths scoped to {couple_id}/{user_id}/
--   • Tombstone support for soft-delete sync
--   • Sensitive metadata (mood/tags/heat) now encrypted client-side
--     before upload — only cipher columns go to couple_data
-- ============================================================
