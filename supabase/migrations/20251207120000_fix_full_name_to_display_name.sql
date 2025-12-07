-- ============================================================================
-- FIX: Replace p.full_name with p.display_name in all functions
-- ============================================================================
-- Issue: profiles table uses display_name, not full_name
-- Error: column p.full_name does not exist (PostgreSQL error 42703)
-- 
-- This migration recreates all database functions and views that incorrectly
-- reference p.full_name to use p.display_name instead.
-- 
-- Affected functions:
-- 1. match_drivers_for_trip_v2 - Driver matching for mobility
-- 2. match_passengers_for_trip_v2 - Passenger matching for mobility
-- 3. get_pending_certificates - Insurance certificates
-- 4. get_manual_reviews - Manual review queue
-- 5. get_expiring_insurance - Expiring insurance policies
-- 
-- Affected views:
-- 1. active_profile_users - Profile monitoring view
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Fix match_drivers_for_trip_v2
-- ============================================================================
CREATE OR REPLACE FUNCTION public.match_drivers_for_trip_v2(
  _trip_id uuid,
  _limit integer DEFAULT 9,
  _prefer_dropoff boolean DEFAULT false,
  _radius_m integer DEFAULT 10000,
  _window_days integer DEFAULT 2
)
RETURNS TABLE (
  trip_id uuid,
  creator_user_id uuid,
  whatsapp_e164 text,
  ref_code text,
  distance_km numeric,
  drop_bonus_m numeric,
  pickup_text text,
  dropoff_text text,
  matched_at timestamptz,
  created_at timestamptz,
  vehicle_type text,
  is_exact_match boolean,
  location_age_minutes integer,
  number_plate text,
  driver_name text,
  role text
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_pickup_lat double precision;
  v_pickup_lng double precision;
  v_dropoff_lat double precision;
  v_dropoff_lng double precision;
  v_vehicle_type text;
  v_pickup_geog geography;
BEGIN
  -- Get the requesting trip's location and vehicle type from V2 table
  SELECT 
    t.pickup_lat,
    t.pickup_lng,
    t.dropoff_lat,
    t.dropoff_lng,
    t.vehicle_type,
    t.pickup_geog
  INTO 
    v_pickup_lat,
    v_pickup_lng,
    v_dropoff_lat,
    v_dropoff_lng,
    v_vehicle_type,
    v_pickup_geog
  FROM public.mobility_trips t
  WHERE t.id = _trip_id;

  -- Return empty if trip not found
  IF v_pickup_lat IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    t.id AS trip_id,
    t.creator_user_id,
    COALESCE(p.phone_number, p.wa_id) AS whatsapp_e164,
    SUBSTRING(t.id::text, 1, 8) AS ref_code,
    ROUND(
      (ST_Distance(t.pickup_geog, v_pickup_geog) / 1000.0)::numeric, 
      2
    ) AS distance_km,
    -- Calculate dropoff bonus if both trips have dropoff locations
    CASE
      WHEN _prefer_dropoff AND v_dropoff_lat IS NOT NULL AND t.dropoff_lat IS NOT NULL THEN
        ROUND(
          (ST_Distance(
            ST_SetSRID(ST_MakePoint(t.dropoff_lng, t.dropoff_lat), 4326)::geography,
            ST_SetSRID(ST_MakePoint(v_dropoff_lng, v_dropoff_lat), 4326)::geography
          ))::numeric,
          0
        )
      ELSE NULL::numeric
    END AS drop_bonus_m,
    t.pickup_text,
    t.dropoff_text,
    t.matched_at,
    t.created_at,
    t.vehicle_type,
    (t.vehicle_type = v_vehicle_type) AS is_exact_match,
    -- Calculate location age in minutes (how fresh is their position)
    EXTRACT(EPOCH FROM (now() - COALESCE(t.last_location_update, t.created_at)))::integer / 60 AS location_age_minutes,
    -- Number plate from profile metadata (drivers often store it there)
    COALESCE((p.metadata->>'number_plate')::text, (p.metadata->'driver'->>'number_plate')::text) AS number_plate,
    COALESCE(p.display_name, p.phone_number, 'Driver') AS driver_name,
    'driver'::text AS role
  FROM public.mobility_trips t
  INNER JOIN public.profiles p ON p.user_id = t.creator_user_id
  WHERE t.role = 'driver'
    -- Status: only open trips (V2 simplified statuses)
    AND t.status = 'open'
    -- Expiry: NULL expires_at means never expires, otherwise must be in future
    AND (t.expires_at IS NULL OR t.expires_at > now())
    -- Location must exist
    AND t.pickup_lat IS NOT NULL
    AND t.pickup_lng IS NOT NULL
    -- Location freshness: 24 hours window
    AND COALESCE(t.last_location_update, t.created_at) > now() - interval '24 hours'
    -- Window: Only trips created within the window (default 2 days)
    AND t.created_at > now() - (_window_days || ' days')::interval
    -- Exclude the requesting trip
    AND t.id != _trip_id
    -- Spatial filter: Within search radius
    AND ST_DWithin(
      t.pickup_geog,
      v_pickup_geog,
      _radius_m::double precision
    )
  ORDER BY 
    -- Primary: Distance (closest first)
    ST_Distance(t.pickup_geog, v_pickup_geog) ASC,
    -- Secondary: Most recently active
    COALESCE(t.last_location_update, t.created_at) DESC,
    -- Tertiary: Exact vehicle match preferred
    (t.vehicle_type = v_vehicle_type) DESC
  LIMIT _limit;
END;
$$;

-- ============================================================================
-- 2. Fix match_passengers_for_trip_v2
-- ============================================================================
CREATE OR REPLACE FUNCTION public.match_passengers_for_trip_v2(
  _trip_id uuid,
  _limit integer DEFAULT 9,
  _prefer_dropoff boolean DEFAULT false,
  _radius_m integer DEFAULT 10000,
  _window_days integer DEFAULT 2
)
RETURNS TABLE (
  trip_id uuid,
  creator_user_id uuid,
  whatsapp_e164 text,
  ref_code text,
  distance_km numeric,
  drop_bonus_m numeric,
  pickup_text text,
  dropoff_text text,
  matched_at timestamptz,
  created_at timestamptz,
  vehicle_type text,
  is_exact_match boolean,
  location_age_minutes integer,
  number_plate text,
  driver_name text,
  role text
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_pickup_lat double precision;
  v_pickup_lng double precision;
  v_dropoff_lat double precision;
  v_dropoff_lng double precision;
  v_vehicle_type text;
  v_pickup_geog geography;
BEGIN
  -- Get the requesting trip's location and vehicle type
  SELECT 
    t.pickup_lat,
    t.pickup_lng,
    t.dropoff_lat,
    t.dropoff_lng,
    t.vehicle_type,
    t.pickup_geog
  INTO 
    v_pickup_lat,
    v_pickup_lng,
    v_dropoff_lat,
    v_dropoff_lng,
    v_vehicle_type,
    v_pickup_geog
  FROM public.mobility_trips t
  WHERE t.id = _trip_id;

  -- Return empty if trip not found
  IF v_pickup_lat IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    t.id AS trip_id,
    t.creator_user_id,
    COALESCE(p.phone_number, p.wa_id) AS whatsapp_e164,
    SUBSTRING(t.id::text, 1, 8) AS ref_code,
    ROUND(
      (ST_Distance(t.pickup_geog, v_pickup_geog) / 1000.0)::numeric, 
      2
    ) AS distance_km,
    -- Calculate dropoff bonus if both trips have dropoff locations
    CASE
      WHEN _prefer_dropoff AND v_dropoff_lat IS NOT NULL AND t.dropoff_lat IS NOT NULL THEN
        ROUND(
          (ST_Distance(
            ST_SetSRID(ST_MakePoint(t.dropoff_lng, t.dropoff_lat), 4326)::geography,
            ST_SetSRID(ST_MakePoint(v_dropoff_lng, v_dropoff_lat), 4326)::geography
          ))::numeric,
          0
        )
      ELSE NULL::numeric
    END AS drop_bonus_m,
    t.pickup_text,
    t.dropoff_text,
    t.matched_at,
    t.created_at,
    t.vehicle_type,
    (t.vehicle_type = v_vehicle_type) AS is_exact_match,
    -- Calculate location age in minutes
    EXTRACT(EPOCH FROM (now() - COALESCE(t.last_location_update, t.created_at)))::integer / 60 AS location_age_minutes,
    NULL::text AS number_plate,  -- Passengers don't have number plates
    COALESCE(p.display_name, p.phone_number, 'Driver') AS driver_name,  -- Reusing column name for passenger name
    'passenger'::text AS role
  FROM public.mobility_trips t
  INNER JOIN public.profiles p ON p.user_id = t.creator_user_id
  WHERE t.role = 'passenger'
    -- Status: only open trips (V2 simplified statuses)
    AND t.status = 'open'
    -- Expiry: NULL expires_at means never expires, otherwise must be in future
    AND (t.expires_at IS NULL OR t.expires_at > now())
    -- Location must exist
    AND t.pickup_lat IS NOT NULL
    AND t.pickup_lng IS NOT NULL
    -- Location freshness: 24 hours window
    AND COALESCE(t.last_location_update, t.created_at) > now() - interval '24 hours'
    -- Window: Only trips created within the window (default 2 days)
    AND t.created_at > now() - (_window_days || ' days')::interval
    -- Exclude the requesting trip
    AND t.id != _trip_id
    -- Spatial filter: Within search radius
    AND ST_DWithin(
      t.pickup_geog,
      v_pickup_geog,
      _radius_m::double precision
    )
  ORDER BY 
    -- Primary: Distance (closest first)
    ST_Distance(t.pickup_geog, v_pickup_geog) ASC,
    -- Secondary: Most recently active
    COALESCE(t.last_location_update, t.created_at) DESC,
    -- Tertiary: Exact vehicle match preferred
    (t.vehicle_type = v_vehicle_type) DESC
  LIMIT _limit;
END;
$$;

-- ============================================================================
-- 3. Fix get_pending_certificates
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_pending_certificates(
  p_limit INTEGER DEFAULT 50
) RETURNS TABLE (
  id UUID,
  user_id UUID,
  vehicle_plate TEXT,
  insurer_name TEXT,
  policy_number TEXT,
  policy_expiry DATE,
  created_at TIMESTAMPTZ,
  user_phone TEXT,
  user_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dic.id,
    dic.user_id,
    dic.vehicle_plate,
    dic.insurer_name,
    dic.policy_number,
    dic.policy_expiry,
    dic.created_at,
    COALESCE(p.phone_number, p.wa_id) AS user_phone,
    COALESCE(p.display_name, p.phone_number, 'Unknown') AS user_name
  FROM public.driver_insurance_certificates dic
  INNER JOIN public.profiles p ON p.user_id = dic.user_id
  WHERE dic.status = 'pending'
  ORDER BY dic.created_at ASC
  LIMIT p_limit;
END;
$$;

-- ============================================================================
-- 4. Fix get_manual_reviews
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_manual_reviews(
  p_status TEXT DEFAULT 'pending',
  p_limit INTEGER DEFAULT 50
) RETURNS TABLE (
  id UUID,
  user_id UUID,
  media_url TEXT,
  ocr_attempts INTEGER,
  last_ocr_error TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  user_phone TEXT,
  user_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    imr.id,
    imr.user_id,
    imr.media_url,
    imr.ocr_attempts,
    imr.last_ocr_error,
    imr.status,
    imr.created_at,
    COALESCE(p.phone_number, p.wa_id) AS user_phone,
    COALESCE(p.display_name, p.phone_number, 'Unknown') AS user_name
  FROM public.insurance_manual_reviews imr
  INNER JOIN public.profiles p ON p.user_id = imr.user_id
  WHERE imr.status = p_status
  ORDER BY imr.created_at ASC
  LIMIT p_limit;
END;
$$;

-- ============================================================================
-- 5. Fix get_expiring_insurance
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_expiring_insurance(
  p_days_before INTEGER DEFAULT 7
) RETURNS TABLE (
  id UUID,
  user_id UUID,
  vehicle_plate TEXT,
  policy_expiry DATE,
  user_phone TEXT,
  user_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dic.id,
    dic.user_id,
    dic.vehicle_plate,
    dic.policy_expiry,
    COALESCE(p.phone_number, p.wa_id) AS user_phone,
    COALESCE(p.display_name, p.phone_number, 'Unknown') AS user_name
  FROM public.driver_insurance_certificates dic
  INNER JOIN public.profiles p ON p.user_id = dic.user_id
  WHERE dic.status = 'active'
    AND dic.policy_expiry BETWEEN CURRENT_DATE AND (CURRENT_DATE + (p_days_before || ' days')::interval)
  ORDER BY dic.policy_expiry ASC;
END;
$$;

-- ============================================================================
-- 6. Fix active_profile_users view
-- ============================================================================
CREATE OR REPLACE VIEW public.active_profile_users AS
SELECT 
  p.user_id,
  p.display_name,
  p.phone_number,
  p.language,
  wb.balance as wallet_balance,
  COUNT(DISTINCT sl.id) as saved_locations_count,
  COUNT(DISTINCT b.id) as businesses_count,
  COUNT(DISTINCT j.id) as jobs_count,
  COUNT(DISTINCT pr.id) as properties_count,
  p.created_at as profile_created_at,
  MAX(GREATEST(
    COALESCE(sl.updated_at, sl.created_at),
    COALESCE(b.updated_at, b.created_at),
    COALESCE(j.updated_at, j.created_at),
    COALESCE(pr.updated_at, pr.created_at)
  )) as last_activity
FROM public.profiles p
LEFT JOIN public.wallet_balance wb ON wb.user_id = p.user_id
LEFT JOIN public.saved_locations sl ON sl.user_id = p.user_id
LEFT JOIN public.businesses b ON b.owner_user_id = p.user_id AND b.deleted_at IS NULL
LEFT JOIN public.jobs j ON j.creator_user_id = p.user_id AND j.deleted_at IS NULL
LEFT JOIN public.properties pr ON pr.owner_user_id = p.user_id AND pr.deleted_at IS NULL
GROUP BY p.user_id, p.display_name, p.phone_number, p.language, wb.balance, p.created_at
ORDER BY last_activity DESC NULLS LAST;

COMMENT ON VIEW public.active_profile_users IS
  'Profile overview for admin monitoring - Fixed to use display_name instead of full_name';

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (Run manually to verify fix)
-- ============================================================================
-- These queries should return 0 rows after this migration is applied:
--
-- -- Check for functions still using p.full_name
-- SELECT routine_name, routine_definition
-- FROM information_schema.routines 
-- WHERE routine_schema = 'public' 
--   AND routine_definition ILIKE '%p.full_name%';
--
-- -- Check for views still using p.full_name in wrong context
-- SELECT table_name, view_definition
-- FROM information_schema.views 
-- WHERE table_schema = 'public' 
--   AND view_definition ILIKE '%p.full_name%';
-- ============================================================================
