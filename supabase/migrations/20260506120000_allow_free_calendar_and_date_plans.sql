-- Align backend access with the free Calendar and date-planning product contract.
-- Calendar events and date_plan couple_data rows are part of the free core experience.

DROP POLICY IF EXISTS "Couple members can insert data" ON public.couple_data;
DROP POLICY IF EXISTS "Couple members can insert data (premium-aware)" ON public.couple_data;
DROP POLICY IF EXISTS "couple_insert_data" ON public.couple_data;
DROP POLICY IF EXISTS "couple_data_insert_v2" ON public.couple_data;
DROP POLICY IF EXISTS "Couple data insert (premium-aware)" ON public.couple_data;
CREATE POLICY "Couple data insert (premium-aware)" ON public.couple_data
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.couple_members cm
      WHERE cm.couple_id = couple_data.couple_id
        AND cm.user_id = auth.uid()
    )
    AND created_by = auth.uid()
    AND (
      public.is_user_premium()
      OR data_type IN ('journal', 'prompt_answer', 'check_in', 'vibe', 'couple_state', 'moment_signal', 'attachment_meta', 'date_plan')
      OR (data_type = 'memory' AND public.user_data_count(couple_id, 'memory') < 10)
    )
  );

DROP POLICY IF EXISTS "Premium members can create calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Couple members can create calendar events" ON public.calendar_events;
CREATE POLICY "Couple members can create calendar events" ON public.calendar_events
  FOR INSERT TO authenticated WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.couple_members m
      WHERE m.couple_id = calendar_events.couple_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Premium creators can update calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Premium members can update calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Couple members can update calendar events" ON public.calendar_events;
CREATE POLICY "Couple members can update calendar events" ON public.calendar_events
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1
      FROM public.couple_members m
      WHERE m.couple_id = calendar_events.couple_id
        AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.couple_members m
      WHERE m.couple_id = calendar_events.couple_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Premium creators can delete calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Premium members can delete calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Couple members can delete calendar events" ON public.calendar_events;
CREATE POLICY "Couple members can delete calendar events" ON public.calendar_events
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1
      FROM public.couple_members m
      WHERE m.couple_id = calendar_events.couple_id
        AND m.user_id = auth.uid()
    )
  );
