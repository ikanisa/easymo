-- ============================================================================
-- DATA MIGRATION: V1 to V2 Schema
-- ============================================================================
-- Migration: 20251205000000_migrate_v1_to_v2_data.sql
-- Purpose: Migrate existing data from rides_trips/mobility_matches to new V2 tables
-- ============================================================================

BEGIN;

-- Skip this migration if rides_trips doesn't exist (V1 table)
DO $$
DECLARE
  v1_trips_count integer;
  v2_trips_count integer;
  v1_matches_count integer;
  v2_matches_count integer;
  v1_table_exists boolean;
BEGIN
  -- Check if V1 table exists
  SELECT EXISTS (
    SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'rides_trips'
  ) INTO v1_table_exists;

  IF NOT v1_table_exists THEN
    RAISE NOTICE 'Skipping V1 to V2 migration - rides_trips table does not exist';
    RETURN;
  END IF;

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
-- Note: V1 schema is missing many columns, so we'll use defaults
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
  distance_km,
  duration_minutes,
  driver_phone,
  passenger_phone,
  created_at,
  updated_at,
  started_at,
  completed_at,
  cancelled_at,
  cancellation_reason,
  metadata
)
SELECT 
  mm.id,
  mm.trip_id, -- V1 uses single trip_id, we'll use it as driver_trip_id
  mm.trip_id, -- Same for passenger_trip_id (limitation of V1 schema)
  mm.driver_id,
  mm.passenger_id,
  COALESCE(mm.vehicle_type, 'car'),
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
  'RWF', -- V1 doesn't have currency column
  mm.distance_km,
  mm.duration_minutes,
  dp.phone_number, -- Get from profiles
  pp.phone_number, -- Get from profiles
  mm.created_at,
  mm.updated_at,
  mm.started_at,
  mm.completed_at,
  mm.cancelled_at,
  mm.cancellation_reason,
  COALESCE(mm.metadata, '{}'::jsonb)
FROM mobility_matches mm
LEFT JOIN profiles dp ON dp.user_id = mm.driver_id
LEFT JOIN profiles pp ON pp.user_id = mm.passenger_id
WHERE NOT EXISTS (
  SELECT 1 FROM mobility_trip_matches mtm WHERE mtm.id = mm.id
);

-- ============================================================================
-- 3. VERIFICATION
-- ============================================================================

  -- Verification (now part of the main DO block)
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
