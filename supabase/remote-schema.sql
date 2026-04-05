--
-- PostgreSQL database dump
--

\restrict OzLM3GJeQ2Wevvn4Lg6jcxCDMNOkIQgHaikxWgsCXlBaltX02TYX8RB8WmBC0Fe

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA "auth";


ALTER SCHEMA "auth" OWNER TO "supabase_admin";

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";

--
-- Name: SCHEMA "public"; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA "public" IS 'standard public schema';


--
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE "auth"."aal_level" AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


ALTER TYPE "auth"."aal_level" OWNER TO "supabase_auth_admin";

--
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE "auth"."code_challenge_method" AS ENUM (
    's256',
    'plain'
);


ALTER TYPE "auth"."code_challenge_method" OWNER TO "supabase_auth_admin";

--
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE "auth"."factor_status" AS ENUM (
    'unverified',
    'verified'
);


ALTER TYPE "auth"."factor_status" OWNER TO "supabase_auth_admin";

--
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE "auth"."factor_type" AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


ALTER TYPE "auth"."factor_type" OWNER TO "supabase_auth_admin";

--
-- Name: oauth_authorization_status; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE "auth"."oauth_authorization_status" AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


ALTER TYPE "auth"."oauth_authorization_status" OWNER TO "supabase_auth_admin";

--
-- Name: oauth_client_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE "auth"."oauth_client_type" AS ENUM (
    'public',
    'confidential'
);


ALTER TYPE "auth"."oauth_client_type" OWNER TO "supabase_auth_admin";

--
-- Name: oauth_registration_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE "auth"."oauth_registration_type" AS ENUM (
    'dynamic',
    'manual'
);


ALTER TYPE "auth"."oauth_registration_type" OWNER TO "supabase_auth_admin";

--
-- Name: oauth_response_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE "auth"."oauth_response_type" AS ENUM (
    'code'
);


ALTER TYPE "auth"."oauth_response_type" OWNER TO "supabase_auth_admin";

--
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE "auth"."one_time_token_type" AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


ALTER TYPE "auth"."one_time_token_type" OWNER TO "supabase_auth_admin";

--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--

CREATE FUNCTION "auth"."email"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


ALTER FUNCTION "auth"."email"() OWNER TO "supabase_auth_admin";

--
-- Name: FUNCTION "email"(); Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON FUNCTION "auth"."email"() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--

CREATE FUNCTION "auth"."jwt"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


ALTER FUNCTION "auth"."jwt"() OWNER TO "supabase_auth_admin";

--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--

CREATE FUNCTION "auth"."role"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


ALTER FUNCTION "auth"."role"() OWNER TO "supabase_auth_admin";

--
-- Name: FUNCTION "role"(); Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON FUNCTION "auth"."role"() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--

CREATE FUNCTION "auth"."uid"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


ALTER FUNCTION "auth"."uid"() OWNER TO "supabase_auth_admin";

--
-- Name: FUNCTION "uid"(); Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON FUNCTION "auth"."uid"() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';


--
-- Name: check_rate_limit("uuid", integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."check_rate_limit"("p_user_id" "uuid", "p_cost" integer DEFAULT 1) RETURNS boolean
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

--
-- Name: check_sensitive_rate_limit("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."check_sensitive_rate_limit"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  SELECT check_rate_limit(p_user_id, 10);
$$;


ALTER FUNCTION "public"."check_sensitive_rate_limit"("p_user_id" "uuid") OWNER TO "postgres";

--
-- Name: couple_has_premium("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."couple_has_premium"("check_couple_id" "uuid") RETURNS boolean
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

--
-- Name: create_couple_for_qr("text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."create_couple_for_qr"("device_public_key" "text" DEFAULT NULL::"text") RETURNS "jsonb"
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

--
-- Name: delete_own_account(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."delete_own_account"() RETURNS "void"
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

--
-- Name: get_couple_premium_status("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."get_couple_premium_status"("input_couple_id" "uuid") RETURNS "jsonb"
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

--
-- Name: get_daily_usage_count("uuid", "uuid", "text", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."get_daily_usage_count"("input_couple_id" "uuid", "input_user_id" "uuid", "input_event_type" "text", "input_day_key" "text") RETURNS integer
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

--
-- Name: get_my_couple_ids(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."get_my_couple_ids"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT couple_id FROM couple_members WHERE user_id = auth.uid();
$$;


ALTER FUNCTION "public"."get_my_couple_ids"() OWNER TO "postgres";

--
-- Name: get_user_couple_id("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."get_user_couple_id"("input_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN (SELECT couple_id FROM couple_members WHERE user_id = input_user_id LIMIT 1);
END;
$$;


ALTER FUNCTION "public"."get_user_couple_id"("input_user_id" "uuid") OWNER TO "postgres";

--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
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

--
-- Name: is_couple_member("uuid", "uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."is_couple_member"("couple_uuid" "uuid", "user_uuid" "uuid") RETURNS boolean
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

--
-- Name: is_premium_user("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."is_premium_user"("check_user_id" "uuid") RETURNS boolean
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

--
-- Name: is_user_premium(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."is_user_premium"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE((SELECT is_premium FROM profiles WHERE id = auth.uid()), false);
$$;


ALTER FUNCTION "public"."is_user_premium"() OWNER TO "postgres";

--
-- Name: leave_couple(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."leave_couple"() RETURNS "jsonb"
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

--
-- Name: notify_on_calendar_event_insert(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."notify_on_calendar_event_insert"() RETURNS "trigger"
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

--
-- Name: notify_on_couple_created(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."notify_on_couple_created"() RETURNS "trigger"
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

--
-- Name: notify_on_couple_data_insert(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."notify_on_couple_data_insert"() RETURNS "trigger"
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

--
-- Name: notify_on_moment_insert(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."notify_on_moment_insert"() RETURNS "trigger"
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

--
-- Name: notify_partner("uuid", "text", "text", "jsonb"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."notify_partner"("sender_id" "uuid", "notification_title" "text", "notification_body" "text", "notification_data" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
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

--
-- Name: redeem_pairing_code("text", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."redeem_pairing_code"("input_code_hash" "text", "input_public_key" "text") RETURNS "jsonb"
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

--
-- Name: redeem_partner_code("text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."redeem_partner_code"("input_code_hash" "text") RETURNS "jsonb"
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

--
-- Name: send_expo_push("text", "text", "text", "jsonb"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."send_expo_push"("p_token" "text", "p_title" "text", "p_body" "text", "p_data" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
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

--
-- Name: set_couple_premium("uuid", boolean, "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."set_couple_premium"("input_couple_id" "uuid", "input_is_premium" boolean, "input_source" "text" DEFAULT 'none'::"text") RETURNS "void"
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

--
-- Name: sync_couple_premium_to_profiles(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."sync_couple_premium_to_profiles"() RETURNS "trigger"
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

--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = GREATEST(NEW.updated_at, now());
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

--
-- Name: user_data_count("uuid", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."user_data_count"("p_couple_id" "uuid", "p_data_type" "text") RETURNS bigint
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT count(*) FROM couple_data
  WHERE couple_id = p_couple_id AND data_type = p_data_type AND created_by = auth.uid();
$$;


ALTER FUNCTION "public"."user_data_count"("p_couple_id" "uuid", "p_data_type" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";

--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE "auth"."audit_log_entries" (
    "instance_id" "uuid",
    "id" "uuid" NOT NULL,
    "payload" json,
    "created_at" timestamp with time zone,
    "ip_address" character varying(64) DEFAULT ''::character varying NOT NULL
);


ALTER TABLE "auth"."audit_log_entries" OWNER TO "supabase_auth_admin";

--
-- Name: TABLE "audit_log_entries"; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE "auth"."audit_log_entries" IS 'Auth: Audit trail for user actions.';


--
-- Name: custom_oauth_providers; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE "auth"."custom_oauth_providers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_type" "text" NOT NULL,
    "identifier" "text" NOT NULL,
    "name" "text" NOT NULL,
    "client_id" "text" NOT NULL,
    "client_secret" "text" NOT NULL,
    "acceptable_client_ids" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "scopes" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "pkce_enabled" boolean DEFAULT true NOT NULL,
    "attribute_mapping" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "authorization_params" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "email_optional" boolean DEFAULT false NOT NULL,
    "issuer" "text",
    "discovery_url" "text",
    "skip_nonce_check" boolean DEFAULT false NOT NULL,
    "cached_discovery" "jsonb",
    "discovery_cached_at" timestamp with time zone,
    "authorization_url" "text",
    "token_url" "text",
    "userinfo_url" "text",
    "jwks_uri" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "custom_oauth_providers_authorization_url_https" CHECK ((("authorization_url" IS NULL) OR ("authorization_url" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_authorization_url_length" CHECK ((("authorization_url" IS NULL) OR ("char_length"("authorization_url") <= 2048))),
    CONSTRAINT "custom_oauth_providers_client_id_length" CHECK ((("char_length"("client_id") >= 1) AND ("char_length"("client_id") <= 512))),
    CONSTRAINT "custom_oauth_providers_discovery_url_length" CHECK ((("discovery_url" IS NULL) OR ("char_length"("discovery_url") <= 2048))),
    CONSTRAINT "custom_oauth_providers_identifier_format" CHECK (("identifier" ~ '^[a-z0-9][a-z0-9:-]{0,48}[a-z0-9]$'::"text")),
    CONSTRAINT "custom_oauth_providers_issuer_length" CHECK ((("issuer" IS NULL) OR (("char_length"("issuer") >= 1) AND ("char_length"("issuer") <= 2048)))),
    CONSTRAINT "custom_oauth_providers_jwks_uri_https" CHECK ((("jwks_uri" IS NULL) OR ("jwks_uri" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_jwks_uri_length" CHECK ((("jwks_uri" IS NULL) OR ("char_length"("jwks_uri") <= 2048))),
    CONSTRAINT "custom_oauth_providers_name_length" CHECK ((("char_length"("name") >= 1) AND ("char_length"("name") <= 100))),
    CONSTRAINT "custom_oauth_providers_oauth2_requires_endpoints" CHECK ((("provider_type" <> 'oauth2'::"text") OR (("authorization_url" IS NOT NULL) AND ("token_url" IS NOT NULL) AND ("userinfo_url" IS NOT NULL)))),
    CONSTRAINT "custom_oauth_providers_oidc_discovery_url_https" CHECK ((("provider_type" <> 'oidc'::"text") OR ("discovery_url" IS NULL) OR ("discovery_url" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_oidc_issuer_https" CHECK ((("provider_type" <> 'oidc'::"text") OR ("issuer" IS NULL) OR ("issuer" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_oidc_requires_issuer" CHECK ((("provider_type" <> 'oidc'::"text") OR ("issuer" IS NOT NULL))),
    CONSTRAINT "custom_oauth_providers_provider_type_check" CHECK (("provider_type" = ANY (ARRAY['oauth2'::"text", 'oidc'::"text"]))),
    CONSTRAINT "custom_oauth_providers_token_url_https" CHECK ((("token_url" IS NULL) OR ("token_url" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_token_url_length" CHECK ((("token_url" IS NULL) OR ("char_length"("token_url") <= 2048))),
    CONSTRAINT "custom_oauth_providers_userinfo_url_https" CHECK ((("userinfo_url" IS NULL) OR ("userinfo_url" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_userinfo_url_length" CHECK ((("userinfo_url" IS NULL) OR ("char_length"("userinfo_url") <= 2048)))
);


ALTER TABLE "auth"."custom_oauth_providers" OWNER TO "supabase_auth_admin";

--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE "auth"."flow_state" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid",
    "auth_code" "text",
    "code_challenge_method" "auth"."code_challenge_method",
    "code_challenge" "text",
    "provider_type" "text" NOT NULL,
    "provider_access_token" "text",
    "provider_refresh_token" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "authentication_method" "text" NOT NULL,
    "auth_code_issued_at" timestamp with time zone,
    "invite_token" "text",
    "referrer" "text",
    "oauth_client_state_id" "uuid",
    "linking_target_id" "uuid",
    "email_optional" boolean DEFAULT false NOT NULL
);


ALTER TABLE "auth"."flow_state" OWNER TO "supabase_auth_admin";

--
-- Name: TABLE "flow_state"; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE "auth"."flow_state" IS 'Stores metadata for all OAuth/SSO login flows';


--
-- Name: identities; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE "auth"."identities" (
    "provider_id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "identity_data" "jsonb" NOT NULL,
    "provider" "text" NOT NULL,
    "last_sign_in_at" timestamp with time zone,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "email" "text" GENERATED ALWAYS AS ("lower"(("identity_data" ->> 'email'::"text"))) STORED,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);


ALTER TABLE "auth"."identities" OWNER TO "supabase_auth_admin";

--
-- Name: TABLE "identities"; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE "auth"."identities" IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN "identities"."email"; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN "auth"."identities"."email" IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE "auth"."instances" (
    "id" "uuid" NOT NULL,
    "uuid" "uuid",
    "raw_base_config" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "auth"."instances" OWNER TO "supabase_auth_admin";

--
-- Name: TABLE "instances"; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE "auth"."instances" IS 'Auth: Manages users across multiple sites.';


--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE "auth"."mfa_amr_claims" (
    "session_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "authentication_method" "text" NOT NULL,
    "id" "uuid" NOT NULL
);


ALTER TABLE "auth"."mfa_amr_claims" OWNER TO "supabase_auth_admin";

--
-- Name: TABLE "mfa_amr_claims"; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE "auth"."mfa_amr_claims" IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE "auth"."mfa_challenges" (
    "id" "uuid" NOT NULL,
    "factor_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "verified_at" timestamp with time zone,
    "ip_address" "inet" NOT NULL,
    "otp_code" "text",
    "web_authn_session_data" "jsonb"
);


ALTER TABLE "auth"."mfa_challenges" OWNER TO "supabase_auth_admin";

--
-- Name: TABLE "mfa_challenges"; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE "auth"."mfa_challenges" IS 'auth: stores metadata about challenge requests made';


--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE "auth"."mfa_factors" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "friendly_name" "text",
    "factor_type" "auth"."factor_type" NOT NULL,
    "status" "auth"."factor_status" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "secret" "text",
    "phone" "text",
    "last_challenged_at" timestamp with time zone,
    "web_authn_credential" "jsonb",
    "web_authn_aaguid" "uuid",
    "last_webauthn_challenge_data" "jsonb"
);


ALTER TABLE "auth"."mfa_factors" OWNER TO "supabase_auth_admin";

--
-- Name: TABLE "mfa_factors"; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE "auth"."mfa_factors" IS 'auth: stores metadata about factors';


--
-- Name: COLUMN "mfa_factors"."last_webauthn_challenge_data"; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN "auth"."mfa_factors"."last_webauthn_challenge_data" IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';


--
-- Name: oauth_authorizations; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE "auth"."oauth_authorizations" (
    "id" "uuid" NOT NULL,
    "authorization_id" "text" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "redirect_uri" "text" NOT NULL,
    "scope" "text" NOT NULL,
    "state" "text",
    "resource" "text",
    "code_challenge" "text",
    "code_challenge_method" "auth"."code_challenge_method",
    "response_type" "auth"."oauth_response_type" DEFAULT 'code'::"auth"."oauth_response_type" NOT NULL,
    "status" "auth"."oauth_authorization_status" DEFAULT 'pending'::"auth"."oauth_authorization_status" NOT NULL,
    "authorization_code" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '00:03:00'::interval) NOT NULL,
    "approved_at" timestamp with time zone,
    "nonce" "text",
    CONSTRAINT "oauth_authorizations_authorization_code_length" CHECK (("char_length"("authorization_code") <= 255)),
    CONSTRAINT "oauth_authorizations_code_challenge_length" CHECK (("char_length"("code_challenge") <= 128)),
    CONSTRAINT "oauth_authorizations_expires_at_future" CHECK (("expires_at" > "created_at")),
    CONSTRAINT "oauth_authorizations_nonce_length" CHECK (("char_length"("nonce") <= 255)),
    CONSTRAINT "oauth_authorizations_redirect_uri_length" CHECK (("char_length"("redirect_uri") <= 2048)),
    CONSTRAINT "oauth_authorizations_resource_length" CHECK (("char_length"("resource") <= 2048)),
    CONSTRAINT "oauth_authorizations_scope_length" CHECK (("char_length"("scope") <= 4096)),
    CONSTRAINT "oauth_authorizations_state_length" CHECK (("char_length"("state") <= 4096))
);


ALTER TABLE "auth"."oauth_authorizations" OWNER TO "supabase_auth_admin";

--
-- Name: oauth_client_states; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE "auth"."oauth_client_states" (
    "id" "uuid" NOT NULL,
    "provider_type" "text" NOT NULL,
    "code_verifier" "text",
    "created_at" timestamp with time zone NOT NULL
);


ALTER TABLE "auth"."oauth_client_states" OWNER TO "supabase_auth_admin";

--
-- Name: TABLE "oauth_client_states"; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE "auth"."oauth_client_states" IS 'Stores OAuth states for third-party provider authentication flows where Supabase acts as the OAuth client.';


--
-- Name: oauth_clients; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE "auth"."oauth_clients" (
    "id" "uuid" NOT NULL,
    "client_secret_hash" "text",
    "registration_type" "auth"."oauth_registration_type" NOT NULL,
    "redirect_uris" "text" NOT NULL,
    "grant_types" "text" NOT NULL,
    "client_name" "text",
    "client_uri" "text",
    "logo_uri" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "client_type" "auth"."oauth_client_type" DEFAULT 'confidential'::"auth"."oauth_client_type" NOT NULL,
    "token_endpoint_auth_method" "text" NOT NULL,
    CONSTRAINT "oauth_clients_client_name_length" CHECK (("char_length"("client_name") <= 1024)),
    CONSTRAINT "oauth_clients_client_uri_length" CHECK (("char_length"("client_uri") <= 2048)),
    CONSTRAINT "oauth_clients_logo_uri_length" CHECK (("char_length"("logo_uri") <= 2048)),
    CONSTRAINT "oauth_clients_token_endpoint_auth_method_check" CHECK (("token_endpoint_auth_method" = ANY (ARRAY['client_secret_basic'::"text", 'client_secret_post'::"text", 'none'::"text"])))
);


ALTER TABLE "auth"."oauth_clients" OWNER TO "supabase_auth_admin";

--
-- Name: oauth_consents; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE "auth"."oauth_consents" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "scopes" "text" NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revoked_at" timestamp with time zone,
    CONSTRAINT "oauth_consents_revoked_after_granted" CHECK ((("revoked_at" IS NULL) OR ("revoked_at" >= "granted_at"))),
    CONSTRAINT "oauth_consents_scopes_length" CHECK (("char_length"("scopes") <= 2048)),
    CONSTRAINT "oauth_consents_scopes_not_empty" CHECK (("char_length"(TRIM(BOTH FROM "scopes")) > 0))
);


ALTER TABLE "auth"."oauth_consents" OWNER TO "supabase_auth_admin";

--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE "auth"."one_time_tokens" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token_type" "auth"."one_time_token_type" NOT NULL,
    "token_hash" "text" NOT NULL,
    "relates_to" "text" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "one_time_tokens_token_hash_check" CHECK (("char_length"("token_hash") > 0))
);


ALTER TABLE "auth"."one_time_tokens" OWNER TO "supabase_auth_admin";

--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE "auth"."refresh_tokens" (
    "instance_id" "uuid",
    "id" bigint NOT NULL,
    "token" character varying(255),
    "user_id" character varying(255),
    "revoked" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "parent" character varying(255),
    "session_id" "uuid"
);


ALTER TABLE "auth"."refresh_tokens" OWNER TO "supabase_auth_admin";

--
-- Name: TABLE "refresh_tokens"; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE "auth"."refresh_tokens" IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: supabase_auth_admin
--

CREATE SEQUENCE "auth"."refresh_tokens_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "auth"."refresh_tokens_id_seq" OWNER TO "supabase_auth_admin";

--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: supabase_auth_admin
--

ALTER SEQUENCE "auth"."refresh_tokens_id_seq" OWNED BY "auth"."refresh_tokens"."id";


--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE "auth"."saml_providers" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "entity_id" "text" NOT NULL,
    "metadata_xml" "text" NOT NULL,
    "metadata_url" "text",
    "attribute_mapping" "jsonb",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "name_id_format" "text",
    CONSTRAINT "entity_id not empty" CHECK (("char_length"("entity_id") > 0)),
    CONSTRAINT "metadata_url not empty" CHECK ((("metadata_url" = NULL::"text") OR ("char_length"("metadata_url") > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK (("char_length"("metadata_xml") > 0))
);


ALTER TABLE "auth"."saml_providers" OWNER TO "supabase_auth_admin";

--
-- Name: TABLE "saml_providers"; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE "auth"."saml_providers" IS 'Auth: Manages SAML Identity Provider connections.';


--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE "auth"."saml_relay_states" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "request_id" "text" NOT NULL,
    "for_email" "text",
    "redirect_to" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "flow_state_id" "uuid",
    CONSTRAINT "request_id not empty" CHECK (("char_length"("request_id") > 0))
);


ALTER TABLE "auth"."saml_relay_states" OWNER TO "supabase_auth_admin";

--
-- Name: TABLE "saml_relay_states"; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE "auth"."saml_relay_states" IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE "auth"."schema_migrations" (
    "version" character varying(255) NOT NULL
);


ALTER TABLE "auth"."schema_migrations" OWNER TO "supabase_auth_admin";

--
-- Name: TABLE "schema_migrations"; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE "auth"."schema_migrations" IS 'Auth: Manages updates to the auth system.';


--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE "auth"."sessions" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "factor_id" "uuid",
    "aal" "auth"."aal_level",
    "not_after" timestamp with time zone,
    "refreshed_at" timestamp without time zone,
    "user_agent" "text",
    "ip" "inet",
    "tag" "text",
    "oauth_client_id" "uuid",
    "refresh_token_hmac_key" "text",
    "refresh_token_counter" bigint,
    "scopes" "text",
    CONSTRAINT "sessions_scopes_length" CHECK (("char_length"("scopes") <= 4096))
);


ALTER TABLE "auth"."sessions" OWNER TO "supabase_auth_admin";

--
-- Name: TABLE "sessions"; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE "auth"."sessions" IS 'Auth: Stores session data associated to a user.';


--
-- Name: COLUMN "sessions"."not_after"; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN "auth"."sessions"."not_after" IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- Name: COLUMN "sessions"."refresh_token_hmac_key"; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN "auth"."sessions"."refresh_token_hmac_key" IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';


--
-- Name: COLUMN "sessions"."refresh_token_counter"; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN "auth"."sessions"."refresh_token_counter" IS 'Holds the ID (counter) of the last issued refresh token.';


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE "auth"."sso_domains" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "domain" "text" NOT NULL,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK (("char_length"("domain") > 0))
);


ALTER TABLE "auth"."sso_domains" OWNER TO "supabase_auth_admin";

--
-- Name: TABLE "sso_domains"; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE "auth"."sso_domains" IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE "auth"."sso_providers" (
    "id" "uuid" NOT NULL,
    "resource_id" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "disabled" boolean,
    CONSTRAINT "resource_id not empty" CHECK ((("resource_id" = NULL::"text") OR ("char_length"("resource_id") > 0)))
);


ALTER TABLE "auth"."sso_providers" OWNER TO "supabase_auth_admin";

--
-- Name: TABLE "sso_providers"; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE "auth"."sso_providers" IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- Name: COLUMN "sso_providers"."resource_id"; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN "auth"."sso_providers"."resource_id" IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE "auth"."users" (
    "instance_id" "uuid",
    "id" "uuid" NOT NULL,
    "aud" character varying(255),
    "role" character varying(255),
    "email" character varying(255),
    "encrypted_password" character varying(255),
    "email_confirmed_at" timestamp with time zone,
    "invited_at" timestamp with time zone,
    "confirmation_token" character varying(255),
    "confirmation_sent_at" timestamp with time zone,
    "recovery_token" character varying(255),
    "recovery_sent_at" timestamp with time zone,
    "email_change_token_new" character varying(255),
    "email_change" character varying(255),
    "email_change_sent_at" timestamp with time zone,
    "last_sign_in_at" timestamp with time zone,
    "raw_app_meta_data" "jsonb",
    "raw_user_meta_data" "jsonb",
    "is_super_admin" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "phone" "text" DEFAULT NULL::character varying,
    "phone_confirmed_at" timestamp with time zone,
    "phone_change" "text" DEFAULT ''::character varying,
    "phone_change_token" character varying(255) DEFAULT ''::character varying,
    "phone_change_sent_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone GENERATED ALWAYS AS (LEAST("email_confirmed_at", "phone_confirmed_at")) STORED,
    "email_change_token_current" character varying(255) DEFAULT ''::character varying,
    "email_change_confirm_status" smallint DEFAULT 0,
    "banned_until" timestamp with time zone,
    "reauthentication_token" character varying(255) DEFAULT ''::character varying,
    "reauthentication_sent_at" timestamp with time zone,
    "is_sso_user" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    "is_anonymous" boolean DEFAULT false NOT NULL,
    CONSTRAINT "users_email_change_confirm_status_check" CHECK ((("email_change_confirm_status" >= 0) AND ("email_change_confirm_status" <= 2)))
);


ALTER TABLE "auth"."users" OWNER TO "supabase_auth_admin";

--
-- Name: TABLE "users"; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE "auth"."users" IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN "users"."is_sso_user"; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN "auth"."users"."is_sso_user" IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- Name: webauthn_challenges; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE "auth"."webauthn_challenges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "challenge_type" "text" NOT NULL,
    "session_data" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    CONSTRAINT "webauthn_challenges_challenge_type_check" CHECK (("challenge_type" = ANY (ARRAY['signup'::"text", 'registration'::"text", 'authentication'::"text"])))
);


ALTER TABLE "auth"."webauthn_challenges" OWNER TO "supabase_auth_admin";

--
-- Name: webauthn_credentials; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE "auth"."webauthn_credentials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "credential_id" "bytea" NOT NULL,
    "public_key" "bytea" NOT NULL,
    "attestation_type" "text" DEFAULT ''::"text" NOT NULL,
    "aaguid" "uuid",
    "sign_count" bigint DEFAULT 0 NOT NULL,
    "transports" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "backup_eligible" boolean DEFAULT false NOT NULL,
    "backed_up" boolean DEFAULT false NOT NULL,
    "friendly_name" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_used_at" timestamp with time zone
);


ALTER TABLE "auth"."webauthn_credentials" OWNER TO "supabase_auth_admin";

--
-- Name: analytics_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."analytics_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "session_id" "text",
    "event" "text" NOT NULL,
    "properties" "jsonb" DEFAULT '{}'::"jsonb",
    "timestamp" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."analytics_events" OWNER TO "postgres";

--
-- Name: TABLE "analytics_events"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."analytics_events" IS 'Privacy-respecting analytics events flushed from the mobile client';


--
-- Name: calendar_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."calendar_events" (
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

--
-- Name: couple_data; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."couple_data" (
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

--
-- Name: couple_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."couple_members" (
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

--
-- Name: COLUMN "couple_members"."public_key"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."couple_members"."public_key" IS 'X25519 public key (base64) for Diffie-Hellman key exchange during pairing';


--
-- Name: COLUMN "couple_members"."wrapped_couple_key"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."couple_members"."wrapped_couple_key" IS 'Couple symmetric key encrypted (wrapped) with this device public key via nacl.box';


--
-- Name: couples; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."couples" (
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

--
-- Name: moments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."moments" (
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

--
-- Name: notification_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."notification_log" (
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

--
-- Name: partner_link_codes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."partner_link_codes" (
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

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."profiles" (
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

--
-- Name: push_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."push_tokens" (
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

--
-- Name: rate_limit_buckets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."rate_limit_buckets" (
    "user_id" "uuid" NOT NULL,
    "tokens" integer DEFAULT 60 NOT NULL,
    "max_tokens" integer DEFAULT 60 NOT NULL,
    "last_refill" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rate_limit_buckets" OWNER TO "postgres";

--
-- Name: usage_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."usage_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "couple_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "local_day_key" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."usage_events" OWNER TO "postgres";

--
-- Name: user_entitlements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."user_entitlements" (
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

--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."refresh_tokens" ALTER COLUMN "id" SET DEFAULT "nextval"('"auth"."refresh_tokens_id_seq"'::"regclass");


--
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."mfa_amr_claims"
    ADD CONSTRAINT "amr_id_pk" PRIMARY KEY ("id");


--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."audit_log_entries"
    ADD CONSTRAINT "audit_log_entries_pkey" PRIMARY KEY ("id");


--
-- Name: custom_oauth_providers custom_oauth_providers_identifier_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."custom_oauth_providers"
    ADD CONSTRAINT "custom_oauth_providers_identifier_key" UNIQUE ("identifier");


--
-- Name: custom_oauth_providers custom_oauth_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."custom_oauth_providers"
    ADD CONSTRAINT "custom_oauth_providers_pkey" PRIMARY KEY ("id");


--
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."flow_state"
    ADD CONSTRAINT "flow_state_pkey" PRIMARY KEY ("id");


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."identities"
    ADD CONSTRAINT "identities_pkey" PRIMARY KEY ("id");


--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."identities"
    ADD CONSTRAINT "identities_provider_id_provider_unique" UNIQUE ("provider_id", "provider");


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."instances"
    ADD CONSTRAINT "instances_pkey" PRIMARY KEY ("id");


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."mfa_amr_claims"
    ADD CONSTRAINT "mfa_amr_claims_session_id_authentication_method_pkey" UNIQUE ("session_id", "authentication_method");


--
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."mfa_challenges"
    ADD CONSTRAINT "mfa_challenges_pkey" PRIMARY KEY ("id");


--
-- Name: mfa_factors mfa_factors_last_challenged_at_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."mfa_factors"
    ADD CONSTRAINT "mfa_factors_last_challenged_at_key" UNIQUE ("last_challenged_at");


--
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."mfa_factors"
    ADD CONSTRAINT "mfa_factors_pkey" PRIMARY KEY ("id");


--
-- Name: oauth_authorizations oauth_authorizations_authorization_code_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_authorization_code_key" UNIQUE ("authorization_code");


--
-- Name: oauth_authorizations oauth_authorizations_authorization_id_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_authorization_id_key" UNIQUE ("authorization_id");


--
-- Name: oauth_authorizations oauth_authorizations_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_pkey" PRIMARY KEY ("id");


--
-- Name: oauth_client_states oauth_client_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."oauth_client_states"
    ADD CONSTRAINT "oauth_client_states_pkey" PRIMARY KEY ("id");


--
-- Name: oauth_clients oauth_clients_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."oauth_clients"
    ADD CONSTRAINT "oauth_clients_pkey" PRIMARY KEY ("id");


--
-- Name: oauth_consents oauth_consents_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_pkey" PRIMARY KEY ("id");


--
-- Name: oauth_consents oauth_consents_user_client_unique; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_user_client_unique" UNIQUE ("user_id", "client_id");


--
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."one_time_tokens"
    ADD CONSTRAINT "one_time_tokens_pkey" PRIMARY KEY ("id");


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id");


--
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_token_unique" UNIQUE ("token");


--
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."saml_providers"
    ADD CONSTRAINT "saml_providers_entity_id_key" UNIQUE ("entity_id");


--
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."saml_providers"
    ADD CONSTRAINT "saml_providers_pkey" PRIMARY KEY ("id");


--
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."saml_relay_states"
    ADD CONSTRAINT "saml_relay_states_pkey" PRIMARY KEY ("id");


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."schema_migrations"
    ADD CONSTRAINT "schema_migrations_pkey" PRIMARY KEY ("version");


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");


--
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."sso_domains"
    ADD CONSTRAINT "sso_domains_pkey" PRIMARY KEY ("id");


--
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."sso_providers"
    ADD CONSTRAINT "sso_providers_pkey" PRIMARY KEY ("id");


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."users"
    ADD CONSTRAINT "users_phone_key" UNIQUE ("phone");


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");


--
-- Name: webauthn_challenges webauthn_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."webauthn_challenges"
    ADD CONSTRAINT "webauthn_challenges_pkey" PRIMARY KEY ("id");


--
-- Name: webauthn_credentials webauthn_credentials_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."webauthn_credentials"
    ADD CONSTRAINT "webauthn_credentials_pkey" PRIMARY KEY ("id");


--
-- Name: analytics_events analytics_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."analytics_events"
    ADD CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id");


--
-- Name: calendar_events calendar_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id");


--
-- Name: couple_data couple_data_couple_id_key_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."couple_data"
    ADD CONSTRAINT "couple_data_couple_id_key_unique" UNIQUE ("couple_id", "key");


--
-- Name: couple_data couple_data_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."couple_data"
    ADD CONSTRAINT "couple_data_pkey" PRIMARY KEY ("id");


--
-- Name: couple_members couple_members_couple_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."couple_members"
    ADD CONSTRAINT "couple_members_couple_id_user_id_key" UNIQUE ("couple_id", "user_id");


--
-- Name: couple_members couple_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."couple_members"
    ADD CONSTRAINT "couple_members_pkey" PRIMARY KEY ("id");


--
-- Name: couple_members couple_members_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."couple_members"
    ADD CONSTRAINT "couple_members_user_id_unique" UNIQUE ("user_id");


--
-- Name: couples couples_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."couples"
    ADD CONSTRAINT "couples_pkey" PRIMARY KEY ("id");


--
-- Name: moments moments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."moments"
    ADD CONSTRAINT "moments_pkey" PRIMARY KEY ("id");


--
-- Name: notification_log notification_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."notification_log"
    ADD CONSTRAINT "notification_log_pkey" PRIMARY KEY ("id");


--
-- Name: partner_link_codes partner_link_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."partner_link_codes"
    ADD CONSTRAINT "partner_link_codes_pkey" PRIMARY KEY ("id");


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");


--
-- Name: push_tokens push_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id");


--
-- Name: push_tokens push_tokens_user_id_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_user_id_token_key" UNIQUE ("user_id", "token");


--
-- Name: rate_limit_buckets rate_limit_buckets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."rate_limit_buckets"
    ADD CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("user_id");


--
-- Name: usage_events usage_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."usage_events"
    ADD CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id");


--
-- Name: user_entitlements user_entitlements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_entitlements"
    ADD CONSTRAINT "user_entitlements_pkey" PRIMARY KEY ("id");


--
-- Name: user_entitlements user_entitlements_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_entitlements"
    ADD CONSTRAINT "user_entitlements_user_id_key" UNIQUE ("user_id");


--
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX "audit_logs_instance_id_idx" ON "auth"."audit_log_entries" USING "btree" ("instance_id");


--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX "confirmation_token_idx" ON "auth"."users" USING "btree" ("confirmation_token") WHERE (("confirmation_token")::"text" !~ '^[0-9 ]*$'::"text");


--
-- Name: custom_oauth_providers_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX "custom_oauth_providers_created_at_idx" ON "auth"."custom_oauth_providers" USING "btree" ("created_at");


--
-- Name: custom_oauth_providers_enabled_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX "custom_oauth_providers_enabled_idx" ON "auth"."custom_oauth_providers" USING "btree" ("enabled");


--
-- Name: custom_oauth_providers_identifier_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX "custom_oauth_providers_identifier_idx" ON "auth"."custom_oauth_providers" USING "btree" ("identifier");


--
-- Name: custom_oauth_providers_provider_type_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX "custom_oauth_providers_provider_type_idx" ON "auth"."custom_oauth_providers" USING "btree" ("provider_type");


--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX "email_change_token_current_idx" ON "auth"."users" USING "btree" ("email_change_token_current") WHERE (("email_change_token_current")::"text" !~ '^[0-9 ]*$'::"text");


--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX "email_change_token_new_idx" ON "auth"."users" USING "btree" ("email_change_token_new") WHERE (("email_change_token_new")::"text" !~ '^[0-9 ]*$'::"text");


--
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX "factor_id_created_at_idx" ON "auth"."mfa_factors" USING "btree" ("user_id", "created_at");


--
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX "flow_state_created_at_idx" ON "auth"."flow_state" USING "btree" ("created_at" DESC);


--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX "identities_email_idx" ON "auth"."identities" USING "btree" ("email" "text_pattern_ops");


--
-- Name: INDEX "identities_email_idx"; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON INDEX "auth"."identities_email_idx" IS 'Auth: Ensures indexed queries on the email column';


--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX "identities_user_id_idx" ON "auth"."identities" USING "btree" ("user_id");


--
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX "idx_auth_code" ON "auth"."flow_state" USING "btree" ("auth_code");


--
-- Name: idx_oauth_client_states_created_at; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX "idx_oauth_client_states_created_at" ON "auth"."oauth_client_states" USING "btree" ("created_at");


--
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX "idx_user_id_auth_method" ON "auth"."flow_state" USING "btree" ("user_id", "authentication_method");


--
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX "mfa_challenge_created_at_idx" ON "auth"."mfa_challenges" USING "btree" ("created_at" DESC);


--
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX "mfa_factors_user_friendly_name_unique" ON "auth"."mfa_factors" USING "btree" ("friendly_name", "user_id") WHERE (TRIM(BOTH FROM "friendly_name") <> ''::"text");


--
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX "mfa_factors_user_id_idx" ON "auth"."mfa_factors" USING "btree" ("user_id");


--
-- Name: oauth_auth_pending_exp_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX "oauth_auth_pending_exp_idx" ON "auth"."oauth_authorizations" USING "btree" ("expires_at") WHERE ("status" = 'pending'::"auth"."oauth_authorization_status");


--
-- Name: oauth_clients_deleted_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX "oauth_clients_deleted_at_idx" ON "auth"."oauth_clients" USING "btree" ("deleted_at");


--
-- Name: oauth_consents_active_client_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX "oauth_consents_active_client_idx" ON "auth"."oauth_consents" USING "btree" ("client_id") WHERE ("revoked_at" IS NULL);


--
-- Name: oauth_consents_active_user_client_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX "oauth_consents_active_user_client_idx" ON "auth"."oauth_consents" USING "btree" ("user_id", "client_id") WHERE ("revoked_at" IS NULL);


--
-- Name: oauth_consents_user_order_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX "oauth_consents_user_order_idx" ON "auth"."oauth_consents" USING "btree" ("user_id", "granted_at" DESC);


--
-- Name: one_time_tokens_relates_to_hash_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX "one_time_tokens_relates_to_hash_idx" ON "auth"."one_time_tokens" USING "hash" ("relates_to");


--
-- Name: one_time_tokens_token_hash_hash_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX "one_time_tokens_token_hash_hash_idx" ON "auth"."one_time_tokens" USING "hash" ("token_hash");


--
-- Name: one_time_tokens_user_id_token_type_key; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX "one_time_tokens_user_id_token_type_key" ON "auth"."one_time_tokens" USING "btree" ("user_id", "token_type");


--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX "reauthentication_token_idx" ON "auth"."users" USING "btree" ("reauthentication_token") WHERE (("reauthentication_token")::"text" !~ '^[0-9 ]*$'::"text");


--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX "recovery_token_idx" ON "auth"."users" USING "btree" ("recovery_token") WHERE (("recovery_token")::"text" !~ '^[0-9 ]*$'::"text");


--
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX "refresh_tokens_instance_id_idx" ON "auth"."refresh_tokens" USING "btree" ("instance_id");


--
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX "refresh_tokens_instance_id_user_id_idx" ON "auth"."refresh_tokens" USING "btree" ("instance_id", "user_id");


--
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX "refresh_tokens_parent_idx" ON "auth"."refresh_tokens" USING "btree" ("parent");


--
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX "refresh_tokens_session_id_revoked_idx" ON "auth"."refresh_tokens" USING "btree" ("session_id", "revoked");


--
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX "refresh_tokens_updated_at_idx" ON "auth"."refresh_tokens" USING "btree" ("updated_at" DESC);


--
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX "saml_providers_sso_provider_id_idx" ON "auth"."saml_providers" USING "btree" ("sso_provider_id");


--
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX "saml_relay_states_created_at_idx" ON "auth"."saml_relay_states" USING "btree" ("created_at" DESC);


--
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX "saml_relay_states_for_email_idx" ON "auth"."saml_relay_states" USING "btree" ("for_email");


--
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX "saml_relay_states_sso_provider_id_idx" ON "auth"."saml_relay_states" USING "btree" ("sso_provider_id");


--
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX "sessions_not_after_idx" ON "auth"."sessions" USING "btree" ("not_after" DESC);


--
-- Name: sessions_oauth_client_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX "sessions_oauth_client_id_idx" ON "auth"."sessions" USING "btree" ("oauth_client_id");


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX "sessions_user_id_idx" ON "auth"."sessions" USING "btree" ("user_id");


--
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX "sso_domains_domain_idx" ON "auth"."sso_domains" USING "btree" ("lower"("domain"));


--
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX "sso_domains_sso_provider_id_idx" ON "auth"."sso_domains" USING "btree" ("sso_provider_id");


--
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX "sso_providers_resource_id_idx" ON "auth"."sso_providers" USING "btree" ("lower"("resource_id"));


--
-- Name: sso_providers_resource_id_pattern_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX "sso_providers_resource_id_pattern_idx" ON "auth"."sso_providers" USING "btree" ("resource_id" "text_pattern_ops");


--
-- Name: unique_phone_factor_per_user; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX "unique_phone_factor_per_user" ON "auth"."mfa_factors" USING "btree" ("user_id", "phone");


--
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX "user_id_created_at_idx" ON "auth"."sessions" USING "btree" ("user_id", "created_at");


--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX "users_email_partial_key" ON "auth"."users" USING "btree" ("email") WHERE ("is_sso_user" = false);


--
-- Name: INDEX "users_email_partial_key"; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON INDEX "auth"."users_email_partial_key" IS 'Auth: A partial unique index that applies only when is_sso_user is false';


--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX "users_instance_id_email_idx" ON "auth"."users" USING "btree" ("instance_id", "lower"(("email")::"text"));


--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX "users_instance_id_idx" ON "auth"."users" USING "btree" ("instance_id");


--
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX "users_is_anonymous_idx" ON "auth"."users" USING "btree" ("is_anonymous");


--
-- Name: webauthn_challenges_expires_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX "webauthn_challenges_expires_at_idx" ON "auth"."webauthn_challenges" USING "btree" ("expires_at");


--
-- Name: webauthn_challenges_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX "webauthn_challenges_user_id_idx" ON "auth"."webauthn_challenges" USING "btree" ("user_id");


--
-- Name: webauthn_credentials_credential_id_key; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX "webauthn_credentials_credential_id_key" ON "auth"."webauthn_credentials" USING "btree" ("credential_id");


--
-- Name: webauthn_credentials_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX "webauthn_credentials_user_id_idx" ON "auth"."webauthn_credentials" USING "btree" ("user_id");


--
-- Name: idx_analytics_events_event; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_analytics_events_event" ON "public"."analytics_events" USING "btree" ("event");


--
-- Name: idx_analytics_events_timestamp; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_analytics_events_timestamp" ON "public"."analytics_events" USING "btree" ("timestamp" DESC);


--
-- Name: idx_analytics_events_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_analytics_events_user_id" ON "public"."analytics_events" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);


--
-- Name: idx_calendar_events_couple; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_calendar_events_couple" ON "public"."calendar_events" USING "btree" ("couple_id");


--
-- Name: idx_calendar_events_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_calendar_events_created_by" ON "public"."calendar_events" USING "btree" ("created_by");


--
-- Name: idx_calendar_events_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_calendar_events_date" ON "public"."calendar_events" USING "btree" ("event_date");


--
-- Name: idx_calendar_events_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_calendar_events_type" ON "public"."calendar_events" USING "btree" ("event_type");


--
-- Name: idx_couple_data_couple_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_couple_data_couple_id" ON "public"."couple_data" USING "btree" ("couple_id");


--
-- Name: idx_couple_data_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_couple_data_created_at" ON "public"."couple_data" USING "btree" ("created_at" DESC);


--
-- Name: idx_couple_data_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_couple_data_created_by" ON "public"."couple_data" USING "btree" ("created_by");


--
-- Name: idx_couple_data_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_couple_data_key" ON "public"."couple_data" USING "btree" ("key");


--
-- Name: idx_couple_data_not_deleted; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_couple_data_not_deleted" ON "public"."couple_data" USING "btree" ("couple_id", "data_type", "updated_at") WHERE ("is_deleted" = false);


--
-- Name: idx_couple_data_private; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_couple_data_private" ON "public"."couple_data" USING "btree" ("is_private");


--
-- Name: idx_couple_data_sync; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_couple_data_sync" ON "public"."couple_data" USING "btree" ("couple_id", "data_type", "updated_at");


--
-- Name: idx_couple_data_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_couple_data_type" ON "public"."couple_data" USING "btree" ("data_type");


--
-- Name: idx_couple_data_type_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_couple_data_type_user" ON "public"."couple_data" USING "btree" ("couple_id", "data_type", "created_by");


--
-- Name: idx_couple_data_updated; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_couple_data_updated" ON "public"."couple_data" USING "btree" ("updated_at");


--
-- Name: idx_couple_members_couple; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_couple_members_couple" ON "public"."couple_members" USING "btree" ("couple_id");


--
-- Name: idx_couple_members_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_couple_members_user" ON "public"."couple_members" USING "btree" ("user_id");


--
-- Name: idx_couples_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_couples_active" ON "public"."couples" USING "btree" ("is_active");


--
-- Name: idx_couples_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_couples_created_by" ON "public"."couples" USING "btree" ("created_by");


--
-- Name: idx_couples_premium; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_couples_premium" ON "public"."couples" USING "btree" ("is_premium") WHERE ("is_premium" = true);


--
-- Name: idx_entitlements_premium; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_entitlements_premium" ON "public"."user_entitlements" USING "btree" ("is_premium");


--
-- Name: idx_entitlements_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_entitlements_user" ON "public"."user_entitlements" USING "btree" ("user_id");


--
-- Name: idx_link_codes_couple; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_link_codes_couple" ON "public"."partner_link_codes" USING "btree" ("couple_id");


--
-- Name: idx_link_codes_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_link_codes_created_by" ON "public"."partner_link_codes" USING "btree" ("created_by");


--
-- Name: idx_link_codes_expires; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_link_codes_expires" ON "public"."partner_link_codes" USING "btree" ("expires_at");


--
-- Name: idx_link_codes_hash; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_link_codes_hash" ON "public"."partner_link_codes" USING "btree" ("code_hash");


--
-- Name: idx_link_codes_unused; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_link_codes_unused" ON "public"."partner_link_codes" USING "btree" ("expires_at") WHERE ("used_at" IS NULL);


--
-- Name: idx_moments_couple; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_moments_couple" ON "public"."moments" USING "btree" ("couple_id");


--
-- Name: idx_moments_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_moments_created_at" ON "public"."moments" USING "btree" ("created_at" DESC);


--
-- Name: idx_moments_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_moments_created_by" ON "public"."moments" USING "btree" ("created_by");


--
-- Name: idx_moments_private; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_moments_private" ON "public"."moments" USING "btree" ("is_private");


--
-- Name: idx_moments_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_moments_type" ON "public"."moments" USING "btree" ("moment_type");


--
-- Name: idx_notification_log_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_notification_log_created" ON "public"."notification_log" USING "btree" ("created_at" DESC);


--
-- Name: idx_notification_log_recipient; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_notification_log_recipient" ON "public"."notification_log" USING "btree" ("recipient");


--
-- Name: idx_notification_log_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_notification_log_status" ON "public"."notification_log" USING "btree" ("status") WHERE ("status" = 'failed'::"text");


--
-- Name: idx_profiles_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_profiles_email" ON "public"."profiles" USING "btree" ("email");


--
-- Name: idx_profiles_premium; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_profiles_premium" ON "public"."profiles" USING "btree" ("is_premium");


--
-- Name: idx_push_tokens_last_used; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_push_tokens_last_used" ON "public"."push_tokens" USING "btree" ("last_used_at") WHERE ("last_used_at" IS NOT NULL);


--
-- Name: idx_push_tokens_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_push_tokens_token" ON "public"."push_tokens" USING "btree" ("token");


--
-- Name: idx_push_tokens_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_push_tokens_user" ON "public"."push_tokens" USING "btree" ("user_id");


--
-- Name: idx_usage_events_couple_day; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_usage_events_couple_day" ON "public"."usage_events" USING "btree" ("couple_id", "local_day_key");


--
-- Name: idx_usage_events_daily; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_usage_events_daily" ON "public"."usage_events" USING "btree" ("couple_id", "user_id", "event_type", "local_day_key");


--
-- Name: idx_usage_events_user_day; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_usage_events_user_day" ON "public"."usage_events" USING "btree" ("user_id", "local_day_key");


--
-- Name: users on_auth_user_created; Type: TRIGGER; Schema: auth; Owner: supabase_auth_admin
--

CREATE TRIGGER "on_auth_user_created" AFTER INSERT ON "auth"."users" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user"();


--
-- Name: couple_data couple_data_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "couple_data_updated_at" BEFORE UPDATE ON "public"."couple_data" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();


--
-- Name: calendar_events trigger_notify_calendar_event; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "trigger_notify_calendar_event" AFTER INSERT ON "public"."calendar_events" FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_calendar_event_insert"();


--
-- Name: couple_members trigger_notify_couple_created; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "trigger_notify_couple_created" AFTER INSERT ON "public"."couple_members" FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_couple_created"();


--
-- Name: couple_data trigger_notify_couple_data; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "trigger_notify_couple_data" AFTER INSERT ON "public"."couple_data" FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_couple_data_insert"();


--
-- Name: moments trigger_notify_moment; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "trigger_notify_moment" AFTER INSERT ON "public"."moments" FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_moment_insert"();


--
-- Name: couples trigger_sync_couple_premium; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "trigger_sync_couple_premium" AFTER UPDATE OF "is_premium" ON "public"."couples" FOR EACH ROW WHEN (("old"."is_premium" IS DISTINCT FROM "new"."is_premium")) EXECUTE FUNCTION "public"."sync_couple_premium_to_profiles"();


--
-- Name: calendar_events update_calendar_events_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "update_calendar_events_updated_at" BEFORE UPDATE ON "public"."calendar_events" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


--
-- Name: couples update_couples_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "update_couples_updated_at" BEFORE UPDATE ON "public"."couples" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


--
-- Name: user_entitlements update_entitlements_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "update_entitlements_updated_at" BEFORE UPDATE ON "public"."user_entitlements" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


--
-- Name: moments update_moments_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "update_moments_updated_at" BEFORE UPDATE ON "public"."moments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."identities"
    ADD CONSTRAINT "identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."mfa_amr_claims"
    ADD CONSTRAINT "mfa_amr_claims_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth"."sessions"("id") ON DELETE CASCADE;


--
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."mfa_challenges"
    ADD CONSTRAINT "mfa_challenges_auth_factor_id_fkey" FOREIGN KEY ("factor_id") REFERENCES "auth"."mfa_factors"("id") ON DELETE CASCADE;


--
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."mfa_factors"
    ADD CONSTRAINT "mfa_factors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."oauth_clients"("id") ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."oauth_clients"("id") ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."one_time_tokens"
    ADD CONSTRAINT "one_time_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth"."sessions"("id") ON DELETE CASCADE;


--
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."saml_providers"
    ADD CONSTRAINT "saml_providers_sso_provider_id_fkey" FOREIGN KEY ("sso_provider_id") REFERENCES "auth"."sso_providers"("id") ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."saml_relay_states"
    ADD CONSTRAINT "saml_relay_states_flow_state_id_fkey" FOREIGN KEY ("flow_state_id") REFERENCES "auth"."flow_state"("id") ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."saml_relay_states"
    ADD CONSTRAINT "saml_relay_states_sso_provider_id_fkey" FOREIGN KEY ("sso_provider_id") REFERENCES "auth"."sso_providers"("id") ON DELETE CASCADE;


--
-- Name: sessions sessions_oauth_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."sessions"
    ADD CONSTRAINT "sessions_oauth_client_id_fkey" FOREIGN KEY ("oauth_client_id") REFERENCES "auth"."oauth_clients"("id") ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."sessions"
    ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."sso_domains"
    ADD CONSTRAINT "sso_domains_sso_provider_id_fkey" FOREIGN KEY ("sso_provider_id") REFERENCES "auth"."sso_providers"("id") ON DELETE CASCADE;


--
-- Name: webauthn_challenges webauthn_challenges_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."webauthn_challenges"
    ADD CONSTRAINT "webauthn_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: webauthn_credentials webauthn_credentials_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY "auth"."webauthn_credentials"
    ADD CONSTRAINT "webauthn_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: analytics_events analytics_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."analytics_events"
    ADD CONSTRAINT "analytics_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: calendar_events calendar_events_couple_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_couple_id_fkey" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE CASCADE;


--
-- Name: calendar_events calendar_events_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");


--
-- Name: couple_data couple_data_couple_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."couple_data"
    ADD CONSTRAINT "couple_data_couple_id_fkey" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE CASCADE;


--
-- Name: couple_data couple_data_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."couple_data"
    ADD CONSTRAINT "couple_data_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");


--
-- Name: couple_members couple_members_couple_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."couple_members"
    ADD CONSTRAINT "couple_members_couple_id_fkey" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE CASCADE;


--
-- Name: couple_members couple_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."couple_members"
    ADD CONSTRAINT "couple_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");


--
-- Name: couples couples_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."couples"
    ADD CONSTRAINT "couples_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");


--
-- Name: moments moments_couple_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."moments"
    ADD CONSTRAINT "moments_couple_id_fkey" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE CASCADE;


--
-- Name: moments moments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."moments"
    ADD CONSTRAINT "moments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");


--
-- Name: notification_log notification_log_recipient_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."notification_log"
    ADD CONSTRAINT "notification_log_recipient_fkey" FOREIGN KEY ("recipient") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: partner_link_codes partner_link_codes_couple_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."partner_link_codes"
    ADD CONSTRAINT "partner_link_codes_couple_id_fkey" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id");


--
-- Name: partner_link_codes partner_link_codes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."partner_link_codes"
    ADD CONSTRAINT "partner_link_codes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");


--
-- Name: partner_link_codes partner_link_codes_used_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."partner_link_codes"
    ADD CONSTRAINT "partner_link_codes_used_by_fkey" FOREIGN KEY ("used_by") REFERENCES "auth"."users"("id");


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: push_tokens push_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: rate_limit_buckets rate_limit_buckets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."rate_limit_buckets"
    ADD CONSTRAINT "rate_limit_buckets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: usage_events usage_events_couple_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."usage_events"
    ADD CONSTRAINT "usage_events_couple_id_fkey" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE CASCADE;


--
-- Name: usage_events usage_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."usage_events"
    ADD CONSTRAINT "usage_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");


--
-- Name: user_entitlements user_entitlements_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_entitlements"
    ADD CONSTRAINT "user_entitlements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: audit_log_entries; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE "auth"."audit_log_entries" ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE "auth"."flow_state" ENABLE ROW LEVEL SECURITY;

--
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE "auth"."identities" ENABLE ROW LEVEL SECURITY;

--
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE "auth"."instances" ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_amr_claims; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE "auth"."mfa_amr_claims" ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE "auth"."mfa_challenges" ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_factors; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE "auth"."mfa_factors" ENABLE ROW LEVEL SECURITY;

--
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE "auth"."one_time_tokens" ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE "auth"."refresh_tokens" ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE "auth"."saml_providers" ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_relay_states; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE "auth"."saml_relay_states" ENABLE ROW LEVEL SECURITY;

--
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE "auth"."schema_migrations" ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE "auth"."sessions" ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE "auth"."sso_domains" ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_providers; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE "auth"."sso_providers" ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE "auth"."users" ENABLE ROW LEVEL SECURITY;

--
-- Name: partner_link_codes Authenticated users can create link codes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can create link codes" ON "public"."partner_link_codes" FOR INSERT WITH CHECK ((("created_by" = "auth"."uid"()) AND (("couple_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."couple_members" "cm"
  WHERE (("cm"."couple_id" = "partner_link_codes"."couple_id") AND ("cm"."user_id" = "auth"."uid"()))))) AND (("couple_id" IS NOT NULL) OR (NOT (EXISTS ( SELECT 1
   FROM "public"."couple_members"
  WHERE ("couple_members"."user_id" = "auth"."uid"())))))));


--
-- Name: couple_data Couple data delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Couple data delete" ON "public"."couple_data" FOR DELETE TO "authenticated" USING ((("created_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."couple_members" "cm"
  WHERE (("cm"."couple_id" = "couple_data"."couple_id") AND ("cm"."user_id" = "auth"."uid"()))))));


--
-- Name: couple_data Couple data insert (premium-aware); Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Couple data insert (premium-aware)" ON "public"."couple_data" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."couple_members" "cm"
  WHERE (("cm"."couple_id" = "couple_data"."couple_id") AND ("cm"."user_id" = "auth"."uid"())))) AND ("created_by" = "auth"."uid"()) AND ("public"."is_user_premium"() OR ("data_type" = ANY (ARRAY['journal'::"text", 'prompt_answer'::"text", 'check_in'::"text", 'vibe'::"text", 'couple_state'::"text", 'moment_signal'::"text", 'attachment_meta'::"text"])) OR (("data_type" = 'memory'::"text") AND ("public"."user_data_count"("couple_id", 'memory'::"text") < 10)) OR (("data_type" = 'custom_ritual'::"text") AND ("public"."user_data_count"("couple_id", 'custom_ritual'::"text") < 2)) OR (("data_type" = 'love_note'::"text") AND ("public"."user_data_count"("couple_id", 'love_note'::"text") < 20)))));


--
-- Name: couple_data Couple data select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Couple data select" ON "public"."couple_data" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."couple_members" "cm"
  WHERE (("cm"."couple_id" = "couple_data"."couple_id") AND ("cm"."user_id" = "auth"."uid"())))) AND (("is_private" IS NOT TRUE) OR ("created_by" = "auth"."uid"()))));


--
-- Name: couple_data Couple data update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Couple data update" ON "public"."couple_data" FOR UPDATE TO "authenticated" USING ((("created_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."couple_members" "cm"
  WHERE (("cm"."couple_id" = "couple_data"."couple_id") AND ("cm"."user_id" = "auth"."uid"())))))) WITH CHECK (("created_by" = "auth"."uid"()));


--
-- Name: moments Couple members can create moments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Couple members can create moments" ON "public"."moments" FOR INSERT WITH CHECK ((("created_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."couple_members" "m"
  WHERE (("m"."couple_id" = "moments"."couple_id") AND ("m"."user_id" = "auth"."uid"()))))));


--
-- Name: couples Couple members can update couple; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Couple members can update couple" ON "public"."couples" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."couple_members" "cm"
  WHERE (("cm"."couple_id" = "couples"."id") AND ("cm"."user_id" = "auth"."uid"())))));


--
-- Name: calendar_events Couple members can view calendar events; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Couple members can view calendar events" ON "public"."calendar_events" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."couple_members" "m"
  WHERE (("m"."couple_id" = "calendar_events"."couple_id") AND ("m"."user_id" = "auth"."uid"())))));


--
-- Name: couples Couple members can view couple; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Couple members can view couple" ON "public"."couples" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."couple_members" "cm"
  WHERE (("cm"."couple_id" = "couples"."id") AND ("cm"."user_id" = "auth"."uid"())))));


--
-- Name: couple_members Couple members can view memberships; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Couple members can view memberships" ON "public"."couple_members" FOR SELECT USING (("couple_id" IN ( SELECT "public"."get_my_couple_ids"() AS "get_my_couple_ids")));


--
-- Name: moments Couple members can view moments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Couple members can view moments" ON "public"."moments" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."couple_members" "m"
  WHERE (("m"."couple_id" = "moments"."couple_id") AND ("m"."user_id" = "auth"."uid"())))) AND (("is_private" = false) OR ("created_by" = "auth"."uid"()))));


--
-- Name: moments Creators can delete moments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Creators can delete moments" ON "public"."moments" FOR DELETE USING ((("created_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."couple_members" "m"
  WHERE (("m"."couple_id" = "moments"."couple_id") AND ("m"."user_id" = "auth"."uid"()))))));


--
-- Name: moments Creators can update moments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Creators can update moments" ON "public"."moments" FOR UPDATE USING ((("created_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."couple_members" "m"
  WHERE (("m"."couple_id" = "moments"."couple_id") AND ("m"."user_id" = "auth"."uid"()))))));


--
-- Name: user_entitlements Deny client entitlement updates; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Deny client entitlement updates" ON "public"."user_entitlements" FOR UPDATE TO "authenticated" USING (false) WITH CHECK (false);


--
-- Name: user_entitlements Deny client entitlement writes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Deny client entitlement writes" ON "public"."user_entitlements" FOR INSERT TO "authenticated" WITH CHECK (false);


--
-- Name: calendar_events Premium creators can delete calendar events; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Premium creators can delete calendar events" ON "public"."calendar_events" FOR DELETE USING ((("created_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."couple_members" "m"
  WHERE (("m"."couple_id" = "calendar_events"."couple_id") AND ("m"."user_id" = "auth"."uid"())))) AND "public"."couple_has_premium"("couple_id")));


--
-- Name: calendar_events Premium creators can update calendar events; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Premium creators can update calendar events" ON "public"."calendar_events" FOR UPDATE USING ((("created_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."couple_members" "m"
  WHERE (("m"."couple_id" = "calendar_events"."couple_id") AND ("m"."user_id" = "auth"."uid"())))) AND "public"."couple_has_premium"("couple_id")));


--
-- Name: calendar_events Premium members can create calendar events; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Premium members can create calendar events" ON "public"."calendar_events" FOR INSERT WITH CHECK ((("created_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."couple_members" "m"
  WHERE (("m"."couple_id" = "calendar_events"."couple_id") AND ("m"."user_id" = "auth"."uid"())))) AND "public"."couple_has_premium"("couple_id")));


--
-- Name: couples Users can create couples; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create couples" ON "public"."couples" FOR INSERT WITH CHECK (("auth"."uid"() = "created_by"));


--
-- Name: push_tokens Users can delete own push tokens; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete own push tokens" ON "public"."push_tokens" FOR DELETE USING (("user_id" = "auth"."uid"()));


--
-- Name: usage_events Users can delete own usage events; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete own usage events" ON "public"."usage_events" FOR DELETE USING (("auth"."uid"() = "user_id"));


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));


--
-- Name: push_tokens Users can insert own push tokens; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own push tokens" ON "public"."push_tokens" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));


--
-- Name: usage_events Users can insert own usage events; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own usage events" ON "public"."usage_events" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND "public"."is_couple_member"("couple_id", "auth"."uid"())));


--
-- Name: couple_members Users can join couple; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can join couple" ON "public"."couple_members" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."couples" "c"
  WHERE (("c"."id" = "couple_members"."couple_id") AND ("c"."created_by" = "auth"."uid"()))))));


--
-- Name: couple_members Users can leave couple; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can leave couple" ON "public"."couple_members" FOR DELETE USING (("user_id" = "auth"."uid"()));


--
-- Name: usage_events Users can read couple usage events; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can read couple usage events" ON "public"."usage_events" FOR SELECT USING ("public"."is_couple_member"("couple_id", "auth"."uid"()));


--
-- Name: couple_members Users can update own membership; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own membership" ON "public"."couple_members" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));


--
-- Name: push_tokens Users can update own push tokens; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own push tokens" ON "public"."push_tokens" FOR UPDATE USING (("user_id" = "auth"."uid"()));


--
-- Name: user_entitlements Users can view own entitlements; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own entitlements" ON "public"."user_entitlements" FOR SELECT USING (("user_id" = "auth"."uid"()));


--
-- Name: partner_link_codes Users can view own link codes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own link codes" ON "public"."partner_link_codes" FOR SELECT USING (("created_by" = "auth"."uid"()));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));


--
-- Name: push_tokens Users can view own push tokens; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own push tokens" ON "public"."push_tokens" FOR SELECT USING (("user_id" = "auth"."uid"()));


--
-- Name: analytics_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."analytics_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: analytics_events analytics_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "analytics_insert_own" ON "public"."analytics_events" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: analytics_events analytics_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "analytics_select_own" ON "public"."analytics_events" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: calendar_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."calendar_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: couple_data; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."couple_data" ENABLE ROW LEVEL SECURITY;

--
-- Name: couple_members; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."couple_members" ENABLE ROW LEVEL SECURITY;

--
-- Name: couples; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."couples" ENABLE ROW LEVEL SECURITY;

--
-- Name: moments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."moments" ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."notification_log" ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_log notification_log_service_only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "notification_log_service_only" ON "public"."notification_log" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: partner_link_codes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."partner_link_codes" ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

--
-- Name: push_tokens; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."push_tokens" ENABLE ROW LEVEL SECURITY;

--
-- Name: rate_limit_buckets; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."rate_limit_buckets" ENABLE ROW LEVEL SECURITY;

--
-- Name: rate_limit_buckets service_role_only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "service_role_only" ON "public"."rate_limit_buckets" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: usage_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."usage_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_entitlements; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."user_entitlements" ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA "auth"; Type: ACL; Schema: -; Owner: supabase_admin
--

GRANT USAGE ON SCHEMA "auth" TO "anon";
GRANT USAGE ON SCHEMA "auth" TO "authenticated";
GRANT USAGE ON SCHEMA "auth" TO "service_role";
GRANT ALL ON SCHEMA "auth" TO "supabase_auth_admin";
GRANT ALL ON SCHEMA "auth" TO "dashboard_user";
GRANT USAGE ON SCHEMA "auth" TO "postgres";


--
-- Name: SCHEMA "public"; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";


--
-- Name: FUNCTION "email"(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION "auth"."email"() TO "dashboard_user";


--
-- Name: FUNCTION "jwt"(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION "auth"."jwt"() TO "postgres";
GRANT ALL ON FUNCTION "auth"."jwt"() TO "dashboard_user";


--
-- Name: FUNCTION "role"(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION "auth"."role"() TO "dashboard_user";


--
-- Name: FUNCTION "uid"(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION "auth"."uid"() TO "dashboard_user";


--
-- Name: FUNCTION "check_rate_limit"("p_user_id" "uuid", "p_cost" integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."check_rate_limit"("p_user_id" "uuid", "p_cost" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."check_rate_limit"("p_user_id" "uuid", "p_cost" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_rate_limit"("p_user_id" "uuid", "p_cost" integer) TO "service_role";


--
-- Name: FUNCTION "check_sensitive_rate_limit"("p_user_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."check_sensitive_rate_limit"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_sensitive_rate_limit"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_sensitive_rate_limit"("p_user_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "couple_has_premium"("check_couple_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."couple_has_premium"("check_couple_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."couple_has_premium"("check_couple_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."couple_has_premium"("check_couple_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "create_couple_for_qr"("device_public_key" "text"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."create_couple_for_qr"("device_public_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_couple_for_qr"("device_public_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_couple_for_qr"("device_public_key" "text") TO "service_role";


--
-- Name: FUNCTION "delete_own_account"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."delete_own_account"() TO "anon";
GRANT ALL ON FUNCTION "public"."delete_own_account"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_own_account"() TO "service_role";


--
-- Name: FUNCTION "get_couple_premium_status"("input_couple_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."get_couple_premium_status"("input_couple_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_couple_premium_status"("input_couple_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_couple_premium_status"("input_couple_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "get_daily_usage_count"("input_couple_id" "uuid", "input_user_id" "uuid", "input_event_type" "text", "input_day_key" "text"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."get_daily_usage_count"("input_couple_id" "uuid", "input_user_id" "uuid", "input_event_type" "text", "input_day_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_daily_usage_count"("input_couple_id" "uuid", "input_user_id" "uuid", "input_event_type" "text", "input_day_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_daily_usage_count"("input_couple_id" "uuid", "input_user_id" "uuid", "input_event_type" "text", "input_day_key" "text") TO "service_role";


--
-- Name: FUNCTION "get_my_couple_ids"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."get_my_couple_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_couple_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_couple_ids"() TO "service_role";


--
-- Name: FUNCTION "get_user_couple_id"("input_user_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."get_user_couple_id"("input_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_couple_id"("input_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_couple_id"("input_user_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "handle_new_user"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";


--
-- Name: FUNCTION "is_couple_member"("couple_uuid" "uuid", "user_uuid" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."is_couple_member"("couple_uuid" "uuid", "user_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_couple_member"("couple_uuid" "uuid", "user_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_couple_member"("couple_uuid" "uuid", "user_uuid" "uuid") TO "service_role";


--
-- Name: FUNCTION "is_premium_user"("check_user_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."is_premium_user"("check_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_premium_user"("check_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_premium_user"("check_user_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "is_user_premium"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."is_user_premium"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_user_premium"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_user_premium"() TO "service_role";


--
-- Name: FUNCTION "leave_couple"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."leave_couple"() TO "anon";
GRANT ALL ON FUNCTION "public"."leave_couple"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."leave_couple"() TO "service_role";


--
-- Name: FUNCTION "notify_on_calendar_event_insert"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."notify_on_calendar_event_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_on_calendar_event_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_on_calendar_event_insert"() TO "service_role";


--
-- Name: FUNCTION "notify_on_couple_created"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."notify_on_couple_created"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_on_couple_created"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_on_couple_created"() TO "service_role";


--
-- Name: FUNCTION "notify_on_couple_data_insert"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."notify_on_couple_data_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_on_couple_data_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_on_couple_data_insert"() TO "service_role";


--
-- Name: FUNCTION "notify_on_moment_insert"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."notify_on_moment_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_on_moment_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_on_moment_insert"() TO "service_role";


--
-- Name: FUNCTION "notify_partner"("sender_id" "uuid", "notification_title" "text", "notification_body" "text", "notification_data" "jsonb"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."notify_partner"("sender_id" "uuid", "notification_title" "text", "notification_body" "text", "notification_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."notify_partner"("sender_id" "uuid", "notification_title" "text", "notification_body" "text", "notification_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_partner"("sender_id" "uuid", "notification_title" "text", "notification_body" "text", "notification_data" "jsonb") TO "service_role";


--
-- Name: FUNCTION "redeem_pairing_code"("input_code_hash" "text", "input_public_key" "text"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."redeem_pairing_code"("input_code_hash" "text", "input_public_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."redeem_pairing_code"("input_code_hash" "text", "input_public_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."redeem_pairing_code"("input_code_hash" "text", "input_public_key" "text") TO "service_role";


--
-- Name: FUNCTION "redeem_partner_code"("input_code_hash" "text"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."redeem_partner_code"("input_code_hash" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."redeem_partner_code"("input_code_hash" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."redeem_partner_code"("input_code_hash" "text") TO "service_role";


--
-- Name: FUNCTION "send_expo_push"("p_token" "text", "p_title" "text", "p_body" "text", "p_data" "jsonb"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."send_expo_push"("p_token" "text", "p_title" "text", "p_body" "text", "p_data" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."send_expo_push"("p_token" "text", "p_title" "text", "p_body" "text", "p_data" "jsonb") TO "service_role";


--
-- Name: FUNCTION "set_couple_premium"("input_couple_id" "uuid", "input_is_premium" boolean, "input_source" "text"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."set_couple_premium"("input_couple_id" "uuid", "input_is_premium" boolean, "input_source" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_couple_premium"("input_couple_id" "uuid", "input_is_premium" boolean, "input_source" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_couple_premium"("input_couple_id" "uuid", "input_is_premium" boolean, "input_source" "text") TO "service_role";


--
-- Name: FUNCTION "sync_couple_premium_to_profiles"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."sync_couple_premium_to_profiles"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_couple_premium_to_profiles"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_couple_premium_to_profiles"() TO "service_role";


--
-- Name: FUNCTION "update_updated_at"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";


--
-- Name: FUNCTION "update_updated_at_column"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


--
-- Name: FUNCTION "user_data_count"("p_couple_id" "uuid", "p_data_type" "text"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."user_data_count"("p_couple_id" "uuid", "p_data_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."user_data_count"("p_couple_id" "uuid", "p_data_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_data_count"("p_couple_id" "uuid", "p_data_type" "text") TO "service_role";


--
-- Name: TABLE "audit_log_entries"; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE "auth"."audit_log_entries" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."audit_log_entries" TO "postgres";
GRANT SELECT ON TABLE "auth"."audit_log_entries" TO "postgres" WITH GRANT OPTION;


--
-- Name: TABLE "custom_oauth_providers"; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE "auth"."custom_oauth_providers" TO "postgres";
GRANT ALL ON TABLE "auth"."custom_oauth_providers" TO "dashboard_user";


--
-- Name: TABLE "flow_state"; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."flow_state" TO "postgres";
GRANT SELECT ON TABLE "auth"."flow_state" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."flow_state" TO "dashboard_user";


--
-- Name: TABLE "identities"; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."identities" TO "postgres";
GRANT SELECT ON TABLE "auth"."identities" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."identities" TO "dashboard_user";


--
-- Name: TABLE "instances"; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE "auth"."instances" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."instances" TO "postgres";
GRANT SELECT ON TABLE "auth"."instances" TO "postgres" WITH GRANT OPTION;


--
-- Name: TABLE "mfa_amr_claims"; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."mfa_amr_claims" TO "postgres";
GRANT SELECT ON TABLE "auth"."mfa_amr_claims" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."mfa_amr_claims" TO "dashboard_user";


--
-- Name: TABLE "mfa_challenges"; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."mfa_challenges" TO "postgres";
GRANT SELECT ON TABLE "auth"."mfa_challenges" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."mfa_challenges" TO "dashboard_user";


--
-- Name: TABLE "mfa_factors"; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."mfa_factors" TO "postgres";
GRANT SELECT ON TABLE "auth"."mfa_factors" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."mfa_factors" TO "dashboard_user";


--
-- Name: TABLE "oauth_authorizations"; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE "auth"."oauth_authorizations" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_authorizations" TO "dashboard_user";


--
-- Name: TABLE "oauth_client_states"; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE "auth"."oauth_client_states" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_client_states" TO "dashboard_user";


--
-- Name: TABLE "oauth_clients"; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE "auth"."oauth_clients" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_clients" TO "dashboard_user";


--
-- Name: TABLE "oauth_consents"; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE "auth"."oauth_consents" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_consents" TO "dashboard_user";


--
-- Name: TABLE "one_time_tokens"; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."one_time_tokens" TO "postgres";
GRANT SELECT ON TABLE "auth"."one_time_tokens" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."one_time_tokens" TO "dashboard_user";


--
-- Name: TABLE "refresh_tokens"; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE "auth"."refresh_tokens" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."refresh_tokens" TO "postgres";
GRANT SELECT ON TABLE "auth"."refresh_tokens" TO "postgres" WITH GRANT OPTION;


--
-- Name: SEQUENCE "refresh_tokens_id_seq"; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON SEQUENCE "auth"."refresh_tokens_id_seq" TO "dashboard_user";
GRANT ALL ON SEQUENCE "auth"."refresh_tokens_id_seq" TO "postgres";


--
-- Name: TABLE "saml_providers"; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."saml_providers" TO "postgres";
GRANT SELECT ON TABLE "auth"."saml_providers" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."saml_providers" TO "dashboard_user";


--
-- Name: TABLE "saml_relay_states"; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."saml_relay_states" TO "postgres";
GRANT SELECT ON TABLE "auth"."saml_relay_states" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."saml_relay_states" TO "dashboard_user";


--
-- Name: TABLE "schema_migrations"; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT SELECT ON TABLE "auth"."schema_migrations" TO "postgres" WITH GRANT OPTION;


--
-- Name: TABLE "sessions"; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."sessions" TO "postgres";
GRANT SELECT ON TABLE "auth"."sessions" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."sessions" TO "dashboard_user";


--
-- Name: TABLE "sso_domains"; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."sso_domains" TO "postgres";
GRANT SELECT ON TABLE "auth"."sso_domains" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."sso_domains" TO "dashboard_user";


--
-- Name: TABLE "sso_providers"; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."sso_providers" TO "postgres";
GRANT SELECT ON TABLE "auth"."sso_providers" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."sso_providers" TO "dashboard_user";


--
-- Name: TABLE "users"; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE "auth"."users" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."users" TO "postgres";
GRANT SELECT ON TABLE "auth"."users" TO "postgres" WITH GRANT OPTION;


--
-- Name: TABLE "webauthn_challenges"; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE "auth"."webauthn_challenges" TO "postgres";
GRANT ALL ON TABLE "auth"."webauthn_challenges" TO "dashboard_user";


--
-- Name: TABLE "webauthn_credentials"; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE "auth"."webauthn_credentials" TO "postgres";
GRANT ALL ON TABLE "auth"."webauthn_credentials" TO "dashboard_user";


--
-- Name: TABLE "analytics_events"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."analytics_events" TO "anon";
GRANT ALL ON TABLE "public"."analytics_events" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_events" TO "service_role";


--
-- Name: TABLE "calendar_events"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."calendar_events" TO "anon";
GRANT ALL ON TABLE "public"."calendar_events" TO "authenticated";
GRANT ALL ON TABLE "public"."calendar_events" TO "service_role";


--
-- Name: TABLE "couple_data"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."couple_data" TO "anon";
GRANT ALL ON TABLE "public"."couple_data" TO "authenticated";
GRANT ALL ON TABLE "public"."couple_data" TO "service_role";


--
-- Name: TABLE "couple_members"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."couple_members" TO "anon";
GRANT ALL ON TABLE "public"."couple_members" TO "authenticated";
GRANT ALL ON TABLE "public"."couple_members" TO "service_role";


--
-- Name: TABLE "couples"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."couples" TO "anon";
GRANT ALL ON TABLE "public"."couples" TO "authenticated";
GRANT ALL ON TABLE "public"."couples" TO "service_role";


--
-- Name: TABLE "moments"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."moments" TO "anon";
GRANT ALL ON TABLE "public"."moments" TO "authenticated";
GRANT ALL ON TABLE "public"."moments" TO "service_role";


--
-- Name: TABLE "notification_log"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."notification_log" TO "anon";
GRANT ALL ON TABLE "public"."notification_log" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_log" TO "service_role";


--
-- Name: TABLE "partner_link_codes"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."partner_link_codes" TO "anon";
GRANT ALL ON TABLE "public"."partner_link_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."partner_link_codes" TO "service_role";


--
-- Name: TABLE "profiles"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";


--
-- Name: TABLE "push_tokens"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."push_tokens" TO "anon";
GRANT ALL ON TABLE "public"."push_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."push_tokens" TO "service_role";


--
-- Name: TABLE "rate_limit_buckets"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."rate_limit_buckets" TO "anon";
GRANT ALL ON TABLE "public"."rate_limit_buckets" TO "authenticated";
GRANT ALL ON TABLE "public"."rate_limit_buckets" TO "service_role";


--
-- Name: TABLE "usage_events"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."usage_events" TO "anon";
GRANT ALL ON TABLE "public"."usage_events" TO "authenticated";
GRANT ALL ON TABLE "public"."usage_events" TO "service_role";


--
-- Name: TABLE "user_entitlements"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."user_entitlements" TO "anon";
GRANT ALL ON TABLE "public"."user_entitlements" TO "authenticated";
GRANT ALL ON TABLE "public"."user_entitlements" TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: auth; Owner: supabase_auth_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON SEQUENCES TO "dashboard_user";


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: auth; Owner: supabase_auth_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON FUNCTIONS TO "dashboard_user";


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: auth; Owner: supabase_auth_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON TABLES TO "dashboard_user";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


--
-- PostgreSQL database dump complete
--

\unrestrict OzLM3GJeQ2Wevvn4Lg6jcxCDMNOkIQgHaikxWgsCXlBaltX02TYX8RB8WmBC0Fe

