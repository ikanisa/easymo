-- Pre-migration: Drop conflicting indexes from V1 schema
-- This allows V2 schema to create its own indexes with the same names

BEGIN;

-- Drop V1 indexes on mobility_matches table
DROP INDEX IF EXISTS idx_mobility_matches_driver CASCADE;
DROP INDEX IF EXISTS idx_mobility_matches_passenger CASCADE;
DROP INDEX IF EXISTS idx_mobility_matches_status CASCADE;
DROP INDEX IF EXISTS idx_mobility_matches_payment CASCADE;
DROP INDEX IF EXISTS idx_mobility_matches_created CASCADE;
DROP INDEX IF EXISTS idx_mobility_matches_driver_status CASCADE;
DROP INDEX IF EXISTS idx_mobility_matches_passenger_status CASCADE;
DROP INDEX IF EXISTS idx_mobility_matches_active_status CASCADE;
DROP INDEX IF EXISTS idx_mobility_matches_trip_id CASCADE;

COMMIT;
