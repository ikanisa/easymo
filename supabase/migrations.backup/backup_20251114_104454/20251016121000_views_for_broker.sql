BEGIN;

CREATE OR REPLACE VIEW public.broker_driver_candidates AS
SELECT
  dp.driver_id,
  dp.id AS parking_id,
  dp.geog AS parking_geog,
  u.id AS user_id,
  u.created_at AS driver_since
FROM public.driver_parking dp
JOIN auth.users u ON u.id = dp.driver_id
WHERE dp.active = true;

CREATE OR REPLACE FUNCTION public.time_window_contains(
  start_time_local time,
  end_time_local time,
  candidate_time time
) RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN start_time_local <= end_time_local THEN
      candidate_time >= start_time_local AND candidate_time <= end_time_local
    ELSE
      candidate_time >= start_time_local OR candidate_time <= end_time_local
  END;
$$;

CREATE OR REPLACE FUNCTION public.search_driver_parking_candidates(
  _pickup_lat double precision,
  _pickup_lng double precision,
  _dropoff_lat double precision DEFAULT NULL,
  _dropoff_lng double precision DEFAULT NULL,
  _radius_km numeric DEFAULT 10,
  _when timestamptz DEFAULT timezone('utc', now()),
  _limit integer DEFAULT 20
)
RETURNS TABLE (
  driver_id uuid,
  parking_id uuid,
  pickup_distance_km numeric,
  dropoff_distance_km numeric,
  availability_fits boolean,
  recency_hours numeric,
  rank_score numeric
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  pickup_geog geography;
  dropoff_geog geography;
  radius_m numeric := GREATEST(_radius_km, 0.1) * 1000.0;
  target_time timestamptz := COALESCE(_when, timezone('utc', now()));
  w1 numeric := 1.0;
  w2 numeric := 1.0;
  w3 numeric := -1.0;
  w4 numeric := -0.25;
BEGIN
  pickup_geog := ST_SetSRID(ST_MakePoint(_pickup_lng, _pickup_lat), 4326)::geography;
  IF _dropoff_lat IS NOT NULL AND _dropoff_lng IS NOT NULL THEN
    dropoff_geog := ST_SetSRID(ST_MakePoint(_dropoff_lng, _dropoff_lat), 4326)::geography;
  END IF;

  BEGIN
    SELECT
      COALESCE((value->>'pickup')::numeric, w1),
      COALESCE((value->>'dropoff')::numeric, w2),
      COALESCE((value->>'time_window')::numeric, w3),
      COALESCE((value->>'recency')::numeric, w4)
    INTO w1, w2, w3, w4
    FROM public.settings
    WHERE key = 'broker.matching.weights';
  EXCEPTION WHEN others THEN
    NULL;
  END;

  RETURN QUERY
  WITH base AS (
    SELECT
      dp.id AS parking_id,
      dp.driver_id,
      dp.geog,
      dp.updated_at,
      (ST_Distance(dp.geog, pickup_geog) / 1000.0) AS pickup_km,
      CASE
        WHEN dropoff_geog IS NOT NULL THEN (ST_Distance(dp.geog, dropoff_geog) / 1000.0)
        ELSE NULL
      END AS dropoff_km
    FROM public.driver_parking dp
    WHERE dp.active
      AND ST_DWithin(dp.geog, pickup_geog, radius_m)
      AND (
        dropoff_geog IS NULL OR ST_DWithin(dp.geog, dropoff_geog, radius_m)
      )
  ), availability AS (
    SELECT
      b.parking_id,
      EXISTS (
        SELECT 1
        FROM public.driver_availability da
        WHERE da.driver_id = b.driver_id
          AND da.active
          AND (da.parking_id IS NULL OR da.parking_id = b.parking_id)
          AND EXISTS (
            SELECT 1
            FROM unnest(da.days_of_week) AS d(day)
            WHERE d.day = EXTRACT(ISODOW FROM (target_time AT TIME ZONE da.timezone))::int
          )
          AND public.time_window_contains(
            da.start_time_local,
            da.end_time_local,
            (target_time AT TIME ZONE da.timezone)::time
          )
      ) AS fits
    FROM base b
  )
  SELECT
    b.driver_id,
    b.parking_id,
    (b.pickup_km)::numeric AS pickup_distance_km,
    (b.dropoff_km)::numeric AS dropoff_distance_km,
    COALESCE(a.fits, true) AS availability_fits,
    (EXTRACT(EPOCH FROM (timezone('utc', now()) - b.updated_at)) / 3600.0)::numeric AS recency_hours,
    (
      w1 * b.pickup_km
      + COALESCE(b.dropoff_km, 0) * w2
      + (CASE WHEN COALESCE(a.fits, true) THEN w3 ELSE 0 END)
      + w4 * (EXTRACT(EPOCH FROM (timezone('utc', now()) - b.updated_at)) / 3600.0)
    )::numeric AS rank_score
  FROM base b
  LEFT JOIN availability a ON a.parking_id = b.parking_id
  ORDER BY rank_score, b.pickup_km
  LIMIT LEAST(GREATEST(_limit, 1), 200);
END;
$$;

CREATE OR REPLACE FUNCTION public.find_due_recurring_trips(
  _window_minutes integer DEFAULT 5,
  _now timestamptz DEFAULT timezone('utc', now())
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  origin_favorite_id uuid,
  dest_favorite_id uuid,
  scheduled_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
  WITH params AS (
    SELECT
      COALESCE(_now, timezone('utc', now())) AS current_time,
      GREATEST(_window_minutes, 1) AS window_minutes
  ), base AS (
    SELECT
      rt.id,
      rt.user_id,
      rt.origin_favorite_id,
      rt.dest_favorite_id,
      rt.days_of_week,
      rt.time_local,
      rt.timezone,
      rt.last_triggered_at,
      params.current_time,
      params.window_minutes,
      (params.current_time AT TIME ZONE rt.timezone) AS local_now
    FROM public.recurring_trips rt
    CROSS JOIN params
    WHERE rt.active
  ), schedule AS (
    SELECT
      b.*,
      (date_trunc('day', b.local_now) + b.time_local)::timestamp AT TIME ZONE b.timezone AS scheduled_at
    FROM base b
  )
  SELECT
    s.id,
    s.user_id,
    s.origin_favorite_id,
    s.dest_favorite_id,
    s.scheduled_at
  FROM schedule s
  WHERE EXISTS (
      SELECT 1
      FROM unnest(s.days_of_week) AS d(day)
      WHERE d.day = EXTRACT(ISODOW FROM s.local_now)::int
    )
    AND ABS(EXTRACT(EPOCH FROM (s.scheduled_at - s.current_time))) <= (s.window_minutes * 60)
    AND (
      s.last_triggered_at IS NULL
      OR s.last_triggered_at < s.scheduled_at - interval '1 minute'
    );
$$;

CREATE OR REPLACE FUNCTION public.record_recurring_trip_trigger(
  _trip_id uuid,
  _triggered_at timestamptz DEFAULT timezone('utc', now())
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.recurring_trips
  SET last_triggered_at = _triggered_at
  WHERE id = _trip_id;
END;
$$;

COMMIT;
