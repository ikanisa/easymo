-- Add recommendation functions for mobility intents
-- Helps users discover drivers/passengers based on historical patterns

BEGIN;

-- Function: Recommend drivers to passengers based on historical intents
CREATE OR REPLACE FUNCTION public.recommend_drivers_for_user(
  _user_id uuid,
  _limit integer DEFAULT 5
)
RETURNS TABLE (
  driver_user_id uuid,
  whatsapp_e164 text,
  vehicle_type text,
  distance_km numeric,
  match_score numeric,
  last_online_at timestamptz
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_common_pickup geography;
  v_common_vehicle text;
BEGIN
  -- Get user's most common pickup location (centroid of recent searches)
  SELECT 
    ST_Centroid(ST_Collect(pickup_geog::geometry))::geography,
    MODE() WITHIN GROUP (ORDER BY vehicle_type)
  INTO 
    v_common_pickup,
    v_common_vehicle
  FROM mobility_intents
  WHERE user_id = _user_id
    AND intent_type = 'nearby_drivers'
    AND created_at > now() - interval '30 days'
    AND pickup_geog IS NOT NULL
  LIMIT 100;
  
  -- If no historical data, return empty
  IF v_common_pickup IS NULL THEN
    RETURN;
  END IF;
  
  -- Find drivers who have been active near this location
  RETURN QUERY
  SELECT DISTINCT ON (mi.user_id)
    mi.user_id AS driver_user_id,
    COALESCE(p.phone_number, p.wa_id) AS whatsapp_e164,
    mi.vehicle_type,
    ROUND((ST_Distance(mi.pickup_geog, v_common_pickup) / 1000)::numeric, 2) AS distance_km,
    -- Score based on recency and proximity (higher is better)
    ROUND(
      (1.0 / (1 + EXTRACT(EPOCH FROM (now() - mi.created_at)) / 86400.0) * 100 +
       1.0 / (1 + ST_Distance(mi.pickup_geog, v_common_pickup) / 1000.0) * 100
      )::numeric, 2
    ) AS match_score,
    mi.created_at AS last_online_at
  FROM mobility_intents mi
  JOIN profiles p ON p.user_id = mi.user_id
  WHERE mi.intent_type IN ('nearby_passengers', 'go_online')
    AND mi.created_at > now() - interval '7 days'
    AND ST_DWithin(mi.pickup_geog, v_common_pickup, 10000) -- 10km
    AND mi.user_id != _user_id
    AND (v_common_vehicle IS NULL OR mi.vehicle_type = v_common_vehicle)
    AND mi.pickup_geog IS NOT NULL
  ORDER BY mi.user_id, mi.created_at DESC
  LIMIT _limit;
END;
$$;

-- Function: Recommend passengers to drivers based on historical intents
CREATE OR REPLACE FUNCTION public.recommend_passengers_for_user(
  _user_id uuid,
  _limit integer DEFAULT 5
)
RETURNS TABLE (
  passenger_user_id uuid,
  whatsapp_e164 text,
  vehicle_type text,
  distance_km numeric,
  match_score numeric,
  last_search_at timestamptz
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_common_pickup geography;
  v_driver_vehicle text;
BEGIN
  -- Get driver's most common pickup location
  SELECT 
    ST_Centroid(ST_Collect(pickup_geog::geometry))::geography,
    MODE() WITHIN GROUP (ORDER BY vehicle_type)
  INTO 
    v_common_pickup,
    v_driver_vehicle
  FROM mobility_intents
  WHERE user_id = _user_id
    AND intent_type IN ('nearby_passengers', 'go_online')
    AND created_at > now() - interval '30 days'
    AND pickup_geog IS NOT NULL
  LIMIT 100;
  
  IF v_common_pickup IS NULL THEN
    RETURN;
  END IF;
  
  -- Find passengers who have searched for drivers near this location
  RETURN QUERY
  SELECT DISTINCT ON (mi.user_id)
    mi.user_id AS passenger_user_id,
    COALESCE(p.phone_number, p.wa_id) AS whatsapp_e164,
    mi.vehicle_type,
    ROUND((ST_Distance(mi.pickup_geog, v_common_pickup) / 1000)::numeric, 2) AS distance_km,
    ROUND(
      (1.0 / (1 + EXTRACT(EPOCH FROM (now() - mi.created_at)) / 86400.0) * 100 +
       1.0 / (1 + ST_Distance(mi.pickup_geog, v_common_pickup) / 1000.0) * 100
      )::numeric, 2
    ) AS match_score,
    mi.created_at AS last_search_at
  FROM mobility_intents mi
  JOIN profiles p ON p.user_id = mi.user_id
  WHERE mi.intent_type = 'nearby_drivers'
    AND mi.created_at > now() - interval '7 days'
    AND ST_DWithin(mi.pickup_geog, v_common_pickup, 10000)
    AND mi.user_id != _user_id
    AND (v_driver_vehicle IS NULL OR mi.vehicle_type = v_driver_vehicle)
    AND mi.pickup_geog IS NOT NULL
  ORDER BY mi.user_id, mi.created_at DESC
  LIMIT _limit;
END;
$$;

-- Function: Find scheduled trips near a location
CREATE OR REPLACE FUNCTION public.find_scheduled_trips_nearby(
  _lat double precision,
  _lng double precision,
  _radius_km double precision DEFAULT 10.0,
  _vehicle_type text DEFAULT NULL,
  _hours_ahead integer DEFAULT 24
)
RETURNS TABLE (
  trip_id uuid,
  creator_user_id uuid,
  whatsapp_e164 text,
  role text,
  vehicle_type text,
  pickup_text text,
  dropoff_text text,
  scheduled_at timestamptz,
  recurrence text,
  distance_km numeric,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id AS trip_id,
    t.creator_user_id,
    COALESCE(p.phone_number, p.wa_id) AS whatsapp_e164,
    t.role,
    t.vehicle_type,
    t.pickup_text,
    t.dropoff_text,
    t.scheduled_at,
    t.recurrence,
    ROUND(
      (6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(_lat)) * cos(radians(t.pickup_latitude)) *
          cos(radians(t.pickup_longitude) - radians(_lng)) +
          sin(radians(_lat)) * sin(radians(t.pickup_latitude))
        ))
      ))::numeric, 2
    ) AS distance_km,
    t.created_at
  FROM public.rides_trips t
  INNER JOIN public.profiles p ON p.user_id = t.creator_user_id
  WHERE t.status = 'scheduled'
    AND t.scheduled_at IS NOT NULL
    AND t.scheduled_at BETWEEN now() AND (now() + (_hours_ahead || ' hours')::interval)
    AND t.pickup_latitude IS NOT NULL
    AND t.pickup_longitude IS NOT NULL
    AND (_vehicle_type IS NULL OR t.vehicle_type = _vehicle_type)
    AND (
      6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(_lat)) * cos(radians(t.pickup_latitude)) *
          cos(radians(t.pickup_longitude) - radians(_lng)) +
          sin(radians(_lat)) * sin(radians(t.pickup_latitude))
        ))
      )
    ) <= _radius_km
  ORDER BY distance_km ASC;
END;
$$;

COMMIT;
