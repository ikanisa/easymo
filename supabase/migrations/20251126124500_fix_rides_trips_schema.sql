-- Align rides_trips schema with wa-webhook-mobility expectations
DO $$
BEGIN
  -- Rename legacy coordinate columns to *_latitude / *_longitude
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rides_trips' AND column_name = 'pickup_lat'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rides_trips' AND column_name = 'pickup_latitude'
  ) THEN
    EXECUTE 'ALTER TABLE public.rides_trips RENAME COLUMN pickup_lat TO pickup_latitude';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rides_trips' AND column_name = 'pickup_lng'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rides_trips' AND column_name = 'pickup_longitude'
  ) THEN
    EXECUTE 'ALTER TABLE public.rides_trips RENAME COLUMN pickup_lng TO pickup_longitude';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rides_trips' AND column_name = 'dropoff_lat'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rides_trips' AND column_name = 'dropoff_latitude'
  ) THEN
    EXECUTE 'ALTER TABLE public.rides_trips RENAME COLUMN dropoff_lat TO dropoff_latitude';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rides_trips' AND column_name = 'dropoff_lng'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rides_trips' AND column_name = 'dropoff_longitude'
  ) THEN
    EXECUTE 'ALTER TABLE public.rides_trips RENAME COLUMN dropoff_lng TO dropoff_longitude';
  END IF;
END $$;

ALTER TABLE public.rides_trips
  ADD COLUMN IF NOT EXISTS creator_user_id uuid REFERENCES public.profiles(user_id) ON UPDATE CASCADE ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS vehicle_type text,
  ADD COLUMN IF NOT EXISTS pickup geometry(Point, 4326),
  ADD COLUMN IF NOT EXISTS pickup_radius_m integer,
  ADD COLUMN IF NOT EXISTS pickup_text text,
  ADD COLUMN IF NOT EXISTS dropoff geometry(Point, 4326),
  ADD COLUMN IF NOT EXISTS dropoff_text text,
  ADD COLUMN IF NOT EXISTS dropoff_radius_m integer,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS matched_at timestamptz,
  ADD COLUMN IF NOT EXISTS ref_code text;

-- Populate the newly added columns where possible
UPDATE public.rides_trips
SET creator_user_id = COALESCE(creator_user_id, rider_user_id, driver_user_id),
    role = COALESCE(
      role,
      CASE
        WHEN rider_user_id IS NOT NULL THEN 'passenger'
        WHEN driver_user_id IS NOT NULL THEN 'driver'
        ELSE NULL
      END
    ),
    pickup_radius_m = COALESCE(pickup_radius_m, 10000),
    ref_code = COALESCE(ref_code, substring(id::text from 1 for 8))
WHERE creator_user_id IS NULL
   OR role IS NULL
   OR pickup_radius_m IS NULL
   OR ref_code IS NULL;

-- Backfill geometry columns from lat/lng pairs
UPDATE public.rides_trips
SET pickup = ST_SetSRID(ST_MakePoint(pickup_longitude, pickup_latitude), 4326)
WHERE pickup IS NULL
  AND pickup_latitude IS NOT NULL
  AND pickup_longitude IS NOT NULL;

UPDATE public.rides_trips
SET dropoff = ST_SetSRID(ST_MakePoint(dropoff_longitude, dropoff_latitude), 4326)
WHERE dropoff IS NULL
  AND dropoff_latitude IS NOT NULL
  AND dropoff_longitude IS NOT NULL;

-- Ensure status & expiry defaults
UPDATE public.rides_trips
SET status = COALESCE(status, 'pending')
WHERE status IS NULL;

UPDATE public.rides_trips
SET expires_at = COALESCE(expires_at, now() + interval '30 minutes')
WHERE expires_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_rides_trips_creator_user_id
  ON public.rides_trips(creator_user_id);

CREATE INDEX IF NOT EXISTS idx_rides_trips_role
  ON public.rides_trips(role);

CREATE INDEX IF NOT EXISTS idx_rides_trips_vehicle_type
  ON public.rides_trips(vehicle_type);
