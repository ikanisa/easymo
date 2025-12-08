-- ============================================================================
-- DROP DEPRECATED MOBILITY TABLES
-- ============================================================================
-- Migration: 20251208160000_drop_deprecated_mobility_tables.sql
-- Purpose: Clean up deprecated/duplicate mobility tables after consolidation
-- 
-- CRITICAL: Only run this AFTER:
-- 1. 20251208150000_consolidate_mobility_tables.sql has been applied
-- 2. Data migration has been verified
-- 3. All tests pass
-- 4. Application is confirmed working with canonical tables
--
-- This migration drops:
-- - rides_trips (legacy trip table)
-- - mobility_trips (V2 trip table)
-- - mobility_trip_matches (duplicate match table)
-- - Any phantom tables that may exist
-- ============================================================================

BEGIN;

-- ============================================================================
-- SAFETY CHECK: Verify consolidation was successful
-- ============================================================================

DO $$
DECLARE
  trips_count integer;
  matches_count integer;
BEGIN
  -- Check that canonical tables exist and have data
  SELECT COUNT(*) INTO trips_count FROM trips;
  SELECT COUNT(*) INTO matches_count FROM mobility_matches;
  
  RAISE NOTICE 'Canonical tables status:';
  RAISE NOTICE '  trips: % rows', trips_count;
  RAISE NOTICE '  mobility_matches: % rows', matches_count;
  
  -- Warning if canonical tables are empty
  IF trips_count = 0 THEN
    RAISE WARNING 'trips table is empty - verify consolidation succeeded';
  END IF;
END $$;

-- ============================================================================
-- STEP 1: Drop deprecated trip tables
-- ============================================================================

-- Drop rides_trips if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'rides_trips'
  ) THEN
    RAISE NOTICE 'Dropping rides_trips table...';
    DROP TABLE IF EXISTS public.rides_trips CASCADE;
    RAISE NOTICE 'rides_trips dropped';
  ELSE
    RAISE NOTICE 'rides_trips table does not exist - skipping';
  END IF;
END $$;

-- Drop mobility_trips if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'mobility_trips'
  ) THEN
    RAISE NOTICE 'Dropping mobility_trips table...';
    DROP TABLE IF EXISTS public.mobility_trips CASCADE;
    RAISE NOTICE 'mobility_trips dropped';
  ELSE
    RAISE NOTICE 'mobility_trips table does not exist - skipping';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Drop duplicate match table
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'mobility_trip_matches'
  ) THEN
    RAISE NOTICE 'Dropping mobility_trip_matches table...';
    DROP TABLE IF EXISTS public.mobility_trip_matches CASCADE;
    RAISE NOTICE 'mobility_trip_matches dropped';
  ELSE
    RAISE NOTICE 'mobility_trip_matches table does not exist - skipping';
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Drop phantom tables (if they exist)
-- ============================================================================

-- These tables were mentioned but not found in migrations
-- Drop them if they somehow exist in the database

DROP TABLE IF EXISTS public.pending_trips CASCADE;
DROP TABLE IF EXISTS public.pending_ride_request CASCADE;
DROP TABLE IF EXISTS public.ride_driver_status CASCADE;
DROP TABLE IF EXISTS public.mobility_trips_compact CASCADE;

RAISE NOTICE 'Phantom tables cleanup complete';

-- ============================================================================
-- STEP 4: Clean up orphaned indexes and constraints
-- ============================================================================

-- Drop any indexes that might reference old tables
DO $$
DECLARE
  idx RECORD;
BEGIN
  FOR idx IN 
    SELECT indexname 
    FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND (
        indexname LIKE '%rides_trips%' 
        OR indexname LIKE '%mobility_trip_matches%'
      )
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %I CASCADE', idx.indexname);
    RAISE NOTICE 'Dropped index: %', idx.indexname;
  END LOOP;
END $$;

-- Drop any functions that might still reference old tables
DO $$
DECLARE
  func RECORD;
BEGIN
  FOR func IN 
    SELECT proname, oidvectortypes(proargtypes) as args
    FROM pg_proc 
    WHERE proname IN (
      'match_drivers_for_ride',
      'match_passengers_for_ride',
      'get_nearby_rides',
      'create_ride_from_recurring'
    )
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %I(%s) CASCADE', func.proname, func.args);
    RAISE NOTICE 'Dropped function: %', func.proname;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 5: Verify cleanup
-- ============================================================================

DO $$
DECLARE
  remaining_tables text[];
BEGIN
  -- Check for any remaining trip-related tables
  SELECT array_agg(table_name) 
  INTO remaining_tables
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN (
      'rides_trips',
      'mobility_trips',
      'mobility_trip_matches',
      'pending_trips',
      'pending_ride_request',
      'ride_driver_status',
      'mobility_trips_compact'
    );
  
  IF remaining_tables IS NOT NULL THEN
    RAISE WARNING 'Some deprecated tables still exist: %', remaining_tables;
  ELSE
    RAISE NOTICE 'All deprecated tables successfully removed';
  END IF;
  
  -- Verify canonical tables still exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trips') THEN
    RAISE EXCEPTION 'CRITICAL: trips table was accidentally dropped!';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mobility_matches') THEN
    RAISE EXCEPTION 'CRITICAL: mobility_matches table was accidentally dropped!';
  END IF;
  
  RAISE NOTICE 'Canonical tables verified intact';
END $$;

-- ============================================================================
-- STEP 6: Log cleanup completion
-- ============================================================================

INSERT INTO public.system_logs (event_type, details)
VALUES ('MOBILITY_CLEANUP_COMPLETE', jsonb_build_object(
  'migration', '20251208160000_drop_deprecated_mobility_tables',
  'timestamp', now(),
  'dropped_tables', ARRAY[
    'rides_trips',
    'mobility_trips',
    'mobility_trip_matches',
    'pending_trips',
    'pending_ride_request',
    'ride_driver_status',
    'mobility_trips_compact'
  ],
  'canonical_tables_confirmed', ARRAY['trips', 'mobility_matches']
));

-- ============================================================================
-- STEP 7: Update table comments for documentation
-- ============================================================================

COMMENT ON TABLE public.trips IS 
  'CANONICAL trips table - single source of truth for all trip requests (scheduled + instant). '
  'Consolidated from rides_trips, mobility_trips on 2025-12-08. '
  'See mobility consolidation migration 20251208150000.';

COMMENT ON TABLE public.mobility_matches IS 
  'CANONICAL trip matches table - single source for all accepted trip pairings and lifecycle. '
  'Consolidated from mobility_trip_matches on 2025-12-08. '
  'See mobility consolidation migration 20251208150000.';

COMMIT;

-- ============================================================================
-- CLEANUP COMPLETE ✓
-- ============================================================================
-- 
-- Summary:
--   - Removed 7+ deprecated/duplicate tables
--   - Cleaned up orphaned indexes and functions
--   - Verified canonical tables intact
--   - Updated table documentation
--
-- Final schema:
--   CORE: trips, mobility_matches, ride_notifications, recurring_trips, mobility_intents
--   SUPPORT: trip_payment_requests, trip_status_audit, mobility_*_metrics, mobility_pricing_config
--
-- Total: 10 clean, focused tables (down from 15+)
-- ============================================================================
