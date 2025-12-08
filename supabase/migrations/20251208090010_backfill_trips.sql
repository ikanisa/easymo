-- Backfill legacy data into canonical trips
-- Sources: mobility_trips, scheduled_trips, rides_trips, recurring_trips, legacy trips (if present)
BEGIN;

-- Helper: normalize status
WITH ins AS (
  SELECT
    src,
    id,
    creator_user_id AS user_id,
    role,
    vehicle_type,
    pickup_lat,
    pickup_lng,
    pickup_text,
    scheduled_for,
    created_at,
    COALESCE(expires_at, created_at + interval '90 minutes') AS expires_at,
    CASE 
      WHEN COALESCE(expires_at, created_at + interval '90 minutes') < now() THEN 'expired'
      ELSE 'open'
    END AS status,
    kind,
    metadata
  FROM (
    -- mobility_trips
    SELECT 'mobility_trips'::text AS src, id, creator_user_id, role, vehicle_type,
           pickup_lat, pickup_lng, pickup_text, scheduled_for, created_at, expires_at,
           CASE WHEN scheduled_for IS NOT NULL THEN 'scheduled' ELSE 'request_intent' END AS kind,
           metadata
    FROM mobility_trips

    UNION ALL
    -- scheduled_trips
    SELECT 'scheduled_trips', id, user_id AS creator_user_id, role, vehicle_type,
           pickup_lat::double precision, pickup_lng::double precision, 
           pickup_address AS pickup_text, scheduled_time AS scheduled_for, 
           created_at, 
           NULL::timestamptz AS expires_at,
           'scheduled' AS kind,
           COALESCE(metadata, '{}'::jsonb)
    FROM scheduled_trips

    UNION ALL
    -- rides_trips (v1 mixed)
    SELECT 'rides_trips', id, 
           COALESCE(creator_user_id, rider_user_id) AS creator_user_id, 
           COALESCE(role, 'passenger') AS role, 
           COALESCE(vehicle_type, 'car') AS vehicle_type,
           COALESCE(pickup_latitude, ST_Y(pickup::geometry)) AS pickup_lat,
           COALESCE(pickup_longitude, ST_X(pickup::geometry)) AS pickup_lng, 
           COALESCE(pickup_text, pickup_address) AS pickup_text, 
           scheduled_at AS scheduled_for, 
           created_at, 
           expires_at,
           CASE WHEN scheduled_at IS NOT NULL THEN 'scheduled' ELSE 'request_intent' END AS kind,
           COALESCE(metadata, '{}'::jsonb)
    FROM rides_trips
    WHERE COALESCE(pickup_latitude, ST_Y(pickup::geometry)) IS NOT NULL 
      AND COALESCE(pickup_longitude, ST_X(pickup::geometry)) IS NOT NULL

    UNION ALL
    -- recurring_trips: expand only the template rows
    SELECT 'recurring_trips', id, user_id AS creator_user_id, 
           COALESCE(role, 'passenger') AS role, 
           COALESCE(vehicle_type, 'car') AS vehicle_type,
           pickup_latitude AS pickup_lat, 
           pickup_longitude AS pickup_lng, 
           pickup_text, 
           NULL::timestamptz AS scheduled_for, 
           created_at, 
           NULL::timestamptz AS expires_at,
           'scheduled' AS kind,
           jsonb_build_object('recurrence', recurrence, 'active', active)
    FROM recurring_trips
    WHERE active = true
  ) s
)
INSERT INTO public.trips (
  id, kind, role, user_id, vehicle_type,
  pickup_lat, pickup_lng, pickup_text,
  scheduled_for, requested_at, status, expires_at, metadata, created_at, updated_at
)
SELECT
  i.id,
  i.kind,
  i.role,
  i.user_id,
  NULLIF(i.vehicle_type, '') AS vehicle_type,
  i.pickup_lat,
  i.pickup_lng,
  i.pickup_text,
  i.scheduled_for,
  i.created_at AS requested_at,
  i.status,
  i.expires_at,
  COALESCE(i.metadata, '{}'::jsonb) || jsonb_build_object('source_table', i.src),
  i.created_at,
  i.created_at
FROM ins i
ON CONFLICT (id) DO NOTHING;

-- Deduplicate obvious duplicates (same user, role, pickup, scheduled_for within 5 minutes)
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, role, kind,
                        ROUND(pickup_lat::numeric, 4),
                        ROUND(pickup_lng::numeric, 4),
                        date_trunc('minute', scheduled_for)
           ORDER BY created_at
         ) AS rn
  FROM public.trips
)
DELETE FROM public.trips t
USING ranked r
WHERE t.id = r.id AND r.rn > 1;

COMMIT;
