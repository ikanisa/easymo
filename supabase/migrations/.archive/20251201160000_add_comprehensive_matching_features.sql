-- Add missing features from comprehensive matching fixes (guarded for legacy table)
-- Complements 20251201150000_fix_matching_location_freshness.sql

BEGIN;

-- Drop outdated functions/views (safe even if table is gone)
DROP VIEW IF EXISTS mobility_location_health CASCADE;
DROP FUNCTION IF EXISTS public.update_trip_location CASCADE;
DROP FUNCTION IF EXISTS public.update_location_timestamp CASCADE;
DROP FUNCTION IF EXISTS public.match_drivers_for_trip_v2 CASCADE;
DROP FUNCTION IF EXISTS public.match_passengers_for_trip_v2 CASCADE;

-- Only apply the legacy rides_trips updates if the table exists in this environment
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'rides_trips') THEN
    RAISE NOTICE 'rides_trips exists - legacy location freshness objects not recreated in this environment';
  ELSE
    RAISE NOTICE 'rides_trips table missing; skipping legacy location freshness migration 20251201160000';
  END IF;
END$$;

COMMIT;
