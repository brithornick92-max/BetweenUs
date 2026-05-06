BEGIN;

CREATE OR REPLACE FUNCTION public.cleanup_couple_storage_objects(
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

REVOKE ALL ON FUNCTION public.cleanup_couple_storage_objects(uuid, uuid) FROM PUBLIC, anon, authenticated;

COMMIT;
