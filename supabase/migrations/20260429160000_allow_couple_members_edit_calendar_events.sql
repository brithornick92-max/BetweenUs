-- Allow either member of a premium couple to maintain shared calendar events.
-- The calendar is couple-owned UI, so edit/delete permissions should not be
-- limited to the original creator.

CREATE OR REPLACE FUNCTION delete_calendar_event_if_member(p_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
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

DROP POLICY IF EXISTS "Premium creators can update calendar events" ON calendar_events;
CREATE POLICY "Premium members can update calendar events" ON calendar_events
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM couple_members m
      WHERE m.couple_id = calendar_events.couple_id
        AND m.user_id = auth.uid()
    )
    AND couple_has_premium(calendar_events.couple_id)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM couple_members m
      WHERE m.couple_id = calendar_events.couple_id
        AND m.user_id = auth.uid()
    )
    AND couple_has_premium(calendar_events.couple_id)
  );

DROP POLICY IF EXISTS "Premium creators can delete calendar events" ON calendar_events;
CREATE POLICY "Premium members can delete calendar events" ON calendar_events
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM couple_members m
      WHERE m.couple_id = calendar_events.couple_id
        AND m.user_id = auth.uid()
    )
    AND couple_has_premium(calendar_events.couple_id)
  );
