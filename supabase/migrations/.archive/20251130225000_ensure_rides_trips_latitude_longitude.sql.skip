-- Ensure rides_trips uses *_latitude/*_longitude (not *_lat/*_lng)
-- This migration is idempotent and safe to run multiple times

BEGIN;

DO $$
BEGIN
  -- Rename pickup_lat to pickup_latitude if needed
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rides_trips' AND column_name = 'pickup_lat'
  ) THEN
    ALTER TABLE public.rides_trips RENAME COLUMN pickup_lat TO pickup_latitude;
    RAISE NOTICE 'Renamed pickup_lat to pickup_latitude';
  END IF;

  -- Rename pickup_lng to pickup_longitude if needed
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rides_trips' AND column_name = 'pickup_lng'
  ) THEN
    ALTER TABLE public.rides_trips RENAME COLUMN pickup_lng TO pickup_longitude;
    RAISE NOTICE 'Renamed pickup_lng to pickup_longitude';
  END IF;

  -- Rename dropoff_lat to dropoff_latitude if needed
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rides_trips' AND column_name = 'dropoff_lat'
  ) THEN
    ALTER TABLE public.rides_trips RENAME COLUMN dropoff_lat TO dropoff_latitude;
    RAISE NOTICE 'Renamed dropoff_lat to dropoff_latitude';
  END IF;

  -- Rename dropoff_lng to dropoff_longitude if needed
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rides_trips' AND column_name = 'dropoff_lng'
  ) THEN
    ALTER TABLE public.rides_trips RENAME COLUMN dropoff_lng TO dropoff_longitude;
    RAISE NOTICE 'Renamed dropoff_lng to dropoff_longitude';
  END IF;
END $$;

COMMIT;
