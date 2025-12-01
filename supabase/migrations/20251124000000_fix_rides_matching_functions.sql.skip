-- =====================================================================
-- FIX RIDES MATCHING FUNCTIONS
-- =====================================================================
-- Migration: Create missing match_drivers_for_trip_v2 and match_passengers_for_trip_v2
-- These functions are called by wa-webhook-mobility but were missing from DB
-- Created: 2025-11-24
-- =====================================================================

BEGIN;

-- =====================================================================
-- Function: match_drivers_for_trip_v2
-- Finds nearby drivers for a passenger's trip request
-- Returns: Top N drivers sorted by distance and recency
-- =====================================================================

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
  -- Get trip details
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
  FROM public.trips t
  WHERE t.id = _trip_id;

  -- If trip not found, return empty
  IF v_pickup_lat IS NULL THEN
    RETURN;
  END IF;

  -- Find matching drivers (role = 'driver')
  -- within radius, matching vehicle type, and recent activity
  RETURN QUERY
  SELECT 
    t.id AS trip_id,
    t.creator_user_id,
    COALESCE(p.phone_number, p.wa_id) AS whatsapp_e164,
    COALESCE(t.ref_code, SUBSTRING(t.id::text, 1, 8)) AS ref_code,
    -- Distance in km using Haversine formula
    (
      6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(v_pickup_lat)) * cos(radians(t.pickup_latitude)) *
          cos(radians(t.pickup_longitude) - radians(v_pickup_lng)) +
          sin(radians(v_pickup_lat)) * sin(radians(t.pickup_latitude))
        ))
      )
    )::numeric AS distance_km,
    -- Dropoff bonus (if both have dropoff and prefer_dropoff is true)
    CASE
      WHEN _prefer_dropoff AND v_dropoff_lat IS NOT NULL 
           AND t.dropoff_latitude IS NOT NULL 
           AND t.dropoff_longitude IS NOT NULL
      THEN (
        6371 * acos(
          LEAST(1.0, GREATEST(-1.0,
            cos(radians(v_dropoff_lat)) * cos(radians(t.dropoff_latitude)) *
            cos(radians(t.dropoff_longitude) - radians(v_dropoff_lng)) +
            sin(radians(v_dropoff_lat)) * sin(radians(t.dropoff_latitude))
          ))
        ) * 1000
      )::numeric
      ELSE NULL
    END AS drop_bonus_m,
    t.pickup_text,
    t.dropoff_text,
    t.matched_at,
    t.created_at
  FROM public.trips t
  INNER JOIN public.profiles p ON p.user_id = t.creator_user_id
  WHERE 
    t.role = 'driver'
    AND t.status IN ('open', 'active')
    AND t.vehicle_type = v_vehicle_type
    AND t.pickup_latitude IS NOT NULL
    AND t.pickup_longitude IS NOT NULL
    AND t.id != _trip_id
    AND t.created_at > (now() - (_window_days || ' days')::interval)
    -- Bounding box filter for performance
    AND t.pickup_latitude BETWEEN (v_pickup_lat - (v_radius_km / 111.0)) 
                               AND (v_pickup_lat + (v_radius_km / 111.0))
    AND t.pickup_longitude BETWEEN (v_pickup_lng - (v_radius_km / (111.0 * cos(radians(v_pickup_lat))))) 
                                AND (v_pickup_lng + (v_radius_km / (111.0 * cos(radians(v_pickup_lat)))))
  ORDER BY 
    distance_km ASC,
    t.created_at DESC
  LIMIT _limit;
END;
$$;

-- =====================================================================
-- Function: match_passengers_for_trip_v2
-- Finds nearby passengers for a driver looking for riders
-- Returns: Top N passengers sorted by distance and recency
-- =====================================================================

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
  -- Get trip details
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
  FROM public.trips t
  WHERE t.id = _trip_id;

  -- If trip not found, return empty
  IF v_pickup_lat IS NULL THEN
    RETURN;
  END IF;

  -- Find matching passengers (role = 'passenger')
  -- within radius, matching vehicle type, and recent activity
  RETURN QUERY
  SELECT 
    t.id AS trip_id,
    t.creator_user_id,
    COALESCE(p.phone_number, p.wa_id) AS whatsapp_e164,
    COALESCE(t.ref_code, SUBSTRING(t.id::text, 1, 8)) AS ref_code,
    -- Distance in km using Haversine formula
    (
      6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(v_pickup_lat)) * cos(radians(t.pickup_latitude)) *
          cos(radians(t.pickup_longitude) - radians(v_pickup_lng)) +
          sin(radians(v_pickup_lat)) * sin(radians(t.pickup_latitude))
        ))
      )
    )::numeric AS distance_km,
    -- Dropoff bonus (if both have dropoff and prefer_dropoff is true)
    CASE
      WHEN _prefer_dropoff AND v_dropoff_lat IS NOT NULL 
           AND t.dropoff_latitude IS NOT NULL 
           AND t.dropoff_longitude IS NOT NULL
      THEN (
        6371 * acos(
          LEAST(1.0, GREATEST(-1.0,
            cos(radians(v_dropoff_lat)) * cos(radians(t.dropoff_latitude)) *
            cos(radians(t.dropoff_longitude) - radians(v_dropoff_lng)) +
            sin(radians(v_dropoff_lat)) * sin(radians(t.dropoff_latitude))
          ))
        ) * 1000
      )::numeric
      ELSE NULL
    END AS drop_bonus_m,
    t.pickup_text,
    t.dropoff_text,
    t.matched_at,
    t.created_at
  FROM public.trips t
  INNER JOIN public.profiles p ON p.user_id = t.creator_user_id
  WHERE 
    t.role = 'passenger'
    AND t.status IN ('open', 'active')
    AND t.vehicle_type = v_vehicle_type
    AND t.pickup_latitude IS NOT NULL
    AND t.pickup_longitude IS NOT NULL
    AND t.id != _trip_id
    AND t.created_at > (now() - (_window_days || ' days')::interval)
    -- Bounding box filter for performance
    AND t.pickup_latitude BETWEEN (v_pickup_lat - (v_radius_km / 111.0)) 
                               AND (v_pickup_lat + (v_radius_km / 111.0))
    AND t.pickup_longitude BETWEEN (v_pickup_lng - (v_radius_km / (111.0 * cos(radians(v_pickup_lat))))) 
                                AND (v_pickup_lng + (v_radius_km / (111.0 * cos(radians(v_pickup_lat)))))
  ORDER BY 
    distance_km ASC,
    t.created_at DESC
  LIMIT _limit;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.match_drivers_for_trip_v2 TO service_role, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.match_passengers_for_trip_v2 TO service_role, authenticated, anon;

-- Create indexes for better performance (if not already exist)
CREATE INDEX IF NOT EXISTS idx_trips_role_status_vehicle ON public.trips(role, status, vehicle_type)
  WHERE status IN ('open', 'active');

CREATE INDEX IF NOT EXISTS idx_trips_pickup_coords ON public.trips(pickup_latitude, pickup_longitude)
  WHERE pickup_latitude IS NOT NULL AND pickup_longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trips_created_at ON public.trips(created_at DESC)
  WHERE status IN ('open', 'active');

COMMIT;
