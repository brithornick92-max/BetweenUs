BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'attachments',
    'attachments',
    false,
    52428800,
    ARRAY['application/octet-stream']::text[]
  ),
  (
    'whispers',
    'whispers',
    false,
    26214400,
    ARRAY['application/octet-stream']::text[]
  ),
  (
    'couple-media',
    'couple-media',
    false,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp']::text[]
  )
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS storage_attachments_member_select ON storage.objects;
CREATE POLICY storage_attachments_member_select
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'attachments'
    AND EXISTS (
      SELECT 1
      FROM public.couple_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.couple_id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS storage_attachments_member_insert ON storage.objects;
CREATE POLICY storage_attachments_member_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'attachments'
    AND EXISTS (
      SELECT 1
      FROM public.couple_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.couple_id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS storage_attachments_member_update ON storage.objects;
CREATE POLICY storage_attachments_member_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'attachments'
    AND EXISTS (
      SELECT 1
      FROM public.couple_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.couple_id::text = (storage.foldername(name))[1]
    )
  )
  WITH CHECK (
    bucket_id = 'attachments'
    AND EXISTS (
      SELECT 1
      FROM public.couple_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.couple_id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS storage_attachments_member_delete ON storage.objects;
CREATE POLICY storage_attachments_member_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'attachments'
    AND EXISTS (
      SELECT 1
      FROM public.couple_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.couple_id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS storage_whispers_member_select ON storage.objects;
CREATE POLICY storage_whispers_member_select
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'whispers'
    AND EXISTS (
      SELECT 1
      FROM public.couple_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.couple_id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS storage_whispers_member_insert ON storage.objects;
CREATE POLICY storage_whispers_member_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'whispers'
    AND EXISTS (
      SELECT 1
      FROM public.couple_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.couple_id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS storage_whispers_member_update ON storage.objects;
CREATE POLICY storage_whispers_member_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'whispers'
    AND EXISTS (
      SELECT 1
      FROM public.couple_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.couple_id::text = (storage.foldername(name))[1]
    )
  )
  WITH CHECK (
    bucket_id = 'whispers'
    AND EXISTS (
      SELECT 1
      FROM public.couple_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.couple_id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS storage_whispers_member_delete ON storage.objects;
CREATE POLICY storage_whispers_member_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'whispers'
    AND EXISTS (
      SELECT 1
      FROM public.couple_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.couple_id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS storage_couple_media_member_select ON storage.objects;
CREATE POLICY storage_couple_media_member_select
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'couple-media'
    AND (storage.foldername(name))[1] = 'couples'
    AND EXISTS (
      SELECT 1
      FROM public.couple_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.couple_id::text = (storage.foldername(name))[2]
    )
  );

DROP POLICY IF EXISTS storage_couple_media_member_insert ON storage.objects;
CREATE POLICY storage_couple_media_member_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'couple-media'
    AND (storage.foldername(name))[1] = 'couples'
    AND EXISTS (
      SELECT 1
      FROM public.couple_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.couple_id::text = (storage.foldername(name))[2]
    )
  );

DROP POLICY IF EXISTS storage_couple_media_member_update ON storage.objects;
CREATE POLICY storage_couple_media_member_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'couple-media'
    AND (storage.foldername(name))[1] = 'couples'
    AND EXISTS (
      SELECT 1
      FROM public.couple_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.couple_id::text = (storage.foldername(name))[2]
    )
  )
  WITH CHECK (
    bucket_id = 'couple-media'
    AND (storage.foldername(name))[1] = 'couples'
    AND EXISTS (
      SELECT 1
      FROM public.couple_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.couple_id::text = (storage.foldername(name))[2]
    )
  );

DROP POLICY IF EXISTS storage_couple_media_member_delete ON storage.objects;
CREATE POLICY storage_couple_media_member_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'couple-media'
    AND (storage.foldername(name))[1] = 'couples'
    AND EXISTS (
      SELECT 1
      FROM public.couple_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.couple_id::text = (storage.foldername(name))[2]
    )
  );

COMMIT;