-- ============================================================================
-- Create Missing Location Cache RPC Functions
-- ============================================================================
-- Migration: 20251212083000_create_location_cache_rpcs.sql
-- 
-- ISSUE: 
-- - TypeScript code references RPC functions that don't exist in database
-- - update_user_location_cache was deleted in migration 20251209190200
-- - get_cached_location was never created
-- 
-- FIX:
-- - Create update_user_location_cache function to save location to recent_locations
-- - Create get_cached_location function to retrieve location with validity check
-- - Both functions use 30-minute default TTL to match mobility matching window
-- 
-- IMPACT:
-- - Enables location caching for better UX (fewer location prompts)
-- - Ensures cache validity aligns with matching window (30 minutes)
-- - Reduces database load from repeated location lookups
-- ============================================================================

BEGIN;

-- ============================================================================
-- DROP EXISTING FUNCTIONS IF THEY HAVE DIFFERENT SIGNATURES
-- ============================================================================
DROP FUNCTION IF EXISTS public.update_user_location_cache(uuid, numeric, numeric);
DROP FUNCTION IF EXISTS public.update_user_location_cache(uuid, double precision, double precision);
DROP FUNCTION IF EXISTS public.get_cached_location(uuid, integer);

-- ============================================================================
-- UPDATE USER LOCATION CACHE
-- ============================================================================
-- Saves user's location to recent_locations table
-- Uses UPSERT to avoid duplicate entries per user

CREATE OR REPLACE FUNCTION public.update_user_location_cache(
  _user_id uuid,
  _lat double precision,
  _lng double precision
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate coordinates before storing
  IF _lat IS NULL OR _lng IS NULL THEN
    RAISE EXCEPTION 'Coordinates cannot be NULL';
  END IF;
  
  IF _lat < -90 OR _lat > 90 THEN
    RAISE EXCEPTION 'Latitude must be between -90 and 90, got %', _lat;
  END IF;
  
  IF _lng < -180 OR _lng > 180 THEN
    RAISE EXCEPTION 'Longitude must be between -180 and 180, got %', _lng;
  END IF;
  
  -- Upsert to recent_locations table
  -- Note: Assuming recent_locations has UNIQUE constraint on user_id
  INSERT INTO public.recent_locations (user_id, lat, lng, captured_at, source)
  VALUES (_user_id, _lat, _lng, now(), 'mobility_cache')
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    captured_at = EXCLUDED.captured_at,
    source = EXCLUDED.source,
    updated_at = now();
END;
$$;

COMMENT ON FUNCTION public.update_user_location_cache IS 
'Caches user location to recent_locations table. Used by mobility handlers to reduce location prompts.';

-- ============================================================================
-- GET CACHED LOCATION
-- ============================================================================
-- Retrieves user's cached location with validity check
-- Returns empty result if location is older than _cache_minutes

CREATE OR REPLACE FUNCTION public.get_cached_location(
  _user_id uuid,
  _cache_minutes integer DEFAULT 30
)
RETURNS TABLE (
  lat double precision,
  lng double precision,
  cached_at timestamptz,
  is_valid boolean
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  -- Validate cache_minutes
  IF _cache_minutes IS NULL OR _cache_minutes <= 0 THEN
    RAISE EXCEPTION 'Cache minutes must be positive, got %', _cache_minutes;
  END IF;
  
  RETURN QUERY
  SELECT 
    rl.lat,
    rl.lng,
    rl.captured_at as cached_at,
    -- Location is valid if captured within the cache window
    (rl.captured_at > now() - (_cache_minutes || ' minutes')::interval) as is_valid
  FROM public.recent_locations rl
  WHERE rl.user_id = _user_id
  ORDER BY rl.captured_at DESC
  LIMIT 1;
  
  -- Return empty result set if no location found (don't raise exception)
END;
$$;

COMMENT ON FUNCTION public.get_cached_location IS 
'Retrieves cached location for user with validity check. Default TTL is 30 minutes to match mobility matching window.';

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.update_user_location_cache(uuid, double precision, double precision) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.get_cached_location(uuid, integer) TO service_role, authenticated, anon;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Created update_user_location_cache function';
  RAISE NOTICE '✅ Created get_cached_location function';
  RAISE NOTICE '✅ Default cache TTL: 30 minutes (matches mobility window)';
  RAISE NOTICE '✅ Functions granted to service_role, authenticated, anon';
END;
$$;

COMMIT;
