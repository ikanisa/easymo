-- Fix driver/passenger matching to meet requirements
-- 1. Add 48-hour time window filter
-- 2. Add number_plate for drivers
-- 3. Add role field for UI differentiation
-- 4. Enforce 10km radius (handled in TypeScript constants)

BEGIN;

-- Drop existing functions
DROP FUNCTION IF EXISTS public.match_drivers_for_trip_v2 CASCADE;
DROP FUNCTION IF EXISTS public.match_passengers_for_trip_v2 CASCADE;

-- ============================================================================
-- DRIVER MATCHING (with number plate and role)
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
  v_radius_km double precision;
  v_pickup_geog geography;
BEGIN
  SELECT 
    t.pickup_latitude,
    t.pickup_longitude,
    t.dropoff_latitude,
    t.dropoff_longitude,
    t.vehicle_type,
    CASE 
      WHEN _radius_m IS NULL OR _radius_m <= 0 THEN 10.0
      ELSE _radius_m::double precision / 1000.0
    END,
    ST_SetSRID(ST_MakePoint(t.pickup_longitude, t.pickup_latitude), 4326)::geography
  INTO 
    v_pickup_lat,
    v_pickup_lng,
    v_dropoff_lat,
    v_dropoff_lng,
    v_vehicle_type,
    v_radius_km,
    v_pickup_geog
  FROM public.rides_trips t
  WHERE t.id = _trip_id;

  IF v_pickup_lat IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    t.id AS trip_id,
    t.creator_user_id,
    COALESCE(p.phone_number, p.wa_id) AS whatsapp_e164,
    COALESCE(t.ref_code, SUBSTRING(t.id::text, 1, 8)) AS ref_code,
    ROUND(
      (ST_Distance(t.pickup::geography, v_pickup_geog) / 1000.0)::numeric, 
      2
    ) AS distance_km,
    CASE
      WHEN _prefer_dropoff AND v_dropoff_lat IS NOT NULL AND t.dropoff_latitude IS NOT NULL THEN
        ROUND(
          ST_Distance(
            ST_SetSRID(ST_MakePoint(t.dropoff_longitude, t.dropoff_latitude), 4326)::geography,
            ST_SetSRID(ST_MakePoint(v_dropoff_lng, v_dropoff_lat), 4326)::geography
          )::numeric,
          0
        )
      ELSE NULL
    END AS drop_bonus_m,
    t.pickup_text,
    t.dropoff_text,
    t.matched_at,
    t.created_at,
    t.vehicle_type,
    (t.vehicle_type = v_vehicle_type) AS is_exact_match,
    EXTRACT(EPOCH FROM (now() - COALESCE(t.last_location_at, t.created_at)))::integer / 60 AS location_age_minutes,
    t.number_plate,
    p.full_name AS driver_name,
    'driver'::text AS role
  FROM public.rides_trips t
  INNER JOIN public.profiles p ON p.user_id = t.creator_user_id
  WHERE t.role = 'driver'
    AND t.status IN ('open', 'pending', 'active')
    AND t.expires_at > now()
    AND t.pickup_latitude IS NOT NULL
    AND t.pickup_longitude IS NOT NULL
    AND COALESCE(t.last_location_at, t.created_at) > now() - interval '30 minutes'
    AND t.created_at > now() - (_window_days || ' days')::interval  -- 48-hour window
    AND t.id != _trip_id
    AND ST_DWithin(
      t.pickup::geography,
      v_pickup_geog,
      _radius_m::double precision
    )
  ORDER BY 
    ST_Distance(t.pickup::geography, v_pickup_geog) ASC,
    COALESCE(t.last_location_at, t.created_at) DESC,
    (t.vehicle_type = v_vehicle_type) DESC
  LIMIT _limit;
END;
$$;

-- ============================================================================
-- PASSENGER MATCHING (with role)
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
  v_radius_km double precision;
  v_pickup_geog geography;
BEGIN
  SELECT 
    t.pickup_latitude,
    t.pickup_longitude,
    t.dropoff_latitude,
    t.dropoff_longitude,
    t.vehicle_type,
    CASE 
      WHEN _radius_m IS NULL OR _radius_m <= 0 THEN 10.0
      ELSE _radius_m::double precision / 1000.0
    END,
    ST_SetSRID(ST_MakePoint(t.pickup_longitude, t.pickup_latitude), 4326)::geography
  INTO 
    v_pickup_lat,
    v_pickup_lng,
    v_dropoff_lat,
    v_dropoff_lng,
    v_vehicle_type,
    v_radius_km,
    v_pickup_geog
  FROM public.rides_trips t
  WHERE t.id = _trip_id;

  IF v_pickup_lat IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    t.id AS trip_id,
    t.creator_user_id,
    COALESCE(p.phone_number, p.wa_id) AS whatsapp_e164,
    COALESCE(t.ref_code, SUBSTRING(t.id::text, 1, 8)) AS ref_code,
    ROUND(
      (ST_Distance(t.pickup::geography, v_pickup_geog) / 1000.0)::numeric, 
      2
    ) AS distance_km,
    CASE
      WHEN _prefer_dropoff AND v_dropoff_lat IS NOT NULL AND t.dropoff_latitude IS NOT NULL THEN
        ROUND(
          ST_Distance(
            ST_SetSRID(ST_MakePoint(t.dropoff_longitude, t.dropoff_latitude), 4326)::geography,
            ST_SetSRID(ST_MakePoint(v_dropoff_lng, v_dropoff_lat), 4326)::geography
          )::numeric,
          0
        )
      ELSE NULL
    END AS drop_bonus_m,
    t.pickup_text,
    t.dropoff_text,
    t.matched_at,
    t.created_at,
    t.vehicle_type,
    (t.vehicle_type = v_vehicle_type) AS is_exact_match,
    EXTRACT(EPOCH FROM (now() - COALESCE(t.last_location_at, t.created_at)))::integer / 60 AS location_age_minutes,
    NULL::text AS number_plate,  -- Passengers don't have plates
    p.full_name AS driver_name,  -- Actually passenger name, but keeping field name for consistency
    'passenger'::text AS role
  FROM public.rides_trips t
  INNER JOIN public.profiles p ON p.user_id = t.creator_user_id
  WHERE t.role = 'passenger'
    AND t.status IN ('open', 'pending', 'active')
    AND t.expires_at > now()
    AND t.pickup_latitude IS NOT NULL
    AND t.pickup_longitude IS NOT NULL
    AND COALESCE(t.last_location_at, t.created_at) > now() - interval '30 minutes'
    AND t.created_at > now() - (_window_days || ' days')::interval  -- 48-hour window
    AND t.id != _trip_id
    AND ST_DWithin(
      t.pickup::geography,
      v_pickup_geog,
      _radius_m::double precision
    )
  ORDER BY 
    ST_Distance(t.pickup::geography, v_pickup_geog) ASC,
    COALESCE(t.last_location_at, t.created_at) DESC,
    (t.vehicle_type = v_vehicle_type) DESC
  LIMIT _limit;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.match_drivers_for_trip_v2 TO service_role, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.match_passengers_for_trip_v2 TO service_role, authenticated, anon;

COMMIT;
