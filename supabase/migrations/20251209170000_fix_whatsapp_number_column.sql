-- ============================================================================
-- CRITICAL HOTFIX: Fix Non-Existent Column References in Matching Functions
-- ============================================================================
-- Migration: 20251209170000_fix_whatsapp_number_column.sql
-- Date: 2025-12-09
-- 
-- BUG IDENTIFIED:
-- Migration 20251209090000 introduced references to non-existent columns:
-- 1. p.whatsapp_number (DOES NOT EXIST in profiles table)
-- 2. p.whatsapp_e164 (This is OUTPUT column name, not input column)
--
-- PROFILES TABLE ACTUAL COLUMNS:
-- - phone_number ✅
-- - wa_id ✅
-- - display_name ✅
-- - whatsapp_number ❌ DOES NOT EXIST
-- - whatsapp_e164 ❌ DOES NOT EXIST (output alias only)
--
-- ERROR IN PRODUCTION:
-- "column p.whatsapp_number does not exist"
-- Function: match_drivers_for_trip_v2
-- Impact: Nearby driver/passenger matching BROKEN
--
-- FIX:
-- Replace all references:
-- - WRONG: COALESCE(p.phone_number, p.whatsapp_number, p.wa_id)
-- - CORRECT: COALESCE(p.phone_number, p.wa_id)
-- - WRONG: COALESCE(p.display_name, p.phone_number, p.whatsapp_e164, p.wa_id)
-- - CORRECT: COALESCE(p.display_name, p.phone_number, p.wa_id)
-- ============================================================================

BEGIN;

-- Drop existing functions
DROP FUNCTION IF EXISTS public.match_drivers_for_trip_v2(uuid, integer, boolean, integer, integer);
DROP FUNCTION IF EXISTS public.match_passengers_for_trip_v2(uuid, integer, boolean, integer, integer);

-- ============================================================================
-- MATCH DRIVERS FOR TRIP V2 (FIXED)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.match_drivers_for_trip_v2(
  _trip_id uuid,
  _limit integer DEFAULT 9,
  _prefer_dropoff boolean DEFAULT false,
  _radius_m integer DEFAULT 10000,
  _window_days integer DEFAULT 2
) RETURNS TABLE (
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
  v_pickup_geog geography;
  v_dropoff_geog geography;
  v_vehicle_type text;
  v_radius double precision;
BEGIN
  SELECT t.pickup_geog, t.dropoff_geog, t.vehicle_type
  INTO v_pickup_geog, v_dropoff_geog, v_vehicle_type
  FROM public.trips t
  WHERE t.id = _trip_id;

  IF v_pickup_geog IS NULL THEN
    RETURN;
  END IF;

  v_radius := COALESCE(NULLIF(_radius_m, 0), 10000)::double precision;

  RETURN QUERY
  SELECT
    t.id AS trip_id,
    t.user_id AS creator_user_id,
    COALESCE(p.phone_number, p.wa_id) AS whatsapp_e164,  -- FIXED: removed p.whatsapp_number
    SUBSTRING(t.id::text, 1, 8) AS ref_code,
    ROUND((ST_Distance(t.pickup_geog, v_pickup_geog) / 1000.0)::numeric, 2) AS distance_km,
    CASE
      WHEN _prefer_dropoff AND v_dropoff_geog IS NOT NULL AND t.dropoff_geog IS NOT NULL THEN
        ROUND(ST_Distance(t.dropoff_geog, v_dropoff_geog)::numeric, 0)
      ELSE NULL
    END AS drop_bonus_m,
    t.pickup_text,
    COALESCE(t.dropoff_text, t.metadata->>'dropoff_text') AS dropoff_text,
    NULL::timestamptz AS matched_at,
    t.created_at,
    t.vehicle_type,
    (t.vehicle_type = v_vehicle_type) AS is_exact_match,
    GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - COALESCE(t.updated_at, t.created_at))) / 60))::integer AS location_age_minutes,
    COALESCE((p.metadata->>'number_plate')::text, (p.metadata->'driver'->>'number_plate')::text) AS number_plate,
    COALESCE(p.display_name, p.phone_number, p.wa_id) AS driver_name,  -- FIXED: removed p.whatsapp_e164
    'driver'::text AS role
  FROM public.trips t
  INNER JOIN public.profiles p ON p.user_id = t.user_id
  WHERE t.role = 'driver'
    AND t.status = 'open'
    AND (t.expires_at IS NULL OR t.expires_at > now())
    AND t.pickup_geog IS NOT NULL
    AND COALESCE(t.updated_at, t.created_at) > now() - interval '24 hours'
    AND t.created_at > now() - (_window_days || ' days')::interval
    AND t.id != _trip_id
    AND ST_DWithin(t.pickup_geog, v_pickup_geog, v_radius)
  ORDER BY
    ST_Distance(t.pickup_geog, v_pickup_geog) ASC,
    COALESCE(t.updated_at, t.created_at) DESC,
    (t.vehicle_type = v_vehicle_type) DESC
  LIMIT COALESCE(_limit, 9);
END;
$$;

-- ============================================================================
-- MATCH PASSENGERS FOR TRIP V2 (FIXED)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.match_passengers_for_trip_v2(
  _trip_id uuid,
  _limit integer DEFAULT 9,
  _prefer_dropoff boolean DEFAULT false,
  _radius_m integer DEFAULT 10000,
  _window_days integer DEFAULT 2
) RETURNS TABLE (
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
  v_pickup_geog geography;
  v_dropoff_geog geography;
  v_vehicle_type text;
  v_radius double precision;
BEGIN
  SELECT t.pickup_geog, t.dropoff_geog, t.vehicle_type
  INTO v_pickup_geog, v_dropoff_geog, v_vehicle_type
  FROM public.trips t
  WHERE t.id = _trip_id;

  IF v_pickup_geog IS NULL THEN
    RETURN;
  END IF;

  v_radius := COALESCE(NULLIF(_radius_m, 0), 10000)::double precision;

  RETURN QUERY
  SELECT
    t.id AS trip_id,
    t.user_id AS creator_user_id,
    COALESCE(p.phone_number, p.wa_id) AS whatsapp_e164,  -- FIXED: removed p.whatsapp_number
    SUBSTRING(t.id::text, 1, 8) AS ref_code,
    ROUND((ST_Distance(t.pickup_geog, v_pickup_geog) / 1000.0)::numeric, 2) AS distance_km,
    CASE
      WHEN _prefer_dropoff AND v_dropoff_geog IS NOT NULL AND t.dropoff_geog IS NOT NULL THEN
        ROUND(ST_Distance(t.dropoff_geog, v_dropoff_geog)::numeric, 0)
      ELSE NULL
    END AS drop_bonus_m,
    t.pickup_text,
    COALESCE(t.dropoff_text, t.metadata->>'dropoff_text') AS dropoff_text,
    NULL::timestamptz AS matched_at,
    t.created_at,
    t.vehicle_type,
    (t.vehicle_type = v_vehicle_type) AS is_exact_match,
    GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - COALESCE(t.updated_at, t.created_at))) / 60))::integer AS location_age_minutes,
    NULL::text AS number_plate,
    COALESCE(p.display_name, p.phone_number, p.wa_id) AS driver_name,  -- FIXED: removed p.whatsapp_e164
    'passenger'::text AS role
  FROM public.trips t
  INNER JOIN public.profiles p ON p.user_id = t.user_id
  WHERE t.role = 'passenger'
    AND t.status = 'open'
    AND (t.expires_at IS NULL OR t.expires_at > now())
    AND t.pickup_geog IS NOT NULL
    AND COALESCE(t.updated_at, t.created_at) > now() - interval '24 hours'
    AND t.created_at > now() - (_window_days || ' days')::interval
    AND t.id != _trip_id
    AND ST_DWithin(t.pickup_geog, v_pickup_geog, v_radius)
  ORDER BY
    ST_Distance(t.pickup_geog, v_pickup_geog) ASC,
    COALESCE(t.updated_at, t.created_at) DESC,
    (t.vehicle_type = v_vehicle_type) DESC
  LIMIT COALESCE(_limit, 9);
END;
$$;

COMMIT;

-- ============================================================================
-- VERIFICATION NOTES
-- ============================================================================
-- After applying this migration:
-- 1. Test nearby driver search: Should return results instead of error
-- 2. Test nearby passenger search: Should return results
-- 3. Check logs: Error "column p.whatsapp_number does not exist" should disappear
-- 4. Verify phone numbers display correctly in match results
-- ============================================================================
