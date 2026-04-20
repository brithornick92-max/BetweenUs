DROP FUNCTION IF EXISTS public.set_my_wrapped_couple_key(uuid, text);
CREATE FUNCTION public.set_my_wrapped_couple_key(input_couple_id uuid, input_wrapped_couple_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
DECLARE
  caller_id uuid;
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF input_couple_id IS NULL OR input_wrapped_couple_key IS NULL OR length(input_wrapped_couple_key) < 20 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing wrapped couple key payload');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM couple_members
    WHERE couple_id = input_couple_id AND user_id = caller_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You do not belong to this couple');
  END IF;

  UPDATE couple_members
     SET wrapped_couple_key = input_wrapped_couple_key
   WHERE couple_id = input_couple_id
     AND user_id = caller_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_my_wrapped_couple_key(uuid, text) TO authenticated;

DROP FUNCTION IF EXISTS public.set_member_wrapped_couple_key(uuid, uuid, text);
CREATE FUNCTION public.set_member_wrapped_couple_key(input_couple_id uuid, target_user_id uuid, input_wrapped_couple_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
DECLARE
  caller_id uuid;
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF input_couple_id IS NULL OR target_user_id IS NULL OR input_wrapped_couple_key IS NULL OR length(input_wrapped_couple_key) < 20 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing wrapped couple key payload');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM couple_members
    WHERE couple_id = input_couple_id AND user_id = caller_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You do not belong to this couple');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM couple_members
    WHERE couple_id = input_couple_id AND user_id = target_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target user is not part of this couple');
  END IF;

  UPDATE couple_members
     SET wrapped_couple_key = input_wrapped_couple_key
   WHERE couple_id = input_couple_id
     AND user_id = target_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_member_wrapped_couple_key(uuid, uuid, text) TO authenticated;