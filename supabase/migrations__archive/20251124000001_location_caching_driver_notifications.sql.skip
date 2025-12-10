-- =====================================================================
-- LOCATION CACHING & DRIVER NOTIFICATIONS
-- =====================================================================
-- Migration: Implement 30-minute location caching and driver notification system
-- Created: 2025-11-24
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. Ensure location caching columns exist in profiles
-- (These were added in 20251123120000_rides_enhancements.sql but we ensure they exist)
-- =====================================================================

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_location geography(POINT, 4326),
ADD COLUMN IF NOT EXISTS last_location_at timestamptz;

-- Index for spatial queries
CREATE INDEX IF NOT EXISTS profiles_last_location_idx ON public.profiles USING GIST (last_location);
CREATE INDEX IF NOT EXISTS profiles_last_location_at_idx ON public.profiles(last_location_at) 
  WHERE last_location_at IS NOT NULL;

-- =====================================================================
-- 2. Functions for location caching
-- =====================================================================

-- Function: Update user's cached location
CREATE OR REPLACE FUNCTION public.update_user_location_cache(
  _user_id uuid,
  _lat double precision,
  _lng double precision
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.profiles
  SET 
    last_location = ST_SetSRID(ST_MakePoint(_lng, _lat), 4326)::geography,
    last_location_at = now()
  WHERE user_id = _user_id;
END;
$$;

-- Function: Get cached location if still valid (within 30 minutes)
CREATE OR REPLACE FUNCTION public.get_cached_location(
  _user_id uuid,
  _cache_minutes integer DEFAULT 30
)
RETURNS TABLE (
  lat double precision,
  lng double precision,
  cached_at timestamptz,
  is_valid boolean
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ST_Y(last_location::geometry) AS lat,
    ST_X(last_location::geometry) AS lng,
    last_location_at AS cached_at,
    (last_location_at > (now() - (_cache_minutes || ' minutes')::interval)) AS is_valid
  FROM public.profiles
  WHERE user_id = _user_id
    AND last_location IS NOT NULL
    AND last_location_at IS NOT NULL;
END;
$$;

-- =====================================================================
-- 3. Enhanced ride_requests table for tracking driver responses
-- =====================================================================

-- Update ride_requests to track notifications better
ALTER TABLE public.ride_requests 
ADD COLUMN IF NOT EXISTS notified_at timestamptz,
ADD COLUMN IF NOT EXISTS response_type text, -- 'accept', 'reject', 'timeout'
ADD COLUMN IF NOT EXISTS response_at timestamptz;

-- Index for finding pending requests
CREATE INDEX IF NOT EXISTS idx_ride_requests_status_notified 
  ON public.ride_requests(status, notified_at)
  WHERE status = 'pending';

-- =====================================================================
-- 4. Function to record driver notification
-- =====================================================================

CREATE OR REPLACE FUNCTION public.record_driver_notification(
  _trip_id uuid,
  _passenger_id uuid,
  _driver_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_request_id uuid;
BEGIN
  -- Insert or update ride request
  INSERT INTO public.ride_requests (
    trip_id,
    passenger_id,
    driver_id,
    status,
    notified_at,
    created_at,
    updated_at
  )
  VALUES (
    _trip_id,
    _passenger_id,
    _driver_id,
    'pending',
    now(),
    now(),
    now()
  )
  ON CONFLICT (trip_id, driver_id) 
  DO UPDATE SET
    notified_at = now(),
    updated_at = now()
  RETURNING id INTO v_request_id;

  -- Also record in ride_notifications table
  INSERT INTO public.ride_notifications (
    trip_id,
    driver_id,
    status,
    created_at
  )
  VALUES (
    _trip_id,
    _driver_id,
    'sent',
    now()
  );

  RETURN v_request_id;
END;
$$;

-- Add unique constraint to prevent duplicate requests
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'ride_requests_trip_driver_unique'
  ) THEN
    ALTER TABLE public.ride_requests 
      ADD CONSTRAINT ride_requests_trip_driver_unique UNIQUE (trip_id, driver_id);
  END IF;
END $$;

-- =====================================================================
-- 5. Function to record driver response
-- =====================================================================

CREATE OR REPLACE FUNCTION public.record_driver_response(
  _request_id uuid,
  _response_type text -- 'accept', 'reject'
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated boolean;
BEGIN
  UPDATE public.ride_requests
  SET 
    status = CASE 
      WHEN _response_type = 'accept' THEN 'accepted'
      WHEN _response_type = 'reject' THEN 'rejected'
      ELSE status
    END,
    response_type = _response_type,
    response_at = now(),
    updated_at = now()
  WHERE id = _request_id
    AND status = 'pending'
  RETURNING true INTO v_updated;

  RETURN COALESCE(v_updated, false);
END;
$$;

-- =====================================================================
-- 6. Function to get notified drivers for a trip
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_notified_drivers(
  _trip_id uuid
)
RETURNS TABLE (
  driver_id uuid,
  status text,
  notified_at timestamptz,
  response_type text,
  response_at timestamptz
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rr.driver_id,
    rr.status,
    rr.notified_at,
    rr.response_type,
    rr.response_at
  FROM public.ride_requests rr
  WHERE rr.trip_id = _trip_id
  ORDER BY rr.notified_at DESC;
END;
$$;

-- =====================================================================
-- 7. Function to find nearby online drivers with location
-- (For "Go Online" feature and driver notifications)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.find_online_drivers_near_trip(
  _trip_id uuid,
  _radius_km double precision DEFAULT 10.0,
  _limit integer DEFAULT 9,
  _minutes_online integer DEFAULT 60
)
RETURNS TABLE (
  user_id uuid,
  whatsapp_e164 text,
  distance_km numeric,
  last_location_at timestamptz,
  vehicle_type text
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_pickup_lat double precision;
  v_pickup_lng double precision;
  v_vehicle_type text;
BEGIN
  -- Get trip pickup location
  SELECT 
    t.pickup_latitude,
    t.pickup_longitude,
    t.vehicle_type
  INTO 
    v_pickup_lat,
    v_pickup_lng,
    v_vehicle_type
  FROM public.trips t
  WHERE t.id = _trip_id;

  IF v_pickup_lat IS NULL THEN
    RETURN;
  END IF;

  -- Find drivers with recent location who haven't been notified yet
  RETURN QUERY
  SELECT 
    p.user_id,
    COALESCE(p.phone_number, p.wa_id) AS whatsapp_e164,
    (
      6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(v_pickup_lat)) * cos(radians(ST_Y(p.last_location::geometry))) *
          cos(radians(ST_X(p.last_location::geometry)) - radians(v_pickup_lng)) +
          sin(radians(v_pickup_lat)) * sin(radians(ST_Y(p.last_location::geometry)))
        ))
      )
    )::numeric AS distance_km,
    p.last_location_at,
    COALESCE(ds.vehicle_type, v_vehicle_type) AS vehicle_type
  FROM public.profiles p
  LEFT JOIN public.rides_driver_status ds ON ds.user_id = p.user_id
  WHERE 
    p.last_location IS NOT NULL
    AND p.last_location_at > (now() - (_minutes_online || ' minutes')::interval)
    -- Exclude drivers already notified for this trip
    AND NOT EXISTS (
      SELECT 1 FROM public.ride_requests rr
      WHERE rr.trip_id = _trip_id 
        AND rr.driver_id = p.user_id
    )
    -- Match vehicle type if driver has one set and is online
    AND (
      ds.vehicle_type IS NULL 
      OR (ds.vehicle_type = v_vehicle_type AND (ds.is_online IS NULL OR ds.is_online = true))
    )
    -- Bounding box filter
    AND ST_Y(p.last_location::geometry) BETWEEN (v_pickup_lat - (_radius_km / 111.0)) 
                                             AND (v_pickup_lat + (_radius_km / 111.0))
    AND ST_X(p.last_location::geometry) BETWEEN (v_pickup_lng - (_radius_km / (111.0 * cos(radians(v_pickup_lat))))) 
                                             AND (v_pickup_lng + (_radius_km / (111.0 * cos(radians(v_pickup_lat)))))
  ORDER BY distance_km ASC
  LIMIT _limit;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.update_user_location_cache TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.get_cached_location TO service_role, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.record_driver_notification TO service_role;
GRANT EXECUTE ON FUNCTION public.record_driver_response TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.get_notified_drivers TO service_role, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.find_online_drivers_near_trip TO service_role;

COMMIT;
