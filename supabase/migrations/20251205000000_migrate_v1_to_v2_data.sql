-- ============================================================================
-- DATA MIGRATION: V1 to V2 Schema
-- ============================================================================
-- Migration: 20251205000000_migrate_v1_to_v2_data.sql
-- Purpose: Migrate existing data from rides_trips/mobility_matches to new V2 tables
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. MIGRATE TRIPS DATA
-- ============================================================================

-- Insert trips from rides_trips to mobility_trips
INSERT INTO mobility_trips (
  id,
  creator_user_id,
  role,
  vehicle_type,
  pickup_lat,
  pickup_lng,
  pickup_text,
  pickup_radius_m,
  dropoff_lat,
  dropoff_lng,
  dropoff_text,
  dropoff_radius_m,
  status,
  created_at,
  matched_at,
  expires_at,
  last_location_update,
  scheduled_for,
  recurrence,
  metadata
)
SELECT 
  id,
  creator_user_id,
  role,
  vehicle_type,
  pickup_latitude,
  pickup_longitude,
  pickup_text,
  COALESCE(pickup_radius_m, 1000),
  dropoff_latitude,
  dropoff_longitude,
  dropoff_text,
  dropoff_radius_m,
  CASE 
    WHEN status = 'open' THEN 'open'
    WHEN status = 'matched' THEN 'matched'
    ELSE 'expired'
  END,
  created_at,
  matched_at,
  expires_at,
  COALESCE(last_location_at, created_at),
  scheduled_at,
  recurrence,
  '{}'::jsonb
FROM rides_trips
WHERE NOT EXISTS (
  SELECT 1 FROM mobility_trips mt WHERE mt.id = rides_trips.id
);

-- ============================================================================
-- 2. MIGRATE MATCHES DATA
-- ============================================================================

-- Insert matches from mobility_matches to mobility_trip_matches
INSERT INTO mobility_trip_matches (
  id,
  driver_trip_id,
  passenger_trip_id,
  driver_user_id,
  passenger_user_id,
  vehicle_type,
  pickup_location,
  dropoff_location,
  pickup_address,
  dropoff_address,
  status,
  estimated_fare,
  actual_fare,
  currency,
  surge_multiplier,
  distance_km,
  duration_minutes,
  driver_phone,
  passenger_phone,
  created_at,
  updated_at,
  accepted_at,
  started_at,
  arrived_at_pickup_at,
  picked_up_at,
  completed_at,
  cancelled_at,
  rating_by_passenger,
  rating_by_driver,
  feedback_by_passenger,
  feedback_by_driver,
  cancellation_reason,
  cancelled_by_user_id,
  metadata
)
SELECT 
  mm.id,
  dt.id AS driver_trip_id,
  pt.id AS passenger_trip_id,
  mm.driver_id,
  mm.passenger_id,
  mm.vehicle_type,
  ST_SetSRID(ST_MakePoint(mm.pickup_lng, mm.pickup_lat), 4326)::geography,
  CASE 
    WHEN mm.dropoff_lat IS NOT NULL AND mm.dropoff_lng IS NOT NULL 
    THEN ST_SetSRID(ST_MakePoint(mm.dropoff_lng, mm.dropoff_lat), 4326)::geography
    ELSE NULL
  END,
  mm.pickup_address,
  mm.dropoff_address,
  mm.status,
  mm.fare_estimate,
  mm.actual_fare,
  COALESCE(mm.currency, 'RWF'),
  COALESCE(mm.surge_multiplier, 1.0),
  mm.distance_km,
  mm.duration_minutes,
  COALESCE(mm.driver_phone, dp.whatsapp_number, dp.phone_number),
  COALESCE(mm.passenger_phone, pp.whatsapp_number, pp.phone_number),
  mm.created_at,
  mm.updated_at,
  mm.accepted_at,
  mm.started_at,
  mm.arrived_at,
  mm.pickup_time,
  mm.completed_at,
  mm.cancelled_at,
  mm.passenger_rating,
  mm.driver_rating,
  mm.passenger_feedback,
  mm.driver_feedback,
  mm.cancellation_reason,
  mm.cancelled_by,
  '{}'::jsonb
FROM mobility_matches mm
LEFT JOIN rides_trips dt ON dt.creator_user_id = mm.driver_id AND dt.role = 'driver'
LEFT JOIN rides_trips pt ON pt.creator_user_id = mm.passenger_id AND pt.role = 'passenger'
LEFT JOIN profiles dp ON dp.user_id = mm.driver_id
LEFT JOIN profiles pp ON pp.user_id = mm.passenger_id
WHERE NOT EXISTS (
  SELECT 1 FROM mobility_trip_matches mtm WHERE mtm.id = mm.id
)
AND dt.id IS NOT NULL 
AND pt.id IS NOT NULL;

-- ============================================================================
-- 3. VERIFICATION
-- ============================================================================

DO $$
DECLARE
  v1_trips_count integer;
  v2_trips_count integer;
  v1_matches_count integer;
  v2_matches_count integer;
BEGIN
  SELECT COUNT(*) INTO v1_trips_count FROM rides_trips;
  SELECT COUNT(*) INTO v2_trips_count FROM mobility_trips;
  SELECT COUNT(*) INTO v1_matches_count FROM mobility_matches;
  SELECT COUNT(*) INTO v2_matches_count FROM mobility_trip_matches;
  
  RAISE NOTICE 'Migration Summary:';
  RAISE NOTICE '  V1 trips: %, V2 trips: %', v1_trips_count, v2_trips_count;
  RAISE NOTICE '  V1 matches: %, V2 matches: %', v1_matches_count, v2_matches_count;
  
  IF v2_trips_count < v1_trips_count THEN
    RAISE WARNING 'Some trips were not migrated. Check for data integrity issues.';
  END IF;
END;
$$;

COMMIT;

-- ============================================================================
-- POST-MIGRATION NOTES
-- ============================================================================
-- 
-- After successful migration:
-- 1. Update application code to use V2 tables
-- 2. Test thoroughly in staging
-- 3. Monitor for 48 hours
-- 4. Archive V1 tables (do not drop yet):
--    ALTER TABLE rides_trips RENAME TO _archived_rides_trips;
--    ALTER TABLE mobility_matches RENAME TO _archived_mobility_matches;
-- 5. After 30 days of stable operation, drop archived tables
-- 
-- ============================================================================
