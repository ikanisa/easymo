-- ============================================================================
-- HOTFIX: Fix matching functions to use correct column names
-- ============================================================================
-- The trips table uses pickup_lat/pickup_lng (not pickup_latitude/pickup_longitude)
-- This hotfix updates the functions to use the correct column names
-- ============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.match_drivers_for_trip_v2(uuid, integer, boolean, integer, integer) CASCADE;
DROP FUNCTION IF EXISTS public.match_passengers_for_trip_v2(uuid, integer, boolean, integer, integer) CASCADE;

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
  created_at timestamptz,
  vehicle_type text,
  is_exact_match boolean,
  location_age_minutes integer,
  number_plate text,
  driver_name text,
  role text
)
LANGUAGE plpgsql STABLE
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
    t.pickup_lat, t.pickup_lng, t.dropoff_lat, t.dropoff_lng, t.vehicle_type,
    CASE WHEN _radius_m IS NULL OR _radius_m <= 0 THEN 10.0
         ELSE _radius_m::double precision / 1000.0 END
  INTO v_pickup_lat, v_pickup_lng, v_dropoff_lat, v_dropoff_lng, v_vehicle_type, v_radius_km
  FROM public.trips t WHERE t.id = _trip_id;

  IF v_pickup_lat IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT 
    t.id, t.creator_user_id,
    COALESCE(p.phone_number, p.wa_id),
    COALESCE(t.ref_code, SUBSTRING(t.id::text, 1, 8)),
    ROUND((6371 * acos(LEAST(1.0, GREATEST(-1.0,
      cos(radians(v_pickup_lat)) * cos(radians(t.pickup_lat)) *
      cos(radians(t.pickup_lng) - radians(v_pickup_lng)) +
      sin(radians(v_pickup_lat)) * sin(radians(t.pickup_lat))
    ))))::numeric, 2),
    CASE WHEN _prefer_dropoff AND v_dropoff_lat IS NOT NULL AND t.dropoff_lat IS NOT NULL
      THEN ROUND((6371000 * acos(LEAST(1.0, GREATEST(-1.0,
        cos(radians(v_dropoff_lat)) * cos(radians(t.dropoff_lat)) *
        cos(radians(t.dropoff_lng) - radians(v_dropoff_lng)) +
        sin(radians(v_dropoff_lat)) * sin(radians(t.dropoff_lat))
      ))))::numeric, 0) ELSE NULL END,
    t.pickup_text, t.dropoff_text, NULL::timestamptz, t.created_at, t.vehicle_type,
    (t.vehicle_type = v_vehicle_type),
    EXTRACT(EPOCH FROM (now() - t.updated_at))::integer / 60,
    COALESCE(t.number_plate, (p.metadata->>'number_plate')::text, (p.metadata->'driver'->>'number_plate')::text),
    COALESCE(p.display_name, p.phone_number, 'Driver'),
    'driver'::text
  FROM public.trips t
  INNER JOIN public.profiles p ON p.user_id = t.creator_user_id
  WHERE t.role = 'driver'
    AND t.status = 'open'
    AND (t.expires_at IS NULL OR t.expires_at > now())
    AND t.pickup_lat IS NOT NULL AND t.pickup_lng IS NOT NULL
    AND t.updated_at > now() - interval '24 hours'
    AND t.created_at >= NOW() - (INTERVAL '1 day' * _window_days)
    AND t.id != _trip_id
    AND (6371 * acos(LEAST(1.0, GREATEST(-1.0,
      cos(radians(v_pickup_lat)) * cos(radians(t.pickup_lat)) *
      cos(radians(t.pickup_lng) - radians(v_pickup_lng)) +
      sin(radians(v_pickup_lat)) * sin(radians(t.pickup_lat))
    )))) <= v_radius_km
  ORDER BY distance_km ASC, t.updated_at DESC, (t.vehicle_type = v_vehicle_type) DESC
  LIMIT _limit;
END;
$$;

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
  created_at timestamptz,
  vehicle_type text,
  is_exact_match boolean,
  location_age_minutes integer,
  number_plate text,
  driver_name text,
  role text
)
LANGUAGE plpgsql STABLE
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
    t.pickup_lat, t.pickup_lng, t.dropoff_lat, t.dropoff_lng, t.vehicle_type,
    CASE WHEN _radius_m IS NULL OR _radius_m <= 0 THEN 10.0
         ELSE _radius_m::double precision / 1000.0 END
  INTO v_pickup_lat, v_pickup_lng, v_dropoff_lat, v_dropoff_lng, v_vehicle_type, v_radius_km
  FROM public.trips t WHERE t.id = _trip_id;

  IF v_pickup_lat IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT 
    t.id, t.creator_user_id,
    COALESCE(p.phone_number, p.wa_id),
    COALESCE(t.ref_code, SUBSTRING(t.id::text, 1, 8)),
    ROUND((6371 * acos(LEAST(1.0, GREATEST(-1.0,
      cos(radians(v_pickup_lat)) * cos(radians(t.pickup_lat)) *
      cos(radians(t.pickup_lng) - radians(v_pickup_lng)) +
      sin(radians(v_pickup_lat)) * sin(radians(t.pickup_lat))
    ))))::numeric, 2),
    CASE WHEN _prefer_dropoff AND v_dropoff_lat IS NOT NULL AND t.dropoff_lat IS NOT NULL
      THEN ROUND((6371000 * acos(LEAST(1.0, GREATEST(-1.0,
        cos(radians(v_dropoff_lat)) * cos(radians(t.dropoff_lat)) *
        cos(radians(t.dropoff_lng) - radians(v_dropoff_lng)) +
        sin(radians(v_dropoff_lat)) * sin(radians(t.dropoff_lat))
      ))))::numeric, 0) ELSE NULL END,
    t.pickup_text, t.dropoff_text, NULL::timestamptz, t.created_at, t.vehicle_type,
    (t.vehicle_type = v_vehicle_type),
    EXTRACT(EPOCH FROM (now() - t.updated_at))::integer / 60,
    NULL::text,
    COALESCE(p.display_name, p.phone_number, 'Passenger'),
    'passenger'::text
  FROM public.trips t
  INNER JOIN public.profiles p ON p.user_id = t.creator_user_id
  WHERE t.role = 'passenger'
    AND t.status = 'open'
    AND (t.expires_at IS NULL OR t.expires_at > now())
    AND t.pickup_lat IS NOT NULL AND t.pickup_lng IS NOT NULL
    AND t.updated_at > now() - interval '24 hours'
    AND t.created_at >= NOW() - (INTERVAL '1 day' * _window_days)
    AND t.id != _trip_id
    AND (6371 * acos(LEAST(1.0, GREATEST(-1.0,
      cos(radians(v_pickup_lat)) * cos(radians(t.pickup_lat)) *
      cos(radians(t.pickup_lng) - radians(v_pickup_lng)) +
      sin(radians(v_pickup_lat)) * sin(radians(t.pickup_lat))
    )))) <= v_radius_km
  ORDER BY distance_km ASC, t.updated_at DESC, (t.vehicle_type = v_vehicle_type) DESC
  LIMIT _limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_drivers_for_trip_v2 TO service_role, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.match_passengers_for_trip_v2 TO service_role, authenticated, anon;

COMMIT;
