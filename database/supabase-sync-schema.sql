-- ============================================================
-- Between Us — Supabase Schema for Local-First + E2EE Sync
-- ============================================================
--
-- This extends the existing couple_data table to support the new
-- sync engine. The table is a generic key-value store where:
--   • `value` holds unencrypted metadata (timestamps, mood labels, type)
--   • `encrypted_value` holds E2EE ciphertext (only decryptable with couple key)
--   • `data_type` enables efficient querying per content type
--
-- The app encrypts all sensitive content on-device before upload.
-- Supabase never sees plaintext for journals, prompt answers, memories, etc.
--
-- Run this AFTER the existing supabase-schema.sql
-- ============================================================

-- 1. Add missing columns to couple_data if they don't exist
-- (The existing schema may already have some of these)
DO $$
BEGIN
  -- Add data_type column for filtering by content type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'couple_data' AND column_name = 'data_type'
  ) THEN
    ALTER TABLE couple_data ADD COLUMN data_type text DEFAULT 'unknown';
  END IF;

  -- Add encrypted_value for E2EE ciphertext
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'couple_data' AND column_name = 'encrypted_value'
  ) THEN
    ALTER TABLE couple_data ADD COLUMN encrypted_value text;
  END IF;

  -- Add is_private flag
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'couple_data' AND column_name = 'is_private'
  ) THEN
    ALTER TABLE couple_data ADD COLUMN is_private boolean DEFAULT false;
  END IF;

  -- Add created_by for RLS (who wrote this row)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'couple_data' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE couple_data ADD COLUMN created_by uuid REFERENCES auth.users(id);
  END IF;

  -- Add updated_at for delta sync
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'couple_data' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE couple_data ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;

  -- Add created_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'couple_data' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE couple_data ADD COLUMN created_at timestamptz DEFAULT now();
  END IF;
END $$;

-- 2. Add unique constraint for upsert (couple_id + key)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'couple_data_couple_id_key_unique'
  ) THEN
    ALTER TABLE couple_data ADD CONSTRAINT couple_data_couple_id_key_unique
      UNIQUE (couple_id, key);
  END IF;
END $$;

-- 3. Indexes for sync queries
CREATE INDEX IF NOT EXISTS idx_couple_data_sync
  ON couple_data (couple_id, data_type, updated_at);

CREATE INDEX IF NOT EXISTS idx_couple_data_type
  ON couple_data (data_type);

CREATE INDEX IF NOT EXISTS idx_couple_data_updated
  ON couple_data (updated_at);

-- 4. Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  -- Preserve client timestamps that are ahead of server time (e.g. from sync),
  -- but prevent backdating by using at least now().
  NEW.updated_at = GREATEST(NEW.updated_at, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS couple_data_updated_at ON couple_data;
CREATE TRIGGER couple_data_updated_at
  BEFORE UPDATE ON couple_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 5. Attachments storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'attachments',
  'attachments',
  false,            -- private bucket (requires auth)
  52428800,         -- 50MB max per file
  ARRAY['application/octet-stream']  -- only encrypted blobs
)
ON CONFLICT (id) DO NOTHING;

-- 6. Storage policies for attachments bucket
-- Users can upload to their couple's folder
CREATE POLICY "couple_upload_attachments" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'attachments'
    AND (
      -- Path must start with a couple_id that the user belongs to
      EXISTS (
        SELECT 1 FROM couple_members
        WHERE couple_id = (storage.foldername(name))[1]::uuid
        AND user_id = auth.uid()
      )
    )
  );

-- Users can read from their couple's folder
CREATE POLICY "couple_read_attachments" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'attachments'
    AND EXISTS (
      SELECT 1 FROM couple_members
      WHERE couple_id = (storage.foldername(name))[1]::uuid
      AND user_id = auth.uid()
    )
  );

-- Users can delete from their couple's folder
CREATE POLICY "couple_delete_attachments" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'attachments'
    AND EXISTS (
      SELECT 1 FROM couple_members
      WHERE couple_id = (storage.foldername(name))[1]::uuid
      AND user_id = auth.uid()
    )
  );

-- 7. RLS for couple_data (ensure members can only access their couple's data)
ALTER TABLE couple_data ENABLE ROW LEVEL SECURITY;

-- Members of a couple can read all non-private data for their couple
CREATE POLICY "couple_read_data" ON couple_data
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM couple_members
      WHERE couple_members.couple_id = couple_data.couple_id
      AND couple_members.user_id = auth.uid()
    )
    AND (
      NOT is_private OR created_by = auth.uid()
    )
  );

-- Members can insert data for their couple
CREATE POLICY "couple_insert_data" ON couple_data
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM couple_members
      WHERE couple_members.couple_id = couple_data.couple_id
      AND couple_members.user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

-- Members can update their own data
CREATE POLICY "couple_update_data" ON couple_data
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM couple_members
      WHERE couple_members.couple_id = couple_data.couple_id
      AND couple_members.user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

-- Members can delete their own data
CREATE POLICY "couple_delete_data" ON couple_data
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
  );

-- 8. Enable Realtime for couple_data (for live sync)
ALTER PUBLICATION supabase_realtime ADD TABLE couple_data;

-- ============================================================
-- DONE — The app handles all encryption/decryption client-side.
-- Supabase only ever stores ciphertext in encrypted_value.
-- Plaintext metadata in `value` is limited to: timestamps,
-- data types, mood labels, heat levels — never content.
-- ============================================================
