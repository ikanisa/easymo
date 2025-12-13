-- ============================================================================
-- Simplified Mobility Schema - Database Cleanup & Simplification
-- ============================================================================
-- Migration: 20251214000000_simplified_mobility_schema.sql
-- Date: 2025-12-14
-- 
-- PURPOSE:
-- Simplify the mobility system from 323 tables down to ~10-20 essential tables.
-- Replace complex matching with simple distance-based lookup.
-- Use single canonical trips table with direct phone numbers.
--
-- DESIGN PRINCIPLES:
-- 1. One table for trips (no duplicates)
-- 2. Simple matching (Haversine distance, no PostGIS required)
-- 3. 30-minute expiry (trips auto-expire)
-- 4. Direct contact (users exchange phone numbers)
-- 5. No complex orchestration
--
-- PRESERVED TABLES:
-- - public.business (8,232+ business records - CRITICAL)
-- - PostGIS system tables (spatial_ref_sys, geometry_columns, geography_columns)
-- - Supabase internal tables (schema_migrations, buckets, objects, etc.)
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: CLEANUP - Drop duplicate and obsolete mobility tables
-- ============================================================================

-- Drop old scheduled/recurring trip tables (duplicates)
DROP TABLE IF EXISTS public.scheduled_trips CASCADE;
DROP TABLE IF EXISTS public.recurring_trips CASCADE;

-- Drop any remaining mobility-related duplicates
DROP TABLE IF EXISTS public.mobility_trips_compact CASCADE;
DROP TABLE IF EXISTS public.pending_trips CASCADE;

-- Drop driver status tracking (over-engineered, not needed for simple matching)
DROP TABLE IF EXISTS public.driver_status CASCADE;

-- Drop trip notifications (can use simple WhatsApp messages instead)
DROP TABLE IF EXISTS public.trip_notifications CASCADE;

-- ============================================================================
-- PART 2: SIMPLIFY trips TABLE - Add phone field, ensure proper schema
-- ============================================================================

-- Add phone column to trips table if it doesn't exist
-- This allows direct contact without complex profile lookups
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'trips' 
    AND column_name = 'phone'
  ) THEN
    ALTER TABLE public.trips ADD COLUMN phone TEXT;
    COMMENT ON COLUMN public.trips.phone IS 'WhatsApp phone number for direct contact';
  END IF;
END $$;

-- Ensure all required columns exist with proper types
DO $$
BEGIN
  -- Ensure id column (should already exist)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'trips' AND column_name = 'id'
  ) THEN
    ALTER TABLE public.trips ADD COLUMN id UUID PRIMARY KEY DEFAULT gen_random_uuid();
  END IF;

  -- Ensure user_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'trips' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.trips ADD COLUMN user_id UUID NOT NULL;
  END IF;

  -- Ensure role column with CHECK constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'trips' AND column_name = 'role'
  ) THEN
    ALTER TABLE public.trips ADD COLUMN role TEXT NOT NULL CHECK (role IN ('driver', 'passenger'));
  END IF;

  -- VEHICLE COLUMN STRATEGY:
  -- - Existing code uses `vehicle_type` column (already in database)
  -- - Simplified schema prefers `vehicle` (cleaner name)
  -- - For backward compatibility, we create `vehicle` as a generated alias of `vehicle_type`
  -- - Functions use COALESCE(vehicle, vehicle_type) to work with both
  -- - Future migrations can consolidate to single `vehicle` column
  
  -- Ensure vehicle column (using vehicle_type if it exists, or add vehicle)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'trips' AND column_name = 'vehicle'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'trips' AND column_name = 'vehicle_type'
  ) THEN
    ALTER TABLE public.trips ADD COLUMN vehicle TEXT NOT NULL CHECK (vehicle IN ('moto', 'car'));
  END IF;

  -- Add alias for vehicle_type -> vehicle if needed (for backward compatibility)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'trips' AND column_name = 'vehicle_type'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'trips' AND column_name = 'vehicle'
  ) THEN
    -- Create a generated column that aliases vehicle_type
    -- This allows new code to use `vehicle` while old code still uses `vehicle_type`
    ALTER TABLE public.trips ADD COLUMN vehicle TEXT GENERATED ALWAYS AS (vehicle_type) STORED;
  END IF;
END $$;

-- Ensure coordinates columns exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'trips' AND column_name = 'pickup_lat'
  ) THEN
    ALTER TABLE public.trips ADD COLUMN pickup_lat DOUBLE PRECISION NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'trips' AND column_name = 'pickup_lng'
  ) THEN
    ALTER TABLE public.trips ADD COLUMN pickup_lng DOUBLE PRECISION NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'trips' AND column_name = 'dropoff_lat'
  ) THEN
    ALTER TABLE public.trips ADD COLUMN dropoff_lat DOUBLE PRECISION;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'trips' AND column_name = 'dropoff_lng'
  ) THEN
    ALTER TABLE public.trips ADD COLUMN dropoff_lng DOUBLE PRECISION;
  END IF;
END $$;

-- Ensure text location columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'trips' AND column_name = 'pickup_text'
  ) THEN
    ALTER TABLE public.trips ADD COLUMN pickup_text TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'trips' AND column_name = 'dropoff_text'
  ) THEN
    ALTER TABLE public.trips ADD COLUMN dropoff_text TEXT;
  END IF;
END $$;

-- Ensure status and expiry columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'trips' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.trips ADD COLUMN status TEXT NOT NULL DEFAULT 'open' 
      CHECK (status IN ('open', 'matched', 'completed', 'cancelled', 'expired'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'trips' AND column_name = 'scheduled_for'
  ) THEN
    ALTER TABLE public.trips ADD COLUMN scheduled_for TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'trips' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE public.trips ADD COLUMN expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes');
  END IF;
END $$;

-- Ensure timestamp columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'trips' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.trips ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'trips' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.trips ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

-- ============================================================================
-- PART 3: CREATE SIMPLIFIED FUNCTIONS
-- ============================================================================

-- Drop old complex functions
DROP FUNCTION IF EXISTS public.match_drivers_for_trip_v2(uuid, integer, boolean, integer, integer) CASCADE;
DROP FUNCTION IF EXISTS public.match_passengers_for_trip_v2(uuid, integer, boolean, integer, integer) CASCADE;
DROP FUNCTION IF EXISTS public.match_drivers_for_trip_v2(uuid, integer, boolean, integer) CASCADE;
DROP FUNCTION IF EXISTS public.match_passengers_for_trip_v2(uuid, integer, boolean, integer) CASCADE;

-- ----------------------------------------------------------------------------
-- FUNCTION: find_matches(trip_id, limit)
-- Find opposite-role trips within 10km using simple Haversine distance
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.find_matches(
  _trip_id UUID,
  _limit INTEGER DEFAULT 9
)
RETURNS TABLE (
  trip_id UUID,
  user_id UUID,
  phone TEXT,
  ref_code TEXT,
  role TEXT,
  vehicle TEXT,
  distance_km NUMERIC,
  pickup_text TEXT,
  dropoff_text TEXT,
  scheduled_for TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_role TEXT;
  v_pickup_lat DOUBLE PRECISION;
  v_pickup_lng DOUBLE PRECISION;
  v_vehicle TEXT;
BEGIN
  -- Get the requesting trip details
  SELECT 
    t.role,
    t.pickup_lat,
    t.pickup_lng,
    COALESCE(t.vehicle, t.vehicle_type)
  INTO 
    v_role,
    v_pickup_lat,
    v_pickup_lng,
    v_vehicle
  FROM public.trips t
  WHERE t.id = _trip_id;

  -- Return empty if trip not found
  IF v_role IS NULL THEN
    RETURN;
  END IF;

  -- Find opposite-role trips within 10km
  RETURN QUERY
  SELECT 
    t.id AS trip_id,
    t.user_id,
    COALESCE(t.phone, p.phone_number, p.wa_id) AS phone,
    COALESCE(t.metadata->>'ref_code', SUBSTRING(t.id::text, 1, 8)) AS ref_code,
    t.role,
    -- COALESCE for backward compatibility: vehicle (new) or vehicle_type (existing)
    COALESCE(t.vehicle, t.vehicle_type) AS vehicle,
    -- Haversine distance calculation (simple, no PostGIS needed)
    ROUND(
      (6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(v_pickup_lat)) * cos(radians(t.pickup_lat)) *
          cos(radians(t.pickup_lng) - radians(v_pickup_lng)) +
          sin(radians(v_pickup_lat)) * sin(radians(t.pickup_lat))
        ))
      ))::numeric, 2
    ) AS distance_km,
    t.pickup_text,
    t.dropoff_text,
    t.scheduled_for,
    t.created_at,
    t.expires_at
  FROM public.trips t
  LEFT JOIN public.profiles p ON p.user_id = t.user_id
  WHERE t.role = CASE 
      WHEN v_role = 'driver' THEN 'passenger'
      WHEN v_role = 'passenger' THEN 'driver'
      ELSE t.role  -- fallback, should not happen
    END
    AND t.status = 'open'
    AND t.expires_at > NOW()  -- Only active trips
    AND t.id != _trip_id  -- Exclude self
    AND t.pickup_lat IS NOT NULL
    AND t.pickup_lng IS NOT NULL
    -- Within 10km radius
    AND (
      6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(v_pickup_lat)) * cos(radians(t.pickup_lat)) *
          cos(radians(t.pickup_lng) - radians(v_pickup_lng)) +
          sin(radians(v_pickup_lat)) * sin(radians(t.pickup_lat))
        ))
      )
    ) <= 10
  ORDER BY 
    -- Prefer same vehicle type (COALESCE for backward compatibility)
    (COALESCE(t.vehicle, t.vehicle_type) = v_vehicle) DESC,
    -- Then by distance
    (
      6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(v_pickup_lat)) * cos(radians(t.pickup_lat)) *
          cos(radians(t.pickup_lng) - radians(v_pickup_lng)) +
          sin(radians(v_pickup_lat)) * sin(radians(t.pickup_lat))
        ))
      )
    ) ASC,
    -- Then by creation time (oldest first)
    t.created_at ASC
  LIMIT _limit;
END;
$$;

COMMENT ON FUNCTION public.find_matches(UUID, INTEGER) IS 
'Simple distance-based trip matching. Finds opposite-role trips within 10km using Haversine formula.';

-- ----------------------------------------------------------------------------
-- FUNCTION: create_trip(...)
-- Create a new trip with auto-expiry (30 minutes after scheduled time or now)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_trip(
  _user_id UUID,
  _phone TEXT,
  _role TEXT,
  _vehicle TEXT,
  _pickup_lat DOUBLE PRECISION,
  _pickup_lng DOUBLE PRECISION,
  _pickup_text TEXT DEFAULT NULL,
  _dropoff_lat DOUBLE PRECISION DEFAULT NULL,
  _dropoff_lng DOUBLE PRECISION DEFAULT NULL,
  _dropoff_text TEXT DEFAULT NULL,
  _scheduled_for TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trip_id UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Validate inputs
  IF _role NOT IN ('driver', 'passenger') THEN
    RAISE EXCEPTION 'Invalid role: must be driver or passenger';
  END IF;

  IF _vehicle NOT IN ('moto', 'car') THEN
    RAISE EXCEPTION 'Invalid vehicle: must be moto or car';
  END IF;

  IF _pickup_lat < -90 OR _pickup_lat > 90 OR _pickup_lng < -180 OR _pickup_lng > 180 THEN
    RAISE EXCEPTION 'Invalid coordinates';
  END IF;

  -- Calculate expiry: 30 minutes after scheduled time (or now if immediate)
  v_expires_at := COALESCE(_scheduled_for, NOW()) + INTERVAL '30 minutes';

  -- Insert trip
  INSERT INTO public.trips (
    user_id,
    phone,
    role,
    vehicle_type,  -- Use vehicle_type for compatibility
    pickup_lat,
    pickup_lng,
    pickup_text,
    dropoff_lat,
    dropoff_lng,
    dropoff_text,
    scheduled_for,
    status,
    expires_at,
    created_at,
    updated_at
  ) VALUES (
    _user_id,
    _phone,
    _role,
    _vehicle,
    _pickup_lat,
    _pickup_lng,
    _pickup_text,
    _dropoff_lat,
    _dropoff_lng,
    _dropoff_text,
    _scheduled_for,
    'open',
    v_expires_at,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_trip_id;

  RETURN v_trip_id;
END;
$$;

COMMENT ON FUNCTION public.create_trip IS 
'Create a new trip with automatic 30-minute expiry. Returns trip UUID.';

-- ============================================================================
-- PART 4: GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.find_matches(UUID, INTEGER) TO service_role, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.create_trip TO service_role, authenticated;

-- Ensure cleanup function has proper permissions (function already exists from previous migration)
GRANT EXECUTE ON FUNCTION public.cleanup_expired_trips() TO service_role, authenticated;

-- ============================================================================
-- PART 5: INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index for finding open trips by role and location
CREATE INDEX IF NOT EXISTS idx_trips_matching 
ON public.trips (role, status, expires_at, pickup_lat, pickup_lng) 
WHERE status = 'open';

-- Index for cleanup (already exists from previous migration)
-- CREATE INDEX IF NOT EXISTS idx_trips_cleanup 
-- ON public.trips (status, expires_at) 
-- WHERE status = 'open';

-- ============================================================================
-- VERIFICATION & LOGGING
-- ============================================================================

DO $$
DECLARE
  v_trips_count INTEGER;
  v_business_count INTEGER;
BEGIN
  -- Verify trips table exists and is accessible
  SELECT COUNT(*) INTO v_trips_count FROM public.trips;
  
  -- Verify business table is preserved
  SELECT COUNT(*) INTO v_business_count FROM public.business;
  
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'SIMPLIFIED MOBILITY SCHEMA MIGRATION COMPLETE';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'Database cleanup performed:';
  RAISE NOTICE '  - Dropped duplicate mobility tables';
  RAISE NOTICE '  - Preserved public.business table: % records', v_business_count;
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'Simplified functions created:';
  RAISE NOTICE '  ✅ find_matches(trip_id, limit) - Simple 10km distance matching';
  RAISE NOTICE '  ✅ create_trip(...) - Create trip with auto-expiry';
  RAISE NOTICE '  ✅ cleanup_expired_trips() - Mark expired trips (existing)';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'Trips table: % existing records', v_trips_count;
  RAISE NOTICE '  - Added phone column for direct contact';
  RAISE NOTICE '  - 30-minute auto-expiry';
  RAISE NOTICE '  - Simple distance-based matching';
  RAISE NOTICE '====================================================================';
  
  IF v_business_count = 0 THEN
    RAISE WARNING 'business table has no records - verify data preservation!';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- POST-MIGRATION NOTES
-- ============================================================================
-- 
-- 1. Update edge functions to use new simplified functions:
--    - Use create_trip() instead of direct inserts
--    - Use find_matches() instead of match_drivers_for_trip_v2/match_passengers_for_trip_v2
-- 
-- 2. Remove complex orchestrator services (services/mobility-orchestrator/)
-- 
-- 3. Simplified WhatsApp flow:
--    - User posts trip → find_matches() → exchange phone numbers → direct contact
-- 
-- 4. Trip lifecycle:
--    - Created with status='open'
--    - Auto-expires after 30 minutes (expires_at)
--    - Call cleanup_expired_trips() periodically to mark as 'expired'
-- 
-- 5. Matching is now simple:
--    - Haversine distance calculation (no PostGIS required)
--    - 10km radius
--    - Opposite role (driver ↔ passenger)
--    - Prefers same vehicle type, then sorts by distance
-- ============================================================================
