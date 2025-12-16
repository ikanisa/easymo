-- ============================================================================
-- Cleanup Unused Mobility Functions
-- Migration: 20251216140000_cleanup_unused_mobility_functions.sql
-- Date: 2025-12-16
--
-- PURPOSE: 
-- Remove unused database functions related to deleted scheduling/nearby matching features
-- The simplified flow uses direct queries, not these RPC functions
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: Drop unused matching functions
-- ============================================================================

-- These functions are no longer used - simplified flow uses direct queries
DROP FUNCTION IF EXISTS public.match_drivers_for_trip_v2(uuid, integer, boolean, integer) CASCADE;
DROP FUNCTION IF EXISTS public.match_passengers_for_trip_v2(uuid, integer, boolean, integer) CASCADE;
DROP FUNCTION IF EXISTS public.find_matches(uuid, integer) CASCADE;

-- ============================================================================
-- PART 2: Keep create_trip function (may be used by rpc/mobility.ts)
-- ============================================================================

-- Note: create_trip is kept because it's referenced in rpc/mobility.ts
-- However, the simplified flow in index.ts uses direct INSERT instead
-- We keep it for backward compatibility but it's effectively unused

-- ============================================================================
-- PART 3: Clean up any orphaned functions
-- ============================================================================

-- Drop any functions that reference deleted tables/features
DROP FUNCTION IF EXISTS public.find_online_drivers_near_trip(uuid, integer, double precision) CASCADE;
DROP FUNCTION IF EXISTS public.rides_update_driver_location(uuid, double precision, double precision) CASCADE;
DROP FUNCTION IF EXISTS public.is_driver_insurance_valid(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_driver_active_insurance(uuid) CASCADE;

COMMIT;

