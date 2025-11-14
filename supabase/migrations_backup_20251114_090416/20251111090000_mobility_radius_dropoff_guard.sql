-- Enforce 10 km radius and dropoff proximity for mobility matching
BEGIN;

DROP FUNCTION IF EXISTS public.match_drivers_for_trip_v2(uuid, int, boolean, int, int);
CREATE OR REPLACE FUNCTION public.match_drivers_for_trip_v2(
    _trip_id uuid,
    _limit int DEFAULT 9,
    _prefer_dropoff boolean DEFAULT false,
    _radius_m int DEFAULT NULL,
    _window_days int DEFAULT 30
)
RETURNS TABLE(
    trip_id uuid,
    creator_user_id uuid,
    whatsapp_e164 text,
    ref_code text,
    distance_km numeric,
    drop_bonus_m numeric,
    pickup_text text,
    dropoff_text text,
    matched_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_trip RECORD;
  target_role text;
  window_start timestamptz;
  effective_radius integer;
  drop_radius integer;
  MAX_RADIUS constant integer := 10000;
BEGIN
  SELECT id, role, vehicle_type, pickup, dropoff, pickup_radius_m, dropoff_radius_m, created_at
  INTO base_trip
  FROM public.trips
  WHERE id = _trip_id;

  IF NOT FOUND OR base_trip.pickup IS NULL THEN
    RETURN;
  END IF;

  target_role := CASE WHEN base_trip.role = 'driver' THEN 'passenger' ELSE 'driver' END;
  window_start := timezone('utc', now()) - (_window_days || ' days')::interval;
  effective_radius := LEAST(
    COALESCE(_radius_m, base_trip.pickup_radius_m, MAX_RADIUS),
    MAX_RADIUS
  );
  drop_radius := LEAST(
    COALESCE(_radius_m, base_trip.dropoff_radius_m, effective_radius, MAX_RADIUS),
    MAX_RADIUS
  );

  RETURN QUERY
  SELECT
    t.id,
    t.creator_user_id,
    p.whatsapp_e164,
    public.profile_ref_code(t.creator_user_id) AS ref_code,
    (ST_Distance(t.pickup, base_trip.pickup) / 1000.0)::numeric(10, 3) AS distance_km,
    CASE
      WHEN _prefer_dropoff AND base_trip.dropoff IS NOT NULL AND t.dropoff IS NOT NULL
        THEN ST_Distance(t.dropoff, base_trip.dropoff)::numeric(12, 2)
      ELSE NULL
    END AS drop_bonus_m,
    t.pickup_text,
    t.dropoff_text,
    t.created_at AS matched_at
  FROM public.trips t
  JOIN public.profiles p ON p.user_id = t.creator_user_id
  WHERE t.status = 'open'
    AND t.id <> base_trip.id
    AND t.pickup IS NOT NULL
    AND t.role = target_role
    AND t.vehicle_type = base_trip.vehicle_type
    AND t.created_at >= window_start
    AND ST_DWithin(t.pickup, base_trip.pickup, effective_radius)
    AND (
      base_trip.dropoff IS NULL
      OR t.dropoff IS NULL
      OR ST_DWithin(t.dropoff, base_trip.dropoff, drop_radius)
    )
  ORDER BY
    ST_Distance(t.pickup, base_trip.pickup),
    CASE
      WHEN base_trip.dropoff IS NOT NULL AND t.dropoff IS NOT NULL
        THEN ST_Distance(t.dropoff, base_trip.dropoff)
      ELSE MAX_RADIUS
    END,
    t.created_at DESC,
    t.id
  LIMIT LEAST(GREATEST(_limit, 1), 9);
END;
$$;

DROP FUNCTION IF EXISTS public.match_passengers_for_trip_v2(uuid, int, boolean, int, int);
CREATE OR REPLACE FUNCTION public.match_passengers_for_trip_v2(
    _trip_id uuid,
    _limit int DEFAULT 9,
    _prefer_dropoff boolean DEFAULT false,
    _radius_m int DEFAULT NULL,
    _window_days int DEFAULT 30
)
RETURNS TABLE(
    trip_id uuid,
    creator_user_id uuid,
    whatsapp_e164 text,
    ref_code text,
    distance_km numeric,
    drop_bonus_m numeric,
    pickup_text text,
    dropoff_text text,
    matched_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_trip RECORD;
  target_role text;
  window_start timestamptz;
  effective_radius integer;
  drop_radius integer;
  MAX_RADIUS constant integer := 10000;
BEGIN
  SELECT id, role, vehicle_type, pickup, dropoff, pickup_radius_m, dropoff_radius_m, created_at
  INTO base_trip
  FROM public.trips
  WHERE id = _trip_id;

  IF NOT FOUND OR base_trip.pickup IS NULL THEN
    RETURN;
  END IF;

  target_role := CASE WHEN base_trip.role = 'driver' THEN 'passenger' ELSE 'driver' END;
  window_start := timezone('utc', now()) - (_window_days || ' days')::interval;
  effective_radius := LEAST(
    COALESCE(_radius_m, base_trip.pickup_radius_m, MAX_RADIUS),
    MAX_RADIUS
  );
  drop_radius := LEAST(
    COALESCE(_radius_m, base_trip.dropoff_radius_m, effective_radius, MAX_RADIUS),
    MAX_RADIUS
  );

  RETURN QUERY
  SELECT
    t.id,
    t.creator_user_id,
    p.whatsapp_e164,
    public.profile_ref_code(t.creator_user_id) AS ref_code,
    (ST_Distance(t.pickup, base_trip.pickup) / 1000.0)::numeric(10, 3) AS distance_km,
    CASE
      WHEN _prefer_dropoff AND base_trip.dropoff IS NOT NULL AND t.dropoff IS NOT NULL
        THEN ST_Distance(t.dropoff, base_trip.dropoff)::numeric(12, 2)
      ELSE NULL
    END AS drop_bonus_m,
    t.pickup_text,
    t.dropoff_text,
    t.created_at AS matched_at
  FROM public.trips t
  JOIN public.profiles p ON p.user_id = t.creator_user_id
  WHERE t.status = 'open'
    AND t.id <> base_trip.id
    AND t.pickup IS NOT NULL
    AND t.role = target_role
    AND t.vehicle_type = base_trip.vehicle_type
    AND t.created_at >= window_start
    AND ST_DWithin(t.pickup, base_trip.pickup, effective_radius)
    AND (
      base_trip.dropoff IS NULL
      OR t.dropoff IS NULL
      OR ST_DWithin(t.dropoff, base_trip.dropoff, drop_radius)
    )
  ORDER BY
    ST_Distance(t.pickup, base_trip.pickup),
    CASE
      WHEN base_trip.dropoff IS NOT NULL AND t.dropoff IS NOT NULL
        THEN ST_Distance(t.dropoff, base_trip.dropoff)
      ELSE MAX_RADIUS
    END,
    t.created_at DESC,
    t.id
  LIMIT LEAST(GREATEST(_limit, 1), 9);
END;
$$;

COMMIT;
