BEGIN;

-- Usage events are per-user product access records. Keep writes and reads
-- scoped to auth.uid(); couple membership only proves the row belongs to the
-- caller's current couple.
CREATE OR REPLACE FUNCTION public.get_daily_usage_count(
  input_couple_id uuid,
  input_user_id uuid,
  input_event_type text,
  input_day_key text
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

  IF NOT public.is_couple_member(input_couple_id, auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: not a member of this couple';
  END IF;

  RETURN (
    SELECT count(*)::integer
    FROM public.usage_events
    WHERE couple_id = input_couple_id
      AND user_id = auth.uid()
      AND local_day_key = input_day_key
      AND (
        event_type = input_event_type
        OR (input_event_type = 'prompt_viewed' AND event_type = 'prompts')
        OR (input_event_type = 'date_idea_viewed' AND event_type = 'dates')
      )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_usage_count(uuid, uuid, text, text) TO authenticated;

DROP POLICY IF EXISTS "Users can read couple usage events" ON public.usage_events;
DROP POLICY IF EXISTS "Users can read own usage events" ON public.usage_events;
CREATE POLICY "Users can read own usage events" ON public.usage_events
  FOR SELECT TO authenticated USING (
    user_id = (select auth.uid())
    AND public.is_couple_member(couple_id, (select auth.uid()))
  );

-- Whisper metadata is written by the sender but must be marked played by the
-- receiving partner after playback. Identity columns remain protected by
-- guard_couple_data_immutable_fields.
DROP POLICY IF EXISTS "Couple data update" ON public.couple_data;
CREATE POLICY "Couple data update" ON public.couple_data
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.couple_id = couple_data.couple_id
        AND cm.user_id = (select auth.uid())
    )
    AND (
      created_by = (select auth.uid())
      OR data_type IN ('couple_state', 'daily_prompt', 'daily_quiz', 'date_plan', 'whisper')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.couple_id = couple_data.couple_id
        AND cm.user_id = (select auth.uid())
    )
    AND (
      created_by = (select auth.uid())
      OR data_type IN ('couple_state', 'daily_prompt', 'daily_quiz', 'date_plan', 'whisper')
    )
  );

COMMIT;
