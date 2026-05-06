-- Supabase audit hardening and flow fixes.
-- Keeps client-facing RPCs available to signed-in users, removes anonymous
-- SECURITY DEFINER execution, aligns shared couple rows with app behavior,
-- and adds the remote experiments table used by ExperimentService.

-- ─── Remote experiment config ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.experiments (
  id text PRIMARY KEY,
  variants jsonb NOT NULL DEFAULT '["control", "treatment"]'::jsonb,
  weights jsonb,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.experiments ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS experiments_updated_at ON public.experiments;
CREATE TRIGGER experiments_updated_at
  BEFORE UPDATE ON public.experiments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "Enabled experiments are readable" ON public.experiments;
CREATE POLICY "Enabled experiments are readable" ON public.experiments
  FOR SELECT TO anon, authenticated
  USING (enabled = true);

DROP POLICY IF EXISTS "Service role can manage experiments" ON public.experiments;
CREATE POLICY "Service role can manage experiments" ON public.experiments
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── Prompt-answer domain uniqueness ─────────────────────────────────────────
-- Keep the newest row when retry/offline paths have created duplicates, then
-- enforce one live answer per user/couple/prompt/day.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY couple_id, created_by, value->>'promptId', value->>'dateKey'
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.couple_data
  WHERE data_type = 'prompt_answer'
    AND COALESCE(is_deleted, false) = false
    AND value->>'promptId' IS NOT NULL
    AND value->>'dateKey' IS NOT NULL
)
UPDATE public.couple_data cd
SET is_deleted = true,
    deleted_at = now(),
    updated_at = now()
FROM ranked r
WHERE cd.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS couple_data_prompt_answer_unique_live
  ON public.couple_data (
    couple_id,
    created_by,
    (value->>'promptId'),
    (value->>'dateKey')
  )
  WHERE data_type = 'prompt_answer'
    AND COALESCE(is_deleted, false) = false
    AND value->>'promptId' IS NOT NULL
    AND value->>'dateKey' IS NOT NULL;

-- ─── Immutable couple_data identity fields ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_couple_data_immutable_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.couple_id IS DISTINCT FROM OLD.couple_id
    OR NEW.key IS DISTINCT FROM OLD.key
    OR NEW.data_type IS DISTINCT FROM OLD.data_type
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
  THEN
    RAISE EXCEPTION 'couple_data identity fields cannot be changed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_couple_data_immutable_fields_before_update ON public.couple_data;
CREATE TRIGGER guard_couple_data_immutable_fields_before_update
  BEFORE UPDATE ON public.couple_data
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_couple_data_immutable_fields();

-- ─── Usage counting compatibility ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_daily_usage_count(
  input_couple_id uuid,
  input_user_id uuid,
  input_event_type text,
  input_day_key text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_couple_member(input_couple_id, auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: not a member of this couple';
  END IF;

  RETURN (
    SELECT count(*)::integer
    FROM public.usage_events
    WHERE couple_id = input_couple_id
      AND user_id = input_user_id
      AND local_day_key = input_day_key
      AND (
        event_type = input_event_type
        OR (input_event_type = 'prompt_viewed' AND event_type = 'prompts')
        OR (input_event_type = 'date_idea_viewed' AND event_type = 'dates')
      )
  );
END;
$$;

-- ─── Existing-couple pairing code redemption ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.redeem_partner_code(input_code_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  code_row partner_link_codes%ROWTYPE;
  target_couple_id uuid;
  new_couple_id uuid;
  creator_id uuid;
  redeemer_id uuid;
  member_count integer;
BEGIN
  redeemer_id := auth.uid();
  IF redeemer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF NOT public.check_sensitive_rate_limit(redeemer_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Too many attempts. Try again in a minute.');
  END IF;

  SELECT * INTO code_row
    FROM public.partner_link_codes
   WHERE code_hash = input_code_hash
     AND used_at IS NULL
     AND expires_at > now()
   FOR UPDATE;

  IF code_row IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid, expired, or already-used code');
  END IF;

  creator_id := code_row.created_by;

  IF creator_id = redeemer_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot pair with yourself');
  END IF;

  IF EXISTS (SELECT 1 FROM public.couple_members WHERE user_id = redeemer_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are already in a couple');
  END IF;

  IF code_row.couple_id IS NOT NULL THEN
    target_couple_id := code_row.couple_id;

    PERFORM 1 FROM public.couples WHERE id = target_couple_id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invite couple no longer exists');
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.couple_members
      WHERE couple_id = target_couple_id
        AND user_id = creator_id
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Code creator is no longer in this couple');
    END IF;

    SELECT count(*)::integer INTO member_count
      FROM public.couple_members
      WHERE couple_id = target_couple_id;

    IF member_count >= 2 THEN
      RETURN jsonb_build_object('success', false, 'error', 'This couple is already full');
    END IF;

    INSERT INTO public.couple_members (couple_id, user_id, role)
    VALUES (target_couple_id, redeemer_id, 'member');

    UPDATE public.partner_link_codes
       SET used_at = now(),
           used_by = redeemer_id
     WHERE id = code_row.id;

    INSERT INTO public.couple_data (couple_id, key, value, data_type, created_by)
    VALUES (
      target_couple_id,
      'system:partner_linked',
      jsonb_build_object(
        'creator_id', creator_id,
        'redeemer_id', redeemer_id,
        'linked_at', now()
      ),
      'couple_state',
      redeemer_id
    )
    ON CONFLICT (couple_id, key) DO UPDATE SET
      value = EXCLUDED.value,
      updated_at = now();

    RETURN jsonb_build_object(
      'success', true,
      'couple_id', target_couple_id,
      'creator_id', creator_id,
      'redeemer_id', redeemer_id
    );
  END IF;

  IF EXISTS (SELECT 1 FROM public.couple_members WHERE user_id = creator_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Code creator is already in a couple');
  END IF;

  INSERT INTO public.couples (created_by)
  VALUES (creator_id)
  RETURNING id INTO new_couple_id;

  INSERT INTO public.couple_members (couple_id, user_id, role) VALUES
    (new_couple_id, creator_id, 'member'),
    (new_couple_id, redeemer_id, 'member');

  UPDATE public.partner_link_codes
     SET used_at = now(),
         used_by = redeemer_id,
         couple_id = new_couple_id
   WHERE id = code_row.id;

  INSERT INTO public.couple_data (couple_id, key, value, data_type, created_by)
  VALUES (
    new_couple_id,
    'system:partner_linked',
    jsonb_build_object(
      'creator_id', creator_id,
      'redeemer_id', redeemer_id,
      'linked_at', now()
    ),
    'couple_state',
    redeemer_id
  )
  ON CONFLICT (couple_id, key) DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'couple_id', new_couple_id,
    'creator_id', creator_id,
    'redeemer_id', redeemer_id
  );
END;
$$;

-- ─── Notification trigger copy for richer server-side notification text ──────
CREATE OR REPLACE FUNCTION public.notify_on_couple_data_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_name text;
  recipient_id uuid;
  recipient_label text;
  notif_title text;
  notif_body text;
  moment_type_val text;
  vibe_label_val text;
  vibe_name_val text;
  vibe_color_val text;
  vibe_icon_val text;
  vibe_emoji_val text;
  notif_data jsonb;
BEGIN
  IF NEW.data_type = 'couple_state' THEN RETURN NEW; END IF;

  SELECT COALESCE(display_name, email, 'Your partner') INTO sender_name
    FROM public.profiles WHERE id = NEW.created_by;

  SELECT user_id INTO recipient_id
    FROM public.couple_members
   WHERE couple_id = NEW.couple_id
     AND user_id != NEW.created_by
   LIMIT 1;

  IF recipient_id IS NOT NULL THEN
    SELECT trim(preferences->>'partnerLabel') INTO recipient_label
      FROM public.profiles WHERE id = recipient_id;
    IF recipient_label IS NOT NULL AND length(recipient_label) > 0 THEN
      sender_name := recipient_label;
    END IF;
  END IF;

  notif_data := jsonb_build_object('type', NEW.data_type, 'couple_id', NEW.couple_id);

  CASE NEW.data_type
    WHEN 'moment_signal' THEN
      moment_type_val := NEW.value::jsonb->>'moment_type';
      vibe_label_val := COALESCE(NULLIF(NEW.value::jsonb->>'vibe_label', ''), 'passionate');
      vibe_name_val := COALESCE(NULLIF(NEW.value::jsonb->>'vibe_name', ''), initcap(vibe_label_val));
      vibe_color_val := COALESCE(NULLIF(NEW.value::jsonb->>'vibe_color', ''), '#D2121A');
      vibe_icon_val := COALESCE(NULLIF(NEW.value::jsonb->>'vibe_icon', ''), 'flame-outline');
      vibe_emoji_val := COALESCE(NULLIF(NEW.value::jsonb->>'vibe_emoji', ''), '🔥');
      CASE moment_type_val
        WHEN 'thinking' THEN notif_title := '💭 Thinking of You';
                             notif_body := sender_name || ' is thinking of you';
        WHEN 'grateful' THEN notif_title := '🙏 Grateful for You';
                             notif_body := sender_name || ' is grateful for you';
        WHEN 'missing' THEN notif_title := '💔 Missing You';
                            notif_body := sender_name || ' is missing you right now';
        WHEN 'proud' THEN notif_title := '⭐ Proud of You';
                          notif_body := sender_name || ' is so proud of you';
        WHEN 'want' THEN notif_title := '🔥 Thinking of You';
                         notif_body := sender_name || ' is thinking about you';
        WHEN 'love' THEN notif_title := '❤️ Love You';
                         notif_body := sender_name || ' loves you';
        ELSE notif_title := vibe_emoji_val || ' ' || vibe_name_val || ' Heartbeat';
             notif_body := sender_name || ' sent a ' || lower(vibe_label_val) || ' heartbeat';
      END CASE;
      notif_data := jsonb_build_object(
        'type', 'moment_signal',
        'moment_type', COALESCE(moment_type_val, 'heartbeat'),
        'vibe_id', COALESCE(NEW.value::jsonb->>'vibe_id', vibe_label_val),
        'vibe_type', vibe_label_val,
        'vibe_label', vibe_label_val,
        'vibe_name', vibe_name_val,
        'vibe_color', vibe_color_val,
        'vibe_icon', vibe_icon_val,
        'vibe_emoji', vibe_emoji_val,
        'couple_id', NEW.couple_id,
        'route', 'vibe'
      );
    WHEN 'vibe' THEN
      notif_title := '💗 New Heartbeat';
      notif_body := sender_name || ' just sent a heartbeat';
    WHEN 'journal' THEN
      notif_title := '📝 Journal Entry';
      notif_body := sender_name || ' shared a journal entry';
    WHEN 'prompt_answer' THEN
      IF COALESCE(NEW.value::jsonb->>'promptId', '') LIKE 'quiz:%' THEN
        notif_title := 'Daily Quiz';
        notif_body := sender_name || ' answered the Daily Quiz';
        notif_data := jsonb_build_object('type', 'quiz_answered', 'route', 'quiz', 'couple_id', NEW.couple_id);
      ELSE
        notif_title := '💬 Prompt Answer';
        notif_body := sender_name || ' answered a prompt';
        notif_data := jsonb_build_object(
          'type', 'prompt_answered',
          'route', 'prompt',
          'id', NEW.value::jsonb->>'promptId',
          'prompt_id', NEW.value::jsonb->>'promptId',
          'couple_id', NEW.couple_id
        );
      END IF;
    WHEN 'check_in' THEN
      notif_title := '🤗 Check-In';
      notif_body := sender_name || ' checked in';
    WHEN 'memory' THEN
      IF COALESCE(NEW.value::jsonb->>'type', '') = 'thinking_of_you' THEN
        notif_title := sender_name || ' left you a photo';
        notif_body := 'A private photo is waiting.';
        notif_data := jsonb_build_object('type', 'thinking_of_you_photo', 'route', 'our-story', 'couple_id', NEW.couple_id);
      ELSE
        notif_title := '📸 New Memory';
        notif_body := sender_name || ' shared a memory';
      END IF;
    ELSE
      notif_title := '💕 Between Us';
      notif_body := sender_name || ' shared something new';
  END CASE;

  PERFORM public.notify_partner(
    NEW.created_by,
    notif_title,
    notif_body,
    notif_data
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.notification_log (token, title, body, status, error_msg)
  VALUES ('trigger_error', 'couple_data_insert', '', 'failed', SQLERRM);
  RETURN NEW;
END;
$$;

-- ─── RLS policies aligned to authenticated/service_role roles ────────────────
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING ((select auth.uid()) = id) WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Couple members can view couple" ON public.couples;
CREATE POLICY "Couple members can view couple" ON public.couples
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.couple_id = couples.id
        AND cm.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Couple members can update couple" ON public.couples;
CREATE POLICY "Couple members can update couple" ON public.couples
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.couple_id = couples.id
        AND cm.user_id = (select auth.uid())
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.couple_id = couples.id
        AND cm.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create couples" ON public.couples;
CREATE POLICY "Users can create couples" ON public.couples
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = created_by);

DROP POLICY IF EXISTS "Couple members can view memberships" ON public.couple_members;
CREATE POLICY "Couple members can view memberships" ON public.couple_members
  FOR SELECT TO authenticated USING (couple_id IN (SELECT public.get_my_couple_ids()));

DROP POLICY IF EXISTS "Users can join couple" ON public.couple_members;
CREATE POLICY "Users can join couple" ON public.couple_members
  FOR INSERT TO authenticated WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.couples c
      WHERE c.id = couple_members.couple_id
        AND c.created_by = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update own membership" ON public.couple_members;
CREATE POLICY "Users can update own membership" ON public.couple_members
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can leave couple" ON public.couple_members;
CREATE POLICY "Users can leave couple" ON public.couple_members
  FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Couple data select" ON public.couple_data;
CREATE POLICY "Couple data select" ON public.couple_data
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.couple_id = couple_data.couple_id
        AND cm.user_id = (select auth.uid())
    )
    AND (is_private IS NOT TRUE OR created_by = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Couple data insert (premium-aware)" ON public.couple_data;
CREATE POLICY "Couple data insert (premium-aware)" ON public.couple_data
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.couple_id = couple_data.couple_id
        AND cm.user_id = (select auth.uid())
    )
    AND created_by = (select auth.uid())
    AND (
      public.is_user_premium()
      OR data_type IN (
        'journal',
        'prompt_answer',
        'check_in',
        'vibe',
        'couple_state',
        'moment_signal',
        'attachment_meta',
        'date_plan',
        'daily_prompt',
        'daily_quiz',
        'custom_ritual',
        'love_note',
        'whisper'
      )
      OR (data_type = 'memory' AND public.user_data_count(couple_id, 'memory') < 10)
    )
  );

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
      OR data_type IN ('couple_state', 'daily_prompt', 'daily_quiz', 'date_plan')
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
      OR data_type IN ('couple_state', 'daily_prompt', 'daily_quiz', 'date_plan')
    )
  );

DROP POLICY IF EXISTS "Couple data delete" ON public.couple_data;
CREATE POLICY "Couple data delete" ON public.couple_data
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.couple_id = couple_data.couple_id
        AND cm.user_id = (select auth.uid())
    )
    AND (
      created_by = (select auth.uid())
      OR data_type IN ('couple_state', 'daily_prompt', 'daily_quiz', 'date_plan')
    )
  );

DROP POLICY IF EXISTS "Premium members can create calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Couple members can create calendar events" ON public.calendar_events;
CREATE POLICY "Couple members can create calendar events" ON public.calendar_events
  FOR INSERT TO authenticated WITH CHECK (
    created_by = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.couple_id = calendar_events.couple_id
        AND cm.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Couple members can view calendar events" ON public.calendar_events;
CREATE POLICY "Couple members can view calendar events" ON public.calendar_events
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.couple_id = calendar_events.couple_id
        AND cm.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Premium creators can update calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Premium members can update calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Couple members can update calendar events" ON public.calendar_events;
CREATE POLICY "Couple members can update calendar events" ON public.calendar_events
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.couple_id = calendar_events.couple_id
        AND cm.user_id = (select auth.uid())
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.couple_id = calendar_events.couple_id
        AND cm.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Premium creators can delete calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Premium members can delete calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Couple members can delete calendar events" ON public.calendar_events;
CREATE POLICY "Couple members can delete calendar events" ON public.calendar_events
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.couple_id = calendar_events.couple_id
        AND cm.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Couple members can view moments" ON public.moments;
CREATE POLICY "Couple members can view moments" ON public.moments
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.couple_id = moments.couple_id
        AND cm.user_id = (select auth.uid())
    )
    AND (is_private = false OR created_by = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Couple members can create moments" ON public.moments;
CREATE POLICY "Couple members can create moments" ON public.moments
  FOR INSERT TO authenticated WITH CHECK (
    created_by = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.couple_id = moments.couple_id
        AND cm.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Creators can update moments" ON public.moments;
CREATE POLICY "Creators can update moments" ON public.moments
  FOR UPDATE TO authenticated USING (
    created_by = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.couple_id = moments.couple_id
        AND cm.user_id = (select auth.uid())
    )
  ) WITH CHECK (
    created_by = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.couple_id = moments.couple_id
        AND cm.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Creators can delete moments" ON public.moments;
CREATE POLICY "Creators can delete moments" ON public.moments
  FOR DELETE TO authenticated USING (
    created_by = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.couple_id = moments.couple_id
        AND cm.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can view own link codes" ON public.partner_link_codes;
CREATE POLICY "Users can view own link codes" ON public.partner_link_codes
  FOR SELECT TO authenticated USING (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can create link codes" ON public.partner_link_codes;
CREATE POLICY "Authenticated users can create link codes" ON public.partner_link_codes
  FOR INSERT TO authenticated WITH CHECK (
    created_by = (select auth.uid())
    AND (
      couple_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.couple_members cm
        WHERE cm.couple_id = partner_link_codes.couple_id
          AND cm.user_id = (select auth.uid())
      )
    )
    AND (
      couple_id IS NOT NULL
      OR NOT EXISTS (
        SELECT 1 FROM public.couple_members
        WHERE user_id = (select auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "Users can view own entitlements" ON public.user_entitlements;
CREATE POLICY "Users can view own entitlements" ON public.user_entitlements
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own usage events" ON public.usage_events;
CREATE POLICY "Users can insert own usage events" ON public.usage_events
  FOR INSERT TO authenticated WITH CHECK (
    (select auth.uid()) = user_id
    AND public.is_couple_member(couple_id, (select auth.uid()))
  );

DROP POLICY IF EXISTS "Users can read couple usage events" ON public.usage_events;
CREATE POLICY "Users can read couple usage events" ON public.usage_events
  FOR SELECT TO authenticated USING (public.is_couple_member(couple_id, (select auth.uid())));

DROP POLICY IF EXISTS "Users can delete own usage events" ON public.usage_events;
CREATE POLICY "Users can delete own usage events" ON public.usage_events
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "analytics_insert_own" ON public.analytics_events;
DROP POLICY IF EXISTS analytics_insert_own ON public.analytics_events;
CREATE POLICY "analytics_insert_own" ON public.analytics_events
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "analytics_select_own" ON public.analytics_events;
DROP POLICY IF EXISTS analytics_select_own ON public.analytics_events;
CREATE POLICY "analytics_select_own" ON public.analytics_events
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "service_role_only" ON public.rate_limit_buckets;
CREATE POLICY "service_role_only" ON public.rate_limit_buckets
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "notification_log_service_only" ON public.notification_log;
CREATE POLICY "notification_log_service_only" ON public.notification_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS password_recovery_codes_service_only ON public.password_recovery_codes;
CREATE POLICY password_recovery_codes_service_only ON public.password_recovery_codes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS password_recovery_request_limits_service_only ON public.password_recovery_request_limits;
CREATE POLICY password_recovery_request_limits_service_only ON public.password_recovery_request_limits
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own push tokens" ON public.push_tokens;
CREATE POLICY "Users can view own push tokens" ON public.push_tokens
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own push tokens" ON public.push_tokens;
CREATE POLICY "Users can insert own push tokens" ON public.push_tokens
  FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own push tokens" ON public.push_tokens;
CREATE POLICY "Users can update own push tokens" ON public.push_tokens
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own push tokens" ON public.push_tokens;
CREATE POLICY "Users can delete own push tokens" ON public.push_tokens
  FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can read their own date shortlist" ON public.date_shortlist;
CREATE POLICY "Users can read their own date shortlist" ON public.date_shortlist
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own date shortlist" ON public.date_shortlist;
CREATE POLICY "Users can insert their own date shortlist" ON public.date_shortlist
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own date shortlist" ON public.date_shortlist;
CREATE POLICY "Users can update their own date shortlist" ON public.date_shortlist
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ─── Storage policy parity with live media paths ─────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'whispers',
  'whispers',
  false,
  10485760,
  ARRAY['audio/mp4', 'audio/m4a', 'audio/aac', 'audio/mpeg', 'audio/wav']::text[]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS storage_attachments_member_select ON storage.objects;
CREATE POLICY storage_attachments_member_select
  ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'attachments'
    AND EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.user_id = (select auth.uid())
        AND cm.couple_id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS storage_attachments_member_insert ON storage.objects;
CREATE POLICY storage_attachments_member_insert
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'attachments'
    AND EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.user_id = (select auth.uid())
        AND cm.couple_id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS storage_attachments_member_update ON storage.objects;
CREATE POLICY storage_attachments_member_update
  ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'attachments'
    AND EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.user_id = (select auth.uid())
        AND cm.couple_id::text = (storage.foldername(name))[1]
    )
  )
  WITH CHECK (
    bucket_id = 'attachments'
    AND EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.user_id = (select auth.uid())
        AND cm.couple_id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS storage_attachments_member_delete ON storage.objects;
CREATE POLICY storage_attachments_member_delete
  ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'attachments'
    AND EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.user_id = (select auth.uid())
        AND cm.couple_id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS storage_whispers_member_select ON storage.objects;
CREATE POLICY storage_whispers_member_select
  ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'whispers'
    AND EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.user_id = (select auth.uid())
        AND cm.couple_id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS storage_whispers_member_insert ON storage.objects;
CREATE POLICY storage_whispers_member_insert
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'whispers'
    AND EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.user_id = (select auth.uid())
        AND cm.couple_id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS storage_whispers_member_update ON storage.objects;
CREATE POLICY storage_whispers_member_update
  ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'whispers'
    AND EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.user_id = (select auth.uid())
        AND cm.couple_id::text = (storage.foldername(name))[1]
    )
  )
  WITH CHECK (
    bucket_id = 'whispers'
    AND EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.user_id = (select auth.uid())
        AND cm.couple_id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS storage_whispers_member_delete ON storage.objects;
CREATE POLICY storage_whispers_member_delete
  ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'whispers'
    AND EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.user_id = (select auth.uid())
        AND cm.couple_id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS "Couple members can upload media" ON storage.objects;
DROP POLICY IF EXISTS "Couple members can view media" ON storage.objects;
DROP POLICY IF EXISTS "Couple members can delete own media" ON storage.objects;

DROP POLICY IF EXISTS storage_couple_media_member_select ON storage.objects;
CREATE POLICY storage_couple_media_member_select
  ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'couple-media'
    AND (storage.foldername(name))[1] = 'couples'
    AND EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.user_id = (select auth.uid())
        AND cm.couple_id::text = (storage.foldername(name))[2]
    )
  );

DROP POLICY IF EXISTS storage_couple_media_member_insert ON storage.objects;
CREATE POLICY storage_couple_media_member_insert
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'couple-media'
    AND (storage.foldername(name))[1] = 'couples'
    AND EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.user_id = (select auth.uid())
        AND cm.couple_id::text = (storage.foldername(name))[2]
    )
  );

DROP POLICY IF EXISTS storage_couple_media_member_update ON storage.objects;
CREATE POLICY storage_couple_media_member_update
  ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'couple-media'
    AND (storage.foldername(name))[1] = 'couples'
    AND EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.user_id = (select auth.uid())
        AND cm.couple_id::text = (storage.foldername(name))[2]
    )
  )
  WITH CHECK (
    bucket_id = 'couple-media'
    AND (storage.foldername(name))[1] = 'couples'
    AND EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.user_id = (select auth.uid())
        AND cm.couple_id::text = (storage.foldername(name))[2]
    )
  );

DROP POLICY IF EXISTS storage_couple_media_member_delete ON storage.objects;
CREATE POLICY storage_couple_media_member_delete
  ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'couple-media'
    AND owner = (select auth.uid())
    AND (storage.foldername(name))[1] = 'couples'
    AND EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.user_id = (select auth.uid())
        AND cm.couple_id::text = (storage.foldername(name))[2]
    )
  );

-- ─── SECURITY DEFINER execution grants ───────────────────────────────────────
REVOKE ALL ON FUNCTION public.check_rate_limit(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_sensitive_rate_limit(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_couple_storage_objects(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_user_couple_id(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_profile_premium_fields() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_couple_data_immutable_fields() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_premium_user(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_calendar_event_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_couple_created() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_couple_data_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_moment_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.send_expo_push(text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_couple_premium_to_profiles() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.create_couple_for_qr() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_calendar_event_if_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_own_account() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_couple_premium_status(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_daily_usage_count(uuid, uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_couple_ids() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_couple_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_user_premium() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_data_count(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.couple_has_premium(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.leave_couple() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.notify_partner(uuid, text, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.redeem_partner_code(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_couple_premium(uuid, boolean, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_couple_for_qr() TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_calendar_event_if_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_couple_premium_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_daily_usage_count(uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_couple_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_couple_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_premium() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_data_count(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.couple_has_premium(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_couple() TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_partner(uuid, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_partner_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_couple_premium(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_expo_push(text, text, text, jsonb) TO service_role;
