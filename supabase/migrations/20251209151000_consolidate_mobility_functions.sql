-- ============================================================================
-- MOBILITY CONSOLIDATION - FINAL STEP (Functions Only)
-- ============================================================================
-- Migration: 20251209151000_consolidate_mobility_functions.sql
-- Date: 2025-12-09 (SIMPLIFIED)
--
-- Drops deprecated ride_* functions only
-- Driver status tracking removed in simplified schema
-- ============================================================================

BEGIN;

-- Drop deprecated ride_* functions
DROP FUNCTION IF EXISTS apply_intent_rides CASCADE;
DROP FUNCTION IF EXISTS apply_intent_rides_v2 CASCADE;
DROP FUNCTION IF EXISTS rides_find_nearby_drivers CASCADE;
DROP FUNCTION IF EXISTS rides_find_nearby_trips CASCADE;
DROP FUNCTION IF EXISTS rides_search_nearby_drivers CASCADE;
DROP FUNCTION IF EXISTS rides_search_nearby_passengers CASCADE;
DROP FUNCTION IF EXISTS ride_requests_set_updated_at CASCADE;
DROP FUNCTION IF EXISTS rides_driver_status_set_updated_at CASCADE;
DROP FUNCTION IF EXISTS rides_update_driver_location CASCADE;
DROP FUNCTION IF EXISTS update_driver_status CASCADE;

-- Update trips table comment
COMMENT ON TABLE trips IS 'Canonical table for all trip requests (driver & passenger). Uses simple Haversine distance for matching.';

COMMIT;
