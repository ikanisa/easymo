-- Fix driver matching to be more flexible with vehicle types
-- Shows exact matches first, then nearby drivers with any vehicle type
-- Prioritizes user preference but doesn't exclude options

BEGIN;

-- Drop existing functions to allow return type changes
DROP FUNCTION IF EXISTS public.match_drivers_for_trip_v2(uuid, integer, boolean, integer, integer);
DROP FUNCTION IF EXISTS public.match_passengers_for_trip_v2(uuid, integer, boolean, integer, integer);

-- Enhanced match_drivers_for_trip_v2 with flexible vehicle matching
CREATE FUNCTION public.match_drivers_for_trip_v2(
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
  created_at timestamptz,
  vehicle_type text,
  is_exact_match boolean
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

  -- Find matching drivers with flexible vehicle type matching
  -- Prioritize exact matches, then show any nearby drivers
  RETURN QUERY
  SELECT 
    t.id AS trip_id,
    t.creator_user_id,
    COALESCE(p.phone_number, p.wa_id) AS whatsapp_e164,
    COALESCE(t.ref_code, SUBSTRING(t.id::text, 1, 8)) AS ref_code,
    ROUND(
      (6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(v_pickup_lat)) * cos(radians(t.pickup_latitude)) *
          cos(radians(t.pickup_longitude) - radians(v_pickup_lng)) +
          sin(radians(v_pickup_lat)) * sin(radians(t.pickup_latitude))
        ))
      ))::numeric, 2
    ) AS distance_km,
    CASE
      WHEN _prefer_dropoff AND v_dropoff_lat IS NOT NULL AND t.dropoff_latitude IS NOT NULL THEN
        ROUND(
          (6371000 * acos(
            LEAST(1.0, GREATEST(-1.0,
              cos(radians(v_dropoff_lat)) * cos(radians(t.dropoff_latitude)) *
              cos(radians(t.dropoff_longitude) - radians(v_dropoff_lng)) +
              sin(radians(v_dropoff_lat)) * sin(radians(t.dropoff_latitude))
            ))
          ))::numeric, 0
        )
      ELSE NULL
    END AS drop_bonus_m,
    t.pickup_text,
    t.dropoff_text,
    t.matched_at,
    t.created_at,
    t.vehicle_type,
    (t.vehicle_type = v_vehicle_type) AS is_exact_match
  FROM public.rides_trips t
  INNER JOIN public.profiles p ON p.user_id = t.creator_user_id
  WHERE t.role = 'driver'
    AND t.status IN ('open', 'pending', 'active')
    AND t.expires_at > now()
    AND t.pickup_latitude IS NOT NULL
    AND t.pickup_longitude IS NOT NULL
    AND t.created_at >= NOW() - (INTERVAL '1 day' * _window_days)
    AND t.id != _trip_id
    AND (
      -- Within radius check
      6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(v_pickup_lat)) * cos(radians(t.pickup_latitude)) *
          cos(radians(t.pickup_longitude) - radians(v_pickup_lng)) +
          sin(radians(v_pickup_lat)) * sin(radians(t.pickup_latitude))
        ))
      ) <= v_radius_km
    )
  ORDER BY 
    -- Prioritize exact vehicle matches
    (t.vehicle_type = v_vehicle_type) DESC,
    -- Then sort by distance
    distance_km ASC,
    -- Then by recency
    t.created_at DESC
  LIMIT _limit;
END;
$$;

-- Enhanced match_passengers_for_trip_v2 with same improvements
CREATE FUNCTION public.match_passengers_for_trip_v2(
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
  created_at timestamptz,
  vehicle_type text,
  is_exact_match boolean
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

  -- Find matching passengers with flexible vehicle type matching
  RETURN QUERY
  SELECT 
    t.id AS trip_id,
    t.creator_user_id,
    COALESCE(p.phone_number, p.wa_id) AS whatsapp_e164,
    COALESCE(t.ref_code, SUBSTRING(t.id::text, 1, 8)) AS ref_code,
    ROUND(
      (6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(v_pickup_lat)) * cos(radians(t.pickup_latitude)) *
          cos(radians(t.pickup_longitude) - radians(v_pickup_lng)) +
          sin(radians(v_pickup_lat)) * sin(radians(t.pickup_latitude))
        ))
      ))::numeric, 2
    ) AS distance_km,
    CASE
      WHEN _prefer_dropoff AND v_dropoff_lat IS NOT NULL AND t.dropoff_latitude IS NOT NULL THEN
        ROUND(
          (6371000 * acos(
            LEAST(1.0, GREATEST(-1.0,
              cos(radians(v_dropoff_lat)) * cos(radians(t.dropoff_latitude)) *
              cos(radians(t.dropoff_longitude) - radians(v_dropoff_lng)) +
              sin(radians(v_dropoff_lat)) * sin(radians(t.dropoff_latitude))
            ))
          ))::numeric, 0
        )
      ELSE NULL
    END AS drop_bonus_m,
    t.pickup_text,
    t.dropoff_text,
    t.matched_at,
    t.created_at,
    t.vehicle_type,
    (t.vehicle_type = v_vehicle_type) AS is_exact_match
  FROM public.rides_trips t
  INNER JOIN public.profiles p ON p.user_id = t.creator_user_id
  WHERE t.role = 'passenger'
    AND t.status IN ('open', 'pending', 'active')
    AND t.expires_at > now()
    AND t.pickup_latitude IS NOT NULL
    AND t.pickup_longitude IS NOT NULL
    AND t.created_at >= NOW() - (INTERVAL '1 day' * _window_days)
    AND t.id != _trip_id
    AND (
      -- Within radius check
      6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(v_pickup_lat)) * cos(radians(t.pickup_latitude)) *
          cos(radians(t.pickup_longitude) - radians(v_pickup_lng)) +
          sin(radians(v_pickup_lat)) * sin(radians(t.pickup_latitude))
        ))
      ) <= v_radius_km
    )
  ORDER BY 
    -- Prioritize exact vehicle matches
    (t.vehicle_type = v_vehicle_type) DESC,
    -- Then sort by distance
    distance_km ASC,
    -- Then by recency
    t.created_at DESC
  LIMIT _limit;
END;
$$;

COMMIT;
