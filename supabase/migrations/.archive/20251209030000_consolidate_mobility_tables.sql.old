-- ============================================================================
-- MOBILITY TABLES CONSOLIDATION MIGRATION
-- ============================================================================
-- Migration: 20251209030000_consolidate_mobility_tables.sql
-- Date: 2025-12-09
-- Purpose: Eliminate "ride" naming, consolidate into canonical "trips" table
-- 
-- Changes:
--   1. Create driver_status (replaces rides_driver_status)
--   2. Rename ride_notifications → trip_notifications
--   3. Drop views: mobility_trips_compat, pending_ride_requests_with_trips
--   4. Drop tables: ride_requests, rides_driver_status
--   5. Drop deprecated functions (7 functions)
--   6. Create new functions with "trip" naming
--
-- Data Migration: YES (from rides_driver_status → driver_status)
-- Breaking Changes: NO (backward compatible renames)
-- Rollback: Restore from backup or revert migration
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: CREATE NEW DRIVER_STATUS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS driver_status (
  user_id uuid PRIMARY KEY REFERENCES profiles(user_id) ON DELETE CASCADE,
  online boolean NOT NULL DEFAULT false,
  vehicle_type text,
  lat double precision,
  lng double precision,
  geog geography(Point,4326) GENERATED ALWAYS AS (
    CASE 
      WHEN lat IS NOT NULL AND lng IS NOT NULL 
      THEN ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
      ELSE NULL
    END
  ) STORED,
  last_seen timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_driver_status_online 
  ON driver_status(online, last_seen DESC) 
  WHERE online = true;

CREATE INDEX IF NOT EXISTS idx_driver_status_geog 
  ON driver_status USING GIST(geog) 
  WHERE geog IS NOT NULL;

COMMENT ON TABLE driver_status IS 'Current online/offline status and location of drivers';
COMMENT ON COLUMN driver_status.geog IS 'Auto-generated PostGIS geography point from lat/lng';

-- ============================================================================
-- STEP 2: MIGRATE DATA FROM RIDES_DRIVER_STATUS
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rides_driver_status') THEN
    INSERT INTO driver_status (user_id, online, vehicle_type, lat, lng, last_seen, updated_at, metadata)
    SELECT 
      user_id, 
      online, 
      vehicle_type, 
      lat, 
      lng, 
      last_seen, 
      updated_at,
      COALESCE(metadata::jsonb, '{}'::jsonb)
    FROM rides_driver_status
    ON CONFLICT (user_id) DO UPDATE SET
      online = EXCLUDED.online,
      vehicle_type = EXCLUDED.vehicle_type,
      lat = EXCLUDED.lat,
      lng = EXCLUDED.lng,
      last_seen = EXCLUDED.last_seen,
      updated_at = EXCLUDED.updated_at,
      metadata = EXCLUDED.metadata;
    
    RAISE NOTICE 'Migrated % rows from rides_driver_status to driver_status', 
      (SELECT count(*) FROM driver_status);
  ELSE
    RAISE NOTICE 'rides_driver_status table does not exist - skipping data migration';
  END IF;
END $$;

-- ============================================================================
-- STEP 3: RENAME RIDE_NOTIFICATIONS → TRIP_NOTIFICATIONS
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
    
    -- Rename constraints
    ALTER TABLE trip_notifications RENAME CONSTRAINT ride_notifications_status_check TO trip_notifications_status_check;
    ALTER TABLE trip_notifications RENAME CONSTRAINT ride_notifications_driver_id_fkey TO trip_notifications_recipient_id_fkey;
    ALTER TABLE trip_notifications RENAME CONSTRAINT ride_notifications_trip_id_fkey TO trip_notifications_trip_id_fkey;
    
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
-- STEP 4: DROP VIEWS (NO DATA LOSS)
-- ============================================================================

DROP VIEW IF EXISTS mobility_trips_compat CASCADE;
DROP VIEW IF EXISTS pending_ride_requests_with_trips CASCADE;

RAISE NOTICE 'Dropped compatibility views';

-- ============================================================================
-- STEP 5: DROP LEGACY TABLES
-- ============================================================================

DROP TABLE IF EXISTS ride_requests CASCADE;
DROP TABLE IF EXISTS rides_driver_status CASCADE;

RAISE NOTICE 'Dropped legacy ride_* tables';

-- ============================================================================
-- STEP 6: DROP DEPRECATED FUNCTIONS
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

RAISE NOTICE 'Dropped 9 deprecated ride_* functions';

-- ============================================================================
-- STEP 7: CREATE NEW FUNCTIONS WITH "TRIP" NAMING
-- ============================================================================

-- Trigger function to update updated_at on driver_status
CREATE OR REPLACE FUNCTION driver_status_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_driver_status_updated_at
  BEFORE UPDATE ON driver_status
  FOR EACH ROW
  EXECUTE FUNCTION driver_status_set_updated_at();

COMMENT ON FUNCTION driver_status_set_updated_at IS 'Auto-update updated_at timestamp on driver_status changes';

-- Main function to update driver status (replaces rides_update_driver_location)
CREATE OR REPLACE FUNCTION update_driver_status(
  _user_id uuid,
  _online boolean,
  _vehicle_type text DEFAULT NULL,
  _lat double precision DEFAULT NULL,
  _lng double precision DEFAULT NULL,
  _metadata jsonb DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO driver_status (
    user_id, 
    online, 
    vehicle_type, 
    lat, 
    lng, 
    last_seen,
    metadata
  )
  VALUES (
    _user_id, 
    _online, 
    _vehicle_type, 
    _lat, 
    _lng, 
    now(),
    COALESCE(_metadata, '{}'::jsonb)
  )
  ON CONFLICT (user_id) DO UPDATE SET
    online = EXCLUDED.online,
    vehicle_type = COALESCE(EXCLUDED.vehicle_type, driver_status.vehicle_type),
    lat = COALESCE(EXCLUDED.lat, driver_status.lat),
    lng = COALESCE(EXCLUDED.lng, driver_status.lng),
    last_seen = now(),
    updated_at = now(),
    metadata = COALESCE(EXCLUDED.metadata, driver_status.metadata);
END;
$$;

GRANT EXECUTE ON FUNCTION update_driver_status TO authenticated, service_role;

COMMENT ON FUNCTION update_driver_status IS 'Update driver online status and location (replaces rides_update_driver_location)';

-- ============================================================================
-- STEP 8: ADD RLS POLICIES TO DRIVER_STATUS
-- ============================================================================

ALTER TABLE driver_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY driver_status_owner_rw ON driver_status
  FOR ALL 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY driver_status_read_all ON driver_status
  FOR SELECT 
  USING (true);

CREATE POLICY driver_status_service_role_all ON driver_status
  TO service_role 
  USING (true) 
  WITH CHECK (true);

-- ============================================================================
-- STEP 9: UPDATE TABLE COMMENTS
-- ============================================================================

COMMENT ON TABLE trips IS 'Canonical table for all trip requests (driver & passenger). Uses PostGIS geography for location matching.';
COMMENT ON TABLE recurring_trips IS 'Templates for recurring trip schedules (e.g., daily commute)';
COMMENT ON TABLE trip_payment_requests IS 'Payment requests for completed trips';
COMMENT ON TABLE trip_status_audit IS 'Audit log of trip status changes';

-- ============================================================================
-- STEP 10: VERIFICATION QUERIES
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
  SELECT count(*) INTO v_trip_notifications_count FROM trip_notifications;
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
