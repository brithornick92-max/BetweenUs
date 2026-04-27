DROP FUNCTION IF EXISTS public.set_my_wrapped_couple_key(uuid, text);
DROP FUNCTION IF EXISTS public.set_member_wrapped_couple_key(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.redeem_pairing_code(text, text);
DROP FUNCTION IF EXISTS public.create_couple_for_qr(text);

ALTER TABLE IF EXISTS public.couple_members
  DROP COLUMN IF EXISTS public_key,
  DROP COLUMN IF EXISTS device_id,
  DROP COLUMN IF EXISTS wrapped_couple_key;

ALTER TABLE IF EXISTS public.couple_data
  DROP COLUMN IF EXISTS encrypted_value;

ALTER TABLE IF EXISTS public.moments
  DROP COLUMN IF EXISTS encrypted_content;

CREATE OR REPLACE FUNCTION public.create_couple_for_qr()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  caller_id uuid;
  old_couple_id uuid;
  new_couple_id uuid;
  affected_member_ids uuid[];
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT couple_id INTO old_couple_id
    FROM couple_members
   WHERE user_id = caller_id
   LIMIT 1;

  IF old_couple_id IS NOT NULL THEN
    SELECT COALESCE(array_agg(user_id), ARRAY[]::uuid[]) INTO affected_member_ids
      FROM couple_members
     WHERE couple_id = old_couple_id;

    DELETE FROM couple_members WHERE couple_id = old_couple_id;
    DELETE FROM partner_link_codes WHERE couple_id = old_couple_id;
    DELETE FROM couples WHERE id = old_couple_id;

    UPDATE profiles SET
      is_premium = EXISTS (
        SELECT 1 FROM user_entitlements ue
        WHERE ue.user_id = profiles.id
          AND ue.is_premium = true
          AND (ue.expires_at IS NULL OR ue.expires_at > now())
      ),
      updated_at = now()
    WHERE id = ANY(affected_member_ids);
  END IF;

  INSERT INTO couples (created_by)
  VALUES (caller_id)
  RETURNING id INTO new_couple_id;

  INSERT INTO couple_members (couple_id, user_id, role)
  VALUES (new_couple_id, caller_id, 'owner');

  RETURN jsonb_build_object('success', true, 'couple_id', new_couple_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_couple_for_qr() TO authenticated;
