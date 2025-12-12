-- ============================================================================
-- Add Automated Trip Cleanup
-- ============================================================================
-- Migration: 20251212153000_add_trip_cleanup.sql
-- 
-- ISSUE:
-- - Trips remain with status='open' even after expires_at has passed
-- - No automated cleanup process for expired trips
-- - Database bloat from old trips
-- - Match queries waste time checking expired trips
-- 
-- SOLUTION:
-- - Create cleanup function to mark expired trips
-- - Update status from 'open' to 'expired' after expires_at
-- - Can be called by scheduled-cleanup edge function
-- - Can also be run via pg_cron if needed
-- 
-- BEHAVIOR:
-- - Trip created at 10:00, expires_at = 10:30
-- - At 10:31, cleanup function changes status to 'expired'
-- - Matching functions already filter by expires_at > now() ✅
-- - This cleanup is for data hygiene and reporting
-- ============================================================================

BEGIN;

-- ============================================================================
-- CREATE TRIP CLEANUP FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_trips()
RETURNS TABLE (
  expired_count integer,
  oldest_trip_age_minutes integer,
  cleanup_timestamp timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired_count integer;
  v_oldest_age_minutes integer;
BEGIN
  -- Update expired trips
  WITH updated AS (
    UPDATE public.trips
    SET 
      status = 'expired',
      updated_at = now()
    WHERE status = 'open'
      AND expires_at <= now()
    RETURNING id, created_at
  )
  SELECT 
    COUNT(*)::integer,
    MAX(EXTRACT(EPOCH FROM (now() - created_at)) / 60)::integer
  INTO v_expired_count, v_oldest_age_minutes
  FROM updated;

  -- Return results
  RETURN QUERY
  SELECT 
    COALESCE(v_expired_count, 0) AS expired_count,
    COALESCE(v_oldest_age_minutes, 0) AS oldest_trip_age_minutes,
    now() AS cleanup_timestamp;
END;
$$;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.cleanup_expired_trips() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_trips() TO authenticated;

-- ============================================================================
-- ADD INDEX FOR EFFICIENT CLEANUP
-- ============================================================================

-- Index for finding expired trips quickly
CREATE INDEX IF NOT EXISTS idx_trips_cleanup 
ON public.trips (status, expires_at) 
WHERE status = 'open';

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION public.cleanup_expired_trips() IS 
'Marks trips as expired if expires_at has passed. Should be called periodically (e.g., every 5 minutes) by scheduled-cleanup edge function or pg_cron.';

COMMENT ON INDEX idx_trips_cleanup IS 
'Optimizes cleanup query by indexing open trips with expires_at for fast expiry checks.';

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================

-- Test the function (returns current expired trips without updating)
-- SELECT * FROM public.trips 
-- WHERE status = 'open' AND expires_at <= now()
-- LIMIT 5;

-- Run cleanup (this will actually update trips)
-- SELECT * FROM public.cleanup_expired_trips();

COMMIT;

-- ============================================================================
-- POST-DEPLOYMENT NOTES
-- ============================================================================

-- 1. Update scheduled-cleanup edge function to call this function
-- 2. Schedule to run every 5 minutes for near-real-time cleanup
-- 3. Monitor cleanup metrics (expired_count, oldest_trip_age_minutes)
-- 4. Expected: ~50-200 trips expired per run depending on traffic
-- 5. Query: SELECT * FROM cleanup_expired_trips(); returns stats

-- Example scheduled-cleanup integration:
-- async function cleanupExpiredTrips() {
--   const { data, error } = await supabase.rpc('cleanup_expired_trips');
--   if (error) throw error;
--   return data[0];
-- }
