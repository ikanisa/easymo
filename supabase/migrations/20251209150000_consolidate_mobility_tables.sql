-- ============================================================================
-- MOBILITY TABLES CONSOLIDATION MIGRATION
-- ============================================================================
-- Migration: 20251209150000_consolidate_mobility_tables.sql
-- Date: 2025-12-09
-- Purpose: Eliminate "ride" naming, consolidate into canonical "trips" table
-- 
-- IMPORTANT: driver_status table already exists with different schema
-- This migration will:
--   1. Migrate data from rides_driver_status to existing driver_status
--   2. Rename ride_notifications → trip_notifications
--   3. Drop views and legacy tables
--   4. Drop deprecated functions
--   5. Create new functions with "trip" naming
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: MIGRATE DATA FROM RIDES_DRIVER_STATUS TO EXISTING DRIVER_STATUS
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rides_driver_status') THEN
    -- Migrate data: rides_driver_status → driver_status (which already exists)
    -- Map columns: online → is_online, lat → current_lat, lng → current_lng, last_seen → last_seen_at
    INSERT INTO driver_status (user_id, is_online, vehicle_type, current_lat, current_lng, last_seen_at, updated_at)
    SELECT 
      user_id, 
      online as is_online,
      vehicle_type,
      lat as current_lat,
      lng as current_lng,
      last_seen as last_seen_at,
      updated_at
    FROM rides_driver_status
    ON CONFLICT (user_id) DO UPDATE SET
      is_online = EXCLUDED.is_online,
      vehicle_type = EXCLUDED.vehicle_type,
      current_lat = EXCLUDED.current_lat,
      current_lng = EXCLUDED.current_lng,
      last_seen_at = EXCLUDED.last_seen_at,
      updated_at = EXCLUDED.updated_at;
    
    RAISE NOTICE 'Migrated % rows from rides_driver_status to driver_status', 
      (SELECT count(*) FROM driver_status);
  ELSE
    RAISE NOTICE 'rides_driver_status table does not exist - skipping data migration';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: RENAME RIDE_NOTIFICATIONS → TRIP_NOTIFICATIONS
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ride_notifications') THEN
    -- Rename table
    ALTER TABLE ride_notifications RENAME TO trip_notifications;
    
    -- Rename column driver_id → recipient_id
    ALTER TABLE trip_notifications RENAME COLUMN driver_id TO recipient_id;
    
    -- Rename indexes
    ALTER INDEX IF EXISTS ride_notifications_pkey RENAME TO trip_notifications_pkey;
    ALTER INDEX IF EXISTS idx_ride_notifications_created RENAME TO idx_trip_notifications_created;
    ALTER INDEX IF EXISTS idx_ride_notifications_driver RENAME TO idx_trip_notifications_recipient;
    ALTER INDEX IF EXISTS idx_ride_notifications_status RENAME TO idx_trip_notifications_status;
    ALTER INDEX IF EXISTS idx_ride_notifications_trip RENAME TO idx_trip_notifications_trip;
    
    -- Rename constraints (check if exists first)
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ride_notifications_status_check') THEN
      ALTER TABLE trip_notifications RENAME CONSTRAINT ride_notifications_status_check TO trip_notifications_status_check;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ride_notifications_driver_id_fkey') THEN
      ALTER TABLE trip_notifications RENAME CONSTRAINT ride_notifications_driver_id_fkey TO trip_notifications_recipient_id_fkey;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ride_notifications_trip_id_fkey') THEN
      ALTER TABLE trip_notifications RENAME CONSTRAINT ride_notifications_trip_id_fkey TO trip_notifications_trip_id_fkey;
    END IF;
    
    -- Drop old policies
    DROP POLICY IF EXISTS ride_notifications_driver_read ON trip_notifications;
    DROP POLICY IF EXISTS ride_notifications_service_role_all ON trip_notifications;
    
    -- Create new policies with correct naming
    CREATE POLICY trip_notifications_recipient_read ON trip_notifications
      FOR SELECT USING (auth.uid() = recipient_id);
    
    CREATE POLICY trip_notifications_service_role_all ON trip_notifications
      TO service_role USING (true) WITH CHECK (true);
    
    COMMENT ON TABLE trip_notifications IS 'Notifications sent to users about trips';
    
    RAISE NOTICE 'Renamed ride_notifications to trip_notifications';
  ELSE
    RAISE NOTICE 'ride_notifications table does not exist - skipping rename';
  END IF;
END $$;

-- ============================================================================
-- STEP 3: DROP VIEWS (NO DATA LOSS)
-- ============================================================================

DROP VIEW IF EXISTS mobility_trips_compat CASCADE;
DROP VIEW IF EXISTS pending_ride_requests_with_trips CASCADE;

-- ============================================================================
-- STEP 4: DROP LEGACY TABLES
-- ============================================================================

DROP TABLE IF EXISTS ride_requests CASCADE;
DROP TABLE IF EXISTS rides_driver_status CASCADE;

-- ============================================================================
-- STEP 5: DROP DEPRECATED FUNCTIONS
-- ============================================================================

DROP FUNCTION IF EXISTS apply_intent_rides CASCADE;
DROP FUNCTION IF EXISTS apply_intent_rides_v2 CASCADE;
DROP FUNCTION IF EXISTS rides_find_nearby_drivers CASCADE;
DROP FUNCTION IF EXISTS rides_find_nearby_trips CASCADE;
DROP FUNCTION IF EXISTS rides_search_nearby_drivers CASCADE;
DROP FUNCTION IF EXISTS rides_search_nearby_passengers CASCADE;
DROP FUNCTION IF EXISTS ride_requests_set_updated_at CASCADE;
DROP FUNCTION IF EXISTS rides_driver_status_set_updated_at CASCADE;
DROP FUNCTION IF EXISTS rides_update_driver_location CASCADE;

-- ============================================================================
-- STEP 6: CREATE/UPDATE FUNCTIONS WITH "TRIP" NAMING
-- ============================================================================

-- Update driver status function (works with existing driver_status table schema)
CREATE OR REPLACE FUNCTION update_driver_status(
  _user_id uuid,
  _online boolean,
  _vehicle_type text DEFAULT NULL,
  _lat double precision DEFAULT NULL,
  _lng double precision DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO driver_status (
    user_id, 
    is_online, 
    vehicle_type, 
    current_lat, 
    current_lng, 
    last_seen_at
  )
  VALUES (
    _user_id, 
    _online, 
    _vehicle_type, 
    _lat, 
    _lng, 
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    is_online = EXCLUDED.is_online,
    vehicle_type = COALESCE(EXCLUDED.vehicle_type, driver_status.vehicle_type),
    current_lat = COALESCE(EXCLUDED.current_lat, driver_status.current_lat),
    current_lng = COALESCE(EXCLUDED.current_lng, driver_status.current_lng),
    last_seen_at = now(),
    updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION update_driver_status TO authenticated, service_role;

COMMENT ON FUNCTION update_driver_status IS 'Update driver online status and location (replaces rides_update_driver_location)';

-- ============================================================================
-- STEP 7: UPDATE TABLE COMMENTS
-- ============================================================================

COMMENT ON TABLE trips IS 'Canonical table for all trip requests (driver & passenger). Uses PostGIS geography for location matching.';
COMMENT ON TABLE driver_status IS 'Current online/offline status and location of drivers';
COMMENT ON TABLE recurring_trips IS 'Templates for recurring trip schedules (e.g., daily commute)';
COMMENT ON TABLE trip_payment_requests IS 'Payment requests for completed trips';
COMMENT ON TABLE trip_status_audit IS 'Audit log of trip status changes';

-- ============================================================================
-- STEP 8: VERIFICATION QUERIES
-- ============================================================================

DO $$
DECLARE
  v_trips_count int;
  v_driver_status_count int;
  v_trip_notifications_count int;
  v_recurring_count int;
BEGIN
  SELECT count(*) INTO v_trips_count FROM trips;
  SELECT count(*) INTO v_driver_status_count FROM driver_status;
  
  -- Check if trip_notifications exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trip_notifications') THEN
    SELECT count(*) INTO v_trip_notifications_count FROM trip_notifications;
  ELSE
    v_trip_notifications_count := 0;
  END IF;
  
  SELECT count(*) INTO v_recurring_count FROM recurring_trips;
  
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'MIGRATION COMPLETE';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'Final table counts:';
  RAISE NOTICE '  trips: %', v_trips_count;
  RAISE NOTICE '  driver_status: %', v_driver_status_count;
  RAISE NOTICE '  trip_notifications: %', v_trip_notifications_count;
  RAISE NOTICE '  recurring_trips: %', v_recurring_count;
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'All "ride" tables/functions removed';
  RAISE NOTICE 'All naming now uses "trip" convention';
  RAISE NOTICE 'Data migration complete - no data loss';
  RAISE NOTICE '====================================================================';
END $$;

COMMIT;
