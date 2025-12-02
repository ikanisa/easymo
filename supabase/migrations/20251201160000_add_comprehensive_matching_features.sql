-- Add missing features from comprehensive matching fixes
-- Complements 20251201150000_fix_matching_location_freshness.sql
-- Adds: app_config, update_trip_location RPC, trigger, monitoring view, location_age_minutes

BEGIN;

-- Drop all variations of functions and views manually
DROP VIEW IF EXISTS mobility_location_health CASCADE;
DROP FUNCTION IF EXISTS public.update_trip_location CASCADE;
DROP FUNCTION IF EXISTS public.update_location_timestamp CASCADE;
DROP FUNCTION IF EXISTS public.match_drivers_for_trip_v2 CASCADE;
DROP FUNCTION IF EXISTS public.match_passengers_for_trip_v2 CASCADE;

-- ============================================================================
-- 1. ADD MISSING APP_CONFIG ENTRIES
-- ============================================================================
-- Skip app_config - table schema incompatible (commented out)
-- INSERT INTO app_config (key, value, description, updated_at)
-- VALUES 
--   ('mobility.search_radius_km', '15', 'Default search radius for driver-passenger matching in kilometers', now()),
--   ('mobility.max_search_radius_km', '25', 'Maximum allowed search radius in kilometers', now()),
--   ('mobility.location_freshness_minutes', '30', 'Maximum age of location update to be considered fresh', now())
-- ON CONFLICT (key) DO UPDATE 
--   SET value = EXCLUDED.value,
--       description = EXCLUDED.description,
--       updated_at = now();

-- ============================================================================
-- 2. ADD FUNCTION TO UPDATE TRIP LOCATION (FOR "SHARE NEW LOCATION")
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_trip_location(
  _trip_id uuid,
  _pickup_lat double precision,
  _pickup_lng double precision,
  _pickup_text text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update location and refresh last_location_at timestamp
  UPDATE rides_trips
  SET 
    pickup_latitude = _pickup_lat,
    pickup_longitude = _pickup_lng,
    pickup = ST_SetSRID(ST_MakePoint(_pickup_lng, _pickup_lat), 4326),
    pickup_text = COALESCE(_pickup_text, pickup_text),
    last_location_at = now(),
    -- Extend expiry by 30 minutes on location update
    expires_at = now() + interval '30 minutes'
  WHERE id = _trip_id
    AND creator_user_id = auth.uid();
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trip not found or unauthorized';
  END IF;
END;
$$;

-- ============================================================================
-- 3. ADD TRIGGER TO AUTO-UPDATE last_location_at ON LOCATION CHANGES
-- ============================================================================
CREATE OR REPLACE FUNCTION update_location_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  -- Update last_location_at when pickup coordinates change
  IF (NEW.pickup_latitude IS DISTINCT FROM OLD.pickup_latitude 
      OR NEW.pickup_longitude IS DISTINCT FROM OLD.pickup_longitude)
      AND NEW.pickup_latitude IS NOT NULL 
      AND NEW.pickup_longitude IS NOT NULL THEN
    NEW.last_location_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_location_timestamp ON rides_trips;
CREATE TRIGGER trg_update_location_timestamp
  BEFORE UPDATE ON rides_trips
  FOR EACH ROW
  EXECUTE FUNCTION update_location_timestamp();

-- ============================================================================
-- 4. CREATE MONITORING VIEW FOR LOCATION FRESHNESS
-- ============================================================================
CREATE OR REPLACE VIEW mobility_location_health AS
SELECT 
  role,
  status,
  COUNT(*) AS total_trips,
  COUNT(*) FILTER (WHERE last_location_at > now() - interval '30 minutes') AS fresh_locations_30min,
  COUNT(*) FILTER (WHERE last_location_at > now() - interval '60 minutes') AS fresh_locations_60min,
  COUNT(*) FILTER (WHERE last_location_at IS NULL) AS missing_location_timestamp,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE last_location_at > now() - interval '30 minutes') / NULLIF(COUNT(*), 0),
    2
  ) AS fresh_percentage_30min
FROM rides_trips
WHERE status IN ('open', 'pending', 'active')
  AND expires_at > now()
GROUP BY role, status
ORDER BY role, status;

-- ============================================================================
-- 5. UPDATE MATCH FUNCTIONS TO ADD location_age_minutes FIELD
-- ============================================================================
-- Note: The match_drivers_for_trip_v2 and match_passengers_for_trip_v2 functions
-- from 20251201150000 already have most fields, we just need to add location_age_minutes
-- This will be done by replacing the functions

CREATE OR REPLACE FUNCTION public.match_drivers_for_trip_v2(
  _trip_id uuid,
  _limit integer DEFAULT 9,
  _prefer_dropoff boolean DEFAULT false,
  _radius_m integer DEFAULT 15000,
  _window_days integer DEFAULT 30
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
  location_age_minutes integer
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
      WHEN _radius_m IS NULL OR _radius_m <= 0 THEN 15.0
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
    EXTRACT(EPOCH FROM (now() - COALESCE(t.last_location_at, t.created_at)))::integer / 60 AS location_age_minutes
  FROM public.rides_trips t
  INNER JOIN public.profiles p ON p.user_id = t.creator_user_id
  WHERE t.role = 'driver'
    AND t.status IN ('open', 'pending', 'active')
    AND t.expires_at > now()
    AND t.pickup_latitude IS NOT NULL
    AND t.pickup_longitude IS NOT NULL
    AND COALESCE(t.last_location_at, t.created_at) > now() - interval '30 minutes'
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

CREATE OR REPLACE FUNCTION public.match_passengers_for_trip_v2(
  _trip_id uuid,
  _limit integer DEFAULT 9,
  _prefer_dropoff boolean DEFAULT false,
  _radius_m integer DEFAULT 15000,
  _window_days integer DEFAULT 30
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
  location_age_minutes integer
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
      WHEN _radius_m IS NULL OR _radius_m <= 0 THEN 15.0
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
    EXTRACT(EPOCH FROM (now() - COALESCE(t.last_location_at, t.created_at)))::integer / 60 AS location_age_minutes
  FROM public.rides_trips t
  INNER JOIN public.profiles p ON p.user_id = t.creator_user_id
  WHERE t.role = 'passenger'
    AND t.status IN ('open', 'pending', 'active')
    AND t.expires_at > now()
    AND t.pickup_latitude IS NOT NULL
    AND t.pickup_longitude IS NOT NULL
    AND COALESCE(t.last_location_at, t.created_at) > now() - interval '30 minutes'
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

COMMIT;
