-- ============================================================================
-- MOBILITY CONSOLIDATION - FINAL STEP (Functions Only)
-- ============================================================================
-- Migration: 20251209151000_consolidate_mobility_functions.sql
-- Date: 2025-12-09
--
-- Previous migrations already completed:
--   ✅ ride_notifications → trip_notifications (RENAMED)
--   ✅ rides_driver_status → deleted
--   ✅ ride_requests → deleted
--
-- This migration ONLY:
--   1. Drops deprecated ride_* functions
--   2. Creates update_driver_status function
--   3. Updates table comments
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: DROP DEPRECATED FUNCTIONS
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
-- STEP 2: CREATE UPDATE_DRIVER_STATUS FUNCTION
-- ============================================================================

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
    current_lat, 
    current_lng, 
    last_seen_at,
    vehicle_type
  )
  VALUES (
    _user_id, 
    _online,
    _lat, 
    _lng, 
    now(),
    _vehicle_type
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
-- STEP 3: UPDATE TABLE COMMENTS
-- ============================================================================

COMMENT ON TABLE trips IS 'Canonical table for all trip requests (driver & passenger). Uses PostGIS geography for location matching.';
COMMENT ON TABLE driver_status IS 'Current online/offline status and location of drivers';
COMMENT ON TABLE trip_notifications IS 'Notifications sent to users about trips';
COMMENT ON TABLE recurring_trips IS 'Templates for recurring trip schedules (e.g., daily commute)';
COMMENT ON TABLE trip_payment_requests IS 'Payment requests for completed trips';
COMMENT ON TABLE trip_status_audit IS 'Audit log of trip status changes';

-- ============================================================================
-- VERIFICATION
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
  RAISE NOTICE 'MOBILITY CONSOLIDATION COMPLETE';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'Final table counts:';
  RAISE NOTICE '  trips: %', v_trips_count;
  RAISE NOTICE '  driver_status: %', v_driver_status_count;
  RAISE NOTICE '  trip_notifications: %', v_trip_notifications_count;
  RAISE NOTICE '  recurring_trips: %', v_recurring_count;
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'All "ride" tables removed';
  RAISE NOTICE 'All "ride" functions removed';
  RAISE NOTICE 'All naming now uses "trip" convention';
  RAISE NOTICE '====================================================================';
END $$;

COMMIT;
