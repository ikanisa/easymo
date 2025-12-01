-- Fix trip matching to include 'open' status and improve intent storage
-- Addresses critical issues where passenger trips are not visible to drivers

BEGIN;

-- 1. Fix match_drivers_for_trip_v2 to include 'open' status
CREATE OR REPLACE FUNCTION public.match_drivers_for_trip_v2(
  _trip_id uuid,
  _limit integer DEFAULT 9,
  _prefer_dropoff boolean DEFAULT false,
  _radius_m integer DEFAULT 10000,
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
  created_at timestamptz
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
    END
  INTO 
    v_pickup_lat,
    v_pickup_lng,
    v_dropoff_lat,
    v_dropoff_lng,
    v_vehicle_type,
    v_radius_km
  FROM public.rides_trips t
  WHERE t.id = _trip_id;

  IF v_pickup_lat IS NULL THEN
    RETURN;
  END IF;

  -- Find matching drivers (role = 'driver')
  -- CRITICAL FIX: Include 'open' status and check expires_at
  RETURN QUERY
  SELECT 
    t.id AS trip_id,
    t.creator_user_id,
    COALESCE(p.phone_number, p.wa_id) AS whatsapp_e164,
    COALESCE(t.ref_code, SUBSTRING(t.id::text, 1, 8)) AS ref_code,
    ROUND(
      (6371 * acos(
        cos(radians(v_pickup_lat)) * cos(radians(t.pickup_latitude)) *
        cos(radians(t.pickup_longitude) - radians(v_pickup_lng)) +
        sin(radians(v_pickup_lat)) * sin(radians(t.pickup_latitude))
      ))::numeric, 2
    ) AS distance_km,
    CASE
      WHEN _prefer_dropoff AND v_dropoff_lat IS NOT NULL AND t.dropoff_latitude IS NOT NULL THEN
        ROUND(
          (6371000 * acos(
            cos(radians(v_dropoff_lat)) * cos(radians(t.dropoff_latitude)) *
            cos(radians(t.dropoff_longitude) - radians(v_dropoff_lng)) +
            sin(radians(v_dropoff_lat)) * sin(radians(t.dropoff_latitude))
          ))::numeric, 0
        )
      ELSE NULL
    END AS drop_bonus_m,
    t.pickup_text,
    t.dropoff_text,
    t.matched_at,
    t.created_at
  FROM public.rides_trips t
  INNER JOIN public.profiles p ON p.user_id = t.creator_user_id
  WHERE t.role = 'driver'
    AND t.status IN ('open', 'pending', 'active')  -- ADDED 'open'
    AND t.expires_at > now()  -- ADDED: Only non-expired trips
    AND t.pickup_latitude IS NOT NULL
    AND t.pickup_longitude IS NOT NULL
    AND (v_vehicle_type IS NULL OR t.vehicle_type = v_vehicle_type)
    AND t.created_at >= NOW() - (INTERVAL '1 day' * _window_days)
    AND t.id != _trip_id
    AND (
      6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(v_pickup_lat)) * cos(radians(t.pickup_latitude)) *
          cos(radians(t.pickup_longitude) - radians(v_pickup_lng)) +
          sin(radians(v_pickup_lat)) * sin(radians(t.pickup_latitude))
        ))
      )
    ) <= v_radius_km
  ORDER BY distance_km ASC
  LIMIT _limit;
END;
$$;

-- 2. Fix match_passengers_for_trip_v2 to include 'open' status
CREATE OR REPLACE FUNCTION public.match_passengers_for_trip_v2(
  _trip_id uuid,
  _limit integer DEFAULT 9,
  _prefer_dropoff boolean DEFAULT false,
  _radius_m integer DEFAULT 10000,
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
  created_at timestamptz
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
    END
  INTO 
    v_pickup_lat,
    v_pickup_lng,
    v_dropoff_lat,
    v_dropoff_lng,
    v_vehicle_type,
    v_radius_km
  FROM public.rides_trips t
  WHERE t.id = _trip_id;

  IF v_pickup_lat IS NULL THEN
    RETURN;
  END IF;

  -- Find matching passengers (role = 'passenger')
  -- CRITICAL FIX: Include 'open' status and check expires_at
  RETURN QUERY
  SELECT 
    t.id AS trip_id,
    t.creator_user_id,
    COALESCE(p.phone_number, p.wa_id) AS whatsapp_e164,
    COALESCE(t.ref_code, SUBSTRING(t.id::text, 1, 8)) AS ref_code,
    ROUND(
      (6371 * acos(
        cos(radians(v_pickup_lat)) * cos(radians(t.pickup_latitude)) *
        cos(radians(t.pickup_longitude) - radians(v_pickup_lng)) +
        sin(radians(v_pickup_lat)) * sin(radians(t.pickup_latitude))
      ))::numeric, 2
    ) AS distance_km,
    CASE
      WHEN _prefer_dropoff AND v_dropoff_lat IS NOT NULL AND t.dropoff_latitude IS NOT NULL THEN
        ROUND(
          (6371000 * acos(
            cos(radians(v_dropoff_lat)) * cos(radians(t.dropoff_latitude)) *
            cos(radians(t.dropoff_longitude) - radians(v_dropoff_lng)) +
            sin(radians(v_dropoff_lat)) * sin(radians(t.dropoff_latitude))
          ))::numeric, 0
        )
      ELSE NULL
    END AS drop_bonus_m,
    t.pickup_text,
    t.dropoff_text,
    t.matched_at,
    t.created_at
  FROM public.rides_trips t
  INNER JOIN public.profiles p ON p.user_id = t.creator_user_id
  WHERE t.role = 'passenger'
    AND t.status IN ('open', 'pending', 'active')  -- ADDED 'open'
    AND t.expires_at > now()  -- ADDED: Only non-expired trips
    AND t.pickup_latitude IS NOT NULL
    AND t.pickup_longitude IS NOT NULL
    AND (v_vehicle_type IS NULL OR t.vehicle_type = v_vehicle_type)
    AND t.created_at >= NOW() - (INTERVAL '1 day' * _window_days)
    AND t.id != _trip_id
    AND (
      6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(v_pickup_lat)) * cos(radians(t.pickup_latitude)) *
          cos(radians(t.pickup_longitude) - radians(v_pickup_lng)) +
          sin(radians(v_pickup_lat)) * sin(radians(t.pickup_latitude))
        ))
      )
    ) <= v_radius_km
  ORDER BY distance_km ASC
  LIMIT _limit;
END;
$$;

-- 3. Add scheduled_at and recurrence columns to rides_trips if not exists
ALTER TABLE rides_trips 
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS recurrence text CHECK (recurrence IN ('once', 'daily', 'weekdays', 'weekly', 'monthly'));

CREATE INDEX IF NOT EXISTS idx_rides_trips_scheduled ON rides_trips(scheduled_at) 
  WHERE scheduled_at IS NOT NULL AND status = 'scheduled';

-- 4. Create mobility_intents table for better intent tracking
CREATE TABLE IF NOT EXISTS mobility_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  intent_type text NOT NULL CHECK (intent_type IN ('nearby_drivers', 'nearby_passengers', 'schedule', 'go_online')),
  vehicle_type text,
  pickup_lat double precision NOT NULL,
  pickup_lng double precision NOT NULL,
  pickup_geog geography(Point, 4326) GENERATED ALWAYS AS 
    (ST_SetSRID(ST_MakePoint(pickup_lng, pickup_lat), 4326)::geography) STORED,
  dropoff_lat double precision,
  dropoff_lng double precision,
  dropoff_geog geography(Point, 4326) GENERATED ALWAYS AS 
    (CASE WHEN dropoff_lat IS NOT NULL AND dropoff_lng IS NOT NULL 
      THEN ST_SetSRID(ST_MakePoint(dropoff_lng, dropoff_lat), 4326)::geography 
      ELSE NULL END) STORED,
  scheduled_for timestamptz,
  recurrence text CHECK (recurrence IN ('once', 'daily', 'weekdays', 'weekly', 'monthly')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_mobility_intents_type_expires ON mobility_intents(intent_type, expires_at);
CREATE INDEX IF NOT EXISTS idx_mobility_intents_pickup_geog ON mobility_intents USING GIST(pickup_geog);
CREATE INDEX IF NOT EXISTS idx_mobility_intents_user_type ON mobility_intents(user_id, intent_type);
CREATE INDEX IF NOT EXISTS idx_mobility_intents_created ON mobility_intents(created_at DESC);

-- Enable RLS on mobility_intents
ALTER TABLE mobility_intents ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own intents
CREATE POLICY "Users can view own intents"
  ON mobility_intents FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own intents
CREATE POLICY "Users can insert own intents"
  ON mobility_intents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own intents
CREATE POLICY "Users can update own intents"
  ON mobility_intents FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own intents
CREATE POLICY "Users can delete own intents"
  ON mobility_intents FOR DELETE
  USING (auth.uid() = user_id);

COMMIT;
