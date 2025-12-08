-- Align mobility matching with canonical trips table
-- - Adds dropoff coordinates to public.trips (with geography)
-- - Backfills dropoff data from metadata
-- - Recreates matching functions to avoid missing columns (ref_code) errors
-- - Repoints mobility_trip_matches FKs to public.trips so matches can be recorded

BEGIN;

-- Enable PostGIS extension if not already enabled (required for geography type)
CREATE EXTENSION IF NOT EXISTS postgis;

-- ===========================================================================
-- PART 1: Trips Table Modifications (only if trips exists)
-- ===========================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trips') THEN
    RAISE NOTICE 'trips table does not exist - skipping column/index/constraint modifications';
    RAISE NOTICE 'This is normal for fresh database - trips will be created by schema pull';
    RETURN;
  END IF;

  -- Add dropoff columns
  EXECUTE 'ALTER TABLE public.trips
    ADD COLUMN IF NOT EXISTS dropoff_lat double precision,
    ADD COLUMN IF NOT EXISTS dropoff_lng double precision,
    ADD COLUMN IF NOT EXISTS dropoff_geog geography(Point, 4326) GENERATED ALWAYS AS (
      CASE
        WHEN dropoff_lat IS NOT NULL AND dropoff_lng IS NOT NULL THEN
          ST_SetSRID(ST_MakePoint(dropoff_lng, dropoff_lat), 4326)::geography
        ELSE NULL
      END
    ) STORED,
    ADD COLUMN IF NOT EXISTS dropoff_text text,
    ADD COLUMN IF NOT EXISTS dropoff_radius_m integer';
  
  RAISE NOTICE 'Added dropoff columns to trips';

  -- Refresh coordinate constraint
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trips_valid_coordinates') THEN
    ALTER TABLE public.trips DROP CONSTRAINT trips_valid_coordinates;
  END IF;

  EXECUTE 'ALTER TABLE public.trips
    ADD CONSTRAINT trips_valid_coordinates CHECK (
      pickup_lat BETWEEN -90 AND 90
      AND pickup_lng BETWEEN -180 AND 180
      AND (dropoff_lat IS NULL OR dropoff_lat BETWEEN -90 AND 90)
      AND (dropoff_lng IS NULL OR dropoff_lng BETWEEN -180 AND 180)
    )';

  -- Backfill dropoff columns from metadata
  EXECUTE 'UPDATE public.trips
  SET
    dropoff_lat = COALESCE(dropoff_lat, NULLIF((metadata->>''dropoff_lat'')::text, '''')::double precision),
    dropoff_lng = COALESCE(dropoff_lng, NULLIF((metadata->>''dropoff_lng'')::text, '''')::double precision),
    dropoff_text = COALESCE(dropoff_text, NULLIF(metadata->>''dropoff_text'', '''')),
    dropoff_radius_m = COALESCE(dropoff_radius_m, (metadata->>''dropoff_radius_m'')::integer)
  WHERE (metadata ? ''dropoff_lat'' OR metadata ? ''dropoff_lng'' OR metadata ? ''dropoff_text'' OR metadata ? ''dropoff_radius_m'')';

  RAISE NOTICE 'Trips table modifications complete';
END $$;

-- ===========================================================================
-- PART 2: Create Indexes (only if trips exists)
-- ===========================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trips') THEN
    CREATE INDEX IF NOT EXISTS idx_trips_dropoff_geog
      ON public.trips USING GIST (dropoff_geog) WHERE dropoff_geog IS NOT NULL;
      
    RAISE NOTICE 'Created dropoff geog index on trips table';
  ELSE
    RAISE NOTICE 'trips table does not exist - skipping index creation';
  END IF;
END $$;

-- ===========================================================================
-- PART 3: Recreate matching functions (production only - requires trips)
-- ===========================================================================
DROP FUNCTION IF EXISTS public.match_drivers_for_trip_v2(uuid, integer, boolean, integer, integer);
DROP FUNCTION IF EXISTS public.match_passengers_for_trip_v2(uuid, integer, boolean, integer, integer);

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
    COALESCE(p.phone_number, p.whatsapp_number, p.wa_id) AS whatsapp_e164,
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
    COALESCE(p.display_name, p.phone_number, p.whatsapp_number, p.wa_id) AS driver_name,
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
    COALESCE(p.phone_number, p.whatsapp_number, p.wa_id) AS whatsapp_e164,
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
    COALESCE(p.display_name, p.phone_number, p.whatsapp_number, p.wa_id) AS driver_name,
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

COMMENT ON FUNCTION public.match_drivers_for_trip_v2 IS
  'Find nearby drivers for a passenger trip. Uses canonical trips table and generates ref_code from trip id.';
COMMENT ON FUNCTION public.match_passengers_for_trip_v2 IS
  'Find nearby passengers for a driver trip. Uses canonical trips table and generates ref_code from trip id.';

-- ---------------------------------------------------------------------------
-- 3) Point mobility_trip_matches at public.trips (avoids FK failures)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'mobility_trip_matches'
  ) THEN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mobility_trip_matches_driver_trip_id_fkey') THEN
      ALTER TABLE public.mobility_trip_matches DROP CONSTRAINT mobility_trip_matches_driver_trip_id_fkey;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mobility_trip_matches_passenger_trip_id_fkey') THEN
      ALTER TABLE public.mobility_trip_matches DROP CONSTRAINT mobility_trip_matches_passenger_trip_id_fkey;
    END IF;

    ALTER TABLE public.mobility_trip_matches
      ADD CONSTRAINT mobility_trip_matches_driver_trip_id_fkey
        FOREIGN KEY (driver_trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;
    ALTER TABLE public.mobility_trip_matches
      ADD CONSTRAINT mobility_trip_matches_passenger_trip_id_fkey
        FOREIGN KEY (passenger_trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;
  END IF;
END;
$$;

COMMIT;
