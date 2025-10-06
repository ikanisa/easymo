

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



CREATE TYPE "public"."bar_contact_role" AS ENUM (
    'manager',
    'staff'
);


ALTER TYPE "public"."bar_contact_role" OWNER TO "postgres";


CREATE TYPE "public"."basket_status" AS ENUM (
    'draft',
    'pending_review',
    'approved',
    'rejected',
    'suspended',
    'closed'
);


ALTER TYPE "public"."basket_status" OWNER TO "postgres";


CREATE TYPE "public"."basket_type" AS ENUM (
    'public',
    'private'
);


ALTER TYPE "public"."basket_type" OWNER TO "postgres";


CREATE TYPE "public"."cart_status" AS ENUM (
    'open',
    'locked',
    'expired'
);


ALTER TYPE "public"."cart_status" OWNER TO "postgres";


CREATE TYPE "public"."item_modifier_type" AS ENUM (
    'single',
    'multiple'
);


ALTER TYPE "public"."item_modifier_type" OWNER TO "postgres";


CREATE TYPE "public"."menu_source" AS ENUM (
    'ocr',
    'manual'
);


ALTER TYPE "public"."menu_source" OWNER TO "postgres";


CREATE TYPE "public"."menu_status" AS ENUM (
    'draft',
    'published',
    'archived'
);


ALTER TYPE "public"."menu_status" OWNER TO "postgres";


CREATE TYPE "public"."notification_channel" AS ENUM (
    'template',
    'freeform',
    'flow',
    'media'
);


ALTER TYPE "public"."notification_channel" OWNER TO "postgres";


CREATE TYPE "public"."notification_status" AS ENUM (
    'queued',
    'sent',
    'failed'
);


ALTER TYPE "public"."notification_status" OWNER TO "postgres";


CREATE TYPE "public"."ocr_job_status" AS ENUM (
    'queued',
    'processing',
    'succeeded',
    'failed'
);


ALTER TYPE "public"."ocr_job_status" OWNER TO "postgres";


CREATE TYPE "public"."order_event_actor" AS ENUM (
    'system',
    'customer',
    'vendor',
    'admin'
);


ALTER TYPE "public"."order_event_actor" OWNER TO "postgres";


CREATE TYPE "public"."order_event_type" AS ENUM (
    'created',
    'paid',
    'served',
    'cancelled',
    'customer_paid_signal',
    'vendor_nudge',
    'admin_override'
);


ALTER TYPE "public"."order_event_type" OWNER TO "postgres";


CREATE TYPE "public"."order_status" AS ENUM (
    'pending',
    'paid',
    'served',
    'cancelled'
);


ALTER TYPE "public"."order_status" OWNER TO "postgres";


CREATE TYPE "public"."session_role" AS ENUM (
    'customer',
    'vendor',
    'admin',
    'system',
    'vendor_manager',
    'vendor_staff'
);


ALTER TYPE "public"."session_role" OWNER TO "postgres";


CREATE TYPE "public"."sub_status" AS ENUM (
    'pending_review',
    'active',
    'expired',
    'rejected'
);


ALTER TYPE "public"."sub_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at := now();
  return new;
end$$;


ALTER FUNCTION "public"."_touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_sub_command"("_action" "text", "_reference" "text", "_actor" "text") RETURNS TABLE("status" "text")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_status text;
BEGIN
  IF _action IS NULL OR _reference IS NULL THEN
    status := 'invalid';
    RETURN NEXT;
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.admin_submissions WHERE reference = _reference) THEN
    INSERT INTO public.admin_submissions (reference, applicant_name)
    VALUES (_reference, NULL)
    ON CONFLICT (reference) DO NOTHING;
  END IF;
  IF _action = 'approve' THEN
    UPDATE public.admin_submissions SET status = 'approved' WHERE reference = _reference;
    v_status := 'approved';
  ELSIF _action = 'reject' THEN
    UPDATE public.admin_submissions SET status = 'rejected' WHERE reference = _reference;
    v_status := 'rejected';
  ELSE
    v_status := 'unknown_action';
  END IF;
  INSERT INTO public.admin_audit_log (actor_wa, action, target, details)
  VALUES (_actor, 'sub_' || _action, _reference, jsonb_build_object('reference', _reference));
  status := v_status;
  RETURN NEXT;
END;
$$;


ALTER FUNCTION "public"."admin_sub_command"("_action" "text", "_reference" "text", "_actor" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_sub_list_pending"("_limit" integer DEFAULT 10) RETURNS TABLE("reference" "text", "name" "text", "submitted_at" timestamp with time zone)
    LANGUAGE "sql"
    AS $$
  SELECT reference, applicant_name, submitted_at
  FROM public.admin_submissions
  WHERE status = 'pending'
  ORDER BY submitted_at ASC
  LIMIT COALESCE(_limit, 10);
$$;


ALTER FUNCTION "public"."admin_sub_list_pending"("_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auth_bar_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT NULLIF(public.auth_claim('bar_id'), '')::uuid;
$$;


ALTER FUNCTION "public"."auth_bar_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auth_claim"("text") RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $_$
  SELECT COALESCE(current_setting('request.jwt.claim.' || $1, true), '');
$_$;


ALTER FUNCTION "public"."auth_claim"("text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auth_customer_id"() RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RAISE EXCEPTION 'auth_customer_id() is deprecated. Use auth_profile_id().' USING ERRCODE = 'P0001';
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."auth_customer_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auth_profile_id"() RETURNS "uuid"
    LANGUAGE "sql"
    AS $$
  SELECT NULLIF(public.auth_claim('profile_id'), '')::uuid;
$$;


ALTER FUNCTION "public"."auth_profile_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auth_role"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT public.auth_claim('role');
$$;


ALTER FUNCTION "public"."auth_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auth_wa_id"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT public.auth_claim('wa_id');
$$;


ALTER FUNCTION "public"."auth_wa_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."basket_close"("_profile_id" "uuid", "_basket_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE public.baskets
  SET status = 'closed', updated_at = timezone('utc', now())
  WHERE id = _basket_id AND (owner_profile_id = _profile_id OR owner_profile_id IS NULL);
END;
$$;


ALTER FUNCTION "public"."basket_close"("_profile_id" "uuid", "_basket_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."basket_create"("_profile_id" "uuid", "_whatsapp" "text", "_name" "text", "_is_public" boolean, "_goal_minor" integer) RETURNS TABLE("basket_id" "uuid", "share_token" "text", "qr_url" "text")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_basket_id uuid;
  v_token text;
  v_updated integer;
  v_now timestamptz := timezone('utc', now());
  v_whatsapp text := COALESCE(_whatsapp, '');
BEGIN
  IF _profile_id IS NULL THEN
    RAISE EXCEPTION 'basket_profile_required'
      USING MESSAGE = 'A profile is required to create a basket.';
  END IF;

  v_token := upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));

  INSERT INTO public.baskets (
    owner_profile_id,
    owner_whatsapp,
    creator_user_id,
    name,
    is_public,
    goal_minor,
    share_token,
    join_token,
    join_token_revoked,
    status,
    created_at,
    updated_at
  )
  VALUES (
    _profile_id,
    v_whatsapp,
    _profile_id,
    _name,
    COALESCE(_is_public, false),
    _goal_minor,
    v_token,
    v_token,
    false,
    'open',
    v_now,
    v_now
  )
  RETURNING id INTO v_basket_id;

  UPDATE public.basket_members
  SET profile_id = _profile_id,
      user_id = _profile_id,
      whatsapp = v_whatsapp,
      role = 'owner',
      joined_at = v_now,
      joined_via = 'create',
      join_reference = v_token
  WHERE basket_id = v_basket_id
    AND (
      (user_id IS NOT NULL AND user_id = _profile_id)
      OR COALESCE(whatsapp, '') = v_whatsapp
    )
  RETURNING 1 INTO v_updated;

  IF NOT FOUND THEN
    INSERT INTO public.basket_members (
      basket_id,
      profile_id,
      user_id,
      whatsapp,
      role,
      joined_at,
      joined_via,
      join_reference
    )
    VALUES (
      v_basket_id,
      _profile_id,
      _profile_id,
      v_whatsapp,
      'owner',
      v_now,
      'create',
      v_token
    );
  END IF;

  basket_id := v_basket_id;
  share_token := v_token;
  qr_url := 'https://quickchart.io/qr?text=JB:' || v_token;
  RETURN NEXT;
END;
$$;


ALTER FUNCTION "public"."basket_create"("_profile_id" "uuid", "_whatsapp" "text", "_name" "text", "_is_public" boolean, "_goal_minor" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."basket_detail"("_profile_id" "uuid", "_basket_id" "uuid") RETURNS TABLE("id" "uuid", "name" "text", "status" "text", "member_count" integer, "balance_minor" integer, "goal_minor" integer, "currency" "text", "share_token" "text", "is_owner" boolean, "owner_name" "text", "owner_whatsapp" "text", "last_activity" timestamp with time zone)
    LANGUAGE "sql"
    AS $$
  SELECT b.id,
         b.name,
         b.status,
         (SELECT count(*) FROM public.basket_members bm WHERE bm.basket_id = b.id) AS member_count,
         COALESCE((SELECT sum(amount_minor) FROM public.basket_contributions bc WHERE bc.basket_id = b.id), 0) AS balance_minor,
         b.goal_minor,
         b.currency,
         b.share_token,
         (b.owner_profile_id = _profile_id OR b.owner_whatsapp = public.profile_wa(_profile_id)) AS is_owner,
         (SELECT display_name FROM public.profiles p WHERE p.user_id = b.owner_profile_id) AS owner_name,
         b.owner_whatsapp,
         GREATEST(
           b.updated_at,
           COALESCE((SELECT max(bm.joined_at) FROM public.basket_members bm WHERE bm.basket_id = b.id), b.updated_at),
           COALESCE((SELECT max(bc.created_at) FROM public.basket_contributions bc WHERE bc.basket_id = b.id), b.updated_at)
         ) AS last_activity
  FROM public.baskets b
  WHERE b.id = _basket_id;
$$;


ALTER FUNCTION "public"."basket_detail"("_profile_id" "uuid", "_basket_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."basket_discover_nearby"("_profile_id" "uuid", "_lat" double precision, "_lng" double precision, "_limit" integer DEFAULT 10) RETURNS TABLE("id" "uuid", "name" "text", "description" "text", "distance_km" double precision, "member_count" integer)
    LANGUAGE "sql"
    AS $$
  SELECT b.id,
         b.name,
         b.description,
         CASE
           WHEN b.lat IS NULL OR b.lng IS NULL THEN NULL
           ELSE public.haversine_km(b.lat, b.lng, _lat, _lng)
         END AS distance_km,
         (SELECT count(*) FROM public.basket_members bm WHERE bm.basket_id = b.id) AS member_count
  FROM public.baskets b
  WHERE b.is_public = true AND b.status::text = 'open'
  ORDER BY distance_km NULLS LAST, b.created_at DESC
  LIMIT COALESCE(_limit, 10);
$$;


ALTER FUNCTION "public"."basket_discover_nearby"("_profile_id" "uuid", "_lat" double precision, "_lng" double precision, "_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."basket_generate_qr"("_profile_id" "uuid", "_basket_id" "uuid") RETURNS TABLE("qr_url" "text")
    LANGUAGE "sql"
    AS $$
  SELECT 'https://quickchart.io/qr?text=JB:' || COALESCE(share_token, '') AS qr_url
  FROM public.baskets
  WHERE id = _basket_id;
$$;


ALTER FUNCTION "public"."basket_generate_qr"("_profile_id" "uuid", "_basket_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."basket_join_by_code"("_profile_id" "uuid", "_whatsapp" "text", "_code" "text") RETURNS TABLE("basket_id" "uuid", "basket_name" "text")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_token text;
  v_contact text := COALESCE(_whatsapp, '');
  v_basket public.baskets;
  v_now timestamptz := timezone('utc', now());
  v_updated integer;
BEGIN
  IF _code IS NULL OR length(trim(_code)) < 4 THEN
    RAISE EXCEPTION 'basket_code_invalid'
      USING MESSAGE = 'That join code looks invalid.';
  END IF;

  v_token := upper(regexp_replace(trim(_code), '^JB[:\-]?', ''));
  IF length(v_token) < 4 THEN
    RAISE EXCEPTION 'basket_code_invalid'
      USING MESSAGE = 'That join code looks invalid.';
  END IF;

  SELECT * INTO v_basket
  FROM public.baskets b
  WHERE COALESCE(b.join_token, b.share_token) = v_token
  LIMIT 1;

  IF v_basket.id IS NULL THEN
    RAISE EXCEPTION 'basket_code_not_found'
      USING MESSAGE = 'No basket found for that code.';
  END IF;

  IF COALESCE(v_basket.join_token_revoked, false) THEN
    RAISE EXCEPTION 'basket_code_revoked'
      USING MESSAGE = 'This join code has been revoked.';
  END IF;

  IF v_basket.status IS NULL OR v_basket.status::text <> 'open' THEN
    RAISE EXCEPTION 'basket_not_joinable'
      USING MESSAGE = 'This basket is not accepting new members.';
  END IF;

  INSERT INTO public.basket_joins (
    basket_id,
    whatsapp,
    user_id,
    invite_source,
    status,
    metadata,
    created_at,
    processed_at
  )
  VALUES (
    v_basket.id,
    NULLIF(v_contact, ''),
    _profile_id,
    'code',
    'joined',
    jsonb_build_object('token', v_token),
    v_now,
    v_now
  )
  ON CONFLICT ON CONSTRAINT idx_basket_joins_unique DO UPDATE
  SET user_id = COALESCE(EXCLUDED.user_id, public.basket_joins.user_id),
      whatsapp = EXCLUDED.whatsapp,
      invite_source = 'code',
      status = 'joined',
      metadata = jsonb_strip_nulls(public.basket_joins.metadata || EXCLUDED.metadata),
      processed_at = v_now;

  UPDATE public.basket_members
  SET profile_id = COALESCE(_profile_id, profile_id),
      user_id = COALESCE(_profile_id, user_id),
      whatsapp = v_contact,
      role = CASE WHEN role = 'owner' THEN role ELSE 'member' END,
      joined_at = v_now,
      joined_via = 'code',
      join_reference = v_token
  WHERE basket_id = v_basket.id
    AND (
      (user_id IS NOT NULL AND _profile_id IS NOT NULL AND user_id = _profile_id)
      OR COALESCE(whatsapp, '') = v_contact
    )
  RETURNING 1 INTO v_updated;

  IF NOT FOUND THEN
    INSERT INTO public.basket_members (
      basket_id,
      profile_id,
      user_id,
      whatsapp,
      role,
      joined_at,
      joined_via,
      join_reference
    )
    VALUES (
      v_basket.id,
      _profile_id,
      _profile_id,
      v_contact,
      'member',
      v_now,
      'code',
      v_token
    );
  END IF;

  basket_id := v_basket.id;
  basket_name := v_basket.name;
  RETURN NEXT;
END;
$$;


ALTER FUNCTION "public"."basket_join_by_code"("_profile_id" "uuid", "_whatsapp" "text", "_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."basket_leave"("_profile_id" "uuid", "_basket_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  DELETE FROM public.basket_members
  WHERE basket_id = _basket_id
    AND (profile_id = _profile_id OR (SELECT whatsapp_e164 FROM public.profiles WHERE user_id = _profile_id) = whatsapp);
END;
$$;


ALTER FUNCTION "public"."basket_leave"("_profile_id" "uuid", "_basket_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."basket_list_mine"("_profile_id" "uuid") RETURNS TABLE("id" "uuid", "name" "text", "status" "text", "member_count" integer, "balance_minor" integer, "currency" "text")
    LANGUAGE "sql"
    AS $$
  SELECT b.id,
         b.name,
         b.status,
         (SELECT count(*) FROM public.basket_members bm WHERE bm.basket_id = b.id) AS member_count,
         COALESCE((SELECT sum(amount_minor) FROM public.basket_contributions bc WHERE bc.basket_id = b.id), 0) AS balance_minor,
         b.currency
  FROM public.baskets b
  WHERE EXISTS (
    SELECT 1 FROM public.basket_members m
    WHERE m.basket_id = b.id
      AND (
        (_profile_id IS NOT NULL AND m.profile_id = _profile_id)
        OR (
          COALESCE(public.profile_wa(_profile_id), '') <> ''
          AND m.whatsapp = public.profile_wa(_profile_id)
        )
      )
  );
$$;


ALTER FUNCTION "public"."basket_list_mine"("_profile_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid",
    "to_wa_id" "text" NOT NULL,
    "template_name" "text",
    "notification_type" "text" NOT NULL,
    "channel" "public"."notification_channel" DEFAULT 'template'::"public"."notification_channel" NOT NULL,
    "status" "public"."notification_status" DEFAULT 'queued'::"public"."notification_status" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "error_message" "text",
    "sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "retry_count" integer DEFAULT 0 NOT NULL,
    "next_attempt_at" timestamp with time zone,
    "locked_at" timestamp with time zone
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_notifications"("_limit" integer DEFAULT 10) RETURNS SETOF "public"."notifications"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _now timestamptz := timezone('utc', now());
BEGIN
  RETURN QUERY
  WITH candidate AS (
    SELECT id
    FROM public.notifications
    WHERE status = 'queued'
      AND (locked_at IS NULL OR locked_at < _now - interval '15 minutes')
      AND (next_attempt_at IS NULL OR next_attempt_at <= _now)
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT COALESCE(_limit, 10)
  )
  UPDATE public.notifications n
     SET locked_at = _now,
         retry_count = COALESCE(n.retry_count, 0),
         next_attempt_at = NULL
  FROM candidate
  WHERE n.id = candidate.id
  RETURNING n.*;
END;
$$;


ALTER FUNCTION "public"."claim_notifications"("_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."claim_notifications"("_limit" integer) IS 'Atomically locks and returns up to _limit queued notifications for delivery.';



CREATE OR REPLACE FUNCTION "public"."fn_assert_basket_create_rate_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_owner uuid := NEW.owner_profile_id;
  v_recent_window interval := interval '10 minutes';
  v_daily_limit integer := 10;
  v_recent_limit integer := 3;
  recent_count integer;
  daily_count integer;
BEGIN
  IF v_owner IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO recent_count
  FROM public.baskets b
  WHERE b.owner_profile_id = v_owner
    AND b.created_at >= timezone('utc', now()) - v_recent_window;

  IF recent_count >= v_recent_limit THEN
    RAISE EXCEPTION 'basket_create_rate_limit'
      USING MESSAGE = 'You are creating baskets too quickly. Try again later.';
  END IF;

  SELECT count(*) INTO daily_count
  FROM public.baskets b
  WHERE b.owner_profile_id = v_owner
    AND b.created_at >= date_trunc('day', timezone('utc', now()));

  IF daily_count >= v_daily_limit THEN
    RAISE EXCEPTION 'basket_create_daily_limit'
      USING MESSAGE = 'You have reached the daily basket creation limit.';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_assert_basket_create_rate_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_assert_basket_join_rate_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_contact text := COALESCE(NEW.whatsapp, OLD.whatsapp, '');
  v_user uuid := COALESCE(NEW.user_id, OLD.user_id);
  v_window_start timestamptz := timezone('utc', now()) - interval '5 minutes';
  v_current_id uuid := COALESCE(NEW.id, OLD.id);
  attempt_count integer;
BEGIN
  IF v_user IS NULL AND v_contact = '' THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO attempt_count
  FROM public.basket_joins bj
  WHERE bj.created_at >= v_window_start
    AND (v_current_id IS NULL OR bj.id <> v_current_id)
    AND (
      (v_user IS NOT NULL AND bj.user_id = v_user)
      OR (v_contact <> '' AND bj.whatsapp = v_contact)
    );

  IF attempt_count >= 5 THEN
    RAISE EXCEPTION 'basket_join_rate_limit'
      USING MESSAGE = 'Too many join attempts. Wait a few minutes and try again.';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.created_at := timezone('utc', now());
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_assert_basket_join_rate_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gate_pro_feature"("_user_id" "uuid") RETURNS TABLE("access" boolean, "used_credit" boolean, "credits_left" integer)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_rec public.mobility_pro_access;
  v_access boolean := false;
  v_used boolean := false;
  v_left integer := 0;
BEGIN
  SELECT * INTO v_rec FROM public.mobility_pro_access WHERE user_id = _user_id;
  IF v_rec.user_id IS NULL THEN
    RETURN QUERY SELECT false, false, 0;
    RETURN;
  END IF;
  v_left := COALESCE(v_rec.credits_left, 0);
  IF v_rec.granted_until IS NOT NULL AND v_rec.granted_until >= timezone('utc', now()) THEN
    v_access := true;
  ELSIF v_left > 0 THEN
    v_access := true;
  END IF;
  RETURN QUERY SELECT v_access, v_used, v_left;
END;
$$;


ALTER FUNCTION "public"."gate_pro_feature"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_order_code"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_seq bigint;
BEGIN
  SELECT nextval('public.order_code_seq') INTO v_seq;
  RETURN upper(lpad(to_hex(v_seq), 6, '0'));
END;
$$;


ALTER FUNCTION "public"."generate_order_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."haversine_km"("lat1" double precision, "lng1" double precision, "lat2" double precision, "lng2" double precision) RETURNS double precision
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT 2 * 6371 * asin(
    sqrt(
      pow(sin(radians(lat2 - lat1) / 2), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) * pow(sin(radians(lng2 - lng1) / 2), 2)
    )
  );
$$;


ALTER FUNCTION "public"."haversine_km"("lat1" double precision, "lng1" double precision, "lat2" double precision, "lng2" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_profile_credits"("in_user_id" "uuid", "in_delta" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  new_bal integer;
begin
  update public.profiles
  set credits_balance = coalesce(credits_balance, 0) + in_delta
  where user_id = in_user_id
  returning credits_balance into new_bal;

  if not found then
    raise exception 'profile % not found', in_user_id using errcode = 'P0002';
  end if;

  return jsonb_build_object('new_balance', new_bal);
end;
$$;


ALTER FUNCTION "public"."increment_profile_credits"("in_user_id" "uuid", "in_delta" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insurance_queue_media"("_profile_id" "uuid", "_wa_id" "text", "_storage_path" "text", "_mime_type" "text", "_caption" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO public.insurance_media_queue (profile_id, wa_id, storage_path, mime_type, caption)
  VALUES (_profile_id, _wa_id, _storage_path, _mime_type, _caption);
END;
$$;


ALTER FUNCTION "public"."insurance_queue_media"("_profile_id" "uuid", "_wa_id" "text", "_storage_path" "text", "_mime_type" "text", "_caption" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."km"("a" "public"."geography", "b" "public"."geography") RETURNS numeric
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select (st_distance(a,b) / 1000.0)::numeric
$$;


ALTER FUNCTION "public"."km"("a" "public"."geography", "b" "public"."geography") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_driver_served"("viewer_e164" "text", "driver_uuid" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  insert into public.served_drivers(viewer_passenger_msisdn, driver_contact_id, expires_at)
  values (viewer_e164, driver_uuid, now() + interval '15 minutes')
  on conflict (viewer_passenger_msisdn, driver_contact_id)
  do update set expires_at = excluded.expires_at, created_at = now();
end;
$$;


ALTER FUNCTION "public"."mark_driver_served"("viewer_e164" "text", "driver_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_passenger_served"("viewer_e164" "text", "trip_uuid" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  insert into public.served_passengers(viewer_driver_msisdn, passenger_trip_id, expires_at)
  values (viewer_e164, trip_uuid, now() + interval '15 minutes')
  on conflict (viewer_driver_msisdn, passenger_trip_id)
  do update set expires_at = excluded.expires_at, created_at = now();
end;
$$;


ALTER FUNCTION "public"."mark_passenger_served"("viewer_e164" "text", "trip_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_served"("_viewer" "text", "_kind" "text", "_target_pk" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  if _kind = 'driver' then
    insert into public.served_drivers (viewer_passenger_msisdn, driver_contact_id, expires_at)
    values (_viewer, (_target_pk)::uuid, now() + interval '15 minutes')
    on conflict (viewer_passenger_msisdn, driver_contact_id)
    do update set expires_at = excluded.expires_at, created_at = now();

  elsif _kind = 'passenger' then
    insert into public.served_passengers (viewer_driver_msisdn, passenger_trip_id, expires_at)
    values (_viewer, (_target_pk)::uuid, now() + interval '15 minutes')
    on conflict (viewer_driver_msisdn, passenger_trip_id)
    do update set expires_at = excluded.expires_at, created_at = now();

  else
    -- businesses are never served; do nothing
    perform 1;
  end if;
end;
$$;


ALTER FUNCTION "public"."mark_served"("_viewer" "text", "_kind" "text", "_target_pk" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."marketplace_add_business"("_owner" "text", "_name" "text", "_description" "text", "_catalog" "text", "_lat" double precision, "_lng" double precision) RETURNS "uuid"
    LANGUAGE "sql"
    AS $$
  INSERT INTO public.businesses (owner_whatsapp, name, description, catalog_url, lat, lng)
  VALUES (_owner, _name, _description, _catalog, _lat, _lng)
  RETURNING id;
$$;


ALTER FUNCTION "public"."marketplace_add_business"("_owner" "text", "_name" "text", "_description" "text", "_catalog" "text", "_lat" double precision, "_lng" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_drivers_for_trip"("_trip_id" "uuid", "_limit" integer) RETURNS TABLE("trip_id" "uuid", "creator_user_id" "uuid", "distance_km" numeric, "created_at" timestamp with time zone)
    LANGUAGE "sql" STABLE
    AS $$
  with t as (
    select * from public.trips where id = _trip_id and role = 'passenger'
  )
  select d.id as trip_id,
         d.creator_user_id,
         (st_distance(d.pickup, t.pickup) / 1000.0)::numeric as distance_km,
         d.created_at
  from public.trips d, t
  where d.role = 'driver'
    and d.vehicle_type = t.vehicle_type
    and d.creator_user_id <> t.creator_user_id
    and d.pickup is not null and t.pickup is not null
    and st_dwithin(d.pickup, t.pickup, 10000) -- 10km
    and d.created_at > now() - interval '48 hours'
  order by distance_km asc, d.created_at desc
  limit greatest(1, coalesce(_limit, 10));
$$;


ALTER FUNCTION "public"."match_drivers_for_trip"("_trip_id" "uuid", "_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_drivers_for_trip"("_trip_id" "uuid", "_limit" integer DEFAULT 9, "_prefer_dropoff" boolean DEFAULT false) RETURNS TABLE("driver_user_id" "uuid", "whatsapp_e164" "text", "distance_km" double precision)
    LANGUAGE "sql"
    AS $$
  SELECT NULL::uuid AS driver_user_id,
         NULL::text AS whatsapp_e164,
         NULL::double precision AS distance_km
  WHERE false;
$$;


ALTER FUNCTION "public"."match_drivers_for_trip"("_trip_id" "uuid", "_limit" integer, "_prefer_dropoff" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_drivers_for_trip_v2"("_trip_id" "uuid", "_limit" integer DEFAULT 9, "_prefer_dropoff" boolean DEFAULT false, "_radius_m" integer DEFAULT NULL::integer, "_window_days" integer DEFAULT 30) RETURNS TABLE("trip_id" "uuid", "creator_user_id" "uuid", "whatsapp_e164" "text", "ref_code" "text", "distance_km" numeric, "drop_bonus_m" numeric, "pickup_text" "text", "dropoff_text" "text", "matched_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  base_trip RECORD;
  target_role text;
  window_start timestamptz;
  effective_radius integer;
BEGIN
  SELECT id, role, vehicle_type, pickup, dropoff, pickup_radius_m, dropoff_radius_m, created_at
  INTO base_trip
  FROM public.trips
  WHERE id = _trip_id;

  IF NOT FOUND OR base_trip.pickup IS NULL THEN
    RETURN;
  END IF;

  target_role := CASE WHEN base_trip.role = 'driver' THEN 'passenger' ELSE 'driver' END;
  window_start := timezone('utc', now()) - (_window_days || ' days')::interval;
  effective_radius := COALESCE(_radius_m, base_trip.pickup_radius_m, 20000);

  RETURN QUERY
  SELECT
    t.id,
    t.creator_user_id,
    p.whatsapp_e164,
    public.profile_ref_code(t.creator_user_id) AS ref_code,
    (ST_Distance(t.pickup, base_trip.pickup) / 1000.0)::numeric(10,3) AS distance_km,
    CASE
      WHEN _prefer_dropoff AND base_trip.dropoff IS NOT NULL AND t.dropoff IS NOT NULL
        THEN ST_Distance(t.dropoff, base_trip.dropoff)
      ELSE NULL
    END AS drop_bonus_m,
    t.pickup_text,
    t.dropoff_text,
    t.created_at AS matched_at
  FROM public.trips t
  JOIN public.profiles p ON p.user_id = t.creator_user_id
  WHERE t.status = 'open'
    AND t.id <> base_trip.id
    AND t.pickup IS NOT NULL
    AND t.role = target_role
    AND t.vehicle_type = base_trip.vehicle_type
    AND t.created_at >= window_start
    AND ST_DWithin(t.pickup, base_trip.pickup, effective_radius)
  ORDER BY
    ST_Distance(t.pickup, base_trip.pickup),
    CASE
      WHEN _prefer_dropoff AND base_trip.dropoff IS NOT NULL AND t.dropoff IS NOT NULL
        THEN ST_Distance(t.dropoff, base_trip.dropoff)
      ELSE NULL
    END,
    t.created_at DESC,
    t.id
  LIMIT _limit;
END;
$$;


ALTER FUNCTION "public"."match_drivers_for_trip_v2"("_trip_id" "uuid", "_limit" integer, "_prefer_dropoff" boolean, "_radius_m" integer, "_window_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_passengers_for_trip"("_trip_id" "uuid", "_limit" integer) RETURNS TABLE("trip_id" "uuid", "creator_user_id" "uuid", "distance_km" numeric, "created_at" timestamp with time zone)
    LANGUAGE "sql" STABLE
    AS $$
  with t as (
    select * from public.trips where id = _trip_id and role = 'driver'
  )
  select p.id as trip_id,
         p.creator_user_id,
         (st_distance(p.pickup, t.pickup) / 1000.0)::numeric as distance_km,
         p.created_at
  from public.trips p, t
  where p.role = 'passenger'
    and p.vehicle_type = t.vehicle_type
    and p.creator_user_id <> t.creator_user_id
    and p.pickup is not null and t.pickup is not null
    and st_dwithin(p.pickup, t.pickup, 10000)
    and p.created_at > now() - interval '48 hours'
  order by distance_km asc, p.created_at desc
  limit greatest(1, coalesce(_limit, 10));
$$;


ALTER FUNCTION "public"."match_passengers_for_trip"("_trip_id" "uuid", "_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_passengers_for_trip"("_trip_id" "uuid", "_limit" integer DEFAULT 9, "_prefer_dropoff" boolean DEFAULT false) RETURNS TABLE("passenger_user_id" "uuid", "whatsapp_e164" "text", "distance_km" double precision)
    LANGUAGE "sql"
    AS $$
  SELECT NULL::uuid AS passenger_user_id,
         NULL::text AS whatsapp_e164,
         NULL::double precision AS distance_km
  WHERE false;
$$;


ALTER FUNCTION "public"."match_passengers_for_trip"("_trip_id" "uuid", "_limit" integer, "_prefer_dropoff" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_passengers_for_trip_v2"("_trip_id" "uuid", "_limit" integer DEFAULT 9, "_prefer_dropoff" boolean DEFAULT false, "_radius_m" integer DEFAULT NULL::integer, "_window_days" integer DEFAULT 30) RETURNS TABLE("trip_id" "uuid", "creator_user_id" "uuid", "whatsapp_e164" "text", "ref_code" "text", "distance_km" numeric, "drop_bonus_m" numeric, "pickup_text" "text", "dropoff_text" "text", "matched_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  base_trip RECORD;
  target_role text;
  window_start timestamptz;
  effective_radius integer;
BEGIN
  SELECT id, role, vehicle_type, pickup, dropoff, pickup_radius_m, dropoff_radius_m, created_at
  INTO base_trip
  FROM public.trips
  WHERE id = _trip_id;

  IF NOT FOUND OR base_trip.pickup IS NULL THEN
    RETURN;
  END IF;

  target_role := CASE WHEN base_trip.role = 'driver' THEN 'passenger' ELSE 'driver' END;
  window_start := timezone('utc', now()) - (_window_days || ' days')::interval;
  effective_radius := COALESCE(_radius_m, base_trip.pickup_radius_m, 20000);

  RETURN QUERY
  SELECT
    t.id,
    t.creator_user_id,
    p.whatsapp_e164,
    public.profile_ref_code(t.creator_user_id) AS ref_code,
    (ST_Distance(t.pickup, base_trip.pickup) / 1000.0)::numeric(10,3) AS distance_km,
    CASE
      WHEN _prefer_dropoff AND base_trip.dropoff IS NOT NULL AND t.dropoff IS NOT NULL
        THEN ST_Distance(t.dropoff, base_trip.dropoff)
      ELSE NULL
    END AS drop_bonus_m,
    t.pickup_text,
    t.dropoff_text,
    t.created_at AS matched_at
  FROM public.trips t
  JOIN public.profiles p ON p.user_id = t.creator_user_id
  WHERE t.status = 'open'
    AND t.id <> base_trip.id
    AND t.pickup IS NOT NULL
    AND t.role = target_role
    AND t.vehicle_type = base_trip.vehicle_type
    AND t.created_at >= window_start
    AND ST_DWithin(t.pickup, base_trip.pickup, effective_radius)
  ORDER BY
    ST_Distance(t.pickup, base_trip.pickup),
    CASE
      WHEN _prefer_dropoff AND base_trip.dropoff IS NOT NULL AND t.dropoff IS NOT NULL
        THEN ST_Distance(t.dropoff, base_trip.dropoff)
      ELSE NULL
    END,
    t.created_at DESC,
    t.id
  LIMIT _limit;
END;
$$;


ALTER FUNCTION "public"."match_passengers_for_trip_v2"("_trip_id" "uuid", "_limit" integer, "_prefer_dropoff" boolean, "_radius_m" integer, "_window_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."nearby_businesses"("_lat" double precision, "_lng" double precision, "_viewer" "text", "_limit" integer DEFAULT 10) RETURNS TABLE("id" "uuid", "owner_whatsapp" "text", "name" "text", "description" "text", "location_text" "text", "distance_km" double precision)
    LANGUAGE "sql"
    AS $$
  SELECT b.id,
         b.owner_whatsapp,
         b.name,
         b.description,
         b.location_text,
         CASE
           WHEN b.lat IS NULL OR b.lng IS NULL THEN NULL
           ELSE public.haversine_km(b.lat, b.lng, _lat, _lng)
         END AS distance_km
  FROM public.businesses b
  WHERE b.is_active = true
  ORDER BY distance_km NULLS LAST, b.created_at DESC
  LIMIT COALESCE(_limit, 10);
$$;


ALTER FUNCTION "public"."nearby_businesses"("_lat" double precision, "_lng" double precision, "_viewer" "text", "_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."nearby_drivers"("_lat" double precision, "_lon" double precision, "_viewer" "text", "_limit" integer) RETURNS TABLE("driver_user_id" "uuid", "whatsapp_e164" "text", "distance_km" numeric, "last_seen" timestamp with time zone)
    LANGUAGE "sql" STABLE
    AS $$
  select
    d.user_id as driver_user_id,
    p.whatsapp_e164,
    (st_distance(
       d.location,
       st_setsrid(st_point(_lon,_lat), 4326)::geography
     ) / 1000.0)::numeric as distance_km,
    d.last_seen
  from public.driver_status d
  join public.profiles p on p.user_id = d.user_id
  where d.online = true
    and d.location is not null
    and not exists (
      select 1
      from public.served_drivers sd
      where sd.viewer_passenger_msisdn = _viewer
        and sd.driver_contact_id      = d.user_id
        and sd.expires_at > now()
    )
  order by distance_km asc, d.last_seen desc
  limit greatest(1, coalesce(_limit, 10));
$$;


ALTER FUNCTION "public"."nearby_drivers"("_lat" double precision, "_lon" double precision, "_viewer" "text", "_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."nearby_drivers_by_vehicle"("_lat" double precision, "_lon" double precision, "_viewer" "text", "_vehicle" "text", "_limit" integer DEFAULT 10) RETURNS TABLE("driver_user_id" "text", "whatsapp_e164" "text", "distance_km" double precision, "last_seen" timestamp with time zone)
    LANGUAGE "sql" STABLE
    AS $$
  WITH prm AS (
    SELECT
      ST_SetSRID(ST_MakePoint(_lon, _lat), 4326)::geography AS gpt,
      NULLIF(btrim(lower(_vehicle)), '') AS vtype,
      GREATEST(COALESCE(_limit, 10), 1) AS lim
  ),
  driver_open AS (
    -- Most recent open driver trip per driver
    SELECT DISTINCT ON (t.creator_user_id)
      t.creator_user_id,
      t.pickup,
      t.vehicle_type,
      t.created_at AS last_seen
    FROM public.trips t
    WHERE t.status = 'open'
      AND t.role = 'driver'
      AND t.pickup IS NOT NULL
    ORDER BY t.creator_user_id, t.created_at DESC
  )
  SELECT
    d.creator_user_id::text AS driver_user_id,
    p.whatsapp_e164         AS whatsapp_e164,
    ST_Distance(d.pickup::geography, prm.gpt) / 1000.0 AS distance_km,  -- km
    d.last_seen
  FROM driver_open d
  JOIN prm ON TRUE
  JOIN public.profiles p
    ON p.user_id = d.creator_user_id
  LEFT JOIN public.served_drivers sd
    ON sd.viewer_passenger_msisdn = _viewer
   AND sd.driver_contact_id::text = d.creator_user_id::text   -- robust across uuid/text
   AND sd.expires_at > now()
  WHERE
        (prm.vtype IS NULL OR lower(COALESCE(d.vehicle_type, '')) = prm.vtype)
    AND (p.whatsapp_e164 IS DISTINCT FROM _viewer)
    AND sd.viewer_passenger_msisdn IS NULL
  ORDER BY
    ST_Distance(d.pickup::geography, prm.gpt) ASC,
    d.last_seen DESC
  LIMIT (SELECT lim FROM prm);
$$;


ALTER FUNCTION "public"."nearby_drivers_by_vehicle"("_lat" double precision, "_lon" double precision, "_viewer" "text", "_vehicle" "text", "_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."nearby_passengers"("_lat" double precision, "_lon" double precision, "_viewer" "text", "_limit" integer) RETURNS TABLE("trip_id" "uuid", "creator_user_id" "uuid", "distance_km" numeric, "created_at" timestamp with time zone, "whatsapp_e164" "text")
    LANGUAGE "sql" STABLE
    AS $$
  select
    t.id as trip_id,
    t.creator_user_id,
    (st_distance(
       t.pickup,
       st_setsrid(st_point(_lon,_lat), 4326)::geography
     ) / 1000.0)::numeric as distance_km,
    t.created_at,
    p.whatsapp_e164
  from public.trips t
  join public.profiles p on p.user_id = t.creator_user_id
  where t.role = 'passenger'
    and t.status = 'open'
    and t.pickup is not null
    and not exists (
      select 1
      from public.served_passengers sp
      where sp.viewer_driver_msisdn = _viewer
        and sp.passenger_trip_id    = t.id
        and sp.expires_at > now()
    )
  order by distance_km asc, t.created_at desc
  limit greatest(1, coalesce(_limit, 10));
$$;


ALTER FUNCTION "public"."nearby_passengers"("_lat" double precision, "_lon" double precision, "_viewer" "text", "_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."nearby_passengers_by_vehicle"("_lat" double precision, "_lon" double precision, "_viewer" "text", "_vehicle" "text", "_limit" integer DEFAULT 10) RETURNS TABLE("trip_id" "text", "creator_user_id" "text", "whatsapp_e164" "text", "distance_km" double precision, "created_at" timestamp with time zone)
    LANGUAGE "sql" STABLE
    AS $$
  WITH prm AS (
    SELECT
      ST_SetSRID(ST_MakePoint(_lon, _lat), 4326)::geography AS gpt,
      NULLIF(btrim(lower(_vehicle)), '') AS vtype,
      GREATEST(COALESCE(_limit, 10), 1) AS lim
  )
  SELECT
    t.id::text                      AS trip_id,
    t.creator_user_id::text         AS creator_user_id,
    p.whatsapp_e164                 AS whatsapp_e164,
    ST_Distance(t.pickup::geography, prm.gpt) / 1000.0 AS distance_km,  -- km
    t.created_at
  FROM public.trips t
  JOIN prm ON TRUE
  JOIN public.profiles p
    ON p.user_id = t.creator_user_id
  LEFT JOIN public.served_passengers sp
    ON sp.viewer_driver_msisdn = _viewer
   AND sp.passenger_trip_id::text = t.id::text   -- robust across uuid/text
   AND sp.expires_at > now()
  WHERE
        t.status = 'open'
    AND t.role   = 'passenger'
    AND t.pickup IS NOT NULL
    AND (prm.vtype IS NULL OR lower(COALESCE(t.vehicle_type, '')) = prm.vtype)
    AND (p.whatsapp_e164 IS DISTINCT FROM _viewer)
    AND sp.viewer_driver_msisdn IS NULL
  ORDER BY
    ST_Distance(t.pickup::geography, prm.gpt) ASC,
    t.created_at DESC
  LIMIT (SELECT lim FROM prm);
$$;


ALTER FUNCTION "public"."nearby_passengers_by_vehicle"("_lat" double precision, "_lon" double precision, "_viewer" "text", "_vehicle" "text", "_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."on_menu_publish_refresh"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  PERFORM public.refresh_menu_items_snapshot();
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."on_menu_publish_refresh"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."orders_set_defaults"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.order_code IS NULL OR NEW.order_code = '' THEN
    NEW.order_code := public.generate_order_code();
  END IF;
  IF NEW.created_at IS NULL THEN
    NEW.created_at := timezone('utc', now());
  END IF;
  IF NEW.updated_at IS NULL THEN
    NEW.updated_at := timezone('utc', now());
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."orders_set_defaults"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."profile_ref_code"("_profile_id" "uuid") RETURNS "text"
    LANGUAGE "sql"
    AS $$
  SELECT COALESCE(metadata->>'ref_code',
                  upper(substring(md5(COALESCE(whatsapp_e164, '')) FROM 1 FOR 6)))
  FROM public.profiles
  WHERE user_id = _profile_id;
$$;


ALTER FUNCTION "public"."profile_ref_code"("_profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."profile_wa"("_profile_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT whatsapp_e164 FROM public.profiles WHERE user_id = _profile_id;
$$;


ALTER FUNCTION "public"."profile_wa"("_profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."promote_draft_menu"("_bar_id" "uuid", "_draft_menu_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_draft public.menus%ROWTYPE;
  v_new_menu_id uuid;
  v_next_version integer;
BEGIN
  -- Locate the draft to promote
  IF _draft_menu_id IS NOT NULL THEN
    SELECT * INTO v_draft
    FROM public.menus
    WHERE id = _draft_menu_id
      AND bar_id = _bar_id
      AND status = 'draft'
    FOR UPDATE;
  ELSE
    SELECT * INTO v_draft
    FROM public.menus
    WHERE bar_id = _bar_id
      AND status = 'draft'
    ORDER BY updated_at DESC, created_at DESC
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Draft menu not found for bar %', _bar_id USING ERRCODE = 'P0002';
  END IF;

  -- Pick the next semantic version for the published copy
  SELECT COALESCE(MAX(version), 0) + 1 INTO v_next_version
  FROM public.menus
  WHERE bar_id = _bar_id;

  v_new_menu_id := gen_random_uuid();

  INSERT INTO public.menus (
    id,
    bar_id,
    version,
    status,
    source,
    source_file_ids,
    created_by,
    created_at,
    updated_at,
    published_at
  )
  VALUES (
    v_new_menu_id,
    _bar_id,
    v_next_version,
    'published',
    v_draft.source,
    v_draft.source_file_ids,
    v_draft.created_by,
    timezone('utc', now()),
    timezone('utc', now()),
    timezone('utc', now())
  );

  -- Map categories so subcategory relations can be preserved
  CREATE TEMP TABLE tmp_category_map (old_id uuid PRIMARY KEY, new_id uuid NOT NULL) ON COMMIT DROP;
  INSERT INTO tmp_category_map (old_id, new_id)
  SELECT id, gen_random_uuid()
  FROM public.categories
  WHERE menu_id = v_draft.id;

  INSERT INTO public.categories (
    id,
    bar_id,
    menu_id,
    parent_category_id,
    name,
    sort_order,
    is_deleted,
    created_at,
    updated_at
  )
  SELECT
    map.new_id,
    c.bar_id,
    v_new_menu_id,
    CASE
      WHEN c.parent_category_id IS NULL THEN NULL
      ELSE (SELECT new_id FROM tmp_category_map WHERE old_id = c.parent_category_id)
    END,
    c.name,
    c.sort_order,
    c.is_deleted,
    timezone('utc', now()),
    timezone('utc', now())
  FROM public.categories c
  JOIN tmp_category_map map ON map.old_id = c.id
  WHERE c.menu_id = v_draft.id;

  -- Map items for reuse with modifiers
  CREATE TEMP TABLE tmp_item_map (old_id uuid PRIMARY KEY, new_id uuid NOT NULL) ON COMMIT DROP;
  INSERT INTO tmp_item_map (old_id, new_id)
  SELECT id, gen_random_uuid()
  FROM public.items
  WHERE menu_id = v_draft.id;

  INSERT INTO public.items (
    id,
    bar_id,
    menu_id,
    category_id,
    name,
    short_description,
    price_minor,
    currency,
    flags,
    is_available,
    sort_order,
    metadata,
    created_at,
    updated_at
  )
  SELECT
    map.new_id,
    i.bar_id,
    v_new_menu_id,
    CASE
      WHEN i.category_id IS NULL THEN NULL
      ELSE (SELECT new_id FROM tmp_category_map WHERE old_id = i.category_id)
    END,
    i.name,
    i.short_description,
    i.price_minor,
    i.currency,
    i.flags,
    i.is_available,
    i.sort_order,
    i.metadata,
    timezone('utc', now()),
    timezone('utc', now())
  FROM public.items i
  JOIN tmp_item_map map ON map.old_id = i.id
  WHERE i.menu_id = v_draft.id;

  INSERT INTO public.item_modifiers (
    id,
    item_id,
    name,
    modifier_type,
    is_required,
    options,
    sort_order,
    created_at,
    updated_at
  )
  SELECT
    gen_random_uuid(),
    map.new_id,
    m.name,
    m.modifier_type,
    m.is_required,
    m.options,
    m.sort_order,
    timezone('utc', now()),
    timezone('utc', now())
  FROM public.item_modifiers m
  JOIN tmp_item_map map ON map.old_id = m.item_id;

  -- Archive previous published versions
  UPDATE public.menus
  SET status = 'archived', updated_at = timezone('utc', now())
  WHERE bar_id = _bar_id
    AND status = 'published'
    AND id <> v_new_menu_id;

  -- Ensure published snapshot stays in sync
  PERFORM public.refresh_menu_items_snapshot();

  RETURN v_new_menu_id;
END;
$$;


ALTER FUNCTION "public"."promote_draft_menu"("_bar_id" "uuid", "_draft_menu_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."purge_expired_served"() RETURNS integer
    LANGUAGE "sql"
    AS $$
  with d1 as (
    delete from public.served_drivers    where expires_at <= now() returning 1
  ), d2 as (
    delete from public.served_passengers where expires_at <= now() returning 1
  )
  select coalesce((select count(*) from d1),0) + coalesce((select count(*) from d2),0);
$$;


ALTER FUNCTION "public"."purge_expired_served"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recent_businesses_near"("in_lat" double precision, "in_lng" double precision, "in_category_id" integer, "in_radius_km" numeric, "in_max" integer) RETURNS TABLE("business_id" bigint, "name" "text", "owner_user_id" "uuid", "created_at" timestamp with time zone)
    LANGUAGE "sql" STABLE
    AS $$
  select b.id, b.name, b.owner_user_id, b.created_at
  from businesses b
  where (in_category_id is null or b.category_id = in_category_id)
    and st_dwithin(
      b.location::geography,
      st_setsrid(st_makepoint(in_lng, in_lat), 4326),
      in_radius_km * 1000
    )
  order by b.created_at desc
  limit greatest(in_max, 1);
$$;


ALTER FUNCTION "public"."recent_businesses_near"("in_lat" double precision, "in_lng" double precision, "in_category_id" integer, "in_radius_km" numeric, "in_max" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recent_drivers_near"("in_lat" double precision, "in_lng" double precision, "in_vehicle_type" "text", "in_radius_km" double precision, "in_max" integer) RETURNS TABLE("ref_code" "text", "whatsapp_e164" "text", "last_seen" timestamp with time zone)
    LANGUAGE "sql"
    AS $$
  SELECT
    public.profile_ref_code(ds.user_id) AS ref_code,
    p.whatsapp_e164,
    ds.last_seen
  FROM public.driver_status ds
  JOIN public.profiles p ON p.user_id = ds.user_id
  WHERE ds.online = true
    AND p.whatsapp_e164 IS NOT NULL
    AND (in_vehicle_type IS NULL OR ds.vehicle_type = in_vehicle_type)
    AND ds.lat IS NOT NULL AND ds.lng IS NOT NULL
    AND (
      in_radius_km IS NULL
      OR public.haversine_km(ds.lat, ds.lng, in_lat, in_lng) <= in_radius_km
    )
  ORDER BY ds.last_seen DESC
  LIMIT COALESCE(in_max, 9);
$$;


ALTER FUNCTION "public"."recent_drivers_near"("in_lat" double precision, "in_lng" double precision, "in_vehicle_type" "text", "in_radius_km" double precision, "in_max" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recent_drivers_near"("in_lat" double precision, "in_lng" double precision, "in_vehicle_type" "text", "in_radius_km" numeric, "in_max" integer) RETURNS TABLE("ref_code" character, "whatsapp_e164" "text", "last_seen" timestamp with time zone, "user_id" "uuid")
    LANGUAGE "sql" STABLE
    AS $$
  select p.ref_code, p.whatsapp_e164, d.last_seen, d.user_id
  from driver_status d
  join profiles p on p.user_id = d.user_id
  where d.online = true
    and (in_vehicle_type is null or d.vehicle_type = in_vehicle_type)
    and d.location is not null
    and st_dwithin(d.location::geography,
                   st_setsrid(st_makepoint(in_lng, in_lat),4326),
                   in_radius_km * 1000)
  order by d.last_seen desc
  limit greatest(in_max,1);
$$;


ALTER FUNCTION "public"."recent_drivers_near"("in_lat" double precision, "in_lng" double precision, "in_vehicle_type" "text", "in_radius_km" numeric, "in_max" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recent_passenger_trips_near"("in_lat" double precision, "in_lng" double precision, "in_vehicle_type" "text", "in_radius_km" double precision, "in_max" integer) RETURNS TABLE("trip_id" "uuid", "ref_code" "text", "whatsapp_e164" "text", "created_at" timestamp with time zone)
    LANGUAGE "sql"
    AS $$
  SELECT
    t.id,
    public.profile_ref_code(t.creator_user_id) AS ref_code,
    p.whatsapp_e164,
    t.created_at
  FROM public.trips t
  JOIN public.profiles p ON p.user_id = t.creator_user_id
  WHERE t.role = 'passenger'
    AND p.whatsapp_e164 IS NOT NULL
    AND (in_vehicle_type IS NULL OR t.vehicle_type = in_vehicle_type)
    AND t.pickup_lat IS NOT NULL AND t.pickup_lng IS NOT NULL
    AND (
      in_radius_km IS NULL
      OR public.haversine_km(t.pickup_lat, t.pickup_lng, in_lat, in_lng) <= in_radius_km
    )
  ORDER BY t.created_at DESC
  LIMIT COALESCE(in_max, 9);
$$;


ALTER FUNCTION "public"."recent_passenger_trips_near"("in_lat" double precision, "in_lng" double precision, "in_vehicle_type" "text", "in_radius_km" double precision, "in_max" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recent_passenger_trips_near"("in_lat" double precision, "in_lng" double precision, "in_vehicle_type" "text", "in_radius_km" numeric, "in_max" integer) RETURNS TABLE("trip_id" bigint, "creator_user_id" "uuid", "created_at" timestamp with time zone)
    LANGUAGE "sql" STABLE
    AS $$
  select t.id, t.creator_user_id, t.created_at
  from trips t
  where t.role='passenger' and t.status='open'
    and (in_vehicle_type is null or t.vehicle_type=in_vehicle_type)
    and st_dwithin(t.pickup::geography,
                   st_setsrid(st_makepoint(in_lng, in_lat),4326),
                   in_radius_km * 1000)
  order by t.created_at desc
  limit greatest(in_max,1);
$$;


ALTER FUNCTION "public"."recent_passenger_trips_near"("in_lat" double precision, "in_lng" double precision, "in_vehicle_type" "text", "in_radius_km" numeric, "in_max" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_menu_items_snapshot"() RETURNS "void"
    LANGUAGE "sql"
    AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.menu_items_snapshot;
$$;


ALTER FUNCTION "public"."refresh_menu_items_snapshot"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."round"("value" double precision, "ndigits" integer) RETURNS numeric
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select round((value)::numeric, ndigits);
$$;


ALTER FUNCTION "public"."round"("value" double precision, "ndigits" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_apply_delta"("_user_id" "uuid", "_delta" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO public.wallets (user_id, balance_tokens)
  VALUES (_user_id, COALESCE(_delta, 0))
  ON CONFLICT (user_id)
  DO UPDATE SET balance_tokens = public.wallets.balance_tokens + COALESCE(_delta, 0), updated_at = timezone('utc', now());
END;
$$;


ALTER FUNCTION "public"."wallet_apply_delta"("_user_id" "uuid", "_delta" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_apply_delta"("p_user_id" "uuid", "p_delta" integer, "p_type" "text", "p_meta" "jsonb" DEFAULT '{}'::"jsonb") RETURNS TABLE("balance" integer, "ledger_id" bigint)
    LANGUAGE "plpgsql"
    AS $$
declare
  new_balance integer;
  inserted_id bigint;
begin
  insert into public.wallets(user_id, balance_tokens, updated_at)
  values (p_user_id, 0, now())
  on conflict (user_id) do nothing;

  insert into public.wallet_ledger(user_id, delta_tokens, type, meta)
  values (p_user_id, p_delta, p_type, coalesce(p_meta, '{}'::jsonb))
  returning id into inserted_id;

  update public.wallets
  set balance_tokens = balance_tokens + p_delta,
      updated_at = now()
  where user_id = p_user_id
  returning balance_tokens into new_balance;

  return query select coalesce(new_balance, 0), inserted_id;
end;
$$;


ALTER FUNCTION "public"."wallet_apply_delta"("p_user_id" "uuid", "p_delta" integer, "p_type" "text", "p_meta" "jsonb") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallet_earn_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text",
    "description" "text",
    "reward_tokens" integer,
    "referral_code" "text",
    "share_text" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."wallet_earn_actions" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_earn_actions"("_profile_id" "uuid", "_limit" integer DEFAULT 10) RETURNS SETOF "public"."wallet_earn_actions"
    LANGUAGE "sql"
    AS $$
  SELECT * FROM public.wallet_earn_actions
  WHERE is_active = true
  ORDER BY created_at DESC
  LIMIT COALESCE(_limit, 10);
$$;


ALTER FUNCTION "public"."wallet_earn_actions"("_profile_id" "uuid", "_limit" integer) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallet_redeem_options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text",
    "description" "text",
    "cost_tokens" integer,
    "instructions" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."wallet_redeem_options" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_redeem_options"("_profile_id" "uuid") RETURNS SETOF "public"."wallet_redeem_options"
    LANGUAGE "sql"
    AS $$
  SELECT * FROM public.wallet_redeem_options WHERE is_active = true ORDER BY created_at DESC;
$$;


ALTER FUNCTION "public"."wallet_redeem_options"("_profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_summary"("_profile_id" "uuid") RETURNS TABLE("balance_minor" integer, "pending_minor" integer, "currency" "text", "tokens" integer)
    LANGUAGE "sql"
    AS $$
  SELECT balance_minor, pending_minor, currency, tokens
  FROM public.wallet_accounts
  WHERE profile_id = _profile_id;
$$;


ALTER FUNCTION "public"."wallet_summary"("_profile_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallet_promoters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "display_name" "text",
    "whatsapp" "text",
    "tokens" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."wallet_promoters" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_top_promoters"("_limit" integer DEFAULT 9) RETURNS SETOF "public"."wallet_promoters"
    LANGUAGE "sql"
    AS $$
  SELECT * FROM public.wallet_promoters ORDER BY tokens DESC, updated_at DESC LIMIT COALESCE(_limit, 9);
$$;


ALTER FUNCTION "public"."wallet_top_promoters"("_limit" integer) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallet_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid",
    "amount_minor" integer NOT NULL,
    "currency" "text" DEFAULT 'RWF'::"text" NOT NULL,
    "direction" "text" DEFAULT 'credit'::"text" NOT NULL,
    "description" "text",
    "occurred_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."wallet_transactions" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_transactions_recent"("_profile_id" "uuid", "_limit" integer DEFAULT 5) RETURNS SETOF "public"."wallet_transactions"
    LANGUAGE "sql"
    AS $$
  SELECT * FROM public.wallet_transactions
  WHERE profile_id = _profile_id
  ORDER BY occurred_at DESC
  LIMIT COALESCE(_limit, 5);
$$;


ALTER FUNCTION "public"."wallet_transactions_recent"("_profile_id" "uuid", "_limit" integer) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_alert_prefs" (
    "wa_id" "text" NOT NULL,
    "want_alerts" boolean DEFAULT true NOT NULL,
    "channels" "text"[] DEFAULT ARRAY['whatsapp'::"text"] NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "admin_user_id" "uuid",
    "alert_key" "text",
    "enabled" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."admin_alert_prefs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_wa" "text",
    "action" "text" NOT NULL,
    "target" "text",
    "details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "admin_user_id" "uuid",
    "target_id" "text",
    "before" "jsonb",
    "after" "jsonb",
    "reason" "text"
);


ALTER TABLE "public"."admin_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_pin_sessions" (
    "session_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "wa_id" "text" NOT NULL,
    "unlocked_until" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."admin_pin_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_sessions" (
    "wa_id" "text" NOT NULL,
    "pin_ok_until" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."admin_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_submissions" (
    "reference" "text" NOT NULL,
    "applicant_name" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "submitted_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."admin_submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_config" (
    "id" integer DEFAULT 1 NOT NULL,
    "insurance_admin_numbers" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tokens_per_referral" integer DEFAULT 10 NOT NULL,
    "referral_daily_cap" integer DEFAULT 0 NOT NULL,
    "welcome_bonus_tokens" integer DEFAULT 0 NOT NULL,
    "wallet_redeem_catalog" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "referral_short_domain" "text",
    "referral_redeem_rules" "text",
    "openai_api_key" "text",
    "search_radius_km" double precision DEFAULT 10,
    "max_results" integer DEFAULT 9,
    "subscription_price" numeric(10,2) DEFAULT 0,
    "wa_bot_number_e164" "text",
    "admin_numbers" "text"[] DEFAULT ARRAY[]::"text"[],
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "momo_qr_logo_url" "text",
    "redeem_catalog" "jsonb",
    "admin_pin_required" boolean DEFAULT false NOT NULL,
    "admin_pin_hash" "text"
);


ALTER TABLE "public"."app_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor" "text",
    "actor_type" "text",
    "action" "text" NOT NULL,
    "target_table" "text",
    "target_id" "text",
    "diff" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bar_numbers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bar_id" "uuid" NOT NULL,
    "number_e164" "text" NOT NULL,
    "role" "public"."bar_contact_role" DEFAULT 'staff'::"public"."bar_contact_role" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "verified_at" timestamp with time zone,
    "added_by" "text",
    "last_seen_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "verification_code_hash" "text",
    "verification_expires_at" timestamp with time zone,
    "verification_attempts" integer DEFAULT 0 NOT NULL,
    "invited_at" timestamp with time zone
);


ALTER TABLE "public"."bar_numbers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bar_settings" (
    "bar_id" "uuid" NOT NULL,
    "allow_direct_customer_chat" boolean DEFAULT false NOT NULL,
    "order_auto_ack" boolean DEFAULT false NOT NULL,
    "default_prep_minutes" integer DEFAULT 0 NOT NULL,
    "service_charge_pct" numeric(5,2) DEFAULT 0 NOT NULL,
    "payment_instructions" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "bar_settings_default_prep_minutes_check" CHECK ((("default_prep_minutes" >= 0) AND ("default_prep_minutes" <= 240))),
    CONSTRAINT "bar_settings_service_charge_pct_check" CHECK ((("service_charge_pct" >= (0)::numeric) AND ("service_charge_pct" <= (25)::numeric)))
);


ALTER TABLE "public"."bar_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bar_tables" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bar_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "qr_payload" "text" NOT NULL,
    "token_nonce" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "last_scan_at" timestamp with time zone
);


ALTER TABLE "public"."bar_tables" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bars" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "location_text" "text",
    "country" "text",
    "city_area" "text",
    "currency" "text",
    "momo_code" "text",
    "is_active" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."bars" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."basket_contributions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "basket_id" "uuid" NOT NULL,
    "contributor_user_id" "uuid" NOT NULL,
    "amount_rwf" integer NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "approved_at" timestamp with time zone,
    "approver_user_id" "uuid",
    "wa_message_id" "text",
    "amount_minor" integer,
    "currency" "text" DEFAULT 'RWF'::"text" NOT NULL,
    "momo_reference" "text",
    "source" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "profile_id" "uuid",
    CONSTRAINT "basket_contributions_amount_rwf_check" CHECK (("amount_rwf" > 0)),
    CONSTRAINT "basket_contributions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);

ALTER TABLE ONLY "public"."basket_contributions" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."basket_contributions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."basket_joins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "basket_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "via_token" boolean,
    "source" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "whatsapp" "text",
    "invite_source" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "processed_at" timestamp with time zone
);

ALTER TABLE ONLY "public"."basket_joins" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."basket_joins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."basket_members" (
    "basket_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "member_code" "text",
    "total_contributed" numeric,
    "whatsapp" "text",
    "profile_id" "uuid",
    "joined_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "joined_via" "text",
    "join_reference" "text"
);

ALTER TABLE ONLY "public"."basket_members" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."basket_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."baskets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "type" "public"."basket_type" NOT NULL,
    "status" "public"."basket_status" DEFAULT 'draft'::"public"."basket_status" NOT NULL,
    "public_slug" "text",
    "creator_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "momo_payee_number" "text",
    "momo_ussd_code" "text",
    "momo_target" "text",
    "momo_is_code" boolean,
    "owner_profile_id" "uuid",
    "owner_whatsapp" "text",
    "is_public" boolean DEFAULT false NOT NULL,
    "goal_minor" integer,
    "currency" "text" DEFAULT 'RWF'::"text" NOT NULL,
    "share_token" "text",
    "lat" double precision,
    "lng" double precision,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "creator_user_id" "uuid",
    "momo_number_or_code" "text",
    "join_token" "text",
    "join_token_revoked" boolean DEFAULT false NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "baskets_type_check" CHECK ((("type")::"text" = ANY (ARRAY['public'::"text", 'private'::"text"])))
);

ALTER TABLE ONLY "public"."baskets" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."baskets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."businesses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_whatsapp" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "geo" "public"."geography"(Point,4326),
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "category_id" bigint,
    "catalog_url" "text",
    "location_text" "text",
    "lat" double precision,
    "lng" double precision,
    "owner_user_id" "uuid",
    "location" "public"."geography"(Point,4326),
    "status" "text",
    CONSTRAINT "businesses_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'hidden'::"text"])))
);


ALTER TABLE "public"."businesses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaign_recipients" (
    "id" bigint NOT NULL,
    "campaign_id" bigint,
    "contact_id" bigint,
    "msisdn_e164" "text" NOT NULL,
    "send_allowed" boolean DEFAULT true,
    "window_24h_open" boolean DEFAULT false
);


ALTER TABLE "public"."campaign_recipients" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."campaign_recipients_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."campaign_recipients_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."campaign_recipients_id_seq" OWNED BY "public"."campaign_recipients"."id";



CREATE TABLE IF NOT EXISTS "public"."campaigns" (
    "id" bigint NOT NULL,
    "title" "text" NOT NULL,
    "template_id" bigint,
    "message_kind" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "target_audience" "jsonb" NOT NULL,
    "scheduled_at" timestamp with time zone,
    "time_zone" "text" DEFAULT 'Africa/Kigali'::"text",
    "status" "text" DEFAULT 'DRAFT'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "campaigns_message_kind_check" CHECK (("message_kind" = ANY (ARRAY['TEMPLATE'::"text", 'TEXT'::"text", 'INTERACTIVE'::"text"]))),
    CONSTRAINT "campaigns_status_check" CHECK (("status" = ANY (ARRAY['DRAFT'::"text", 'QUEUED'::"text", 'SENDING'::"text", 'PAUSED'::"text", 'COMPLETED'::"text", 'FAILED'::"text"])))
);


ALTER TABLE "public"."campaigns" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."campaigns_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."campaigns_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."campaigns_id_seq" OWNED BY "public"."campaigns"."id";



CREATE TABLE IF NOT EXISTS "public"."cart_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cart_id" "uuid" NOT NULL,
    "item_id" "uuid",
    "item_name" "text" NOT NULL,
    "item_snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "qty" integer NOT NULL,
    "unit_price_minor" integer NOT NULL,
    "flags_snapshot" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "modifiers_snapshot" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "line_total_minor" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "cart_items_line_total_minor_check" CHECK (("line_total_minor" >= 0)),
    CONSTRAINT "cart_items_qty_check" CHECK (("qty" >= 1)),
    CONSTRAINT "cart_items_unit_price_minor_check" CHECK (("unit_price_minor" >= 0))
);


ALTER TABLE "public"."cart_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."carts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bar_id" "uuid" NOT NULL,
    "table_label" "text",
    "status" "public"."cart_status" DEFAULT 'open'::"public"."cart_status" NOT NULL,
    "subtotal_minor" integer DEFAULT 0 NOT NULL,
    "service_charge_minor" integer DEFAULT 0 NOT NULL,
    "total_minor" integer DEFAULT 0 NOT NULL,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "profile_id" "uuid" NOT NULL
);


ALTER TABLE "public"."carts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bar_id" "uuid" NOT NULL,
    "menu_id" "uuid" NOT NULL,
    "parent_category_id" "uuid",
    "name" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_sessions" (
    "user_id" "text" NOT NULL,
    "state" "jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."chat_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_state" (
    "user_id" "uuid" NOT NULL,
    "state" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "state_key" "text"
);


ALTER TABLE "public"."chat_state" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contacts" (
    "id" bigint NOT NULL,
    "msisdn_e164" "text" NOT NULL,
    "full_name" "text",
    "sector" "text",
    "city" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "attributes" "jsonb" DEFAULT '{}'::"jsonb",
    "opted_in" boolean DEFAULT false NOT NULL,
    "opt_in_source" "text",
    "opt_in_ts" timestamp with time zone,
    "opted_out" boolean DEFAULT false NOT NULL,
    "opt_out_ts" timestamp with time zone,
    "last_inbound_ts" timestamp with time zone,
    "last_inbound_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."contacts" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."contacts_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."contacts_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."contacts_id_seq" OWNED BY "public"."contacts"."id";



CREATE TABLE IF NOT EXISTS "public"."contributions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "basket_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "amount" numeric,
    "currency" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."contributions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."driver_status" (
    "user_id" "uuid" NOT NULL,
    "vehicle_type" "text",
    "location" "public"."geography"(Point,4326),
    "last_seen" timestamp with time zone,
    "online" boolean DEFAULT true,
    "lat" double precision,
    "lng" double precision,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."driver_status" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."drivers_available" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "whatsapp" "text" NOT NULL,
    "vehicle_type" "text",
    "geo" "public"."geography"(Point,4326),
    "served_at" timestamp with time zone,
    "served_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."drivers_available" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."flow_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "flow_id" "text" NOT NULL,
    "screen_id" "text",
    "action_id" "text",
    "wa_id" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "received_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."flow_submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."insurance_leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "whatsapp" "text" NOT NULL,
    "file_path" "text",
    "raw_ocr" "jsonb",
    "extracted" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "extracted_json" "jsonb",
    "status" "text" DEFAULT 'received'::"text" NOT NULL,
    CONSTRAINT "insurance_leads_status_check" CHECK (("status" = ANY (ARRAY['received'::"text", 'ocr_ok'::"text", 'ocr_error'::"text", 'reviewed'::"text"])))
);


ALTER TABLE "public"."insurance_leads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."insurance_media" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid",
    "wa_media_id" "text",
    "storage_path" "text" NOT NULL,
    "mime_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."insurance_media" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."insurance_media_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid",
    "wa_id" "text",
    "storage_path" "text" NOT NULL,
    "mime_type" "text",
    "caption" "text",
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."insurance_media_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."item_modifiers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "item_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "modifier_type" "public"."item_modifier_type" NOT NULL,
    "is_required" boolean DEFAULT false NOT NULL,
    "options" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."item_modifiers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bar_id" "uuid" NOT NULL,
    "menu_id" "uuid" NOT NULL,
    "category_id" "uuid",
    "name" "text" NOT NULL,
    "short_description" "text",
    "price_minor" integer NOT NULL,
    "currency" "text",
    "flags" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "is_available" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "items_price_minor_check" CHECK (("price_minor" >= 0))
);


ALTER TABLE "public"."items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leaderboard_notifications" (
    "user_id" "uuid" NOT NULL,
    "window" "text" NOT NULL,
    "last_entered_at" timestamp with time zone,
    "last_dropped_at" timestamp with time zone
);


ALTER TABLE "public"."leaderboard_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leaderboard_snapshots" (
    "window" "text" NOT NULL,
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "payload" "jsonb" NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "snapshot_window" "text",
    "top9" "jsonb",
    "your_rank_map" "jsonb"
);


ALTER TABLE "public"."leaderboard_snapshots" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."leaderboard_snapshots_v" AS
 SELECT "id",
    "snapshot_window" AS "window",
    "generated_at",
    "top9",
    "your_rank_map"
   FROM "public"."leaderboard_snapshots";


ALTER VIEW "public"."leaderboard_snapshots_v" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketplace_categories" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."marketplace_categories" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."marketplace_categories_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."marketplace_categories_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."marketplace_categories_id_seq" OWNED BY "public"."marketplace_categories"."id";



CREATE MATERIALIZED VIEW "public"."menu_items_snapshot" AS
 SELECT "i"."id" AS "item_id",
    "i"."bar_id",
    "i"."menu_id",
    "i"."category_id",
    "i"."name",
    "i"."short_description",
    "i"."price_minor",
    COALESCE("i"."currency", "b"."currency") AS "currency",
    "i"."flags",
    "i"."is_available",
    "i"."sort_order",
    "i"."metadata",
    "i"."updated_at"
   FROM ("public"."items" "i"
     JOIN "public"."bars" "b" ON (("b"."id" = "i"."bar_id")))
  WHERE ("i"."is_available" = true)
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."menu_items_snapshot" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."menus" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bar_id" "uuid" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "status" "public"."menu_status" DEFAULT 'draft'::"public"."menu_status" NOT NULL,
    "source" "public"."menu_source" DEFAULT 'manual'::"public"."menu_source" NOT NULL,
    "source_file_ids" "text"[] DEFAULT ARRAY[]::"text"[] NOT NULL,
    "created_by" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "published_at" timestamp with time zone
);


ALTER TABLE "public"."menus" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mobility_pro_access" (
    "user_id" "uuid" NOT NULL,
    "credits_left" integer DEFAULT 0 NOT NULL,
    "granted_until" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."mobility_pro_access" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."momo_qr_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "whatsapp_e164" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "momo_value" "text" NOT NULL,
    "amount_rwf" integer,
    "ussd_text" "text" NOT NULL,
    "tel_uri" "text" NOT NULL,
    "qr_url" "text" NOT NULL,
    "share_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "requester_wa_id" "text",
    "target_value" "text",
    "target_type" "text",
    "amount_minor" integer,
    "ussd_code" "text",
    "msisdn_or_code" "text",
    "amount" numeric,
    "ussd" "text",
    CONSTRAINT "momo_qr_requests_kind_check" CHECK (("kind" = ANY (ARRAY['number'::"text", 'code'::"text"])))
);


ALTER TABLE "public"."momo_qr_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ocr_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bar_id" "uuid" NOT NULL,
    "menu_id" "uuid",
    "source_file_id" "text",
    "status" "public"."ocr_job_status" DEFAULT 'queued'::"public"."ocr_job_status" NOT NULL,
    "error_message" "text",
    "attempts" smallint DEFAULT 0 NOT NULL,
    "last_attempt_at" timestamp with time zone,
    "result_path" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."ocr_jobs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."order_code_seq"
    START WITH 1000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."order_code_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "event_type" "public"."order_event_type" NOT NULL,
    "actor_type" "public"."order_event_actor" NOT NULL,
    "actor_identifier" "text",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."order_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "item_id" "uuid",
    "item_name" "text" NOT NULL,
    "item_description" "text",
    "qty" integer NOT NULL,
    "unit_price_minor" integer NOT NULL,
    "flags_snapshot" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "modifiers_snapshot" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "line_total_minor" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "order_items_line_total_minor_check" CHECK (("line_total_minor" >= 0)),
    CONSTRAINT "order_items_qty_check" CHECK (("qty" >= 1)),
    CONSTRAINT "order_items_unit_price_minor_check" CHECK (("unit_price_minor" >= 0))
);


ALTER TABLE "public"."order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_code" "text",
    "bar_id" "uuid" NOT NULL,
    "source_cart_id" "uuid",
    "table_label" "text",
    "status" "public"."order_status" DEFAULT 'pending'::"public"."order_status" NOT NULL,
    "subtotal_minor" integer DEFAULT 0 NOT NULL,
    "service_charge_minor" integer DEFAULT 0 NOT NULL,
    "total_minor" integer DEFAULT 0 NOT NULL,
    "momo_code_used" "text",
    "note" "text",
    "paid_at" timestamp with time zone,
    "served_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "profile_id" "uuid"
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."passengers_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "whatsapp" "text" NOT NULL,
    "vehicle_type" "text",
    "geo" "public"."geography"(Point,4326),
    "served_at" timestamp with time zone,
    "served_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."passengers_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."petrol_stations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "city" "text",
    "owner_contact" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "petrol_stations_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text"])))
);


ALTER TABLE "public"."petrol_stations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "user_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "whatsapp_e164" "text" NOT NULL,
    "display_name" "text",
    "locale" "text" DEFAULT 'en'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "show_on_leaderboards" boolean DEFAULT true NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "id" "uuid" GENERATED ALWAYS AS ("user_id") STORED
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."promo_rules" (
    "id" integer DEFAULT 1 NOT NULL,
    "tokens_per_new_user" integer DEFAULT 10 NOT NULL,
    "welcome_bonus" integer,
    "daily_cap_per_sharer" integer
);


ALTER TABLE "public"."promo_rules" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."published_menus" AS
 SELECT DISTINCT ON ("bar_id") "id",
    "bar_id",
    "version",
    "status",
    "source",
    "source_file_ids",
    "created_by",
    "created_at",
    "updated_at",
    "published_at"
   FROM "public"."menus" "m"
  WHERE ("status" = 'published'::"public"."menu_status")
  ORDER BY "bar_id", "published_at" DESC NULLS LAST, "updated_at" DESC;


ALTER VIEW "public"."published_menus" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."referral_attributions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "sharer_user_id" "uuid" NOT NULL,
    "joiner_user_id" "uuid" NOT NULL,
    "first_message_at" timestamp with time zone NOT NULL,
    "credited" boolean DEFAULT false NOT NULL,
    "credited_tokens" integer DEFAULT 0 NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."referral_attributions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."referral_clicks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text",
    "clicked_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "ip" "text",
    "user_agent" "text",
    "country_guess" "text"
);


ALTER TABLE "public"."referral_clicks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."referral_links" (
    "user_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "short_url" "text",
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_shared_at" timestamp with time zone
);


ALTER TABLE "public"."referral_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."segments" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "filter" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."segments" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."segments_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."segments_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."segments_id_seq" OWNED BY "public"."segments"."id";



CREATE TABLE IF NOT EXISTS "public"."send_logs" (
    "id" bigint NOT NULL,
    "queue_id" bigint,
    "campaign_id" bigint NOT NULL,
    "msisdn_e164" "text" NOT NULL,
    "sent_at" timestamp with time zone,
    "provider_msg_id" "text",
    "delivery_status" "text",
    "error" "text"
);


ALTER TABLE "public"."send_logs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."send_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."send_logs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."send_logs_id_seq" OWNED BY "public"."send_logs"."id";



CREATE TABLE IF NOT EXISTS "public"."send_queue" (
    "id" bigint NOT NULL,
    "campaign_id" bigint,
    "msisdn_e164" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "attempt" integer DEFAULT 0,
    "next_attempt_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'PENDING'::"text",
    CONSTRAINT "send_queue_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'SENT'::"text", 'FAILED'::"text", 'SKIPPED'::"text"])))
);


ALTER TABLE "public"."send_queue" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."send_queue_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."send_queue_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."send_queue_id_seq" OWNED BY "public"."send_queue"."id";



CREATE TABLE IF NOT EXISTS "public"."served_drivers" (
    "viewer_passenger_msisdn" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "driver_contact_id" "uuid" NOT NULL
);


ALTER TABLE "public"."served_drivers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."served_passengers" (
    "viewer_driver_msisdn" "text" NOT NULL,
    "passenger_trip_id" "uuid" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."served_passengers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "wa_id" "text" NOT NULL,
    "role" "public"."session_role" NOT NULL,
    "bar_id" "uuid",
    "current_flow" "text",
    "context" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "flow_state" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "last_interaction_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "profile_id" "uuid"
);


ALTER TABLE "public"."sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shops" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "short_code" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."shops" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."station_numbers" (
    "station_id" "uuid" NOT NULL,
    "wa_e164" "text" NOT NULL,
    "role" "text" DEFAULT 'staff'::"text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "station_numbers_role_check" CHECK (("role" = ANY (ARRAY['manager'::"text", 'staff'::"text"])))
);


ALTER TABLE "public"."station_numbers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."templates" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "language_code" "text" DEFAULT 'en'::"text" NOT NULL,
    "category" "text",
    "status" "text" NOT NULL,
    "meta_id" "text",
    "components" "jsonb" NOT NULL,
    "sample" "jsonb" DEFAULT '{}'::"jsonb",
    "last_synced_at" timestamp with time zone,
    CONSTRAINT "templates_category_check" CHECK (("category" = ANY (ARRAY['MARKETING'::"text", 'UTILITY'::"text", 'AUTHENTICATION'::"text", 'SERVICE'::"text"]))),
    CONSTRAINT "templates_status_check" CHECK (("status" = ANY (ARRAY['APPROVED'::"text", 'REJECTED'::"text", 'PENDING'::"text", 'DRAFT'::"text"])))
);


ALTER TABLE "public"."templates" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."templates_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."templates_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."templates_id_seq" OWNED BY "public"."templates"."id";



CREATE TABLE IF NOT EXISTS "public"."trips" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "creator_user_id" "uuid",
    "role" "text",
    "vehicle_type" "text",
    "pickup" "public"."geography"(Point,4326),
    "status" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "dropoff" "public"."geometry"(Point,4326),
    "pickup_lat" double precision,
    "pickup_lng" double precision,
    "dropoff_lat" double precision,
    "dropoff_lng" double precision,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "pickup_text" "text",
    "dropoff_text" "text",
    "pickup_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "pickup_lon" double precision GENERATED ALWAYS AS (
CASE
    WHEN ("pickup" IS NULL) THEN NULL::double precision
    ELSE "public"."st_x"(("pickup")::"public"."geometry")
END) STORED,
    "dropoff_lon" double precision GENERATED ALWAYS AS (
CASE
    WHEN ("dropoff" IS NULL) THEN NULL::double precision
    ELSE "public"."st_x"(("dropoff")::"public"."geometry")
END) STORED,
    "pickup_radius_m" integer DEFAULT 200 NOT NULL,
    "dropoff_radius_m" integer DEFAULT 200 NOT NULL,
    CONSTRAINT "trips_role_check" CHECK (("role" = ANY (ARRAY['driver'::"text", 'passenger'::"text"]))),
    CONSTRAINT "trips_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'matched'::"text", 'closed'::"text", 'expired'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "trips_status_check_spec" CHECK (("status" = ANY (ARRAY['open'::"text", 'matched'::"text", 'cancelled'::"text", 'expired'::"text", 'archived'::"text"]))),
    CONSTRAINT "trips_vehicle_type_check" CHECK (("vehicle_type" = ANY (ARRAY['moto'::"text", 'cab'::"text", 'lifan'::"text", 'truck'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."trips" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."voucher_redemptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "voucher_id" "uuid" NOT NULL,
    "station_id" "uuid",
    "redeemer_wa_e164" "text",
    "reason" "text",
    "meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."voucher_redemptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vouchers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code_5" "text" NOT NULL,
    "amount_minor" integer NOT NULL,
    "currency" "text" DEFAULT 'RWF'::"text" NOT NULL,
    "status" "text" DEFAULT 'issued'::"text" NOT NULL,
    "user_id" "uuid",
    "whatsapp_e164" "text" NOT NULL,
    "policy_number" "text" NOT NULL,
    "plate" "text",
    "qr_payload" "text" NOT NULL,
    "image_url" "text",
    "issued_by_admin" "uuid",
    "issued_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "redeemed_at" timestamp with time zone,
    "redeemed_by_station_id" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "vouchers_code_5_check" CHECK (("code_5" ~ '^[0-9]{5}$'::"text")),
    CONSTRAINT "vouchers_status_check" CHECK (("status" = ANY (ARRAY['issued'::"text", 'redeemed'::"text", 'cancelled'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."vouchers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wa_events" (
    "wa_message_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "received_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."wa_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wa_inbound" (
    "wa_msg_id" "text" NOT NULL,
    "from_msisdn" "text",
    "received_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."wa_inbound" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wa_inbox" (
    "id" bigint NOT NULL,
    "provider_msg_id" "text",
    "from_msisdn" "text" NOT NULL,
    "to_msisdn" "text",
    "wa_timestamp" timestamp with time zone,
    "type" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."wa_inbox" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."wa_inbox_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."wa_inbox_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."wa_inbox_id_seq" OWNED BY "public"."wa_inbox"."id";



CREATE TABLE IF NOT EXISTS "public"."wallet_accounts" (
    "profile_id" "uuid" NOT NULL,
    "balance_minor" integer DEFAULT 0 NOT NULL,
    "pending_minor" integer DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'RWF'::"text" NOT NULL,
    "tokens" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."wallet_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallet_ledger" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "delta_tokens" integer NOT NULL,
    "type" "text" NOT NULL,
    "meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."wallet_ledger" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."wallet_ledger_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."wallet_ledger_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."wallet_ledger_id_seq" OWNED BY "public"."wallet_ledger"."id";



CREATE TABLE IF NOT EXISTS "public"."wallet_redemptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "reward_id" "text" NOT NULL,
    "reward_name" "text" NOT NULL,
    "cost_tokens" integer NOT NULL,
    "status" "text" DEFAULT 'fulfilled'::"text" NOT NULL,
    "meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."wallet_redemptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallets" (
    "user_id" "uuid" NOT NULL,
    "balance_tokens" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."wallets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."webhook_logs" (
    "id" bigint NOT NULL,
    "endpoint" "text" NOT NULL,
    "wa_id" "text",
    "status_code" integer,
    "error_message" "text",
    "headers" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "received_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."webhook_logs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."webhook_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."webhook_logs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."webhook_logs_id_seq" OWNED BY "public"."webhook_logs"."id";



ALTER TABLE ONLY "public"."campaign_recipients" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."campaign_recipients_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."campaigns" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."campaigns_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."contacts" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."contacts_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."marketplace_categories" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."marketplace_categories_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."segments" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."segments_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."send_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."send_logs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."send_queue" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."send_queue_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."templates" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."templates_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."wa_inbox" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."wa_inbox_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."wallet_ledger" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."wallet_ledger_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."webhook_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."webhook_logs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."admin_alert_prefs"
    ADD CONSTRAINT "admin_alert_prefs_pkey" PRIMARY KEY ("wa_id");



ALTER TABLE ONLY "public"."admin_audit_log"
    ADD CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_pin_sessions"
    ADD CONSTRAINT "admin_pin_sessions_pkey" PRIMARY KEY ("session_id");



ALTER TABLE ONLY "public"."admin_sessions"
    ADD CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("wa_id");



ALTER TABLE ONLY "public"."admin_submissions"
    ADD CONSTRAINT "admin_submissions_pkey" PRIMARY KEY ("reference");



ALTER TABLE ONLY "public"."app_config"
    ADD CONSTRAINT "app_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bar_numbers"
    ADD CONSTRAINT "bar_numbers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bar_numbers"
    ADD CONSTRAINT "bar_numbers_unique_number_per_bar" UNIQUE ("bar_id", "number_e164");



ALTER TABLE ONLY "public"."bar_settings"
    ADD CONSTRAINT "bar_settings_pkey" PRIMARY KEY ("bar_id");



ALTER TABLE ONLY "public"."bar_tables"
    ADD CONSTRAINT "bar_tables_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bar_tables"
    ADD CONSTRAINT "bar_tables_unique_label_per_bar" UNIQUE ("bar_id", "label");



ALTER TABLE ONLY "public"."bar_tables"
    ADD CONSTRAINT "bar_tables_unique_payload" UNIQUE ("qr_payload");



ALTER TABLE ONLY "public"."bars"
    ADD CONSTRAINT "bars_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bars"
    ADD CONSTRAINT "bars_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."basket_contributions"
    ADD CONSTRAINT "basket_contributions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."basket_joins"
    ADD CONSTRAINT "basket_joins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."basket_members"
    ADD CONSTRAINT "basket_members_pkey" PRIMARY KEY ("basket_id", "user_id");



ALTER TABLE ONLY "public"."basket_members"
    ADD CONSTRAINT "basket_members_unique" UNIQUE ("basket_id", "user_id");



ALTER TABLE ONLY "public"."baskets"
    ADD CONSTRAINT "baskets_join_token_unique" UNIQUE ("join_token");



ALTER TABLE ONLY "public"."baskets"
    ADD CONSTRAINT "baskets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."baskets"
    ADD CONSTRAINT "baskets_public_slug_key" UNIQUE ("public_slug");



ALTER TABLE "public"."baskets"
    ADD CONSTRAINT "baskets_status_check" CHECK ((("status")::"text" = ANY (ARRAY['open'::"text", 'locked'::"text", 'closed'::"text", 'archived'::"text"]))) NOT VALID;



ALTER TABLE ONLY "public"."businesses"
    ADD CONSTRAINT "businesses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaign_recipients"
    ADD CONSTRAINT "campaign_recipients_campaign_id_contact_id_key" UNIQUE ("campaign_id", "contact_id");



ALTER TABLE ONLY "public"."campaign_recipients"
    ADD CONSTRAINT "campaign_recipients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."carts"
    ADD CONSTRAINT "carts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_sessions"
    ADD CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."chat_state"
    ADD CONSTRAINT "chat_state_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."chat_state"
    ADD CONSTRAINT "chat_state_user_id_unique" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_msisdn_e164_key" UNIQUE ("msisdn_e164");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contributions"
    ADD CONSTRAINT "contributions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."driver_status"
    ADD CONSTRAINT "driver_status_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."drivers_available"
    ADD CONSTRAINT "drivers_available_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."flow_submissions"
    ADD CONSTRAINT "flow_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."insurance_leads"
    ADD CONSTRAINT "insurance_leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."insurance_media"
    ADD CONSTRAINT "insurance_media_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."insurance_media_queue"
    ADD CONSTRAINT "insurance_media_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."item_modifiers"
    ADD CONSTRAINT "item_modifiers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leaderboard_notifications"
    ADD CONSTRAINT "leaderboard_notifications_pkey" PRIMARY KEY ("user_id", "window");



ALTER TABLE ONLY "public"."leaderboard_snapshots"
    ADD CONSTRAINT "leaderboard_snapshots_pkey" PRIMARY KEY ("window");



ALTER TABLE ONLY "public"."marketplace_categories"
    ADD CONSTRAINT "marketplace_categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."marketplace_categories"
    ADD CONSTRAINT "marketplace_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."menus"
    ADD CONSTRAINT "menus_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."menus"
    ADD CONSTRAINT "menus_unique_version_per_bar" UNIQUE ("bar_id", "version");



ALTER TABLE ONLY "public"."mobility_pro_access"
    ADD CONSTRAINT "mobility_pro_access_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."momo_qr_requests"
    ADD CONSTRAINT "momo_qr_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ocr_jobs"
    ADD CONSTRAINT "ocr_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_events"
    ADD CONSTRAINT "order_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_order_code_key" UNIQUE ("order_code");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."passengers_requests"
    ADD CONSTRAINT "passengers_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."petrol_stations"
    ADD CONSTRAINT "petrol_stations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_whatsapp_e164_key" UNIQUE ("whatsapp_e164");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_whatsapp_unique" UNIQUE ("whatsapp_e164");



ALTER TABLE ONLY "public"."promo_rules"
    ADD CONSTRAINT "promo_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."referral_attributions"
    ADD CONSTRAINT "referral_attributions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."referral_clicks"
    ADD CONSTRAINT "referral_clicks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."referral_links"
    ADD CONSTRAINT "referral_links_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."referral_links"
    ADD CONSTRAINT "referral_links_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."segments"
    ADD CONSTRAINT "segments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."send_logs"
    ADD CONSTRAINT "send_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."send_queue"
    ADD CONSTRAINT "send_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."served_drivers"
    ADD CONSTRAINT "served_drivers_pkey" PRIMARY KEY ("viewer_passenger_msisdn", "driver_contact_id");



ALTER TABLE ONLY "public"."served_passengers"
    ADD CONSTRAINT "served_passengers_pkey" PRIMARY KEY ("viewer_driver_msisdn", "passenger_trip_id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shops"
    ADD CONSTRAINT "shops_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shops"
    ADD CONSTRAINT "shops_short_code_key" UNIQUE ("short_code");



ALTER TABLE ONLY "public"."station_numbers"
    ADD CONSTRAINT "station_numbers_pkey" PRIMARY KEY ("station_id", "wa_e164");



ALTER TABLE ONLY "public"."templates"
    ADD CONSTRAINT "templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trips"
    ADD CONSTRAINT "trips_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."voucher_redemptions"
    ADD CONSTRAINT "voucher_redemptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vouchers"
    ADD CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wa_events"
    ADD CONSTRAINT "wa_events_pkey" PRIMARY KEY ("wa_message_id");



ALTER TABLE ONLY "public"."wa_inbound"
    ADD CONSTRAINT "wa_inbound_pkey" PRIMARY KEY ("wa_msg_id");



ALTER TABLE ONLY "public"."wa_inbox"
    ADD CONSTRAINT "wa_inbox_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wa_inbox"
    ADD CONSTRAINT "wa_inbox_provider_msg_id_key" UNIQUE ("provider_msg_id");



ALTER TABLE ONLY "public"."wallet_accounts"
    ADD CONSTRAINT "wallet_accounts_pkey" PRIMARY KEY ("profile_id");



ALTER TABLE ONLY "public"."wallet_earn_actions"
    ADD CONSTRAINT "wallet_earn_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallet_ledger"
    ADD CONSTRAINT "wallet_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallet_promoters"
    ADD CONSTRAINT "wallet_promoters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallet_redeem_options"
    ADD CONSTRAINT "wallet_redeem_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallet_redemptions"
    ADD CONSTRAINT "wallet_redemptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallet_transactions"
    ADD CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallets"
    ADD CONSTRAINT "wallets_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."webhook_logs"
    ADD CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id");



CREATE INDEX "businesses_location_gix" ON "public"."businesses" USING "gist" ("location");



CREATE INDEX "businesses_status_idx" ON "public"."businesses" USING "btree" ("status");



CREATE INDEX "driver_status_location_gix" ON "public"."driver_status" USING "gist" ("location");



CREATE INDEX "idx_audit_log_table_time" ON "public"."audit_log" USING "btree" ("target_table", "created_at" DESC);



CREATE INDEX "idx_bar_numbers_active" ON "public"."bar_numbers" USING "btree" ("bar_id") WHERE "is_active";



CREATE INDEX "idx_bar_numbers_token_lookup" ON "public"."bar_numbers" USING "btree" ("number_e164", "bar_id") WHERE ("verification_code_hash" IS NOT NULL);



CREATE INDEX "idx_bar_tables_bar_active" ON "public"."bar_tables" USING "btree" ("bar_id") WHERE "is_active";



CREATE INDEX "idx_basket_contrib_basket" ON "public"."basket_contributions" USING "btree" ("basket_id");



CREATE INDEX "idx_basket_joins_status" ON "public"."basket_joins" USING "btree" ("status", "created_at" DESC);



CREATE UNIQUE INDEX "idx_basket_joins_unique" ON "public"."basket_joins" USING "btree" ("basket_id", COALESCE("whatsapp", ''::"text"));



CREATE INDEX "idx_basket_members_basket" ON "public"."basket_members" USING "btree" ("basket_id");



CREATE UNIQUE INDEX "idx_baskets_join_token" ON "public"."baskets" USING "btree" ("join_token") WHERE ("join_token" IS NOT NULL);



CREATE INDEX "idx_baskets_public_status" ON "public"."baskets" USING "btree" ("is_public", "status");



CREATE INDEX "idx_bk_contrib_basket" ON "public"."basket_contributions" USING "btree" ("basket_id");



CREATE INDEX "idx_bk_contrib_contributor" ON "public"."basket_contributions" USING "btree" ("contributor_user_id");



CREATE INDEX "idx_bk_contrib_status" ON "public"."basket_contributions" USING "btree" ("status");



CREATE INDEX "idx_businesses_active" ON "public"."businesses" USING "btree" ("is_active");



CREATE INDEX "idx_businesses_created" ON "public"."businesses" USING "btree" ("created_at");



CREATE INDEX "idx_businesses_geo" ON "public"."businesses" USING "gist" ("geo");



CREATE INDEX "idx_carts_profile" ON "public"."carts" USING "btree" ("profile_id");



CREATE INDEX "idx_carts_profile_status" ON "public"."carts" USING "btree" ("profile_id", "status");



CREATE INDEX "idx_categories_menu_parent" ON "public"."categories" USING "btree" ("menu_id", "parent_category_id", "sort_order");



CREATE INDEX "idx_driver_status_geo" ON "public"."driver_status" USING "gist" ("location");



CREATE INDEX "idx_driver_status_last_seen" ON "public"."driver_status" USING "btree" ("last_seen");



CREATE INDEX "idx_driver_status_online" ON "public"."driver_status" USING "btree" ("online");



CREATE INDEX "idx_drivers_geo" ON "public"."drivers_available" USING "gist" ("geo");



CREATE INDEX "idx_items_availability" ON "public"."items" USING "btree" ("bar_id", "is_available");



CREATE INDEX "idx_items_menu_category" ON "public"."items" USING "btree" ("menu_id", "category_id", "sort_order");



CREATE INDEX "idx_menu_items_snapshot_bar_category" ON "public"."menu_items_snapshot" USING "btree" ("bar_id", "category_id");



CREATE UNIQUE INDEX "idx_menu_items_snapshot_item" ON "public"."menu_items_snapshot" USING "btree" ("item_id");



CREATE INDEX "idx_momo_qr_requests_created_at" ON "public"."momo_qr_requests" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_momo_qr_requests_requester" ON "public"."momo_qr_requests" USING "btree" ("requester_wa_id", "created_at" DESC);



CREATE INDEX "idx_momo_qr_requests_user" ON "public"."momo_qr_requests" USING "btree" ("user_id");



CREATE INDEX "idx_momo_qr_requests_whatsapp" ON "public"."momo_qr_requests" USING "btree" ("whatsapp_e164");



CREATE INDEX "idx_notifications_status_created" ON "public"."notifications" USING "btree" ("status", "created_at");



CREATE INDEX "idx_ocr_jobs_status_created" ON "public"."ocr_jobs" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_order_events_order_created" ON "public"."order_events" USING "btree" ("order_id", "created_at" DESC);



CREATE INDEX "idx_orders_bar_status_created" ON "public"."orders" USING "btree" ("bar_id", "status", "created_at" DESC);



CREATE INDEX "idx_orders_profile" ON "public"."orders" USING "btree" ("profile_id");



CREATE INDEX "idx_passengers_geo" ON "public"."passengers_requests" USING "gist" ("geo");



CREATE INDEX "idx_send_queue_ready" ON "public"."send_queue" USING "btree" ("status", "next_attempt_at");



CREATE INDEX "idx_served_drivers_expires_at" ON "public"."served_drivers" USING "btree" ("expires_at");



CREATE INDEX "idx_served_drivers_lookup" ON "public"."served_drivers" USING "btree" ("viewer_passenger_msisdn", "driver_contact_id", "expires_at");



CREATE INDEX "idx_served_drivers_viewer_target" ON "public"."served_drivers" USING "btree" ("viewer_passenger_msisdn", "driver_contact_id");



CREATE INDEX "idx_served_drivers_viewer_target_expires" ON "public"."served_drivers" USING "btree" ("viewer_passenger_msisdn", "driver_contact_id", "expires_at");



CREATE INDEX "idx_served_passengers_expires_at" ON "public"."served_passengers" USING "btree" ("expires_at");



CREATE INDEX "idx_served_passengers_lookup" ON "public"."served_passengers" USING "btree" ("viewer_driver_msisdn", "passenger_trip_id", "expires_at");



CREATE INDEX "idx_served_passengers_viewer_target" ON "public"."served_passengers" USING "btree" ("viewer_driver_msisdn", "passenger_trip_id");



CREATE INDEX "idx_sessions_profile" ON "public"."sessions" USING "btree" ("profile_id");



CREATE INDEX "idx_sessions_wa_role" ON "public"."sessions" USING "btree" ("wa_id", "role");



CREATE INDEX "idx_trips_pickup" ON "public"."trips" USING "gist" ("pickup");



CREATE INDEX "idx_trips_role" ON "public"."trips" USING "btree" ("role", "vehicle_type");



CREATE INDEX "idx_wallet_earn_active" ON "public"."wallet_earn_actions" USING "btree" ("is_active");



CREATE INDEX "idx_wallet_redeem_active" ON "public"."wallet_redeem_options" USING "btree" ("is_active");



CREATE INDEX "idx_wallet_tx_profile" ON "public"."wallet_transactions" USING "btree" ("profile_id", "occurred_at" DESC);



CREATE INDEX "idx_webhook_logs_endpoint_time" ON "public"."webhook_logs" USING "btree" ("endpoint", "received_at" DESC);



CREATE INDEX "marketplace_categories_active_sort_idx" ON "public"."marketplace_categories" USING "btree" ("is_active", "sort_order", "id");



CREATE INDEX "momo_qr_requests_user_idx" ON "public"."momo_qr_requests" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "referral_attributions_code_idx" ON "public"."referral_attributions" USING "btree" ("code");



CREATE UNIQUE INDEX "referral_attributions_joiner_unique" ON "public"."referral_attributions" USING "btree" ("joiner_user_id");



CREATE INDEX "referral_attributions_sharer_created_idx" ON "public"."referral_attributions" USING "btree" ("sharer_user_id", "credited", "created_at" DESC);



CREATE INDEX "trips_created_idx" ON "public"."trips" USING "btree" ("created_at");



CREATE INDEX "trips_dropoff_geog_idx" ON "public"."trips" USING "gist" ("dropoff");



CREATE INDEX "trips_dropoff_gix" ON "public"."trips" USING "gist" ("dropoff");



CREATE INDEX "trips_open_pickup_gix" ON "public"."trips" USING "gist" ("pickup") WHERE ("status" = 'open'::"text");



CREATE INDEX "trips_pickup_geog_idx" ON "public"."trips" USING "gist" ("pickup");



CREATE INDEX "trips_pickup_gix" ON "public"."trips" USING "gist" ("pickup");



CREATE INDEX "trips_role_idx" ON "public"."trips" USING "btree" ("role");



CREATE INDEX "trips_status_idx" ON "public"."trips" USING "btree" ("status");



CREATE INDEX "trips_status_role_idx" ON "public"."trips" USING "btree" ("status", "role");



CREATE INDEX "trips_vehicle_idx" ON "public"."trips" USING "btree" ("vehicle_type");



CREATE UNIQUE INDEX "uniq_baskets_public_slug" ON "public"."baskets" USING "btree" ("public_slug") WHERE ("public_slug" IS NOT NULL);



CREATE UNIQUE INDEX "uniq_marketplace_categories_name" ON "public"."marketplace_categories" USING "btree" ("name");



CREATE UNIQUE INDEX "uq_businesses_name_owner" ON "public"."businesses" USING "btree" ("name", "owner_whatsapp");



CREATE UNIQUE INDEX "uq_chat_state_user" ON "public"."chat_state" USING "btree" ("user_id");



CREATE UNIQUE INDEX "uq_marketplace_categories_name" ON "public"."marketplace_categories" USING "btree" ("name");



CREATE UNIQUE INDEX "uq_profiles_whatsapp" ON "public"."profiles" USING "btree" ("whatsapp_e164");



CREATE UNIQUE INDEX "uq_wa_events_wa_message_id" ON "public"."wa_events" USING "btree" ("wa_message_id");



CREATE INDEX "voucher_redemptions_voucher_idx" ON "public"."voucher_redemptions" USING "btree" ("voucher_id", "created_at" DESC);



CREATE UNIQUE INDEX "vouchers_code_active_unique" ON "public"."vouchers" USING "btree" ("code_5") WHERE ("status" = ANY (ARRAY['issued'::"text", 'redeemed'::"text"]));



CREATE INDEX "wallet_ledger_user_created_idx" ON "public"."wallet_ledger" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "wallet_ledger_user_idx" ON "public"."wallet_ledger" USING "btree" ("user_id", "created_at" DESC);



CREATE OR REPLACE TRIGGER "trg_admin_sessions_updated" BEFORE UPDATE ON "public"."admin_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_app_config_updated" BEFORE UPDATE ON "public"."app_config" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_bar_numbers_updated" BEFORE UPDATE ON "public"."bar_numbers" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_bar_settings_updated" BEFORE UPDATE ON "public"."bar_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_bar_tables_updated" BEFORE UPDATE ON "public"."bar_tables" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_bars_updated" BEFORE UPDATE ON "public"."bars" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_basket_joins_rate_limit_insert" BEFORE INSERT ON "public"."basket_joins" FOR EACH ROW EXECUTE FUNCTION "public"."fn_assert_basket_join_rate_limit"();



CREATE OR REPLACE TRIGGER "trg_basket_joins_rate_limit_update" BEFORE UPDATE ON "public"."basket_joins" FOR EACH ROW EXECUTE FUNCTION "public"."fn_assert_basket_join_rate_limit"();



CREATE OR REPLACE TRIGGER "trg_baskets_rate_limit" BEFORE INSERT ON "public"."baskets" FOR EACH ROW EXECUTE FUNCTION "public"."fn_assert_basket_create_rate_limit"();



CREATE OR REPLACE TRIGGER "trg_baskets_updated_v2" BEFORE UPDATE ON "public"."baskets" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_carts_updated" BEFORE UPDATE ON "public"."carts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_categories_updated" BEFORE UPDATE ON "public"."categories" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_chat_state_updated" BEFORE UPDATE ON "public"."chat_state" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_contacts_updated" BEFORE UPDATE ON "public"."contacts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_driver_status_updated" BEFORE UPDATE ON "public"."driver_status" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_item_modifiers_updated" BEFORE UPDATE ON "public"."item_modifiers" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_items_updated" BEFORE UPDATE ON "public"."items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_menus_refresh_snapshot" AFTER UPDATE OF "status" ON "public"."menus" FOR EACH ROW WHEN (("new"."status" = 'published'::"public"."menu_status")) EXECUTE FUNCTION "public"."on_menu_publish_refresh"();



CREATE OR REPLACE TRIGGER "trg_menus_updated" BEFORE UPDATE ON "public"."menus" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_mobility_pro_access_updated" BEFORE UPDATE ON "public"."mobility_pro_access" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_notifications_updated" BEFORE UPDATE ON "public"."notifications" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_ocr_jobs_updated" BEFORE UPDATE ON "public"."ocr_jobs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_orders_defaults" BEFORE INSERT ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."orders_set_defaults"();



CREATE OR REPLACE TRIGGER "trg_orders_updated" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_petrol_stations_updated" BEFORE UPDATE ON "public"."petrol_stations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_profiles_updated" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_sessions_updated" BEFORE UPDATE ON "public"."sessions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_trips_updated" BEFORE UPDATE ON "public"."trips" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_vouchers_updated" BEFORE UPDATE ON "public"."vouchers" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."admin_alert_prefs"
    ADD CONSTRAINT "admin_alert_prefs_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "public"."profiles"("user_id");



ALTER TABLE ONLY "public"."admin_audit_log"
    ADD CONSTRAINT "admin_audit_log_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "public"."profiles"("user_id");



ALTER TABLE ONLY "public"."bar_numbers"
    ADD CONSTRAINT "bar_numbers_bar_id_fkey" FOREIGN KEY ("bar_id") REFERENCES "public"."bars"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bar_settings"
    ADD CONSTRAINT "bar_settings_bar_id_fkey" FOREIGN KEY ("bar_id") REFERENCES "public"."bars"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bar_tables"
    ADD CONSTRAINT "bar_tables_bar_id_fkey" FOREIGN KEY ("bar_id") REFERENCES "public"."bars"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."basket_contributions"
    ADD CONSTRAINT "basket_contributions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("user_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."basket_joins"
    ADD CONSTRAINT "basket_joins_basket_id_fkey" FOREIGN KEY ("basket_id") REFERENCES "public"."baskets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."basket_joins"
    ADD CONSTRAINT "basket_joins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."basket_members"
    ADD CONSTRAINT "basket_members_basket_id_fkey" FOREIGN KEY ("basket_id") REFERENCES "public"."baskets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."basket_members"
    ADD CONSTRAINT "basket_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."baskets"
    ADD CONSTRAINT "baskets_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."profiles"("user_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."baskets"
    ADD CONSTRAINT "baskets_creator_user_id_fkey" FOREIGN KEY ("creator_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."businesses"
    ADD CONSTRAINT "businesses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."marketplace_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."businesses"
    ADD CONSTRAINT "businesses_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."campaign_recipients"
    ADD CONSTRAINT "campaign_recipients_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_recipients"
    ADD CONSTRAINT "campaign_recipients_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id");



ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carts"
    ADD CONSTRAINT "carts_bar_id_fkey" FOREIGN KEY ("bar_id") REFERENCES "public"."bars"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carts"
    ADD CONSTRAINT "carts_profile_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_bar_id_fkey" FOREIGN KEY ("bar_id") REFERENCES "public"."bars"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "public"."menus"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_parent_category_id_fkey" FOREIGN KEY ("parent_category_id") REFERENCES "public"."categories"("id");



ALTER TABLE ONLY "public"."chat_state"
    ADD CONSTRAINT "chat_state_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contributions"
    ADD CONSTRAINT "contributions_basket_id_fkey" FOREIGN KEY ("basket_id") REFERENCES "public"."baskets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contributions"
    ADD CONSTRAINT "contributions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."insurance_media"
    ADD CONSTRAINT "insurance_media_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."insurance_leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."insurance_media_queue"
    ADD CONSTRAINT "insurance_media_queue_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("user_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."item_modifiers"
    ADD CONSTRAINT "item_modifiers_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_bar_id_fkey" FOREIGN KEY ("bar_id") REFERENCES "public"."bars"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "public"."menus"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leaderboard_notifications"
    ADD CONSTRAINT "leaderboard_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."menus"
    ADD CONSTRAINT "menus_bar_id_fkey" FOREIGN KEY ("bar_id") REFERENCES "public"."bars"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mobility_pro_access"
    ADD CONSTRAINT "mobility_pro_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."momo_qr_requests"
    ADD CONSTRAINT "momo_qr_requests_user_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ocr_jobs"
    ADD CONSTRAINT "ocr_jobs_bar_id_fkey" FOREIGN KEY ("bar_id") REFERENCES "public"."bars"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ocr_jobs"
    ADD CONSTRAINT "ocr_jobs_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "public"."menus"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."order_events"
    ADD CONSTRAINT "order_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_bar_id_fkey" FOREIGN KEY ("bar_id") REFERENCES "public"."bars"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_profile_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("user_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_source_cart_id_fkey" FOREIGN KEY ("source_cart_id") REFERENCES "public"."carts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."referral_attributions"
    ADD CONSTRAINT "referral_attributions_code_fkey" FOREIGN KEY ("code") REFERENCES "public"."referral_links"("code") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."referral_attributions"
    ADD CONSTRAINT "referral_attributions_joiner_user_id_fkey" FOREIGN KEY ("joiner_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."referral_attributions"
    ADD CONSTRAINT "referral_attributions_sharer_user_id_fkey" FOREIGN KEY ("sharer_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."referral_links"
    ADD CONSTRAINT "referral_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."send_logs"
    ADD CONSTRAINT "send_logs_queue_id_fkey" FOREIGN KEY ("queue_id") REFERENCES "public"."send_queue"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."send_queue"
    ADD CONSTRAINT "send_queue_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_bar_id_fkey" FOREIGN KEY ("bar_id") REFERENCES "public"."bars"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_profile_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("user_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."station_numbers"
    ADD CONSTRAINT "station_numbers_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "public"."petrol_stations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."voucher_redemptions"
    ADD CONSTRAINT "voucher_redemptions_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "public"."petrol_stations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."voucher_redemptions"
    ADD CONSTRAINT "voucher_redemptions_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "public"."vouchers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vouchers"
    ADD CONSTRAINT "vouchers_issued_by_admin_fkey" FOREIGN KEY ("issued_by_admin") REFERENCES "public"."profiles"("user_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."vouchers"
    ADD CONSTRAINT "vouchers_redeemed_by_station_id_fkey" FOREIGN KEY ("redeemed_by_station_id") REFERENCES "public"."petrol_stations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."vouchers"
    ADD CONSTRAINT "vouchers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wallet_accounts"
    ADD CONSTRAINT "wallet_accounts_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wallet_ledger"
    ADD CONSTRAINT "wallet_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wallet_redemptions"
    ADD CONSTRAINT "wallet_redemptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wallet_transactions"
    ADD CONSTRAINT "wallet_transactions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wallets"
    ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE "public"."app_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_log_platform_full" ON "public"."audit_log" USING (("public"."auth_role"() = 'platform'::"text")) WITH CHECK (("public"."auth_role"() = 'platform'::"text"));



ALTER TABLE "public"."bar_numbers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bar_numbers_platform_full" ON "public"."bar_numbers" USING (("public"."auth_role"() = 'platform'::"text")) WITH CHECK (("public"."auth_role"() = 'platform'::"text"));



CREATE POLICY "bar_numbers_vendor_manage" ON "public"."bar_numbers" FOR INSERT WITH CHECK ((("public"."auth_role"() = 'vendor_manager'::"text") AND ("public"."auth_bar_id"() = "bar_id")));



CREATE POLICY "bar_numbers_vendor_select" ON "public"."bar_numbers" FOR SELECT USING ((("public"."auth_role"() = ANY (ARRAY['vendor_manager'::"text", 'vendor_staff'::"text"])) AND ("public"."auth_bar_id"() = "bar_id")));



CREATE POLICY "bar_numbers_vendor_update" ON "public"."bar_numbers" FOR UPDATE USING ((("public"."auth_role"() = 'vendor_manager'::"text") AND ("public"."auth_bar_id"() = "bar_id"))) WITH CHECK ((("public"."auth_role"() = 'vendor_manager'::"text") AND ("public"."auth_bar_id"() = "bar_id")));



ALTER TABLE "public"."bar_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bar_settings_platform_full" ON "public"."bar_settings" USING (("public"."auth_role"() = 'platform'::"text")) WITH CHECK (("public"."auth_role"() = 'platform'::"text"));



CREATE POLICY "bar_settings_vendor_rw" ON "public"."bar_settings" USING ((("public"."auth_role"() = 'vendor_manager'::"text") AND ("public"."auth_bar_id"() = "bar_id"))) WITH CHECK ((("public"."auth_role"() = 'vendor_manager'::"text") AND ("public"."auth_bar_id"() = "bar_id")));



ALTER TABLE "public"."bar_tables" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bar_tables_customer_select" ON "public"."bar_tables" FOR SELECT USING (("public"."auth_role"() = 'customer'::"text"));



CREATE POLICY "bar_tables_platform_full" ON "public"."bar_tables" USING (("public"."auth_role"() = 'platform'::"text")) WITH CHECK (("public"."auth_role"() = 'platform'::"text"));



CREATE POLICY "bar_tables_vendor_rw" ON "public"."bar_tables" USING ((("public"."auth_role"() = 'vendor_manager'::"text") AND ("public"."auth_bar_id"() = "bar_id"))) WITH CHECK ((("public"."auth_role"() = 'vendor_manager'::"text") AND ("public"."auth_bar_id"() = "bar_id")));



CREATE POLICY "bar_tables_vendor_select" ON "public"."bar_tables" FOR SELECT USING ((("public"."auth_role"() = ANY (ARRAY['vendor_manager'::"text", 'vendor_staff'::"text"])) AND ("public"."auth_bar_id"() = "bar_id")));



ALTER TABLE "public"."bars" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bars_platform_full" ON "public"."bars" USING (("public"."auth_role"() = 'platform'::"text")) WITH CHECK (("public"."auth_role"() = 'platform'::"text"));



CREATE POLICY "bars_vendor_select" ON "public"."bars" FOR SELECT USING ((("public"."auth_role"() = ANY (ARRAY['vendor_manager'::"text", 'vendor_staff'::"text"])) AND ("public"."auth_bar_id"() = "id")));



CREATE POLICY "bars_vendor_update" ON "public"."bars" FOR UPDATE USING ((("public"."auth_role"() = 'vendor_manager'::"text") AND ("public"."auth_bar_id"() = "id"))) WITH CHECK ((("public"."auth_role"() = 'vendor_manager'::"text") AND ("public"."auth_bar_id"() = "id")));



ALTER TABLE "public"."basket_contributions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "basket_contributions_select_related" ON "public"."basket_contributions" FOR SELECT USING ((("auth"."role"() = 'service_role'::"text") OR (("auth"."uid"() IS NOT NULL) AND (("profile_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."basket_members" "bm"
  WHERE (("bm"."basket_id" = "basket_contributions"."basket_id") AND (("bm"."profile_id" = "auth"."uid"()) OR ("bm"."user_id" = "auth"."uid"()) OR (COALESCE("bm"."whatsapp", ''::"text") = COALESCE("public"."profile_wa"("auth"."uid"()), ''::"text"))))))))));



ALTER TABLE "public"."basket_joins" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "basket_joins_select_related" ON "public"."basket_joins" FOR SELECT USING ((("auth"."role"() = 'service_role'::"text") OR (("auth"."uid"() IS NOT NULL) AND (("user_id" = "auth"."uid"()) OR (COALESCE("whatsapp", ''::"text") = COALESCE("public"."profile_wa"("auth"."uid"()), ''::"text")) OR (EXISTS ( SELECT 1
   FROM "public"."baskets" "b"
  WHERE (("b"."id" = "basket_joins"."basket_id") AND ("b"."owner_profile_id" = "auth"."uid"()))))))));



ALTER TABLE "public"."basket_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "basket_members_delete_self" ON "public"."basket_members" FOR DELETE USING ((("auth"."role"() = 'service_role'::"text") OR (("auth"."uid"() IS NOT NULL) AND (("profile_id" = "auth"."uid"()) OR ("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."baskets" "b"
  WHERE (("b"."id" = "basket_members"."basket_id") AND ("b"."owner_profile_id" = "auth"."uid"()))))))));



CREATE POLICY "basket_members_insert_self" ON "public"."basket_members" FOR INSERT WITH CHECK ((("auth"."role"() = 'service_role'::"text") OR (("auth"."uid"() IS NOT NULL) AND ((COALESCE("user_id", "profile_id") = "auth"."uid"()) OR (COALESCE("public"."profile_wa"("auth"."uid"()), ''::"text") = COALESCE("whatsapp", ''::"text"))))));



CREATE POLICY "basket_members_select_related" ON "public"."basket_members" FOR SELECT USING ((("auth"."role"() = 'service_role'::"text") OR (("auth"."uid"() IS NOT NULL) AND (("profile_id" = "auth"."uid"()) OR ("user_id" = "auth"."uid"()) OR (COALESCE("whatsapp", ''::"text") = COALESCE("public"."profile_wa"("auth"."uid"()), ''::"text")) OR (EXISTS ( SELECT 1
   FROM "public"."baskets" "b"
  WHERE (("b"."id" = "basket_members"."basket_id") AND ("b"."owner_profile_id" = "auth"."uid"()))))))));



ALTER TABLE "public"."baskets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "baskets_delete_owner" ON "public"."baskets" FOR DELETE USING ((("auth"."role"() = 'service_role'::"text") OR ("owner_profile_id" = "auth"."uid"())));



CREATE POLICY "baskets_insert_owner" ON "public"."baskets" FOR INSERT WITH CHECK ((("auth"."role"() = 'service_role'::"text") OR (("auth"."uid"() IS NOT NULL) AND ("owner_profile_id" = "auth"."uid"()))));



CREATE POLICY "baskets_mutate_owner" ON "public"."baskets" FOR UPDATE USING ((("auth"."role"() = 'service_role'::"text") OR ("owner_profile_id" = "auth"."uid"()))) WITH CHECK ((("auth"."role"() = 'service_role'::"text") OR ("owner_profile_id" = "auth"."uid"())));



CREATE POLICY "baskets_select_members" ON "public"."baskets" FOR SELECT USING ((("auth"."role"() = 'service_role'::"text") OR (("auth"."uid"() IS NOT NULL) AND (("owner_profile_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."basket_members" "bm"
  WHERE (("bm"."basket_id" = "baskets"."id") AND (("bm"."profile_id" = "auth"."uid"()) OR ("bm"."user_id" = "auth"."uid"()) OR ((COALESCE("bm"."whatsapp", ''::"text") <> ''::"text") AND ("bm"."whatsapp" = COALESCE("public"."profile_wa"("auth"."uid"()), ''::"text")))))))))));



ALTER TABLE "public"."businesses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cart_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cart_items_customer_rw" ON "public"."cart_items" USING ((("public"."auth_role"() = 'customer'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."carts" "c"
  WHERE (("c"."id" = "cart_items"."cart_id") AND ("c"."profile_id" = "public"."auth_profile_id"())))))) WITH CHECK ((("public"."auth_role"() = 'customer'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."carts" "c"
  WHERE (("c"."id" = "cart_items"."cart_id") AND ("c"."profile_id" = "public"."auth_profile_id"()))))));



CREATE POLICY "cart_items_platform_full" ON "public"."cart_items" USING (("public"."auth_role"() = 'platform'::"text")) WITH CHECK (("public"."auth_role"() = 'platform'::"text"));



ALTER TABLE "public"."carts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "carts_customer_rw" ON "public"."carts" USING ((("public"."auth_role"() = 'customer'::"text") AND ("public"."auth_profile_id"() = "profile_id"))) WITH CHECK ((("public"."auth_role"() = 'customer'::"text") AND ("public"."auth_profile_id"() = "profile_id")));



CREATE POLICY "carts_platform_full" ON "public"."carts" USING (("public"."auth_role"() = 'platform'::"text")) WITH CHECK (("public"."auth_role"() = 'platform'::"text"));



CREATE POLICY "carts_vendor_select" ON "public"."carts" FOR SELECT USING ((("public"."auth_role"() = ANY (ARRAY['vendor_manager'::"text", 'vendor_staff'::"text"])) AND ("public"."auth_bar_id"() = "bar_id")));



ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "categories_platform_full" ON "public"."categories" USING (("public"."auth_role"() = 'platform'::"text")) WITH CHECK (("public"."auth_role"() = 'platform'::"text"));



CREATE POLICY "categories_published_select" ON "public"."categories" FOR SELECT USING ((("public"."auth_role"() = ANY (ARRAY['customer'::"text", 'vendor_manager'::"text", 'vendor_staff'::"text"])) AND (("public"."auth_role"() = 'customer'::"text") OR ("public"."auth_bar_id"() = "bar_id"))));



CREATE POLICY "categories_vendor_manage" ON "public"."categories" USING ((("public"."auth_role"() = 'vendor_manager'::"text") AND ("public"."auth_bar_id"() = "bar_id"))) WITH CHECK ((("public"."auth_role"() = 'vendor_manager'::"text") AND ("public"."auth_bar_id"() = "bar_id")));



ALTER TABLE "public"."chat_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_state" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "deny_all" ON "public"."served_drivers" USING (false);



CREATE POLICY "deny_all" ON "public"."served_passengers" USING (false);



CREATE POLICY "deny_all_app_config" ON "public"."app_config" USING (false);



CREATE POLICY "deny_all_biz" ON "public"."businesses" USING (false);



CREATE POLICY "deny_all_chat_state" ON "public"."chat_state" USING (false);



CREATE POLICY "deny_all_cs" ON "public"."chat_sessions" USING (false);



CREATE POLICY "deny_all_driver_status" ON "public"."driver_status" USING (false);



CREATE POLICY "deny_all_drv" ON "public"."drivers_available" USING (false);



CREATE POLICY "deny_all_il" ON "public"."insurance_leads" USING (false);



CREATE POLICY "deny_all_im" ON "public"."insurance_media" USING (false);



CREATE POLICY "deny_all_marketplace_categories" ON "public"."marketplace_categories" USING (false);



CREATE POLICY "deny_all_profiles" ON "public"."profiles" USING (false);



CREATE POLICY "deny_all_psg" ON "public"."passengers_requests" USING (false);



CREATE POLICY "deny_all_shops" ON "public"."shops" USING (false);



CREATE POLICY "deny_all_trips" ON "public"."trips" USING (false);



CREATE POLICY "deny_all_wa_events" ON "public"."wa_events" USING (false);



CREATE POLICY "deny_all_wa_in" ON "public"."wa_inbound" USING (false);



ALTER TABLE "public"."driver_status" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."drivers_available" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."flow_submissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "flow_submissions_platform_full" ON "public"."flow_submissions" USING (("public"."auth_role"() = 'platform'::"text")) WITH CHECK (("public"."auth_role"() = 'platform'::"text"));



CREATE POLICY "generic_platform_read" ON "public"."bars" FOR SELECT USING (("public"."auth_role"() = 'platform'::"text"));



ALTER TABLE "public"."insurance_leads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."insurance_media" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."item_modifiers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "item_modifiers_platform_full" ON "public"."item_modifiers" USING (("public"."auth_role"() = 'platform'::"text")) WITH CHECK (("public"."auth_role"() = 'platform'::"text"));



CREATE POLICY "item_modifiers_vendor_rw" ON "public"."item_modifiers" USING ((("public"."auth_role"() = 'vendor_manager'::"text") AND ("public"."auth_bar_id"() = ( SELECT "items"."bar_id"
   FROM "public"."items"
  WHERE ("items"."id" = "item_modifiers"."item_id"))))) WITH CHECK ((("public"."auth_role"() = 'vendor_manager'::"text") AND ("public"."auth_bar_id"() = ( SELECT "items"."bar_id"
   FROM "public"."items"
  WHERE ("items"."id" = "item_modifiers"."item_id")))));



ALTER TABLE "public"."items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "items_platform_full" ON "public"."items" USING (("public"."auth_role"() = 'platform'::"text")) WITH CHECK (("public"."auth_role"() = 'platform'::"text"));



CREATE POLICY "items_published_select" ON "public"."items" FOR SELECT USING ((("public"."auth_role"() = ANY (ARRAY['customer'::"text", 'vendor_manager'::"text", 'vendor_staff'::"text"])) AND (("public"."auth_role"() = 'customer'::"text") OR ("public"."auth_bar_id"() = "bar_id"))));



CREATE POLICY "items_vendor_manage" ON "public"."items" USING ((("public"."auth_role"() = 'vendor_manager'::"text") AND ("public"."auth_bar_id"() = "bar_id"))) WITH CHECK ((("public"."auth_role"() = 'vendor_manager'::"text") AND ("public"."auth_bar_id"() = "bar_id")));



ALTER TABLE "public"."marketplace_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mc_public_read_active" ON "public"."marketplace_categories" FOR SELECT TO "authenticated", "anon" USING ((COALESCE("is_active", true) = true));



ALTER TABLE "public"."menus" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "menus_platform_full" ON "public"."menus" USING (("public"."auth_role"() = 'platform'::"text")) WITH CHECK (("public"."auth_role"() = 'platform'::"text"));



CREATE POLICY "menus_published_select" ON "public"."menus" FOR SELECT USING ((("public"."auth_role"() = ANY (ARRAY['customer'::"text", 'vendor_manager'::"text", 'vendor_staff'::"text"])) AND (("public"."auth_role"() = 'customer'::"text") OR ("public"."auth_bar_id"() = "bar_id"))));



CREATE POLICY "menus_vendor_manage" ON "public"."menus" USING ((("public"."auth_role"() = 'vendor_manager'::"text") AND ("public"."auth_bar_id"() = "bar_id"))) WITH CHECK ((("public"."auth_role"() = 'vendor_manager'::"text") AND ("public"."auth_bar_id"() = "bar_id")));



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_platform_full" ON "public"."notifications" USING (("public"."auth_role"() = 'platform'::"text")) WITH CHECK (("public"."auth_role"() = 'platform'::"text"));



CREATE POLICY "notifications_role_select" ON "public"."notifications" FOR SELECT USING (((("public"."auth_role"() = 'customer'::"text") AND ("public"."auth_wa_id"() = "to_wa_id")) OR (("public"."auth_role"() = ANY (ARRAY['vendor_manager'::"text", 'vendor_staff'::"text"])) AND (EXISTS ( SELECT 1
   FROM "public"."orders"
  WHERE (("orders"."id" = "notifications"."order_id") AND ("orders"."bar_id" = "public"."auth_bar_id"())))))));



ALTER TABLE "public"."ocr_jobs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ocr_jobs_platform_full" ON "public"."ocr_jobs" USING (("public"."auth_role"() = 'platform'::"text")) WITH CHECK (("public"."auth_role"() = 'platform'::"text"));



CREATE POLICY "ocr_jobs_vendor_select" ON "public"."ocr_jobs" FOR SELECT USING ((("public"."auth_role"() = 'vendor_manager'::"text") AND ("public"."auth_bar_id"() = "bar_id")));



ALTER TABLE "public"."order_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "order_events_customer_select" ON "public"."order_events" FOR SELECT USING ((("public"."auth_role"() = 'customer'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "order_events"."order_id") AND ("o"."profile_id" = "public"."auth_profile_id"()))))));



CREATE POLICY "order_events_platform_full" ON "public"."order_events" USING (("public"."auth_role"() = 'platform'::"text")) WITH CHECK (("public"."auth_role"() = 'platform'::"text"));



CREATE POLICY "order_events_vendor_rw" ON "public"."order_events" USING ((("public"."auth_role"() = ANY (ARRAY['vendor_manager'::"text", 'vendor_staff'::"text"])) AND (EXISTS ( SELECT 1
   FROM "public"."orders"
  WHERE (("orders"."id" = "order_events"."order_id") AND ("orders"."bar_id" = "public"."auth_bar_id"())))))) WITH CHECK ((("public"."auth_role"() = ANY (ARRAY['vendor_manager'::"text", 'vendor_staff'::"text"])) AND (EXISTS ( SELECT 1
   FROM "public"."orders"
  WHERE (("orders"."id" = "order_events"."order_id") AND ("orders"."bar_id" = "public"."auth_bar_id"()))))));



ALTER TABLE "public"."order_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "order_items_customer_select" ON "public"."order_items" FOR SELECT USING ((("public"."auth_role"() = 'customer'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "order_items"."order_id") AND ("o"."profile_id" = "public"."auth_profile_id"()))))));



CREATE POLICY "order_items_platform_full" ON "public"."order_items" USING (("public"."auth_role"() = 'platform'::"text")) WITH CHECK (("public"."auth_role"() = 'platform'::"text"));



CREATE POLICY "order_items_vendor_select" ON "public"."order_items" FOR SELECT USING ((("public"."auth_role"() = ANY (ARRAY['vendor_manager'::"text", 'vendor_staff'::"text"])) AND (EXISTS ( SELECT 1
   FROM "public"."orders"
  WHERE (("orders"."id" = "order_items"."order_id") AND ("orders"."bar_id" = "public"."auth_bar_id"()))))));



ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "orders_customer_select" ON "public"."orders" FOR SELECT USING ((("public"."auth_role"() = ANY (ARRAY['customer'::"text", 'platform'::"text"])) AND (("public"."auth_role"() = 'platform'::"text") OR ("public"."auth_profile_id"() = "profile_id"))));



CREATE POLICY "orders_platform_full" ON "public"."orders" USING (("public"."auth_role"() = 'platform'::"text")) WITH CHECK (("public"."auth_role"() = 'platform'::"text"));



CREATE POLICY "orders_vendor_rw" ON "public"."orders" USING ((("public"."auth_role"() = ANY (ARRAY['vendor_manager'::"text", 'vendor_staff'::"text"])) AND ("public"."auth_bar_id"() = "bar_id"))) WITH CHECK ((("public"."auth_role"() = ANY (ARRAY['vendor_manager'::"text", 'vendor_staff'::"text"])) AND ("public"."auth_bar_id"() = "bar_id")));



ALTER TABLE "public"."passengers_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."served_drivers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."served_passengers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sessions_platform_full" ON "public"."sessions" USING (("public"."auth_role"() = 'platform'::"text")) WITH CHECK (("public"."auth_role"() = 'platform'::"text"));



CREATE POLICY "sessions_role_rw" ON "public"."sessions" USING ((("public"."auth_role"() = 'platform'::"text") OR (("public"."auth_role"() = 'customer'::"text") AND ("public"."auth_profile_id"() = "profile_id")))) WITH CHECK ((("public"."auth_role"() = 'platform'::"text") OR (("public"."auth_role"() = 'customer'::"text") AND ("public"."auth_profile_id"() = "profile_id"))));



ALTER TABLE "public"."shops" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trips" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wa_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wa_inbound" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."webhook_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "webhook_logs_platform_full" ON "public"."webhook_logs" USING (("public"."auth_role"() = 'platform'::"text")) WITH CHECK (("public"."auth_role"() = 'platform'::"text"));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."_touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."_touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_touch_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_sub_command"("_action" "text", "_reference" "text", "_actor" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_sub_command"("_action" "text", "_reference" "text", "_actor" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_sub_command"("_action" "text", "_reference" "text", "_actor" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_sub_list_pending"("_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_sub_list_pending"("_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_sub_list_pending"("_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."auth_bar_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."auth_bar_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auth_bar_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auth_claim"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."auth_claim"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."auth_claim"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."auth_customer_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."auth_customer_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auth_customer_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auth_profile_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."auth_profile_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auth_profile_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auth_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."auth_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auth_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auth_wa_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."auth_wa_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auth_wa_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."basket_close"("_profile_id" "uuid", "_basket_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."basket_close"("_profile_id" "uuid", "_basket_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."basket_close"("_profile_id" "uuid", "_basket_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."basket_create"("_profile_id" "uuid", "_whatsapp" "text", "_name" "text", "_is_public" boolean, "_goal_minor" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."basket_create"("_profile_id" "uuid", "_whatsapp" "text", "_name" "text", "_is_public" boolean, "_goal_minor" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."basket_create"("_profile_id" "uuid", "_whatsapp" "text", "_name" "text", "_is_public" boolean, "_goal_minor" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."basket_detail"("_profile_id" "uuid", "_basket_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."basket_detail"("_profile_id" "uuid", "_basket_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."basket_detail"("_profile_id" "uuid", "_basket_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."basket_discover_nearby"("_profile_id" "uuid", "_lat" double precision, "_lng" double precision, "_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."basket_discover_nearby"("_profile_id" "uuid", "_lat" double precision, "_lng" double precision, "_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."basket_discover_nearby"("_profile_id" "uuid", "_lat" double precision, "_lng" double precision, "_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."basket_generate_qr"("_profile_id" "uuid", "_basket_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."basket_generate_qr"("_profile_id" "uuid", "_basket_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."basket_generate_qr"("_profile_id" "uuid", "_basket_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."basket_join_by_code"("_profile_id" "uuid", "_whatsapp" "text", "_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."basket_join_by_code"("_profile_id" "uuid", "_whatsapp" "text", "_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."basket_join_by_code"("_profile_id" "uuid", "_whatsapp" "text", "_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."basket_leave"("_profile_id" "uuid", "_basket_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."basket_leave"("_profile_id" "uuid", "_basket_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."basket_leave"("_profile_id" "uuid", "_basket_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."basket_list_mine"("_profile_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."basket_list_mine"("_profile_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."basket_list_mine"("_profile_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON FUNCTION "public"."claim_notifications"("_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."claim_notifications"("_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_notifications"("_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_assert_basket_create_rate_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_assert_basket_create_rate_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_assert_basket_create_rate_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_assert_basket_join_rate_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_assert_basket_join_rate_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_assert_basket_join_rate_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."gate_pro_feature"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."gate_pro_feature"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gate_pro_feature"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_order_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_order_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_order_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."haversine_km"("lat1" double precision, "lng1" double precision, "lat2" double precision, "lng2" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."haversine_km"("lat1" double precision, "lng1" double precision, "lat2" double precision, "lng2" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."haversine_km"("lat1" double precision, "lng1" double precision, "lat2" double precision, "lng2" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_profile_credits"("in_user_id" "uuid", "in_delta" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_profile_credits"("in_user_id" "uuid", "in_delta" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_profile_credits"("in_user_id" "uuid", "in_delta" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."insurance_queue_media"("_profile_id" "uuid", "_wa_id" "text", "_storage_path" "text", "_mime_type" "text", "_caption" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."insurance_queue_media"("_profile_id" "uuid", "_wa_id" "text", "_storage_path" "text", "_mime_type" "text", "_caption" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."insurance_queue_media"("_profile_id" "uuid", "_wa_id" "text", "_storage_path" "text", "_mime_type" "text", "_caption" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."km"("a" "public"."geography", "b" "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."km"("a" "public"."geography", "b" "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."km"("a" "public"."geography", "b" "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_driver_served"("viewer_e164" "text", "driver_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_driver_served"("viewer_e164" "text", "driver_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_driver_served"("viewer_e164" "text", "driver_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_passenger_served"("viewer_e164" "text", "trip_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_passenger_served"("viewer_e164" "text", "trip_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_passenger_served"("viewer_e164" "text", "trip_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_served"("_viewer" "text", "_kind" "text", "_target_pk" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_served"("_viewer" "text", "_kind" "text", "_target_pk" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_served"("_viewer" "text", "_kind" "text", "_target_pk" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."marketplace_add_business"("_owner" "text", "_name" "text", "_description" "text", "_catalog" "text", "_lat" double precision, "_lng" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."marketplace_add_business"("_owner" "text", "_name" "text", "_description" "text", "_catalog" "text", "_lat" double precision, "_lng" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."marketplace_add_business"("_owner" "text", "_name" "text", "_description" "text", "_catalog" "text", "_lat" double precision, "_lng" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."match_drivers_for_trip"("_trip_id" "uuid", "_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."match_drivers_for_trip"("_trip_id" "uuid", "_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_drivers_for_trip"("_trip_id" "uuid", "_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."match_drivers_for_trip"("_trip_id" "uuid", "_limit" integer, "_prefer_dropoff" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."match_drivers_for_trip"("_trip_id" "uuid", "_limit" integer, "_prefer_dropoff" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_drivers_for_trip"("_trip_id" "uuid", "_limit" integer, "_prefer_dropoff" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."match_drivers_for_trip_v2"("_trip_id" "uuid", "_limit" integer, "_prefer_dropoff" boolean, "_radius_m" integer, "_window_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."match_drivers_for_trip_v2"("_trip_id" "uuid", "_limit" integer, "_prefer_dropoff" boolean, "_radius_m" integer, "_window_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_drivers_for_trip_v2"("_trip_id" "uuid", "_limit" integer, "_prefer_dropoff" boolean, "_radius_m" integer, "_window_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."match_passengers_for_trip"("_trip_id" "uuid", "_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."match_passengers_for_trip"("_trip_id" "uuid", "_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_passengers_for_trip"("_trip_id" "uuid", "_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."match_passengers_for_trip"("_trip_id" "uuid", "_limit" integer, "_prefer_dropoff" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."match_passengers_for_trip"("_trip_id" "uuid", "_limit" integer, "_prefer_dropoff" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_passengers_for_trip"("_trip_id" "uuid", "_limit" integer, "_prefer_dropoff" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."match_passengers_for_trip_v2"("_trip_id" "uuid", "_limit" integer, "_prefer_dropoff" boolean, "_radius_m" integer, "_window_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."match_passengers_for_trip_v2"("_trip_id" "uuid", "_limit" integer, "_prefer_dropoff" boolean, "_radius_m" integer, "_window_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_passengers_for_trip_v2"("_trip_id" "uuid", "_limit" integer, "_prefer_dropoff" boolean, "_radius_m" integer, "_window_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."nearby_businesses"("_lat" double precision, "_lng" double precision, "_viewer" "text", "_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."nearby_businesses"("_lat" double precision, "_lng" double precision, "_viewer" "text", "_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."nearby_businesses"("_lat" double precision, "_lng" double precision, "_viewer" "text", "_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."nearby_drivers"("_lat" double precision, "_lon" double precision, "_viewer" "text", "_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."nearby_drivers"("_lat" double precision, "_lon" double precision, "_viewer" "text", "_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."nearby_drivers"("_lat" double precision, "_lon" double precision, "_viewer" "text", "_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."nearby_drivers_by_vehicle"("_lat" double precision, "_lon" double precision, "_viewer" "text", "_vehicle" "text", "_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."nearby_drivers_by_vehicle"("_lat" double precision, "_lon" double precision, "_viewer" "text", "_vehicle" "text", "_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."nearby_drivers_by_vehicle"("_lat" double precision, "_lon" double precision, "_viewer" "text", "_vehicle" "text", "_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."nearby_passengers"("_lat" double precision, "_lon" double precision, "_viewer" "text", "_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."nearby_passengers"("_lat" double precision, "_lon" double precision, "_viewer" "text", "_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."nearby_passengers"("_lat" double precision, "_lon" double precision, "_viewer" "text", "_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."nearby_passengers_by_vehicle"("_lat" double precision, "_lon" double precision, "_viewer" "text", "_vehicle" "text", "_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."nearby_passengers_by_vehicle"("_lat" double precision, "_lon" double precision, "_viewer" "text", "_vehicle" "text", "_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."nearby_passengers_by_vehicle"("_lat" double precision, "_lon" double precision, "_viewer" "text", "_vehicle" "text", "_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."on_menu_publish_refresh"() TO "anon";
GRANT ALL ON FUNCTION "public"."on_menu_publish_refresh"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."on_menu_publish_refresh"() TO "service_role";



GRANT ALL ON FUNCTION "public"."orders_set_defaults"() TO "anon";
GRANT ALL ON FUNCTION "public"."orders_set_defaults"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."orders_set_defaults"() TO "service_role";



GRANT ALL ON FUNCTION "public"."profile_ref_code"("_profile_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."profile_ref_code"("_profile_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."profile_ref_code"("_profile_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."profile_wa"("_profile_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."profile_wa"("_profile_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."profile_wa"("_profile_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."promote_draft_menu"("_bar_id" "uuid", "_draft_menu_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."promote_draft_menu"("_bar_id" "uuid", "_draft_menu_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."promote_draft_menu"("_bar_id" "uuid", "_draft_menu_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."purge_expired_served"() TO "anon";
GRANT ALL ON FUNCTION "public"."purge_expired_served"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."purge_expired_served"() TO "service_role";



GRANT ALL ON FUNCTION "public"."recent_businesses_near"("in_lat" double precision, "in_lng" double precision, "in_category_id" integer, "in_radius_km" numeric, "in_max" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."recent_businesses_near"("in_lat" double precision, "in_lng" double precision, "in_category_id" integer, "in_radius_km" numeric, "in_max" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."recent_businesses_near"("in_lat" double precision, "in_lng" double precision, "in_category_id" integer, "in_radius_km" numeric, "in_max" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."recent_drivers_near"("in_lat" double precision, "in_lng" double precision, "in_vehicle_type" "text", "in_radius_km" double precision, "in_max" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."recent_drivers_near"("in_lat" double precision, "in_lng" double precision, "in_vehicle_type" "text", "in_radius_km" double precision, "in_max" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."recent_drivers_near"("in_lat" double precision, "in_lng" double precision, "in_vehicle_type" "text", "in_radius_km" double precision, "in_max" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."recent_drivers_near"("in_lat" double precision, "in_lng" double precision, "in_vehicle_type" "text", "in_radius_km" numeric, "in_max" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."recent_drivers_near"("in_lat" double precision, "in_lng" double precision, "in_vehicle_type" "text", "in_radius_km" numeric, "in_max" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."recent_drivers_near"("in_lat" double precision, "in_lng" double precision, "in_vehicle_type" "text", "in_radius_km" numeric, "in_max" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."recent_passenger_trips_near"("in_lat" double precision, "in_lng" double precision, "in_vehicle_type" "text", "in_radius_km" double precision, "in_max" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."recent_passenger_trips_near"("in_lat" double precision, "in_lng" double precision, "in_vehicle_type" "text", "in_radius_km" double precision, "in_max" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."recent_passenger_trips_near"("in_lat" double precision, "in_lng" double precision, "in_vehicle_type" "text", "in_radius_km" double precision, "in_max" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."recent_passenger_trips_near"("in_lat" double precision, "in_lng" double precision, "in_vehicle_type" "text", "in_radius_km" numeric, "in_max" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."recent_passenger_trips_near"("in_lat" double precision, "in_lng" double precision, "in_vehicle_type" "text", "in_radius_km" numeric, "in_max" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."recent_passenger_trips_near"("in_lat" double precision, "in_lng" double precision, "in_vehicle_type" "text", "in_radius_km" numeric, "in_max" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_menu_items_snapshot"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_menu_items_snapshot"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_menu_items_snapshot"() TO "service_role";



GRANT ALL ON FUNCTION "public"."round"("value" double precision, "ndigits" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."round"("value" double precision, "ndigits" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."round"("value" double precision, "ndigits" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."wallet_apply_delta"("_user_id" "uuid", "_delta" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."wallet_apply_delta"("_user_id" "uuid", "_delta" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."wallet_apply_delta"("_user_id" "uuid", "_delta" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."wallet_apply_delta"("p_user_id" "uuid", "p_delta" integer, "p_type" "text", "p_meta" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."wallet_apply_delta"("p_user_id" "uuid", "p_delta" integer, "p_type" "text", "p_meta" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."wallet_apply_delta"("p_user_id" "uuid", "p_delta" integer, "p_type" "text", "p_meta" "jsonb") TO "service_role";



GRANT ALL ON TABLE "public"."wallet_earn_actions" TO "anon";
GRANT ALL ON TABLE "public"."wallet_earn_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."wallet_earn_actions" TO "service_role";



GRANT ALL ON FUNCTION "public"."wallet_earn_actions"("_profile_id" "uuid", "_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."wallet_earn_actions"("_profile_id" "uuid", "_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."wallet_earn_actions"("_profile_id" "uuid", "_limit" integer) TO "service_role";



GRANT ALL ON TABLE "public"."wallet_redeem_options" TO "anon";
GRANT ALL ON TABLE "public"."wallet_redeem_options" TO "authenticated";
GRANT ALL ON TABLE "public"."wallet_redeem_options" TO "service_role";



GRANT ALL ON FUNCTION "public"."wallet_redeem_options"("_profile_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."wallet_redeem_options"("_profile_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."wallet_redeem_options"("_profile_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."wallet_summary"("_profile_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."wallet_summary"("_profile_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."wallet_summary"("_profile_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."wallet_promoters" TO "anon";
GRANT ALL ON TABLE "public"."wallet_promoters" TO "authenticated";
GRANT ALL ON TABLE "public"."wallet_promoters" TO "service_role";



GRANT ALL ON FUNCTION "public"."wallet_top_promoters"("_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."wallet_top_promoters"("_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."wallet_top_promoters"("_limit" integer) TO "service_role";



GRANT ALL ON TABLE "public"."wallet_transactions" TO "anon";
GRANT ALL ON TABLE "public"."wallet_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."wallet_transactions" TO "service_role";



GRANT ALL ON FUNCTION "public"."wallet_transactions_recent"("_profile_id" "uuid", "_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."wallet_transactions_recent"("_profile_id" "uuid", "_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."wallet_transactions_recent"("_profile_id" "uuid", "_limit" integer) TO "service_role";



GRANT ALL ON TABLE "public"."admin_alert_prefs" TO "anon";
GRANT ALL ON TABLE "public"."admin_alert_prefs" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_alert_prefs" TO "service_role";



GRANT ALL ON TABLE "public"."admin_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."admin_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."admin_pin_sessions" TO "anon";
GRANT ALL ON TABLE "public"."admin_pin_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_pin_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."admin_sessions" TO "anon";
GRANT ALL ON TABLE "public"."admin_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."admin_submissions" TO "anon";
GRANT ALL ON TABLE "public"."admin_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."app_config" TO "anon";
GRANT ALL ON TABLE "public"."app_config" TO "authenticated";
GRANT ALL ON TABLE "public"."app_config" TO "service_role";



GRANT ALL ON TABLE "public"."audit_log" TO "anon";
GRANT ALL ON TABLE "public"."audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."bar_numbers" TO "anon";
GRANT ALL ON TABLE "public"."bar_numbers" TO "authenticated";
GRANT ALL ON TABLE "public"."bar_numbers" TO "service_role";



GRANT ALL ON TABLE "public"."bar_settings" TO "anon";
GRANT ALL ON TABLE "public"."bar_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."bar_settings" TO "service_role";



GRANT ALL ON TABLE "public"."bar_tables" TO "anon";
GRANT ALL ON TABLE "public"."bar_tables" TO "authenticated";
GRANT ALL ON TABLE "public"."bar_tables" TO "service_role";



GRANT ALL ON TABLE "public"."bars" TO "anon";
GRANT ALL ON TABLE "public"."bars" TO "authenticated";
GRANT ALL ON TABLE "public"."bars" TO "service_role";



GRANT ALL ON TABLE "public"."basket_contributions" TO "anon";
GRANT ALL ON TABLE "public"."basket_contributions" TO "authenticated";
GRANT ALL ON TABLE "public"."basket_contributions" TO "service_role";



GRANT ALL ON TABLE "public"."basket_joins" TO "anon";
GRANT ALL ON TABLE "public"."basket_joins" TO "authenticated";
GRANT ALL ON TABLE "public"."basket_joins" TO "service_role";



GRANT ALL ON TABLE "public"."basket_members" TO "anon";
GRANT ALL ON TABLE "public"."basket_members" TO "authenticated";
GRANT ALL ON TABLE "public"."basket_members" TO "service_role";



GRANT ALL ON TABLE "public"."baskets" TO "anon";
GRANT ALL ON TABLE "public"."baskets" TO "authenticated";
GRANT ALL ON TABLE "public"."baskets" TO "service_role";



GRANT ALL ON TABLE "public"."businesses" TO "anon";
GRANT ALL ON TABLE "public"."businesses" TO "authenticated";
GRANT ALL ON TABLE "public"."businesses" TO "service_role";



GRANT ALL ON TABLE "public"."campaign_recipients" TO "anon";
GRANT ALL ON TABLE "public"."campaign_recipients" TO "authenticated";
GRANT ALL ON TABLE "public"."campaign_recipients" TO "service_role";



GRANT ALL ON SEQUENCE "public"."campaign_recipients_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."campaign_recipients_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."campaign_recipients_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."campaigns" TO "anon";
GRANT ALL ON TABLE "public"."campaigns" TO "authenticated";
GRANT ALL ON TABLE "public"."campaigns" TO "service_role";



GRANT ALL ON SEQUENCE "public"."campaigns_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."campaigns_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."campaigns_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."cart_items" TO "anon";
GRANT ALL ON TABLE "public"."cart_items" TO "authenticated";
GRANT ALL ON TABLE "public"."cart_items" TO "service_role";



GRANT ALL ON TABLE "public"."carts" TO "anon";
GRANT ALL ON TABLE "public"."carts" TO "authenticated";
GRANT ALL ON TABLE "public"."carts" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."chat_sessions" TO "anon";
GRANT ALL ON TABLE "public"."chat_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."chat_state" TO "anon";
GRANT ALL ON TABLE "public"."chat_state" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_state" TO "service_role";



GRANT ALL ON TABLE "public"."contacts" TO "anon";
GRANT ALL ON TABLE "public"."contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."contacts" TO "service_role";



GRANT ALL ON SEQUENCE "public"."contacts_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."contacts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."contacts_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."contributions" TO "anon";
GRANT ALL ON TABLE "public"."contributions" TO "authenticated";
GRANT ALL ON TABLE "public"."contributions" TO "service_role";



GRANT ALL ON TABLE "public"."driver_status" TO "anon";
GRANT ALL ON TABLE "public"."driver_status" TO "authenticated";
GRANT ALL ON TABLE "public"."driver_status" TO "service_role";



GRANT ALL ON TABLE "public"."drivers_available" TO "anon";
GRANT ALL ON TABLE "public"."drivers_available" TO "authenticated";
GRANT ALL ON TABLE "public"."drivers_available" TO "service_role";



GRANT ALL ON TABLE "public"."flow_submissions" TO "anon";
GRANT ALL ON TABLE "public"."flow_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."flow_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."insurance_leads" TO "anon";
GRANT ALL ON TABLE "public"."insurance_leads" TO "authenticated";
GRANT ALL ON TABLE "public"."insurance_leads" TO "service_role";



GRANT ALL ON TABLE "public"."insurance_media" TO "anon";
GRANT ALL ON TABLE "public"."insurance_media" TO "authenticated";
GRANT ALL ON TABLE "public"."insurance_media" TO "service_role";



GRANT ALL ON TABLE "public"."insurance_media_queue" TO "anon";
GRANT ALL ON TABLE "public"."insurance_media_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."insurance_media_queue" TO "service_role";



GRANT ALL ON TABLE "public"."item_modifiers" TO "anon";
GRANT ALL ON TABLE "public"."item_modifiers" TO "authenticated";
GRANT ALL ON TABLE "public"."item_modifiers" TO "service_role";



GRANT ALL ON TABLE "public"."items" TO "anon";
GRANT ALL ON TABLE "public"."items" TO "authenticated";
GRANT ALL ON TABLE "public"."items" TO "service_role";



GRANT ALL ON TABLE "public"."leaderboard_notifications" TO "anon";
GRANT ALL ON TABLE "public"."leaderboard_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."leaderboard_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."leaderboard_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."leaderboard_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."leaderboard_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."leaderboard_snapshots_v" TO "anon";
GRANT ALL ON TABLE "public"."leaderboard_snapshots_v" TO "authenticated";
GRANT ALL ON TABLE "public"."leaderboard_snapshots_v" TO "service_role";



GRANT ALL ON TABLE "public"."marketplace_categories" TO "anon";
GRANT ALL ON TABLE "public"."marketplace_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."marketplace_categories" TO "service_role";



GRANT ALL ON SEQUENCE "public"."marketplace_categories_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."marketplace_categories_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."marketplace_categories_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."menu_items_snapshot" TO "anon";
GRANT ALL ON TABLE "public"."menu_items_snapshot" TO "authenticated";
GRANT ALL ON TABLE "public"."menu_items_snapshot" TO "service_role";



GRANT ALL ON TABLE "public"."menus" TO "anon";
GRANT ALL ON TABLE "public"."menus" TO "authenticated";
GRANT ALL ON TABLE "public"."menus" TO "service_role";



GRANT ALL ON TABLE "public"."mobility_pro_access" TO "anon";
GRANT ALL ON TABLE "public"."mobility_pro_access" TO "authenticated";
GRANT ALL ON TABLE "public"."mobility_pro_access" TO "service_role";



GRANT ALL ON TABLE "public"."momo_qr_requests" TO "anon";
GRANT ALL ON TABLE "public"."momo_qr_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."momo_qr_requests" TO "service_role";



GRANT ALL ON TABLE "public"."ocr_jobs" TO "anon";
GRANT ALL ON TABLE "public"."ocr_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."ocr_jobs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."order_code_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."order_code_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."order_code_seq" TO "service_role";



GRANT ALL ON TABLE "public"."order_events" TO "anon";
GRANT ALL ON TABLE "public"."order_events" TO "authenticated";
GRANT ALL ON TABLE "public"."order_events" TO "service_role";



GRANT ALL ON TABLE "public"."order_items" TO "anon";
GRANT ALL ON TABLE "public"."order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_items" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."passengers_requests" TO "anon";
GRANT ALL ON TABLE "public"."passengers_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."passengers_requests" TO "service_role";



GRANT ALL ON TABLE "public"."petrol_stations" TO "anon";
GRANT ALL ON TABLE "public"."petrol_stations" TO "authenticated";
GRANT ALL ON TABLE "public"."petrol_stations" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."promo_rules" TO "anon";
GRANT ALL ON TABLE "public"."promo_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."promo_rules" TO "service_role";



GRANT ALL ON TABLE "public"."published_menus" TO "anon";
GRANT ALL ON TABLE "public"."published_menus" TO "authenticated";
GRANT ALL ON TABLE "public"."published_menus" TO "service_role";



GRANT ALL ON TABLE "public"."referral_attributions" TO "anon";
GRANT ALL ON TABLE "public"."referral_attributions" TO "authenticated";
GRANT ALL ON TABLE "public"."referral_attributions" TO "service_role";



GRANT ALL ON TABLE "public"."referral_clicks" TO "anon";
GRANT ALL ON TABLE "public"."referral_clicks" TO "authenticated";
GRANT ALL ON TABLE "public"."referral_clicks" TO "service_role";



GRANT ALL ON TABLE "public"."referral_links" TO "anon";
GRANT ALL ON TABLE "public"."referral_links" TO "authenticated";
GRANT ALL ON TABLE "public"."referral_links" TO "service_role";



GRANT ALL ON TABLE "public"."segments" TO "anon";
GRANT ALL ON TABLE "public"."segments" TO "authenticated";
GRANT ALL ON TABLE "public"."segments" TO "service_role";



GRANT ALL ON SEQUENCE "public"."segments_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."segments_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."segments_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."send_logs" TO "anon";
GRANT ALL ON TABLE "public"."send_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."send_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."send_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."send_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."send_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."send_queue" TO "anon";
GRANT ALL ON TABLE "public"."send_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."send_queue" TO "service_role";



GRANT ALL ON SEQUENCE "public"."send_queue_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."send_queue_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."send_queue_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."served_drivers" TO "anon";
GRANT ALL ON TABLE "public"."served_drivers" TO "authenticated";
GRANT ALL ON TABLE "public"."served_drivers" TO "service_role";



GRANT ALL ON TABLE "public"."served_passengers" TO "anon";
GRANT ALL ON TABLE "public"."served_passengers" TO "authenticated";
GRANT ALL ON TABLE "public"."served_passengers" TO "service_role";



GRANT ALL ON TABLE "public"."sessions" TO "anon";
GRANT ALL ON TABLE "public"."sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."sessions" TO "service_role";



GRANT ALL ON TABLE "public"."shops" TO "anon";
GRANT ALL ON TABLE "public"."shops" TO "authenticated";
GRANT ALL ON TABLE "public"."shops" TO "service_role";



GRANT ALL ON TABLE "public"."station_numbers" TO "anon";
GRANT ALL ON TABLE "public"."station_numbers" TO "authenticated";
GRANT ALL ON TABLE "public"."station_numbers" TO "service_role";



GRANT ALL ON TABLE "public"."templates" TO "anon";
GRANT ALL ON TABLE "public"."templates" TO "authenticated";
GRANT ALL ON TABLE "public"."templates" TO "service_role";



GRANT ALL ON SEQUENCE "public"."templates_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."templates_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."templates_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."trips" TO "anon";
GRANT ALL ON TABLE "public"."trips" TO "authenticated";
GRANT ALL ON TABLE "public"."trips" TO "service_role";



GRANT ALL ON TABLE "public"."voucher_redemptions" TO "anon";
GRANT ALL ON TABLE "public"."voucher_redemptions" TO "authenticated";
GRANT ALL ON TABLE "public"."voucher_redemptions" TO "service_role";



GRANT ALL ON TABLE "public"."vouchers" TO "anon";
GRANT ALL ON TABLE "public"."vouchers" TO "authenticated";
GRANT ALL ON TABLE "public"."vouchers" TO "service_role";



GRANT ALL ON TABLE "public"."wa_events" TO "anon";
GRANT ALL ON TABLE "public"."wa_events" TO "authenticated";
GRANT ALL ON TABLE "public"."wa_events" TO "service_role";



GRANT ALL ON TABLE "public"."wa_inbound" TO "anon";
GRANT ALL ON TABLE "public"."wa_inbound" TO "authenticated";
GRANT ALL ON TABLE "public"."wa_inbound" TO "service_role";



GRANT ALL ON TABLE "public"."wa_inbox" TO "anon";
GRANT ALL ON TABLE "public"."wa_inbox" TO "authenticated";
GRANT ALL ON TABLE "public"."wa_inbox" TO "service_role";



GRANT ALL ON SEQUENCE "public"."wa_inbox_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."wa_inbox_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."wa_inbox_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."wallet_accounts" TO "anon";
GRANT ALL ON TABLE "public"."wallet_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."wallet_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."wallet_ledger" TO "anon";
GRANT ALL ON TABLE "public"."wallet_ledger" TO "authenticated";
GRANT ALL ON TABLE "public"."wallet_ledger" TO "service_role";



GRANT ALL ON SEQUENCE "public"."wallet_ledger_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."wallet_ledger_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."wallet_ledger_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."wallet_redemptions" TO "anon";
GRANT ALL ON TABLE "public"."wallet_redemptions" TO "authenticated";
GRANT ALL ON TABLE "public"."wallet_redemptions" TO "service_role";



GRANT ALL ON TABLE "public"."wallets" TO "anon";
GRANT ALL ON TABLE "public"."wallets" TO "authenticated";
GRANT ALL ON TABLE "public"."wallets" TO "service_role";



GRANT ALL ON TABLE "public"."webhook_logs" TO "anon";
GRANT ALL ON TABLE "public"."webhook_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."webhook_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."webhook_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."webhook_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."webhook_logs_id_seq" TO "service_role";



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






RESET ALL;
