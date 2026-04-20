


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE SCHEMA IF NOT EXISTS "storage";


ALTER SCHEMA "storage" OWNER TO "supabase_admin";


CREATE TYPE "storage"."buckettype" AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


ALTER TYPE "storage"."buckettype" OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "public"."check_rate_limit"("p_user_id" "uuid", "p_cost" integer DEFAULT 1) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_bucket rate_limit_buckets%ROWTYPE;
  v_elapsed INTERVAL;
  v_refill INT;
  v_new_tokens INT;
BEGIN
  INSERT INTO rate_limit_buckets (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_bucket
    FROM rate_limit_buckets
   WHERE user_id = p_user_id
   FOR UPDATE;

  v_elapsed    := now() - v_bucket.last_refill;
  v_refill     := GREATEST(0, EXTRACT(EPOCH FROM v_elapsed)::INT);
  v_new_tokens := LEAST(v_bucket.max_tokens, v_bucket.tokens + v_refill);

  IF v_new_tokens < p_cost THEN
    UPDATE rate_limit_buckets
       SET tokens = v_new_tokens, last_refill = now()
     WHERE user_id = p_user_id;
    RETURN FALSE;
  END IF;

  UPDATE rate_limit_buckets
     SET tokens = v_new_tokens - p_cost, last_refill = now()
   WHERE user_id = p_user_id;
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."check_rate_limit"("p_user_id" "uuid", "p_cost" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_sensitive_rate_limit"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  SELECT check_rate_limit(p_user_id, 10);
$$;


ALTER FUNCTION "public"."check_sensitive_rate_limit"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."couple_has_premium"("check_couple_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM couple_members cm
    JOIN user_entitlements ue ON ue.user_id = cm.user_id
    WHERE cm.couple_id = check_couple_id
      AND ue.is_premium = true
      AND (ue.expires_at IS NULL OR ue.expires_at > now())
  );
END;
$$;


ALTER FUNCTION "public"."couple_has_premium"("check_couple_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_couple_for_qr"("device_public_key" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  caller_id     uuid;
  old_couple_id uuid;
  new_couple_id uuid;
  affected_member_ids uuid[];
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Auto-leave any existing couple so re-pairing always works
  SELECT couple_id INTO old_couple_id
    FROM couple_members WHERE user_id = caller_id LIMIT 1;
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

  INSERT INTO couples (created_by) VALUES (caller_id)
    RETURNING id INTO new_couple_id;

  INSERT INTO couple_members (couple_id, user_id, role, public_key)
  VALUES (new_couple_id, caller_id, 'owner', device_public_key);

  RETURN jsonb_build_object(
    'success',   true,
    'couple_id', new_couple_id
  );
END;
$$;


ALTER FUNCTION "public"."create_couple_for_qr"("device_public_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_own_account"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  _couple_id     uuid;
  _partner_count int;
BEGIN
  SELECT couple_id INTO _couple_id
    FROM couple_members WHERE user_id = auth.uid() LIMIT 1;

  IF _couple_id IS NOT NULL THEN
    DELETE FROM couple_data      WHERE couple_id = _couple_id AND created_by = auth.uid();
    DELETE FROM calendar_events  WHERE couple_id = _couple_id AND created_by = auth.uid();
    DELETE FROM moments          WHERE couple_id = _couple_id AND created_by = auth.uid();
    DELETE FROM couple_members   WHERE couple_id = _couple_id AND user_id    = auth.uid();
    SELECT count(*) INTO _partner_count
      FROM couple_members WHERE couple_id = _couple_id;
    IF _partner_count = 0 THEN
      DELETE FROM couple_data     WHERE couple_id = _couple_id;
      DELETE FROM calendar_events WHERE couple_id = _couple_id;
      DELETE FROM moments         WHERE couple_id = _couple_id;
      DELETE FROM partner_link_codes WHERE couple_id = _couple_id;
      DELETE FROM couples         WHERE id = _couple_id;
    ELSE
      -- Partner remains — reassign ownership so couples.created_by FK doesn't block deletion
      UPDATE couples SET created_by = (
        SELECT user_id FROM couple_members WHERE couple_id = _couple_id LIMIT 1
      ) WHERE id = _couple_id AND created_by = auth.uid();
    END IF;
  END IF;

  -- Clean up remaining FK references outside the couple
  BEGIN DELETE FROM partner_link_codes WHERE created_by = auth.uid(); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM usage_events       WHERE user_id = auth.uid();   EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM user_entitlements   WHERE user_id = auth.uid();   EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM push_tokens        WHERE user_id = auth.uid();   EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM analytics_events   WHERE user_id = auth.uid();   EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM notification_log   WHERE recipient = auth.uid(); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM rate_limit_buckets WHERE user_id = auth.uid();   EXCEPTION WHEN undefined_table THEN NULL; END;

  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;


ALTER FUNCTION "public"."delete_own_account"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_couple_premium_status"("input_couple_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE result jsonb;
BEGIN
  IF NOT is_couple_member(input_couple_id, auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: not a member of this couple';
  END IF;
  SELECT jsonb_build_object(
    'is_premium', COALESCE(c.is_premium, false),
    'premium_since', c.premium_since,
    'premium_source', COALESCE(c.premium_source, 'none')
  ) INTO result FROM couples c WHERE c.id = input_couple_id;
  RETURN COALESCE(result, '{"is_premium": false, "premium_source": "none"}'::jsonb);
END;
$$;


ALTER FUNCTION "public"."get_couple_premium_status"("input_couple_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_daily_usage_count"("input_couple_id" "uuid", "input_user_id" "uuid", "input_event_type" "text", "input_day_key" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT is_couple_member(input_couple_id, auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: not a member of this couple';
  END IF;
  RETURN (
    SELECT count(*)::integer FROM usage_events
    WHERE couple_id = input_couple_id AND user_id = input_user_id
      AND event_type = input_event_type AND local_day_key = input_day_key
  );
END;
$$;


ALTER FUNCTION "public"."get_daily_usage_count"("input_couple_id" "uuid", "input_user_id" "uuid", "input_event_type" "text", "input_day_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_couple_ids"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT couple_id FROM couple_members WHERE user_id = auth.uid();
$$;


ALTER FUNCTION "public"."get_my_couple_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_couple_id"("input_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN (SELECT couple_id FROM couple_members WHERE user_id = input_user_id LIMIT 1);
END;
$$;


ALTER FUNCTION "public"."get_user_couple_id"("input_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO UPDATE SET
    email      = EXCLUDED.email,
    updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_couple_member"("couple_uuid" "uuid", "user_uuid" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM couple_members
    WHERE couple_id = couple_uuid AND user_id = user_uuid
  );
END;
$$;


ALTER FUNCTION "public"."is_couple_member"("couple_uuid" "uuid", "user_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_premium_user"("check_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_entitlements
    WHERE user_id = check_user_id
      AND is_premium = true
      AND (expires_at IS NULL OR expires_at > now())
  );
END;
$$;


ALTER FUNCTION "public"."is_premium_user"("check_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_user_premium"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE((SELECT is_premium FROM profiles WHERE id = auth.uid()), false);
$$;


ALTER FUNCTION "public"."is_user_premium"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."leave_couple"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  caller_id           uuid;
  the_couple_id       uuid;
  affected_member_ids uuid[];
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT couple_id INTO the_couple_id
    FROM couple_members WHERE user_id = caller_id LIMIT 1;

  IF the_couple_id IS NULL THEN
    -- Already not in a couple — treat as success
    RETURN jsonb_build_object('success', true, 'couple_id', null);
  END IF;

  SELECT COALESCE(array_agg(user_id), ARRAY[]::uuid[]) INTO affected_member_ids
    FROM couple_members
   WHERE couple_id = the_couple_id;

  -- Dissolve the couple entirely so neither partner remains linked locally or remotely.
  DELETE FROM couple_members WHERE couple_id = the_couple_id;
  DELETE FROM partner_link_codes WHERE couple_id = the_couple_id;
  DELETE FROM couples WHERE id = the_couple_id;

  -- Reset each former member's profile premium to their own entitlement status.
  UPDATE profiles SET
    is_premium = EXISTS (
      SELECT 1 FROM user_entitlements ue
      WHERE ue.user_id = profiles.id
        AND ue.is_premium = true
        AND (ue.expires_at IS NULL OR ue.expires_at > now())
    ),
    updated_at = now()
  WHERE id = ANY(affected_member_ids);

  RETURN jsonb_build_object('success', true, 'couple_id', the_couple_id);
END;
$$;


ALTER FUNCTION "public"."leave_couple"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_on_calendar_event_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  sender_name text;
BEGIN
  SELECT COALESCE(display_name, email, 'Your partner') INTO sender_name
    FROM profiles WHERE id = NEW.created_by;

  PERFORM notify_partner(
    NEW.created_by,
    '📅 ' || COALESCE(NEW.title, 'New Date Plan'),
    sender_name || ' planned something special',
    jsonb_build_object('type', 'calendar_event', 'event_id', NEW.id, 'couple_id', NEW.couple_id)
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO notification_log (token, title, body, status, error_msg)
  VALUES ('trigger_error', 'calendar_event_insert', '', 'failed', SQLERRM);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_on_calendar_event_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_on_couple_created"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  partner_name   text;
  redeemer_name  text;
  the_creator_id uuid;
  the_redeemer_id uuid;
BEGIN
  IF (SELECT count(*) FROM couple_members WHERE couple_id = NEW.couple_id) = 2 THEN
    SELECT user_id INTO the_creator_id
      FROM couple_members
     WHERE couple_id = NEW.couple_id AND user_id != NEW.user_id
     LIMIT 1;
    the_redeemer_id := NEW.user_id;

    SELECT COALESCE(display_name, email, 'Your partner') INTO redeemer_name
      FROM profiles WHERE id = the_redeemer_id;

    PERFORM notify_partner(
      the_redeemer_id,
      '💕 You''re Linked!',
      redeemer_name || ' has joined your couple on Between Us',
      jsonb_build_object('type', 'partner_linked', 'couple_id', NEW.couple_id)
    );

    SELECT COALESCE(display_name, email, 'Your partner') INTO partner_name
      FROM profiles WHERE id = the_creator_id;

    PERFORM notify_partner(
      the_creator_id,
      '💕 You''re Linked!',
      'You and ' || partner_name || ' are now connected on Between Us',
      jsonb_build_object('type', 'partner_linked', 'couple_id', NEW.couple_id)
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO notification_log (token, title, body, status, error_msg)
  VALUES ('trigger_error', 'couple_created', '', 'failed', SQLERRM);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_on_couple_created"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_on_couple_data_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  sender_name     text;
  recipient_id    uuid;
  recipient_label text;
  notif_title     text;
  notif_body      text;
  moment_type_val text;
  notif_data      jsonb;
BEGIN
  IF NEW.data_type = 'couple_state' THEN RETURN NEW; END IF;

  -- Default: use the sender's own chosen display name
  SELECT COALESCE(display_name, email, 'Your partner') INTO sender_name
    FROM profiles WHERE id = NEW.created_by;

  -- Prefer the name the recipient assigned to their partner over the sender's
  -- self-chosen display name. This respects what the user typed in Identity settings.
  SELECT user_id INTO recipient_id
    FROM couple_members
   WHERE couple_id = NEW.couple_id
     AND user_id  != NEW.created_by
   LIMIT 1;

  IF recipient_id IS NOT NULL THEN
    SELECT trim(preferences->>'partnerLabel') INTO recipient_label
      FROM profiles WHERE id = recipient_id;
    IF recipient_label IS NOT NULL AND length(recipient_label) > 0 THEN
      sender_name := recipient_label;
    END IF;
  END IF;

  -- Default notification data (overridden per type below)
  notif_data := jsonb_build_object('type', NEW.data_type, 'couple_id', NEW.couple_id);

  CASE NEW.data_type
    WHEN 'moment_signal' THEN
      moment_type_val := NEW.value::jsonb->>'moment_type';
      CASE moment_type_val
        WHEN 'thinking' THEN notif_title := '💭 Thinking of You';
                             notif_body  := sender_name || ' is thinking of you';
        WHEN 'grateful' THEN notif_title := '🙏 Grateful for You';
                             notif_body  := sender_name || ' is grateful for you';
        WHEN 'missing'  THEN notif_title := '💔 Missing You';
                             notif_body  := sender_name || ' is missing you right now';
        WHEN 'proud'    THEN notif_title := '⭐ Proud of You';
                             notif_body  := sender_name || ' is so proud of you';
        WHEN 'want'     THEN notif_title := '🔥 Thinking of You';
                             notif_body  := sender_name || ' is thinking about you';
        WHEN 'love'     THEN notif_title := '❤️ Love You';
                             notif_body  := sender_name || ' loves you';
        ELSE                 notif_title := '💗 Heartbeat';
                             notif_body  := sender_name || ' sent you a heartbeat';
      END CASE;
      notif_data := jsonb_build_object(
        'type',        'moment_signal',
        'moment_type', COALESCE(moment_type_val, 'heartbeat'),
        'couple_id',   NEW.couple_id,
        'route',       'vibe'
      );
    WHEN 'vibe'          THEN notif_title := '💗 New Heartbeat';
                              notif_body  := sender_name || ' just sent a heartbeat';
    WHEN 'love_note'     THEN notif_title := '💌 Love Note';
                              notif_body  := sender_name || ' sent you a love note';
    WHEN 'journal'       THEN notif_title := '📝 Journal Entry';
                              notif_body  := sender_name || ' shared a journal entry';
    WHEN 'prompt_answer' THEN notif_title := '💬 Prompt Answer';
                              notif_body  := sender_name || ' answered a prompt';
    WHEN 'check_in'      THEN notif_title := '🤗 Check-In';
                              notif_body  := sender_name || ' checked in';
    WHEN 'memory'        THEN notif_title := '📸 New Memory';
                              notif_body  := sender_name || ' shared a memory';
    WHEN 'custom_ritual' THEN notif_title := '🌙 New Ritual';
                              notif_body  := sender_name || ' created a ritual';
    ELSE                      notif_title := '💕 Between Us';
                              notif_body  := sender_name || ' shared something new';
  END CASE;

  PERFORM notify_partner(
    NEW.created_by,
    notif_title,
    notif_body,
    notif_data
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO notification_log (token, title, body, status, error_msg)
  VALUES ('trigger_error', 'couple_data_insert', '', 'failed', SQLERRM);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_on_couple_data_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_on_moment_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  sender_name text;
BEGIN
  IF NEW.is_private THEN RETURN NEW; END IF;

  SELECT COALESCE(display_name, email, 'Your partner') INTO sender_name
    FROM profiles WHERE id = NEW.created_by;

  PERFORM notify_partner(
    NEW.created_by,
    '✨ New Moment',
    sender_name || ' shared a ' || COALESCE(NEW.moment_type, 'moment'),
    jsonb_build_object('type', 'moment', 'moment_id', NEW.id, 'couple_id', NEW.couple_id)
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO notification_log (token, title, body, status, error_msg)
  VALUES ('trigger_error', 'moment_insert', '', 'failed', SQLERRM);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_on_moment_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_partner"("sender_id" "uuid", "notification_title" "text", "notification_body" "text", "notification_data" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  partner_token RECORD;
  sender_couple_id uuid;
BEGIN
  -- Anti-spoof: only allow sending as yourself (triggers have auth.uid() = NULL)
  IF auth.uid() IS NOT NULL AND sender_id != auth.uid() THEN
    RAISE EXCEPTION 'Cannot send notifications as another user';
  END IF;

  SELECT couple_id INTO sender_couple_id
    FROM couple_members WHERE user_id = sender_id LIMIT 1;
  IF sender_couple_id IS NULL THEN RETURN; END IF;

  FOR partner_token IN
    SELECT pt.id AS token_id, pt.token
      FROM push_tokens pt
      JOIN couple_members cm ON cm.user_id = pt.user_id
     WHERE cm.couple_id = sender_couple_id
       AND cm.user_id  != sender_id
  LOOP
    PERFORM send_expo_push(
      partner_token.token,
      notification_title,
      notification_body,
      notification_data
    );

    UPDATE push_tokens SET last_used_at = now() WHERE id = partner_token.token_id;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."notify_partner"("sender_id" "uuid", "notification_title" "text", "notification_body" "text", "notification_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."redeem_pairing_code"("input_code_hash" "text", "input_public_key" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  code_row              partner_link_codes%ROWTYPE;
  creator_id            uuid;
  redeemer_id           uuid;
  old_redeemer_couple   uuid;
  affected_member_ids   uuid[];
BEGIN
  redeemer_id := auth.uid();
  IF redeemer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF input_public_key IS NULL OR length(input_public_key) < 40 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing or invalid public key');
  END IF;

  IF NOT check_sensitive_rate_limit(redeemer_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Too many attempts. Try again in a minute.');
  END IF;

  SELECT * INTO code_row
    FROM partner_link_codes
   WHERE code_hash = input_code_hash
     AND used_at IS NULL
     AND expires_at > now()
     AND couple_id IS NOT NULL
   FOR UPDATE;

  IF code_row IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid, expired, or already-used pairing code');
  END IF;

  creator_id := code_row.created_by;

  IF creator_id = redeemer_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot pair with yourself');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM couple_members
    WHERE couple_id = code_row.couple_id AND user_id = creator_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pairing code is no longer valid');
  END IF;
  -- Auto-leave any existing couple so re-pairing always works
  SELECT couple_id INTO old_redeemer_couple
    FROM couple_members WHERE user_id = redeemer_id LIMIT 1;
  IF old_redeemer_couple IS NOT NULL THEN
    SELECT COALESCE(array_agg(user_id), ARRAY[]::uuid[]) INTO affected_member_ids
      FROM couple_members
     WHERE couple_id = old_redeemer_couple;

    DELETE FROM couple_members WHERE couple_id = old_redeemer_couple;
    DELETE FROM partner_link_codes WHERE couple_id = old_redeemer_couple;
    DELETE FROM couples WHERE id = old_redeemer_couple;

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

  INSERT INTO couple_members (couple_id, user_id, role, public_key)
  VALUES (code_row.couple_id, redeemer_id, 'member', input_public_key);

  UPDATE partner_link_codes
     SET used_at = now(),
         used_by = redeemer_id
   WHERE id = code_row.id;

  RETURN jsonb_build_object(
    'success', true,
    'couple_id', code_row.couple_id,
    'creator_id', creator_id,
    'redeemer_id', redeemer_id
  );
END;
$$;


ALTER FUNCTION "public"."redeem_pairing_code"("input_code_hash" "text", "input_public_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."redeem_partner_code"("input_code_hash" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  code_row  partner_link_codes%ROWTYPE;
  new_couple_id uuid;
  creator_id    uuid;
  redeemer_id   uuid;
BEGIN
  redeemer_id := auth.uid();
  IF redeemer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF NOT check_sensitive_rate_limit(redeemer_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Too many attempts. Try again in a minute.');
  END IF;

  SELECT * INTO code_row
    FROM partner_link_codes
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
  IF EXISTS (SELECT 1 FROM couple_members WHERE user_id = creator_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Code creator is already in a couple');
  END IF;
  IF EXISTS (SELECT 1 FROM couple_members WHERE user_id = redeemer_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are already in a couple');
  END IF;

  INSERT INTO couples (created_by) VALUES (creator_id)
    RETURNING id INTO new_couple_id;

  INSERT INTO couple_members (couple_id, user_id, role) VALUES
    (new_couple_id, creator_id,  'member'),
    (new_couple_id, redeemer_id, 'member');

  UPDATE partner_link_codes
     SET used_at   = now(),
         used_by   = redeemer_id,
         couple_id = new_couple_id
   WHERE id = code_row.id;

  -- Write system event so both partners see confirmation via Realtime
  INSERT INTO couple_data (couple_id, key, value, data_type, created_by)
  VALUES (
    new_couple_id,
    'system:partner_linked',
    jsonb_build_object(
      'creator_id',  creator_id,
      'redeemer_id', redeemer_id,
      'linked_at',   now()
    ),
    'couple_state',
    redeemer_id
  )
  ON CONFLICT (couple_id, key) DO UPDATE SET
    value      = EXCLUDED.value,
    updated_at = now();

  RETURN jsonb_build_object(
    'success',     true,
    'couple_id',   new_couple_id,
    'creator_id',  creator_id,
    'redeemer_id', redeemer_id
  );
END;
$$;


ALTER FUNCTION "public"."redeem_partner_code"("input_code_hash" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_expo_push"("p_token" "text", "p_title" "text", "p_body" "text", "p_data" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'net', 'extensions'
    AS $$
BEGIN
  PERFORM net.http_post(
    url     := 'https://exp.host/--/api/v2/push/send',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Accept',       'application/json'
    ),
    body := jsonb_build_object(
      'to',    p_token,
      'title', p_title,
      'body',  p_body,
      'sound', 'default',
      'data',  p_data
    )
  );

  INSERT INTO notification_log (recipient, token, title, body, status)
  VALUES (
    (SELECT user_id FROM push_tokens WHERE token = p_token LIMIT 1),
    p_token, p_title, p_body, 'sent'
  );

EXCEPTION WHEN OTHERS THEN
  INSERT INTO notification_log (recipient, token, title, body, status, error_msg)
  VALUES (
    (SELECT user_id FROM push_tokens WHERE token = p_token LIMIT 1),
    p_token, p_title, p_body, 'failed', SQLERRM
  );
END;
$$;


ALTER FUNCTION "public"."send_expo_push"("p_token" "text", "p_title" "text", "p_body" "text", "p_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_couple_premium"("input_couple_id" "uuid", "input_is_premium" boolean, "input_source" "text" DEFAULT 'none'::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  active_premium_user uuid;
  should_be_premium boolean;
BEGIN
  IF NOT is_couple_member(input_couple_id, auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: not a member of this couple';
  END IF;

  -- Backward-compatible signature: ignore caller-provided premium flags and
  -- recompute shared premium solely from server-side entitlement truth.
  SELECT cm.user_id INTO active_premium_user
    FROM couple_members cm
    JOIN user_entitlements ue ON ue.user_id = cm.user_id
   WHERE cm.couple_id = input_couple_id
     AND ue.is_premium = true
     AND (ue.expires_at IS NULL OR ue.expires_at > now())
   ORDER BY CASE WHEN cm.user_id = auth.uid() THEN 0 ELSE 1 END, ue.updated_at DESC NULLS LAST
   LIMIT 1;

  should_be_premium := active_premium_user IS NOT NULL;

  UPDATE couples SET
    is_premium = should_be_premium,
    premium_since = CASE
      WHEN should_be_premium AND premium_since IS NULL THEN now()
      WHEN NOT should_be_premium THEN NULL
      ELSE premium_since
    END,
    premium_source = COALESCE(active_premium_user::text, 'none'),
    updated_at = now()
  WHERE id = input_couple_id;
END;
$$;


ALTER FUNCTION "public"."set_couple_premium"("input_couple_id" "uuid", "input_is_premium" boolean, "input_source" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_member_wrapped_couple_key"("input_couple_id" "uuid", "target_user_id" "uuid", "input_wrapped_couple_key" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
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


ALTER FUNCTION "public"."set_member_wrapped_couple_key"("input_couple_id" "uuid", "target_user_id" "uuid", "input_wrapped_couple_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_my_wrapped_couple_key"("input_couple_id" "uuid", "input_wrapped_couple_key" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
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


ALTER FUNCTION "public"."set_my_wrapped_couple_key"("input_couple_id" "uuid", "input_wrapped_couple_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_couple_premium_to_profiles"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE profiles SET is_premium = NEW.is_premium, updated_at = now()
  WHERE id IN (SELECT user_id FROM couple_members WHERE couple_id = NEW.id);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_couple_premium_to_profiles"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = GREATEST(NEW.updated_at, now());
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_data_count"("p_couple_id" "uuid", "p_data_type" "text") RETURNS bigint
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT count(*) FROM couple_data
  WHERE couple_id = p_couple_id AND data_type = p_data_type AND created_by = auth.uid();
$$;


ALTER FUNCTION "public"."user_data_count"("p_couple_id" "uuid", "p_data_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "storage"."allow_any_operation"("expected_operations" "text"[]) RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT CASE
      WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
      ELSE raw_operation
    END AS current_operation
    FROM current_operation
  )
  SELECT EXISTS (
    SELECT 1
    FROM normalized n
    CROSS JOIN LATERAL unnest(expected_operations) AS expected_operation
    WHERE expected_operation IS NOT NULL
      AND expected_operation <> ''
      AND n.current_operation = CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END
  );
$$;


ALTER FUNCTION "storage"."allow_any_operation"("expected_operations" "text"[]) OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."allow_only_operation"("expected_operation" "text") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT
      CASE
        WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
        ELSE raw_operation
      END AS current_operation,
      CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END AS requested_operation
    FROM current_operation
  )
  SELECT CASE
    WHEN requested_operation IS NULL OR requested_operation = '' THEN FALSE
    ELSE COALESCE(current_operation = requested_operation, FALSE)
  END
  FROM normalized;
$$;


ALTER FUNCTION "storage"."allow_only_operation"("expected_operation" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."can_insert_object"("bucketid" "text", "name" "text", "owner" "uuid", "metadata" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


ALTER FUNCTION "storage"."can_insert_object"("bucketid" "text", "name" "text", "owner" "uuid", "metadata" "jsonb") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."delete_leaf_prefixes"("bucket_ids" "text"[], "names" "text"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_rows_deleted integer;
BEGIN
    LOOP
        WITH candidates AS (
            SELECT DISTINCT
                t.bucket_id,
                unnest(storage.get_prefixes(t.name)) AS name
            FROM unnest(bucket_ids, names) AS t(bucket_id, name)
        ),
        uniq AS (
             SELECT
                 bucket_id,
                 name,
                 storage.get_level(name) AS level
             FROM candidates
             WHERE name <> ''
             GROUP BY bucket_id, name
        ),
        leaf AS (
             SELECT
                 p.bucket_id,
                 p.name,
                 p.level
             FROM storage.prefixes AS p
                  JOIN uniq AS u
                       ON u.bucket_id = p.bucket_id
                           AND u.name = p.name
                           AND u.level = p.level
             WHERE NOT EXISTS (
                 SELECT 1
                 FROM storage.objects AS o
                 WHERE o.bucket_id = p.bucket_id
                   AND o.level = p.level + 1
                   AND o.name COLLATE "C" LIKE p.name || '/%'
             )
             AND NOT EXISTS (
                 SELECT 1
                 FROM storage.prefixes AS c
                 WHERE c.bucket_id = p.bucket_id
                   AND c.level = p.level + 1
                   AND c.name COLLATE "C" LIKE p.name || '/%'
             )
        )
        DELETE
        FROM storage.prefixes AS p
            USING leaf AS l
        WHERE p.bucket_id = l.bucket_id
          AND p.name = l.name
          AND p.level = l.level;

        GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;
        EXIT WHEN v_rows_deleted = 0;
    END LOOP;
END;
$$;


ALTER FUNCTION "storage"."delete_leaf_prefixes"("bucket_ids" "text"[], "names" "text"[]) OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."enforce_bucket_name_length"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


ALTER FUNCTION "storage"."enforce_bucket_name_length"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."extension"("name" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    SELECT string_to_array(name, '/') INTO _parts;
    SELECT _parts[array_length(_parts,1)] INTO _filename;
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;


ALTER FUNCTION "storage"."extension"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."filename"("name" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$$;


ALTER FUNCTION "storage"."filename"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."foldername"("name" "text") RETURNS "text"[]
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$$;


ALTER FUNCTION "storage"."foldername"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."get_common_prefix"("p_key" "text", "p_prefix" "text", "p_delimiter" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
SELECT CASE
    WHEN position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)) > 0
    THEN left(p_key, length(p_prefix) + position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)))
    ELSE NULL
END;
$$;


ALTER FUNCTION "storage"."get_common_prefix"("p_key" "text", "p_prefix" "text", "p_delimiter" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."get_level"("name" "text") RETURNS integer
    LANGUAGE "sql" IMMUTABLE STRICT
    AS $$
SELECT array_length(string_to_array("name", '/'), 1);
$$;


ALTER FUNCTION "storage"."get_level"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."get_prefix"("name" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE STRICT
    AS $_$
SELECT
    CASE WHEN strpos("name", '/') > 0 THEN
             regexp_replace("name", '[\/]{1}[^\/]+\/?$', '')
         ELSE
             ''
        END;
$_$;


ALTER FUNCTION "storage"."get_prefix"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."get_prefixes"("name" "text") RETURNS "text"[]
    LANGUAGE "plpgsql" IMMUTABLE STRICT
    AS $$
DECLARE
    parts text[];
    prefixes text[];
    prefix text;
BEGIN
    -- Split the name into parts by '/'
    parts := string_to_array("name", '/');
    prefixes := '{}';

    -- Construct the prefixes, stopping one level below the last part
    FOR i IN 1..array_length(parts, 1) - 1 LOOP
            prefix := array_to_string(parts[1:i], '/');
            prefixes := array_append(prefixes, prefix);
    END LOOP;

    RETURN prefixes;
END;
$$;


ALTER FUNCTION "storage"."get_prefixes"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."get_size_by_bucket"() RETURNS TABLE("size" bigint, "bucket_id" "text")
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::bigint) as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


ALTER FUNCTION "storage"."get_size_by_bucket"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."list_multipart_uploads_with_delimiter"("bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer DEFAULT 100, "next_key_token" "text" DEFAULT ''::"text", "next_upload_token" "text" DEFAULT ''::"text") RETURNS TABLE("key" "text", "id" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


ALTER FUNCTION "storage"."list_multipart_uploads_with_delimiter"("bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer, "next_key_token" "text", "next_upload_token" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."list_objects_with_delimiter"("_bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer DEFAULT 100, "start_after" "text" DEFAULT ''::"text", "next_token" "text" DEFAULT ''::"text", "sort_order" "text" DEFAULT 'asc'::"text") RETURNS TABLE("name" "text", "id" "uuid", "metadata" "jsonb", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;

    -- Configuration
    v_is_asc BOOLEAN;
    v_prefix TEXT;
    v_start TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_is_asc := lower(coalesce(sort_order, 'asc')) = 'asc';
    v_prefix := coalesce(prefix_param, '');
    v_start := CASE WHEN coalesce(next_token, '') <> '' THEN next_token ELSE coalesce(start_after, '') END;
    v_file_batch_size := LEAST(GREATEST(max_keys * 2, 100), 1000);

    -- Calculate upper bound for prefix filtering (bytewise, using COLLATE "C")
    IF v_prefix = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix, 1) = delimiter_param THEN
        v_upper_bound := left(v_prefix, -1) || chr(ascii(delimiter_param) + 1);
    ELSE
        v_upper_bound := left(v_prefix, -1) || chr(ascii(right(v_prefix, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'AND o.name COLLATE "C" < $3 ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'AND o.name COLLATE "C" >= $3 ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- ========================================================================
    -- SEEK INITIALIZATION: Determine starting position
    -- ========================================================================
    IF v_start = '' THEN
        IF v_is_asc THEN
            v_next_seek := v_prefix;
        ELSE
            -- DESC without cursor: find the last item in range
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;

            IF v_next_seek IS NOT NULL THEN
                v_next_seek := v_next_seek || delimiter_param;
            ELSE
                RETURN;
            END IF;
        END IF;
    ELSE
        -- Cursor provided: determine if it refers to a folder or leaf
        IF EXISTS (
            SELECT 1 FROM storage.objects o
            WHERE o.bucket_id = _bucket_id
              AND o.name COLLATE "C" LIKE v_start || delimiter_param || '%'
            LIMIT 1
        ) THEN
            -- Cursor refers to a folder
            IF v_is_asc THEN
                v_next_seek := v_start || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_start || delimiter_param;
            END IF;
        ELSE
            -- Cursor refers to a leaf object
            IF v_is_asc THEN
                v_next_seek := v_start || delimiter_param;
            ELSE
                v_next_seek := v_start;
            END IF;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= max_keys;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(v_peek_name, v_prefix, delimiter_param);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Emit and skip to next folder (no heap access needed)
            name := rtrim(v_common_prefix, delimiter_param);
            id := NULL;
            updated_at := NULL;
            created_at := NULL;
            last_accessed_at := NULL;
            metadata := NULL;
            RETURN NEXT;
            v_count := v_count + 1;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := left(v_common_prefix, -1) || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_common_prefix;
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query USING _bucket_id, v_next_seek,
                CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix) ELSE v_prefix END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(v_current.name, v_prefix, delimiter_param);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := v_current.name;
                    EXIT;
                END IF;

                -- Emit file
                name := v_current.name;
                id := v_current.id;
                updated_at := v_current.updated_at;
                created_at := v_current.created_at;
                last_accessed_at := v_current.last_accessed_at;
                metadata := v_current.metadata;
                RETURN NEXT;
                v_count := v_count + 1;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := v_current.name || delimiter_param;
                ELSE
                    v_next_seek := v_current.name;
                END IF;

                EXIT WHEN v_count >= max_keys;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


ALTER FUNCTION "storage"."list_objects_with_delimiter"("_bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer, "start_after" "text", "next_token" "text", "sort_order" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."operation"() RETURNS "text"
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


ALTER FUNCTION "storage"."operation"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."protect_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Check if storage.allow_delete_query is set to 'true'
    IF COALESCE(current_setting('storage.allow_delete_query', true), 'false') != 'true' THEN
        RAISE EXCEPTION 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
            USING HINT = 'This prevents accidental data loss from orphaned objects.',
                  ERRCODE = '42501';
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION "storage"."protect_delete"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search"("prefix" "text", "bucketname" "text", "limits" integer DEFAULT 100, "levels" integer DEFAULT 1, "offsets" integer DEFAULT 0, "search" "text" DEFAULT ''::"text", "sortcolumn" "text" DEFAULT 'name'::"text", "sortorder" "text" DEFAULT 'asc'::"text") RETURNS TABLE("name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;
    v_delimiter CONSTANT TEXT := '/';

    -- Configuration
    v_limit INT;
    v_prefix TEXT;
    v_prefix_lower TEXT;
    v_is_asc BOOLEAN;
    v_order_by TEXT;
    v_sort_order TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;
    v_skipped INT := 0;
BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_limit := LEAST(coalesce(limits, 100), 1500);
    v_prefix := coalesce(prefix, '') || coalesce(search, '');
    v_prefix_lower := lower(v_prefix);
    v_is_asc := lower(coalesce(sortorder, 'asc')) = 'asc';
    v_file_batch_size := LEAST(GREATEST(v_limit * 2, 100), 1000);

    -- Validate sort column
    CASE lower(coalesce(sortcolumn, 'name'))
        WHEN 'name' THEN v_order_by := 'name';
        WHEN 'updated_at' THEN v_order_by := 'updated_at';
        WHEN 'created_at' THEN v_order_by := 'created_at';
        WHEN 'last_accessed_at' THEN v_order_by := 'last_accessed_at';
        ELSE v_order_by := 'name';
    END CASE;

    v_sort_order := CASE WHEN v_is_asc THEN 'asc' ELSE 'desc' END;

    -- ========================================================================
    -- NON-NAME SORTING: Use path_tokens approach (unchanged)
    -- ========================================================================
    IF v_order_by != 'name' THEN
        RETURN QUERY EXECUTE format(
            $sql$
            WITH folders AS (
                SELECT path_tokens[$1] AS folder
                FROM storage.objects
                WHERE objects.name ILIKE $2 || '%%'
                  AND bucket_id = $3
                  AND array_length(objects.path_tokens, 1) <> $1
                GROUP BY folder
                ORDER BY folder %s
            )
            (SELECT folder AS "name",
                   NULL::uuid AS id,
                   NULL::timestamptz AS updated_at,
                   NULL::timestamptz AS created_at,
                   NULL::timestamptz AS last_accessed_at,
                   NULL::jsonb AS metadata FROM folders)
            UNION ALL
            (SELECT path_tokens[$1] AS "name",
                   id, updated_at, created_at, last_accessed_at, metadata
             FROM storage.objects
             WHERE objects.name ILIKE $2 || '%%'
               AND bucket_id = $3
               AND array_length(objects.path_tokens, 1) = $1
             ORDER BY %I %s)
            LIMIT $4 OFFSET $5
            $sql$, v_sort_order, v_order_by, v_sort_order
        ) USING levels, v_prefix, bucketname, v_limit, offsets;
        RETURN;
    END IF;

    -- ========================================================================
    -- NAME SORTING: Hybrid skip-scan with batch optimization
    -- ========================================================================

    -- Calculate upper bound for prefix filtering
    IF v_prefix_lower = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix_lower, 1) = v_delimiter THEN
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(v_delimiter) + 1);
    ELSE
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(right(v_prefix_lower, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'AND lower(o.name) COLLATE "C" < $3 ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'AND lower(o.name) COLLATE "C" >= $3 ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- Initialize seek position
    IF v_is_asc THEN
        v_next_seek := v_prefix_lower;
    ELSE
        -- DESC: find the last item in range first (static SQL)
        IF v_upper_bound IS NOT NULL THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower AND lower(o.name) COLLATE "C" < v_upper_bound
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSIF v_prefix_lower <> '' THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSE
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        END IF;

        IF v_peek_name IS NOT NULL THEN
            v_next_seek := lower(v_peek_name) || v_delimiter;
        ELSE
            RETURN;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= v_limit;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix_lower <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(lower(v_peek_name), v_prefix_lower, v_delimiter);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Handle offset, emit if needed, skip to next folder
            IF v_skipped < offsets THEN
                v_skipped := v_skipped + 1;
            ELSE
                name := split_part(rtrim(storage.get_common_prefix(v_peek_name, v_prefix, v_delimiter), v_delimiter), v_delimiter, levels);
                id := NULL;
                updated_at := NULL;
                created_at := NULL;
                last_accessed_at := NULL;
                metadata := NULL;
                RETURN NEXT;
                v_count := v_count + 1;
            END IF;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := lower(left(v_common_prefix, -1)) || chr(ascii(v_delimiter) + 1);
            ELSE
                v_next_seek := lower(v_common_prefix);
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix_lower is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query
                USING bucketname, v_next_seek,
                    CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix_lower) ELSE v_prefix_lower END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(lower(v_current.name), v_prefix_lower, v_delimiter);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := lower(v_current.name);
                    EXIT;
                END IF;

                -- Handle offset skipping
                IF v_skipped < offsets THEN
                    v_skipped := v_skipped + 1;
                ELSE
                    -- Emit file
                    name := split_part(v_current.name, v_delimiter, levels);
                    id := v_current.id;
                    updated_at := v_current.updated_at;
                    created_at := v_current.created_at;
                    last_accessed_at := v_current.last_accessed_at;
                    metadata := v_current.metadata;
                    RETURN NEXT;
                    v_count := v_count + 1;
                END IF;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := lower(v_current.name) || v_delimiter;
                ELSE
                    v_next_seek := lower(v_current.name);
                END IF;

                EXIT WHEN v_count >= v_limit;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


ALTER FUNCTION "storage"."search"("prefix" "text", "bucketname" "text", "limits" integer, "levels" integer, "offsets" integer, "search" "text", "sortcolumn" "text", "sortorder" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search_by_timestamp"("p_prefix" "text", "p_bucket_id" "text", "p_limit" integer, "p_level" integer, "p_start_after" "text", "p_sort_order" "text", "p_sort_column" "text", "p_sort_column_after" "text") RETURNS TABLE("key" "text", "name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $_$
DECLARE
    v_cursor_op text;
    v_query text;
    v_prefix text;
BEGIN
    v_prefix := coalesce(p_prefix, '');

    IF p_sort_order = 'asc' THEN
        v_cursor_op := '>';
    ELSE
        v_cursor_op := '<';
    END IF;

    v_query := format($sql$
        WITH raw_objects AS (
            SELECT
                o.name AS obj_name,
                o.id AS obj_id,
                o.updated_at AS obj_updated_at,
                o.created_at AS obj_created_at,
                o.last_accessed_at AS obj_last_accessed_at,
                o.metadata AS obj_metadata,
                storage.get_common_prefix(o.name, $1, '/') AS common_prefix
            FROM storage.objects o
            WHERE o.bucket_id = $2
              AND o.name COLLATE "C" LIKE $1 || '%%'
        ),
        -- Aggregate common prefixes (folders)
        -- Both created_at and updated_at use MIN(obj_created_at) to match the old prefixes table behavior
        aggregated_prefixes AS (
            SELECT
                rtrim(common_prefix, '/') AS name,
                NULL::uuid AS id,
                MIN(obj_created_at) AS updated_at,
                MIN(obj_created_at) AS created_at,
                NULL::timestamptz AS last_accessed_at,
                NULL::jsonb AS metadata,
                TRUE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NOT NULL
            GROUP BY common_prefix
        ),
        leaf_objects AS (
            SELECT
                obj_name AS name,
                obj_id AS id,
                obj_updated_at AS updated_at,
                obj_created_at AS created_at,
                obj_last_accessed_at AS last_accessed_at,
                obj_metadata AS metadata,
                FALSE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NULL
        ),
        combined AS (
            SELECT * FROM aggregated_prefixes
            UNION ALL
            SELECT * FROM leaf_objects
        ),
        filtered AS (
            SELECT *
            FROM combined
            WHERE (
                $5 = ''
                OR ROW(
                    date_trunc('milliseconds', %I),
                    name COLLATE "C"
                ) %s ROW(
                    COALESCE(NULLIF($6, '')::timestamptz, 'epoch'::timestamptz),
                    $5
                )
            )
        )
        SELECT
            split_part(name, '/', $3) AS key,
            name,
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
        FROM filtered
        ORDER BY
            COALESCE(date_trunc('milliseconds', %I), 'epoch'::timestamptz) %s,
            name COLLATE "C" %s
        LIMIT $4
    $sql$,
        p_sort_column,
        v_cursor_op,
        p_sort_column,
        p_sort_order,
        p_sort_order
    );

    RETURN QUERY EXECUTE v_query
    USING v_prefix, p_bucket_id, p_level, p_limit, p_start_after, p_sort_column_after;
END;
$_$;


ALTER FUNCTION "storage"."search_by_timestamp"("p_prefix" "text", "p_bucket_id" "text", "p_limit" integer, "p_level" integer, "p_start_after" "text", "p_sort_order" "text", "p_sort_column" "text", "p_sort_column_after" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search_legacy_v1"("prefix" "text", "bucketname" "text", "limits" integer DEFAULT 100, "levels" integer DEFAULT 1, "offsets" integer DEFAULT 0, "search" "text" DEFAULT ''::"text", "sortcolumn" "text" DEFAULT 'name'::"text", "sortorder" "text" DEFAULT 'asc'::"text") RETURNS TABLE("name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $_$
declare
    v_order_by text;
    v_sort_order text;
begin
    case
        when sortcolumn = 'name' then
            v_order_by = 'name';
        when sortcolumn = 'updated_at' then
            v_order_by = 'updated_at';
        when sortcolumn = 'created_at' then
            v_order_by = 'created_at';
        when sortcolumn = 'last_accessed_at' then
            v_order_by = 'last_accessed_at';
        else
            v_order_by = 'name';
        end case;

    case
        when sortorder = 'asc' then
            v_sort_order = 'asc';
        when sortorder = 'desc' then
            v_sort_order = 'desc';
        else
            v_sort_order = 'asc';
        end case;

    v_order_by = v_order_by || ' ' || v_sort_order;

    return query execute
        'with folders as (
           select path_tokens[$1] as folder
           from storage.objects
             where objects.name ilike $2 || $3 || ''%''
               and bucket_id = $4
               and array_length(objects.path_tokens, 1) <> $1
           group by folder
           order by folder ' || v_sort_order || '
     )
     (select folder as "name",
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[$1] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where objects.name ilike $2 || $3 || ''%''
       and bucket_id = $4
       and array_length(objects.path_tokens, 1) = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;
end;
$_$;


ALTER FUNCTION "storage"."search_legacy_v1"("prefix" "text", "bucketname" "text", "limits" integer, "levels" integer, "offsets" integer, "search" "text", "sortcolumn" "text", "sortorder" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search_v2"("prefix" "text", "bucket_name" "text", "limits" integer DEFAULT 100, "levels" integer DEFAULT 1, "start_after" "text" DEFAULT ''::"text", "sort_order" "text" DEFAULT 'asc'::"text", "sort_column" "text" DEFAULT 'name'::"text", "sort_column_after" "text" DEFAULT ''::"text") RETURNS TABLE("key" "text", "name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
    v_sort_col text;
    v_sort_ord text;
    v_limit int;
BEGIN
    -- Cap limit to maximum of 1500 records
    v_limit := LEAST(coalesce(limits, 100), 1500);

    -- Validate and normalize sort_order
    v_sort_ord := lower(coalesce(sort_order, 'asc'));
    IF v_sort_ord NOT IN ('asc', 'desc') THEN
        v_sort_ord := 'asc';
    END IF;

    -- Validate and normalize sort_column
    v_sort_col := lower(coalesce(sort_column, 'name'));
    IF v_sort_col NOT IN ('name', 'updated_at', 'created_at') THEN
        v_sort_col := 'name';
    END IF;

    -- Route to appropriate implementation
    IF v_sort_col = 'name' THEN
        -- Use list_objects_with_delimiter for name sorting (most efficient: O(k * log n))
        RETURN QUERY
        SELECT
            split_part(l.name, '/', levels) AS key,
            l.name AS name,
            l.id,
            l.updated_at,
            l.created_at,
            l.last_accessed_at,
            l.metadata
        FROM storage.list_objects_with_delimiter(
            bucket_name,
            coalesce(prefix, ''),
            '/',
            v_limit,
            start_after,
            '',
            v_sort_ord
        ) l;
    ELSE
        -- Use aggregation approach for timestamp sorting
        -- Not efficient for large datasets but supports correct pagination
        RETURN QUERY SELECT * FROM storage.search_by_timestamp(
            prefix, bucket_name, v_limit, levels, start_after,
            v_sort_ord, v_sort_col, sort_column_after
        );
    END IF;
END;
$$;


ALTER FUNCTION "storage"."search_v2"("prefix" "text", "bucket_name" "text", "limits" integer, "levels" integer, "start_after" "text", "sort_order" "text", "sort_column" "text", "sort_column_after" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


ALTER FUNCTION "storage"."update_updated_at_column"() OWNER TO "supabase_storage_admin";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."analytics_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "session_id" "text",
    "event" "text" NOT NULL,
    "properties" "jsonb" DEFAULT '{}'::"jsonb",
    "timestamp" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."analytics_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."analytics_events" IS 'Privacy-respecting analytics events flushed from the mobile client';



CREATE TABLE IF NOT EXISTS "public"."calendar_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "couple_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "event_date" timestamp with time zone NOT NULL,
    "event_type" "text" DEFAULT 'date_night'::"text" NOT NULL,
    "recurrence" "text",
    "location" "text",
    "heat_level" integer DEFAULT 1,
    "is_completed" boolean DEFAULT false,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "calendar_events_heat_level_check" CHECK ((("heat_level" >= 1) AND ("heat_level" <= 5)))
);

ALTER TABLE ONLY "public"."calendar_events" REPLICA IDENTITY FULL;


ALTER TABLE "public"."calendar_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."couple_data" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "couple_id" "uuid" NOT NULL,
    "key" "text" NOT NULL,
    "value" "jsonb",
    "encrypted_value" "text",
    "data_type" "text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "is_private" boolean DEFAULT false,
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "is_deleted" boolean DEFAULT false,
    "deleted_at" timestamp with time zone
);

ALTER TABLE ONLY "public"."couple_data" REPLICA IDENTITY FULL;

ALTER TABLE ONLY "public"."couple_data" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."couple_data" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."couple_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "couple_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "public_key" "text",
    "device_id" "text",
    "wrapped_couple_key" "text"
);

ALTER TABLE ONLY "public"."couple_members" REPLICA IDENTITY FULL;

ALTER TABLE ONLY "public"."couple_members" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."couple_members" OWNER TO "postgres";


COMMENT ON COLUMN "public"."couple_members"."public_key" IS 'X25519 public key (base64) for Diffie-Hellman key exchange during pairing';



COMMENT ON COLUMN "public"."couple_members"."wrapped_couple_key" IS 'Couple symmetric key encrypted (wrapped) with this device public key via nacl.box';



CREATE TABLE IF NOT EXISTS "public"."couples" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_by" "uuid" NOT NULL,
    "relationship_start_date" "date",
    "couple_name" "text",
    "is_active" boolean DEFAULT true,
    "preferences" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "is_premium" boolean DEFAULT false,
    "premium_since" timestamp with time zone,
    "premium_source" "text" DEFAULT 'none'::"text",
    CONSTRAINT "couples_premium_source_check" CHECK ((("premium_source" = 'none'::"text") OR ("premium_source" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'::"text")))
);

ALTER TABLE ONLY "public"."couples" REPLICA IDENTITY FULL;

ALTER TABLE ONLY "public"."couples" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."couples" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."moments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "couple_id" "uuid" NOT NULL,
    "moment_type" "text" DEFAULT 'note'::"text" NOT NULL,
    "title" "text",
    "content" "text",
    "encrypted_content" "text",
    "media_path" "text",
    "prompt_id" "text",
    "is_private" boolean DEFAULT false,
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."moments" REPLICA IDENTITY FULL;


ALTER TABLE "public"."moments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recipient" "uuid",
    "token" "text",
    "title" "text",
    "body" "text",
    "status" "text" DEFAULT 'sent'::"text",
    "error_msg" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notification_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."partner_link_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code_hash" "text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "used_at" timestamp with time zone,
    "used_by" "uuid",
    "couple_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."partner_link_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."password_recovery_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "code_hash" "text" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "consumed_at" timestamp with time zone,
    "last_sent_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "password_recovery_codes_attempts_check" CHECK (("attempts" >= 0))
);


ALTER TABLE "public"."password_recovery_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."password_recovery_request_limits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "identifier_hash" "text" NOT NULL,
    "action" "text" NOT NULL,
    "request_count" integer DEFAULT 0 NOT NULL,
    "window_started_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "last_request_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "password_recovery_request_limits_request_count_check" CHECK (("request_count" >= 0))
);


ALTER TABLE "public"."password_recovery_request_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "display_name" "text",
    "is_premium" boolean DEFAULT false,
    "preferences" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."profiles" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "platform" "text" DEFAULT 'ios'::"text",
    "device_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_used_at" timestamp with time zone
);


ALTER TABLE "public"."push_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rate_limit_buckets" (
    "user_id" "uuid" NOT NULL,
    "tokens" integer DEFAULT 60 NOT NULL,
    "max_tokens" integer DEFAULT 60 NOT NULL,
    "last_refill" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rate_limit_buckets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."usage_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "couple_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "local_day_key" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."usage_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_entitlements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "is_premium" boolean DEFAULT false,
    "entitlement_id" "text",
    "product_id" "text",
    "expires_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_entitlements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "storage"."buckets" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "owner" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "public" boolean DEFAULT false,
    "avif_autodetection" boolean DEFAULT false,
    "file_size_limit" bigint,
    "allowed_mime_types" "text"[],
    "owner_id" "text",
    "type" "storage"."buckettype" DEFAULT 'STANDARD'::"storage"."buckettype" NOT NULL
);


ALTER TABLE "storage"."buckets" OWNER TO "supabase_storage_admin";


COMMENT ON COLUMN "storage"."buckets"."owner" IS 'Field is deprecated, use owner_id instead';



CREATE TABLE IF NOT EXISTS "storage"."buckets_analytics" (
    "name" "text" NOT NULL,
    "type" "storage"."buckettype" DEFAULT 'ANALYTICS'::"storage"."buckettype" NOT NULL,
    "format" "text" DEFAULT 'ICEBERG'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "storage"."buckets_analytics" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."buckets_vectors" (
    "id" "text" NOT NULL,
    "type" "storage"."buckettype" DEFAULT 'VECTOR'::"storage"."buckettype" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "storage"."buckets_vectors" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."migrations" (
    "id" integer NOT NULL,
    "name" character varying(100) NOT NULL,
    "hash" character varying(40) NOT NULL,
    "executed_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "storage"."migrations" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."objects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bucket_id" "text",
    "name" "text",
    "owner" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_accessed_at" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb",
    "path_tokens" "text"[] GENERATED ALWAYS AS ("string_to_array"("name", '/'::"text")) STORED,
    "version" "text",
    "owner_id" "text",
    "user_metadata" "jsonb"
);


ALTER TABLE "storage"."objects" OWNER TO "supabase_storage_admin";


COMMENT ON COLUMN "storage"."objects"."owner" IS 'Field is deprecated, use owner_id instead';



CREATE TABLE IF NOT EXISTS "storage"."s3_multipart_uploads" (
    "id" "text" NOT NULL,
    "in_progress_size" bigint DEFAULT 0 NOT NULL,
    "upload_signature" "text" NOT NULL,
    "bucket_id" "text" NOT NULL,
    "key" "text" NOT NULL COLLATE "pg_catalog"."C",
    "version" "text" NOT NULL,
    "owner_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_metadata" "jsonb",
    "metadata" "jsonb"
);


ALTER TABLE "storage"."s3_multipart_uploads" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."s3_multipart_uploads_parts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "upload_id" "text" NOT NULL,
    "size" bigint DEFAULT 0 NOT NULL,
    "part_number" integer NOT NULL,
    "bucket_id" "text" NOT NULL,
    "key" "text" NOT NULL COLLATE "pg_catalog"."C",
    "etag" "text" NOT NULL,
    "owner_id" "text",
    "version" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "storage"."s3_multipart_uploads_parts" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."vector_indexes" (
    "id" "text" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL COLLATE "pg_catalog"."C",
    "bucket_id" "text" NOT NULL,
    "data_type" "text" NOT NULL,
    "dimension" integer NOT NULL,
    "distance_metric" "text" NOT NULL,
    "metadata_configuration" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "storage"."vector_indexes" OWNER TO "supabase_storage_admin";


ALTER TABLE ONLY "public"."analytics_events"
    ADD CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."couple_data"
    ADD CONSTRAINT "couple_data_couple_id_key_unique" UNIQUE ("couple_id", "key");



ALTER TABLE ONLY "public"."couple_data"
    ADD CONSTRAINT "couple_data_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."couple_members"
    ADD CONSTRAINT "couple_members_couple_id_user_id_key" UNIQUE ("couple_id", "user_id");



ALTER TABLE ONLY "public"."couple_members"
    ADD CONSTRAINT "couple_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."couple_members"
    ADD CONSTRAINT "couple_members_user_id_unique" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."couples"
    ADD CONSTRAINT "couples_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."moments"
    ADD CONSTRAINT "moments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_log"
    ADD CONSTRAINT "notification_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."partner_link_codes"
    ADD CONSTRAINT "partner_link_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."password_recovery_codes"
    ADD CONSTRAINT "password_recovery_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."password_recovery_request_limits"
    ADD CONSTRAINT "password_recovery_request_limits_identifier_action_key" UNIQUE ("identifier_hash", "action");



ALTER TABLE ONLY "public"."password_recovery_request_limits"
    ADD CONSTRAINT "password_recovery_request_limits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_user_id_token_key" UNIQUE ("user_id", "token");



ALTER TABLE ONLY "public"."rate_limit_buckets"
    ADD CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."usage_events"
    ADD CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_entitlements"
    ADD CONSTRAINT "user_entitlements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_entitlements"
    ADD CONSTRAINT "user_entitlements_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "storage"."buckets_analytics"
    ADD CONSTRAINT "buckets_analytics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."buckets"
    ADD CONSTRAINT "buckets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."buckets_vectors"
    ADD CONSTRAINT "buckets_vectors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."migrations"
    ADD CONSTRAINT "migrations_name_key" UNIQUE ("name");



ALTER TABLE ONLY "storage"."migrations"
    ADD CONSTRAINT "migrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."objects"
    ADD CONSTRAINT "objects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads_parts"
    ADD CONSTRAINT "s3_multipart_uploads_parts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads"
    ADD CONSTRAINT "s3_multipart_uploads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."vector_indexes"
    ADD CONSTRAINT "vector_indexes_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_analytics_events_event" ON "public"."analytics_events" USING "btree" ("event");



CREATE INDEX "idx_analytics_events_timestamp" ON "public"."analytics_events" USING "btree" ("timestamp" DESC);



CREATE INDEX "idx_analytics_events_user_id" ON "public"."analytics_events" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_calendar_events_couple" ON "public"."calendar_events" USING "btree" ("couple_id");



CREATE INDEX "idx_calendar_events_created_by" ON "public"."calendar_events" USING "btree" ("created_by");



CREATE INDEX "idx_calendar_events_date" ON "public"."calendar_events" USING "btree" ("event_date");



CREATE INDEX "idx_calendar_events_type" ON "public"."calendar_events" USING "btree" ("event_type");



CREATE INDEX "idx_couple_data_couple_id" ON "public"."couple_data" USING "btree" ("couple_id");



CREATE INDEX "idx_couple_data_created_at" ON "public"."couple_data" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_couple_data_created_by" ON "public"."couple_data" USING "btree" ("created_by");



CREATE INDEX "idx_couple_data_key" ON "public"."couple_data" USING "btree" ("key");



CREATE INDEX "idx_couple_data_not_deleted" ON "public"."couple_data" USING "btree" ("couple_id", "data_type", "updated_at") WHERE ("is_deleted" = false);



CREATE INDEX "idx_couple_data_private" ON "public"."couple_data" USING "btree" ("is_private");



CREATE INDEX "idx_couple_data_sync" ON "public"."couple_data" USING "btree" ("couple_id", "data_type", "updated_at");



CREATE INDEX "idx_couple_data_type" ON "public"."couple_data" USING "btree" ("data_type");



CREATE INDEX "idx_couple_data_type_user" ON "public"."couple_data" USING "btree" ("couple_id", "data_type", "created_by");



CREATE INDEX "idx_couple_data_updated" ON "public"."couple_data" USING "btree" ("updated_at");



CREATE INDEX "idx_couple_members_couple" ON "public"."couple_members" USING "btree" ("couple_id");



CREATE INDEX "idx_couple_members_user" ON "public"."couple_members" USING "btree" ("user_id");



CREATE INDEX "idx_couples_active" ON "public"."couples" USING "btree" ("is_active");



CREATE INDEX "idx_couples_created_by" ON "public"."couples" USING "btree" ("created_by");



CREATE INDEX "idx_couples_premium" ON "public"."couples" USING "btree" ("is_premium") WHERE ("is_premium" = true);



CREATE INDEX "idx_entitlements_premium" ON "public"."user_entitlements" USING "btree" ("is_premium");



CREATE INDEX "idx_entitlements_user" ON "public"."user_entitlements" USING "btree" ("user_id");



CREATE INDEX "idx_link_codes_couple" ON "public"."partner_link_codes" USING "btree" ("couple_id");



CREATE INDEX "idx_link_codes_created_by" ON "public"."partner_link_codes" USING "btree" ("created_by");



CREATE INDEX "idx_link_codes_expires" ON "public"."partner_link_codes" USING "btree" ("expires_at");



CREATE INDEX "idx_link_codes_hash" ON "public"."partner_link_codes" USING "btree" ("code_hash");



CREATE INDEX "idx_link_codes_unused" ON "public"."partner_link_codes" USING "btree" ("expires_at") WHERE ("used_at" IS NULL);



CREATE INDEX "idx_moments_couple" ON "public"."moments" USING "btree" ("couple_id");



CREATE INDEX "idx_moments_created_at" ON "public"."moments" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_moments_created_by" ON "public"."moments" USING "btree" ("created_by");



CREATE INDEX "idx_moments_private" ON "public"."moments" USING "btree" ("is_private");



CREATE INDEX "idx_moments_type" ON "public"."moments" USING "btree" ("moment_type");



CREATE INDEX "idx_notification_log_created" ON "public"."notification_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_notification_log_recipient" ON "public"."notification_log" USING "btree" ("recipient");



CREATE INDEX "idx_notification_log_status" ON "public"."notification_log" USING "btree" ("status") WHERE ("status" = 'failed'::"text");



CREATE INDEX "idx_password_recovery_codes_email" ON "public"."password_recovery_codes" USING "btree" ("email", "created_at" DESC);



CREATE INDEX "idx_password_recovery_codes_user_id" ON "public"."password_recovery_codes" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_password_recovery_request_limits_updated_at" ON "public"."password_recovery_request_limits" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_profiles_email" ON "public"."profiles" USING "btree" ("email");



CREATE INDEX "idx_profiles_premium" ON "public"."profiles" USING "btree" ("is_premium");



CREATE INDEX "idx_push_tokens_last_used" ON "public"."push_tokens" USING "btree" ("last_used_at") WHERE ("last_used_at" IS NOT NULL);



CREATE INDEX "idx_push_tokens_token" ON "public"."push_tokens" USING "btree" ("token");



CREATE INDEX "idx_push_tokens_user" ON "public"."push_tokens" USING "btree" ("user_id");



CREATE INDEX "idx_usage_events_couple_day" ON "public"."usage_events" USING "btree" ("couple_id", "local_day_key");



CREATE INDEX "idx_usage_events_daily" ON "public"."usage_events" USING "btree" ("couple_id", "user_id", "event_type", "local_day_key");



CREATE INDEX "idx_usage_events_user_day" ON "public"."usage_events" USING "btree" ("user_id", "local_day_key");



CREATE UNIQUE INDEX "bname" ON "storage"."buckets" USING "btree" ("name");



CREATE UNIQUE INDEX "bucketid_objname" ON "storage"."objects" USING "btree" ("bucket_id", "name");



CREATE UNIQUE INDEX "buckets_analytics_unique_name_idx" ON "storage"."buckets_analytics" USING "btree" ("name") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_multipart_uploads_list" ON "storage"."s3_multipart_uploads" USING "btree" ("bucket_id", "key", "created_at");



CREATE INDEX "idx_objects_bucket_id_name" ON "storage"."objects" USING "btree" ("bucket_id", "name" COLLATE "C");



CREATE INDEX "idx_objects_bucket_id_name_lower" ON "storage"."objects" USING "btree" ("bucket_id", "lower"("name") COLLATE "C");



CREATE INDEX "name_prefix_search" ON "storage"."objects" USING "btree" ("name" "text_pattern_ops");



CREATE UNIQUE INDEX "vector_indexes_name_bucket_id_idx" ON "storage"."vector_indexes" USING "btree" ("name", "bucket_id");



CREATE OR REPLACE TRIGGER "couple_data_updated_at" BEFORE UPDATE ON "public"."couple_data" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_notify_calendar_event" AFTER INSERT ON "public"."calendar_events" FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_calendar_event_insert"();



CREATE OR REPLACE TRIGGER "trigger_notify_couple_created" AFTER INSERT ON "public"."couple_members" FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_couple_created"();



CREATE OR REPLACE TRIGGER "trigger_notify_couple_data" AFTER INSERT ON "public"."couple_data" FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_couple_data_insert"();



CREATE OR REPLACE TRIGGER "trigger_notify_moment" AFTER INSERT ON "public"."moments" FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_moment_insert"();



CREATE OR REPLACE TRIGGER "trigger_sync_couple_premium" AFTER UPDATE OF "is_premium" ON "public"."couples" FOR EACH ROW WHEN (("old"."is_premium" IS DISTINCT FROM "new"."is_premium")) EXECUTE FUNCTION "public"."sync_couple_premium_to_profiles"();



CREATE OR REPLACE TRIGGER "update_calendar_events_updated_at" BEFORE UPDATE ON "public"."calendar_events" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_couples_updated_at" BEFORE UPDATE ON "public"."couples" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_entitlements_updated_at" BEFORE UPDATE ON "public"."user_entitlements" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_moments_updated_at" BEFORE UPDATE ON "public"."moments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "enforce_bucket_name_length_trigger" BEFORE INSERT OR UPDATE OF "name" ON "storage"."buckets" FOR EACH ROW EXECUTE FUNCTION "storage"."enforce_bucket_name_length"();



CREATE OR REPLACE TRIGGER "protect_buckets_delete" BEFORE DELETE ON "storage"."buckets" FOR EACH STATEMENT EXECUTE FUNCTION "storage"."protect_delete"();



CREATE OR REPLACE TRIGGER "protect_objects_delete" BEFORE DELETE ON "storage"."objects" FOR EACH STATEMENT EXECUTE FUNCTION "storage"."protect_delete"();



CREATE OR REPLACE TRIGGER "update_objects_updated_at" BEFORE UPDATE ON "storage"."objects" FOR EACH ROW EXECUTE FUNCTION "storage"."update_updated_at_column"();



ALTER TABLE ONLY "public"."analytics_events"
    ADD CONSTRAINT "analytics_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_couple_id_fkey" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."couple_data"
    ADD CONSTRAINT "couple_data_couple_id_fkey" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."couple_data"
    ADD CONSTRAINT "couple_data_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."couple_members"
    ADD CONSTRAINT "couple_members_couple_id_fkey" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."couple_members"
    ADD CONSTRAINT "couple_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."couples"
    ADD CONSTRAINT "couples_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."moments"
    ADD CONSTRAINT "moments_couple_id_fkey" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."moments"
    ADD CONSTRAINT "moments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."notification_log"
    ADD CONSTRAINT "notification_log_recipient_fkey" FOREIGN KEY ("recipient") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."partner_link_codes"
    ADD CONSTRAINT "partner_link_codes_couple_id_fkey" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id");



ALTER TABLE ONLY "public"."partner_link_codes"
    ADD CONSTRAINT "partner_link_codes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."partner_link_codes"
    ADD CONSTRAINT "partner_link_codes_used_by_fkey" FOREIGN KEY ("used_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."password_recovery_codes"
    ADD CONSTRAINT "password_recovery_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rate_limit_buckets"
    ADD CONSTRAINT "rate_limit_buckets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."usage_events"
    ADD CONSTRAINT "usage_events_couple_id_fkey" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."usage_events"
    ADD CONSTRAINT "usage_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."user_entitlements"
    ADD CONSTRAINT "user_entitlements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "storage"."objects"
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets"("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads"
    ADD CONSTRAINT "s3_multipart_uploads_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets"("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads_parts"
    ADD CONSTRAINT "s3_multipart_uploads_parts_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets"("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads_parts"
    ADD CONSTRAINT "s3_multipart_uploads_parts_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "storage"."s3_multipart_uploads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "storage"."vector_indexes"
    ADD CONSTRAINT "vector_indexes_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets_vectors"("id");



CREATE POLICY "Authenticated users can create link codes" ON "public"."partner_link_codes" FOR INSERT WITH CHECK ((("created_by" = "auth"."uid"()) AND (("couple_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."couple_members" "cm"
  WHERE (("cm"."couple_id" = "partner_link_codes"."couple_id") AND ("cm"."user_id" = "auth"."uid"()))))) AND (("couple_id" IS NOT NULL) OR (NOT (EXISTS ( SELECT 1
   FROM "public"."couple_members"
  WHERE ("couple_members"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Couple data delete" ON "public"."couple_data" FOR DELETE TO "authenticated" USING ((("created_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."couple_members" "cm"
  WHERE (("cm"."couple_id" = "couple_data"."couple_id") AND ("cm"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Couple data insert (premium-aware)" ON "public"."couple_data" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."couple_members" "cm"
  WHERE (("cm"."couple_id" = "couple_data"."couple_id") AND ("cm"."user_id" = "auth"."uid"())))) AND ("created_by" = "auth"."uid"()) AND ("public"."is_user_premium"() OR ("data_type" = ANY (ARRAY['journal'::"text", 'prompt_answer'::"text", 'check_in'::"text", 'vibe'::"text", 'couple_state'::"text", 'moment_signal'::"text", 'attachment_meta'::"text"])) OR (("data_type" = 'memory'::"text") AND ("public"."user_data_count"("couple_id", 'memory'::"text") < 10)) OR (("data_type" = 'custom_ritual'::"text") AND ("public"."user_data_count"("couple_id", 'custom_ritual'::"text") < 2)) OR (("data_type" = 'love_note'::"text") AND ("public"."user_data_count"("couple_id", 'love_note'::"text") < 20)))));



CREATE POLICY "Couple data select" ON "public"."couple_data" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."couple_members" "cm"
  WHERE (("cm"."couple_id" = "couple_data"."couple_id") AND ("cm"."user_id" = "auth"."uid"())))) AND (("is_private" IS NOT TRUE) OR ("created_by" = "auth"."uid"()))));



CREATE POLICY "Couple data update" ON "public"."couple_data" FOR UPDATE TO "authenticated" USING ((("created_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."couple_members" "cm"
  WHERE (("cm"."couple_id" = "couple_data"."couple_id") AND ("cm"."user_id" = "auth"."uid"())))))) WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "Couple members can create moments" ON "public"."moments" FOR INSERT WITH CHECK ((("created_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."couple_members" "m"
  WHERE (("m"."couple_id" = "moments"."couple_id") AND ("m"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Couple members can update couple" ON "public"."couples" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."couple_members" "cm"
  WHERE (("cm"."couple_id" = "couples"."id") AND ("cm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Couple members can view calendar events" ON "public"."calendar_events" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."couple_members" "m"
  WHERE (("m"."couple_id" = "calendar_events"."couple_id") AND ("m"."user_id" = "auth"."uid"())))));



CREATE POLICY "Couple members can view couple" ON "public"."couples" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."couple_members" "cm"
  WHERE (("cm"."couple_id" = "couples"."id") AND ("cm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Couple members can view memberships" ON "public"."couple_members" FOR SELECT USING (("couple_id" IN ( SELECT "public"."get_my_couple_ids"() AS "get_my_couple_ids")));



CREATE POLICY "Couple members can view moments" ON "public"."moments" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."couple_members" "m"
  WHERE (("m"."couple_id" = "moments"."couple_id") AND ("m"."user_id" = "auth"."uid"())))) AND (("is_private" = false) OR ("created_by" = "auth"."uid"()))));



CREATE POLICY "Creators can delete moments" ON "public"."moments" FOR DELETE USING ((("created_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."couple_members" "m"
  WHERE (("m"."couple_id" = "moments"."couple_id") AND ("m"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Creators can update moments" ON "public"."moments" FOR UPDATE USING ((("created_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."couple_members" "m"
  WHERE (("m"."couple_id" = "moments"."couple_id") AND ("m"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Deny client entitlement updates" ON "public"."user_entitlements" FOR UPDATE TO "authenticated" USING (false) WITH CHECK (false);



CREATE POLICY "Deny client entitlement writes" ON "public"."user_entitlements" FOR INSERT TO "authenticated" WITH CHECK (false);



CREATE POLICY "Premium creators can delete calendar events" ON "public"."calendar_events" FOR DELETE USING ((("created_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."couple_members" "m"
  WHERE (("m"."couple_id" = "calendar_events"."couple_id") AND ("m"."user_id" = "auth"."uid"())))) AND "public"."couple_has_premium"("couple_id")));



CREATE POLICY "Premium creators can update calendar events" ON "public"."calendar_events" FOR UPDATE USING ((("created_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."couple_members" "m"
  WHERE (("m"."couple_id" = "calendar_events"."couple_id") AND ("m"."user_id" = "auth"."uid"())))) AND "public"."couple_has_premium"("couple_id")));



CREATE POLICY "Premium members can create calendar events" ON "public"."calendar_events" FOR INSERT WITH CHECK ((("created_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."couple_members" "m"
  WHERE (("m"."couple_id" = "calendar_events"."couple_id") AND ("m"."user_id" = "auth"."uid"())))) AND "public"."couple_has_premium"("couple_id")));



CREATE POLICY "Users can create couples" ON "public"."couples" FOR INSERT WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can delete own push tokens" ON "public"."push_tokens" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete own usage events" ON "public"."usage_events" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can insert own push tokens" ON "public"."push_tokens" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert own usage events" ON "public"."usage_events" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND "public"."is_couple_member"("couple_id", "auth"."uid"())));



CREATE POLICY "Users can join couple" ON "public"."couple_members" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."couples" "c"
  WHERE (("c"."id" = "couple_members"."couple_id") AND ("c"."created_by" = "auth"."uid"()))))));



CREATE POLICY "Users can leave couple" ON "public"."couple_members" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can read couple usage events" ON "public"."usage_events" FOR SELECT USING ("public"."is_couple_member"("couple_id", "auth"."uid"()));



CREATE POLICY "Users can update own membership" ON "public"."couple_members" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own push tokens" ON "public"."push_tokens" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own entitlements" ON "public"."user_entitlements" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own link codes" ON "public"."partner_link_codes" FOR SELECT USING (("created_by" = "auth"."uid"()));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own push tokens" ON "public"."push_tokens" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."analytics_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "analytics_insert_own" ON "public"."analytics_events" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "analytics_select_own" ON "public"."analytics_events" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."calendar_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."couple_data" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."couple_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."couples" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."moments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notification_log_service_only" ON "public"."notification_log" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."partner_link_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."password_recovery_codes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "password_recovery_codes_service_only" ON "public"."password_recovery_codes" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."password_recovery_request_limits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "password_recovery_request_limits_service_only" ON "public"."password_recovery_request_limits" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rate_limit_buckets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_role_only" ON "public"."rate_limit_buckets" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."usage_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_entitlements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Couple members can delete own media" ON "storage"."objects" FOR DELETE USING ((("bucket_id" = 'couple-media'::"text") AND ("auth"."role"() = 'authenticated'::"text") AND ("owner" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."couple_members" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND (("storage"."foldername"("objects"."name"))[1] = 'couples'::"text") AND (("storage"."foldername"("objects"."name"))[2] = ("m"."couple_id")::"text"))))));



CREATE POLICY "Couple members can upload media" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'couple-media'::"text") AND ("auth"."role"() = 'authenticated'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."couple_members" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND (("storage"."foldername"("objects"."name"))[1] = 'couples'::"text") AND (("storage"."foldername"("objects"."name"))[2] = ("m"."couple_id")::"text"))))));



CREATE POLICY "Couple members can view media" ON "storage"."objects" FOR SELECT USING ((("bucket_id" = 'couple-media'::"text") AND ("auth"."role"() = 'authenticated'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."couple_members" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND (("storage"."foldername"("objects"."name"))[1] = 'couples'::"text") AND (("storage"."foldername"("objects"."name"))[2] = ("m"."couple_id")::"text"))))));



CREATE POLICY "attachments_delete" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'attachments'::"text") AND (("storage"."foldername"("name"))[2] = ("auth"."uid"())::"text") AND (EXISTS ( SELECT 1
   FROM "public"."couple_members" "cm"
  WHERE (("cm"."couple_id" = (("storage"."foldername"("objects"."name"))[1])::"uuid") AND ("cm"."user_id" = "auth"."uid"()))))));



CREATE POLICY "attachments_insert" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'attachments'::"text") AND (("storage"."foldername"("name"))[2] = ("auth"."uid"())::"text") AND (EXISTS ( SELECT 1
   FROM "public"."couple_members" "cm"
  WHERE (("cm"."couple_id" = (("storage"."foldername"("objects"."name"))[1])::"uuid") AND ("cm"."user_id" = "auth"."uid"()))))));



CREATE POLICY "attachments_select" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'attachments'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."couple_members" "cm"
  WHERE (("cm"."couple_id" = (("storage"."foldername"("objects"."name"))[1])::"uuid") AND ("cm"."user_id" = "auth"."uid"()))))));



ALTER TABLE "storage"."buckets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."buckets_analytics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."buckets_vectors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."migrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."objects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."s3_multipart_uploads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."s3_multipart_uploads_parts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "storage_attachments_member_delete" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'attachments'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."couple_members" "cm"
  WHERE (("cm"."user_id" = "auth"."uid"()) AND (("cm"."couple_id")::"text" = ("storage"."foldername"("objects"."name"))[1]))))));



CREATE POLICY "storage_attachments_member_insert" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'attachments'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."couple_members" "cm"
  WHERE (("cm"."user_id" = "auth"."uid"()) AND (("cm"."couple_id")::"text" = ("storage"."foldername"("objects"."name"))[1]))))));



CREATE POLICY "storage_attachments_member_select" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'attachments'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."couple_members" "cm"
  WHERE (("cm"."user_id" = "auth"."uid"()) AND (("cm"."couple_id")::"text" = ("storage"."foldername"("objects"."name"))[1]))))));



CREATE POLICY "storage_attachments_member_update" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'attachments'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."couple_members" "cm"
  WHERE (("cm"."user_id" = "auth"."uid"()) AND (("cm"."couple_id")::"text" = ("storage"."foldername"("objects"."name"))[1])))))) WITH CHECK ((("bucket_id" = 'attachments'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."couple_members" "cm"
  WHERE (("cm"."user_id" = "auth"."uid"()) AND (("cm"."couple_id")::"text" = ("storage"."foldername"("objects"."name"))[1]))))));



CREATE POLICY "storage_couple_media_member_delete" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'couple-media'::"text") AND (("storage"."foldername"("name"))[1] = 'couples'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."couple_members" "cm"
  WHERE (("cm"."user_id" = "auth"."uid"()) AND (("cm"."couple_id")::"text" = ("storage"."foldername"("objects"."name"))[2]))))));



CREATE POLICY "storage_couple_media_member_insert" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'couple-media'::"text") AND (("storage"."foldername"("name"))[1] = 'couples'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."couple_members" "cm"
  WHERE (("cm"."user_id" = "auth"."uid"()) AND (("cm"."couple_id")::"text" = ("storage"."foldername"("objects"."name"))[2]))))));



CREATE POLICY "storage_couple_media_member_select" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'couple-media'::"text") AND (("storage"."foldername"("name"))[1] = 'couples'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."couple_members" "cm"
  WHERE (("cm"."user_id" = "auth"."uid"()) AND (("cm"."couple_id")::"text" = ("storage"."foldername"("objects"."name"))[2]))))));



CREATE POLICY "storage_couple_media_member_update" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'couple-media'::"text") AND (("storage"."foldername"("name"))[1] = 'couples'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."couple_members" "cm"
  WHERE (("cm"."user_id" = "auth"."uid"()) AND (("cm"."couple_id")::"text" = ("storage"."foldername"("objects"."name"))[2])))))) WITH CHECK ((("bucket_id" = 'couple-media'::"text") AND (("storage"."foldername"("name"))[1] = 'couples'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."couple_members" "cm"
  WHERE (("cm"."user_id" = "auth"."uid"()) AND (("cm"."couple_id")::"text" = ("storage"."foldername"("objects"."name"))[2]))))));



CREATE POLICY "storage_whispers_member_delete" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'whispers'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."couple_members" "cm"
  WHERE (("cm"."user_id" = "auth"."uid"()) AND (("cm"."couple_id")::"text" = ("storage"."foldername"("objects"."name"))[1]))))));



CREATE POLICY "storage_whispers_member_insert" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'whispers'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."couple_members" "cm"
  WHERE (("cm"."user_id" = "auth"."uid"()) AND (("cm"."couple_id")::"text" = ("storage"."foldername"("objects"."name"))[1]))))));



CREATE POLICY "storage_whispers_member_select" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'whispers'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."couple_members" "cm"
  WHERE (("cm"."user_id" = "auth"."uid"()) AND (("cm"."couple_id")::"text" = ("storage"."foldername"("objects"."name"))[1]))))));



CREATE POLICY "storage_whispers_member_update" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'whispers'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."couple_members" "cm"
  WHERE (("cm"."user_id" = "auth"."uid"()) AND (("cm"."couple_id")::"text" = ("storage"."foldername"("objects"."name"))[1])))))) WITH CHECK ((("bucket_id" = 'whispers'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."couple_members" "cm"
  WHERE (("cm"."user_id" = "auth"."uid"()) AND (("cm"."couple_id")::"text" = ("storage"."foldername"("objects"."name"))[1]))))));



ALTER TABLE "storage"."vector_indexes" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT USAGE ON SCHEMA "storage" TO "postgres" WITH GRANT OPTION;
GRANT USAGE ON SCHEMA "storage" TO "anon";
GRANT USAGE ON SCHEMA "storage" TO "authenticated";
GRANT USAGE ON SCHEMA "storage" TO "service_role";
GRANT ALL ON SCHEMA "storage" TO "supabase_storage_admin" WITH GRANT OPTION;
GRANT ALL ON SCHEMA "storage" TO "dashboard_user";



GRANT ALL ON FUNCTION "public"."check_rate_limit"("p_user_id" "uuid", "p_cost" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."check_rate_limit"("p_user_id" "uuid", "p_cost" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_rate_limit"("p_user_id" "uuid", "p_cost" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_sensitive_rate_limit"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_sensitive_rate_limit"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_sensitive_rate_limit"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."couple_has_premium"("check_couple_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."couple_has_premium"("check_couple_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."couple_has_premium"("check_couple_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_couple_for_qr"("device_public_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_couple_for_qr"("device_public_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_couple_for_qr"("device_public_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_own_account"() TO "anon";
GRANT ALL ON FUNCTION "public"."delete_own_account"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_own_account"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_couple_premium_status"("input_couple_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_couple_premium_status"("input_couple_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_couple_premium_status"("input_couple_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_daily_usage_count"("input_couple_id" "uuid", "input_user_id" "uuid", "input_event_type" "text", "input_day_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_daily_usage_count"("input_couple_id" "uuid", "input_user_id" "uuid", "input_event_type" "text", "input_day_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_daily_usage_count"("input_couple_id" "uuid", "input_user_id" "uuid", "input_event_type" "text", "input_day_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_couple_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_couple_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_couple_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_couple_id"("input_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_couple_id"("input_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_couple_id"("input_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_couple_member"("couple_uuid" "uuid", "user_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_couple_member"("couple_uuid" "uuid", "user_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_couple_member"("couple_uuid" "uuid", "user_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_premium_user"("check_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_premium_user"("check_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_premium_user"("check_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_user_premium"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_user_premium"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_user_premium"() TO "service_role";



GRANT ALL ON FUNCTION "public"."leave_couple"() TO "anon";
GRANT ALL ON FUNCTION "public"."leave_couple"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."leave_couple"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_on_calendar_event_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_on_calendar_event_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_on_calendar_event_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_on_couple_created"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_on_couple_created"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_on_couple_created"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_on_couple_data_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_on_couple_data_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_on_couple_data_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_on_moment_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_on_moment_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_on_moment_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_partner"("sender_id" "uuid", "notification_title" "text", "notification_body" "text", "notification_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."notify_partner"("sender_id" "uuid", "notification_title" "text", "notification_body" "text", "notification_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_partner"("sender_id" "uuid", "notification_title" "text", "notification_body" "text", "notification_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."redeem_pairing_code"("input_code_hash" "text", "input_public_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."redeem_pairing_code"("input_code_hash" "text", "input_public_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."redeem_pairing_code"("input_code_hash" "text", "input_public_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."redeem_partner_code"("input_code_hash" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."redeem_partner_code"("input_code_hash" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."redeem_partner_code"("input_code_hash" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."send_expo_push"("p_token" "text", "p_title" "text", "p_body" "text", "p_data" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."send_expo_push"("p_token" "text", "p_title" "text", "p_body" "text", "p_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_couple_premium"("input_couple_id" "uuid", "input_is_premium" boolean, "input_source" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_couple_premium"("input_couple_id" "uuid", "input_is_premium" boolean, "input_source" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_couple_premium"("input_couple_id" "uuid", "input_is_premium" boolean, "input_source" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_member_wrapped_couple_key"("input_couple_id" "uuid", "target_user_id" "uuid", "input_wrapped_couple_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_member_wrapped_couple_key"("input_couple_id" "uuid", "target_user_id" "uuid", "input_wrapped_couple_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_member_wrapped_couple_key"("input_couple_id" "uuid", "target_user_id" "uuid", "input_wrapped_couple_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_my_wrapped_couple_key"("input_couple_id" "uuid", "input_wrapped_couple_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_my_wrapped_couple_key"("input_couple_id" "uuid", "input_wrapped_couple_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_my_wrapped_couple_key"("input_couple_id" "uuid", "input_wrapped_couple_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_couple_premium_to_profiles"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_couple_premium_to_profiles"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_couple_premium_to_profiles"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."user_data_count"("p_couple_id" "uuid", "p_data_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."user_data_count"("p_couple_id" "uuid", "p_data_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_data_count"("p_couple_id" "uuid", "p_data_type" "text") TO "service_role";



GRANT ALL ON TABLE "public"."analytics_events" TO "anon";
GRANT ALL ON TABLE "public"."analytics_events" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_events" TO "service_role";



GRANT ALL ON TABLE "public"."calendar_events" TO "anon";
GRANT ALL ON TABLE "public"."calendar_events" TO "authenticated";
GRANT ALL ON TABLE "public"."calendar_events" TO "service_role";



GRANT ALL ON TABLE "public"."couple_data" TO "anon";
GRANT ALL ON TABLE "public"."couple_data" TO "authenticated";
GRANT ALL ON TABLE "public"."couple_data" TO "service_role";



GRANT ALL ON TABLE "public"."couple_members" TO "anon";
GRANT ALL ON TABLE "public"."couple_members" TO "authenticated";
GRANT ALL ON TABLE "public"."couple_members" TO "service_role";



GRANT ALL ON TABLE "public"."couples" TO "anon";
GRANT ALL ON TABLE "public"."couples" TO "authenticated";
GRANT ALL ON TABLE "public"."couples" TO "service_role";



GRANT ALL ON TABLE "public"."moments" TO "anon";
GRANT ALL ON TABLE "public"."moments" TO "authenticated";
GRANT ALL ON TABLE "public"."moments" TO "service_role";



GRANT ALL ON TABLE "public"."notification_log" TO "anon";
GRANT ALL ON TABLE "public"."notification_log" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_log" TO "service_role";



GRANT ALL ON TABLE "public"."partner_link_codes" TO "anon";
GRANT ALL ON TABLE "public"."partner_link_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."partner_link_codes" TO "service_role";



GRANT ALL ON TABLE "public"."password_recovery_codes" TO "anon";
GRANT ALL ON TABLE "public"."password_recovery_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."password_recovery_codes" TO "service_role";



GRANT ALL ON TABLE "public"."password_recovery_request_limits" TO "anon";
GRANT ALL ON TABLE "public"."password_recovery_request_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."password_recovery_request_limits" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."push_tokens" TO "anon";
GRANT ALL ON TABLE "public"."push_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."push_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."rate_limit_buckets" TO "anon";
GRANT ALL ON TABLE "public"."rate_limit_buckets" TO "authenticated";
GRANT ALL ON TABLE "public"."rate_limit_buckets" TO "service_role";



GRANT ALL ON TABLE "public"."usage_events" TO "anon";
GRANT ALL ON TABLE "public"."usage_events" TO "authenticated";
GRANT ALL ON TABLE "public"."usage_events" TO "service_role";



GRANT ALL ON TABLE "public"."user_entitlements" TO "anon";
GRANT ALL ON TABLE "public"."user_entitlements" TO "authenticated";
GRANT ALL ON TABLE "public"."user_entitlements" TO "service_role";



REVOKE ALL ON TABLE "storage"."buckets" FROM "supabase_storage_admin";
GRANT ALL ON TABLE "storage"."buckets" TO "supabase_storage_admin" WITH GRANT OPTION;
GRANT ALL ON TABLE "storage"."buckets" TO "service_role";
GRANT ALL ON TABLE "storage"."buckets" TO "authenticated";
GRANT ALL ON TABLE "storage"."buckets" TO "anon";
GRANT ALL ON TABLE "storage"."buckets" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON TABLE "storage"."buckets_analytics" TO "service_role";
GRANT ALL ON TABLE "storage"."buckets_analytics" TO "authenticated";
GRANT ALL ON TABLE "storage"."buckets_analytics" TO "anon";



GRANT SELECT ON TABLE "storage"."buckets_vectors" TO "service_role";
GRANT SELECT ON TABLE "storage"."buckets_vectors" TO "authenticated";
GRANT SELECT ON TABLE "storage"."buckets_vectors" TO "anon";



REVOKE ALL ON TABLE "storage"."objects" FROM "supabase_storage_admin";
GRANT ALL ON TABLE "storage"."objects" TO "supabase_storage_admin" WITH GRANT OPTION;
GRANT ALL ON TABLE "storage"."objects" TO "service_role";
GRANT ALL ON TABLE "storage"."objects" TO "authenticated";
GRANT ALL ON TABLE "storage"."objects" TO "anon";
GRANT ALL ON TABLE "storage"."objects" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON TABLE "storage"."s3_multipart_uploads" TO "service_role";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads" TO "authenticated";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads" TO "anon";



GRANT ALL ON TABLE "storage"."s3_multipart_uploads_parts" TO "service_role";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads_parts" TO "authenticated";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads_parts" TO "anon";



GRANT SELECT ON TABLE "storage"."vector_indexes" TO "service_role";
GRANT SELECT ON TABLE "storage"."vector_indexes" TO "authenticated";
GRANT SELECT ON TABLE "storage"."vector_indexes" TO "anon";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "service_role";




