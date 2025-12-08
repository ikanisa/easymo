-- ============================================================================
-- CLEANUP OLD TRIP TABLES
-- ============================================================================
-- Migration: 20251208092700_cleanup_old_trip_tables.sql
-- Purpose: Archive/remove old trip tables and create backward compatibility views
-- 
-- Actions:
-- 1. Create backward compatibility views for rides_trips and mobility_trips
-- 2. Drop forbidden tables (mobility_trip_matches, mobility_matches, trip_status_audit)
-- 3. Comment out trip_ratings (archive for potential future use)
-- 4. Update/remove old RPC functions that reference old tables
-- 
-- BREAKING CHANGE: This removes tables and functions that are no longer needed
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Create backward compatibility views
-- ============================================================================
-- These views allow existing code to continue working during transition
-- They map the canonical trips table to old schema formats

-- Backward compatibility view for rides_trips (V1 schema)
CREATE OR REPLACE VIEW public.rides_trips AS
SELECT 
  t.id,
  t.creator_user_id,
  t.role,
  t.vehicle_type,
  t.pickup_latitude,
  t.pickup_longitude,
  t.pickup_text AS pickup_address,
  t.pickup_text,
  t.pickup_radius_m,
  t.dropoff_latitude,
  t.dropoff_longitude,
  t.dropoff_text AS dropoff_address,
  t.dropoff_text,
  -- Map simplified status back to V1 status
  CASE 
    WHEN t.status = 'open' THEN 'open'
    WHEN t.status = 'cancelled' THEN 'cancelled'
    WHEN t.status = 'expired' THEN 'expired'
    ELSE 'expired'
  END AS status,
  t.scheduled_at,
  t.recurrence,
  t.created_at,
  t.updated_at,
  t.expires_at,
  t.last_location_at,
  t.ref_code,
  t.number_plate,
  NULL::timestamptz AS matched_at,  -- No longer tracked
  -- Virtual pickup/dropoff columns for PostGIS compatibility
  ST_SetSRID(ST_MakePoint(t.pickup_longitude, t.pickup_latitude), 4326) AS pickup,
  CASE 
    WHEN t.dropoff_latitude IS NOT NULL AND t.dropoff_longitude IS NOT NULL
    THEN ST_SetSRID(ST_MakePoint(t.dropoff_longitude, t.dropoff_latitude), 4326)
    ELSE NULL
  END AS dropoff
FROM public.trips t;

COMMENT ON VIEW public.rides_trips IS 
  'Backward compatibility view for rides_trips. Maps canonical trips table to V1 schema.';

-- Backward compatibility view for mobility_trips (V2 schema)
CREATE OR REPLACE VIEW public.mobility_trips AS
SELECT 
  t.id,
  t.creator_user_id,
  t.role,
  t.vehicle_type,
  t.pickup_latitude AS pickup_lat,
  t.pickup_longitude AS pickup_lng,
  t.pickup_geog,
  t.pickup_text,
  t.pickup_radius_m,
  t.dropoff_latitude AS dropoff_lat,
  t.dropoff_longitude AS dropoff_lng,
  t.dropoff_geog,
  t.dropoff_text,
  NULL::integer AS dropoff_radius_m,  -- Not used in canonical
  -- Map simplified status back to V2 status
  CASE 
    WHEN t.status = 'open' THEN 'open'
    WHEN t.status = 'cancelled' THEN 'cancelled'
    WHEN t.status = 'expired' THEN 'expired'
    ELSE 'expired'
  END AS status,
  t.created_at,
  NULL::timestamptz AS matched_at,  -- No longer tracked
  t.expires_at,
  t.last_location_at AS last_location_update,
  t.scheduled_at AS scheduled_for,
  t.recurrence,
  t.metadata
FROM public.trips t;

COMMENT ON VIEW public.mobility_trips IS 
  'Backward compatibility view for mobility_trips. Maps canonical trips table to V2 schema.';

-- ============================================================================
-- STEP 2: Drop forbidden match tables (violate simplified scope)
-- ============================================================================

-- Drop mobility_trip_matches if exists
DROP TABLE IF EXISTS public.mobility_trip_matches CASCADE;

-- Drop mobility_matches if exists (V1 matches)
DROP TABLE IF EXISTS public.mobility_matches CASCADE;

-- Drop trip_status_audit if exists (over-engineered)
DROP TABLE IF EXISTS public.trip_status_audit CASCADE;

RAISE NOTICE 'Dropped forbidden match tables';

-- ============================================================================
-- STEP 3: Archive trip_ratings (out of scope but keep for future)
-- ============================================================================

-- Just comment the table, don't drop it (may want to restore later)
COMMENT ON TABLE public.trip_ratings IS 
  'ARCHIVED: Trip ratings out of scope for simplified mobility. Table preserved for potential future use.';

-- ============================================================================
-- STEP 4: Drop/update old RPC functions
-- ============================================================================

-- Drop old matching functions that query wrong tables
DROP FUNCTION IF EXISTS public.match_drivers_for_trip CASCADE;
DROP FUNCTION IF EXISTS public.match_drivers_for_trip_v2 CASCADE;
DROP FUNCTION IF EXISTS public.match_passengers_for_trip CASCADE;
DROP FUNCTION IF EXISTS public.match_passengers_for_trip_v2 CASCADE;

-- Drop old mobility intent cleanup (replaced by expire_old_trips)
DROP FUNCTION IF EXISTS public.cleanup_expired_mobility_intents CASCADE;

-- Drop old recurring trip activation (now handled differently)
DROP FUNCTION IF EXISTS public.activate_recurring_trips CASCADE;

-- Drop mobility v2 expiry function (replaced by expire_old_trips)
DROP FUNCTION IF EXISTS public.mobility_expire_old_trips CASCADE;

-- Drop old surge calculation (out of scope)
DROP FUNCTION IF EXISTS public.mobility_calculate_surge CASCADE;

-- Drop old metrics update triggers (out of scope)
DROP FUNCTION IF EXISTS public.mobility_update_driver_metrics_on_match CASCADE;

RAISE NOTICE 'Dropped old RPC functions that referenced old tables';

-- ============================================================================
-- STEP 5: Remove old cron jobs
-- ============================================================================

-- Remove old cron jobs if they exist
DO $$
BEGIN
  -- Remove old mobility intent cleanup cron
  PERFORM cron.unschedule('cleanup-expired-mobility-intents');
EXCEPTION
  WHEN OTHERS THEN
    NULL;  -- Ignore if doesn't exist
END $$;

DO $$
BEGIN
  -- Remove old recurring trips activation cron
  PERFORM cron.unschedule('activate-recurring-trips');
EXCEPTION
  WHEN OTHERS THEN
    NULL;  -- Ignore if doesn't exist
END $$;

-- Add new cron job for expiring trips
SELECT cron.schedule(
  'expire-old-trips',
  '*/5 * * * *',  -- Every 5 minutes
  $$SELECT public.expire_old_trips();$$
);

RAISE NOTICE 'Updated cron jobs to use new expire_old_trips function';

-- ============================================================================
-- STEP 6: Drop old metric tables (out of scope for simplified mobility)
-- ============================================================================

-- Drop driver metrics (no longer needed for simplified scope)
DROP TABLE IF EXISTS public.mobility_driver_metrics CASCADE;

-- Drop passenger metrics (no longer needed for simplified scope)
DROP TABLE IF EXISTS public.mobility_passenger_metrics CASCADE;

-- Drop pricing config (out of scope)
DROP TABLE IF EXISTS public.mobility_pricing_config CASCADE;

RAISE NOTICE 'Dropped old metric and pricing tables';

-- ============================================================================
-- STEP 7: Clean up old indexes that are no longer needed
-- ============================================================================

-- Old indexes from rides_trips/mobility_trips tables are automatically
-- dropped when views are created, since views don't have indexes

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  v_view_count integer;
  v_old_table_count integer;
BEGIN
  -- Count compatibility views
  SELECT COUNT(*) INTO v_view_count
  FROM information_schema.views
  WHERE table_schema = 'public' 
    AND table_name IN ('rides_trips', 'mobility_trips');
  
  -- Count old forbidden tables (should be 0)
  SELECT COUNT(*) INTO v_old_table_count
  FROM information_schema.tables
  WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    AND table_name IN ('mobility_trip_matches', 'mobility_matches', 'trip_status_audit');
  
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Cleanup Verification:';
  RAISE NOTICE 'Compatibility views created: %', v_view_count;
  RAISE NOTICE 'Forbidden tables remaining: %', v_old_table_count;
  RAISE NOTICE '===========================================';
  
  IF v_view_count < 2 THEN
    RAISE WARNING 'Expected 2 compatibility views, found %', v_view_count;
  END IF;
  
  IF v_old_table_count > 0 THEN
    RAISE WARNING 'Found % forbidden tables that should have been dropped', v_old_table_count;
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- POST-MIGRATION NOTES
-- ============================================================================
-- 
-- COMPLETED:
-- ✓ Created backward compatibility views (rides_trips, mobility_trips)
-- ✓ Dropped forbidden match tables (mobility_trip_matches, mobility_matches)
-- ✓ Dropped trip_status_audit (over-engineered)
-- ✓ Archived trip_ratings (commented, not dropped)
-- ✓ Dropped old RPC functions that reference old tables
-- ✓ Updated cron jobs to use new expire_old_trips function
-- ✓ Dropped old metric and pricing tables (out of scope)
-- 
-- BACKWARD COMPATIBILITY:
-- - rides_trips and mobility_trips now point to views
-- - Existing queries using these names will continue to work
-- - Views are read-only (inserts/updates should use trips table directly)
-- 
-- NEXT STEPS:
-- 1. Update edge functions to use canonical trips table directly
-- 2. Update edge functions to use new RPC functions (find_nearby_*)
-- 3. Test all mobility features
-- 4. Monitor for any issues
-- 5. Eventually drop compatibility views after full migration
-- 
-- MIGRATION PATH:
-- Old code can continue using rides_trips/mobility_trips views during transition.
-- New code should use trips table directly with new RPC functions.
-- 
-- ============================================================================
