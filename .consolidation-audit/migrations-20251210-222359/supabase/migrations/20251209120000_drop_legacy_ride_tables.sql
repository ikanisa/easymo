-- ============================================================================
-- DROP LEGACY RIDE_* TABLES
-- ============================================================================
-- Migration: 20251209120000_drop_legacy_ride_tables.sql
-- Date: 2025-12-09
-- Purpose: Complete mobility consolidation by dropping legacy ride_* tables
--          after code has been updated to use canonical trip_* tables
-- 
-- Prerequisites:
--   1. Migration 20251209030000_consolidate_mobility_tables.sql applied
--   2. Edge Functions updated (booking.ts, nearby.ts, rides_agent.ts)
--   3. All references to legacy tables removed from code
--
-- Tables Dropped:
--   - ride_requests (replaced by trips table)
--   - ride_notifications (renamed to trip_notifications)
--
-- Risk: LOW (code already updated to use new tables)
-- Rollback: Restore from backup if needed
-- ============================================================================

BEGIN;

-- Verify new tables exist before dropping old ones
DO $$
DECLARE
  v_trips_exists BOOLEAN;
  v_trip_notifications_exists BOOLEAN;
BEGIN
  -- Check if canonical tables exist
  SELECT EXISTS(
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'trips'
  ) INTO v_trips_exists;
  
  SELECT EXISTS(
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'trip_notifications'
  ) INTO v_trip_notifications_exists;
  
  IF NOT v_trips_exists THEN
    RAISE EXCEPTION 'trips table does not exist - cannot drop legacy tables';
  END IF;
  
  IF NOT v_trip_notifications_exists THEN
    RAISE NOTICE 'trip_notifications does not exist yet - ride_notifications may still be in use';
  END IF;
  
  RAISE NOTICE 'Canonical tables verified - proceeding with cleanup';
END $$;

-- Drop ride_requests table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'ride_requests'
  ) THEN
    RAISE NOTICE 'Dropping ride_requests table...';
    DROP TABLE IF EXISTS public.ride_requests CASCADE;
    RAISE NOTICE 'ride_requests dropped successfully';
  ELSE
    RAISE NOTICE 'ride_requests table does not exist - skipping';
  END IF;
END $$;

-- Drop ride_notifications table (only if trip_notifications exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'ride_notifications'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'trip_notifications'
  ) THEN
    RAISE NOTICE 'Dropping ride_notifications table (trip_notifications exists)...';
    DROP TABLE IF EXISTS public.ride_notifications CASCADE;
    RAISE NOTICE 'ride_notifications dropped successfully';
  ELSE
    RAISE NOTICE 'Skipping ride_notifications drop - trip_notifications may not exist yet';
  END IF;
END $$;

-- Verify cleanup
DO $$
DECLARE
  v_remaining_ride_tables text[];
BEGIN
  SELECT array_agg(table_name) 
  INTO v_remaining_ride_tables
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('ride_requests', 'ride_notifications');
  
  IF v_remaining_ride_tables IS NOT NULL AND array_length(v_remaining_ride_tables, 1) > 0 THEN
    RAISE WARNING 'Some legacy tables still exist: %', v_remaining_ride_tables;
  ELSE
    RAISE NOTICE 'All legacy ride_* tables successfully removed';
  END IF;
END $$;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'MOBILITY CONSOLIDATION COMPLETE';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'Legacy tables dropped:';
  RAISE NOTICE '  - ride_requests → trips';
  RAISE NOTICE '  - ride_notifications → trip_notifications';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'All mobility code now uses canonical trip_* tables';
  RAISE NOTICE '====================================================================';
END $$;

COMMIT;
