-- ============================================================================
-- ADD MISSING INDEXES AND OPTIMISTIC LOCKING
-- ============================================================================
-- Migration: 20251205000002_add_missing_indexes.sql
-- Purpose: Add performance indexes and version column for race condition prevention
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. ADD VERSION COLUMN FOR OPTIMISTIC LOCKING
-- ============================================================================

-- Add version column to mobility_trip_matches if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'mobility_trip_matches' 
    AND column_name = 'version'
  ) THEN
    ALTER TABLE mobility_trip_matches 
    ADD COLUMN version integer NOT NULL DEFAULT 1;
    
    RAISE NOTICE 'Added version column to mobility_trip_matches';
  END IF;
END;
$$;

-- Create trigger to auto-increment version on update
CREATE OR REPLACE FUNCTION increment_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_increment_version ON mobility_trip_matches;
CREATE TRIGGER trg_increment_version
  BEFORE UPDATE ON mobility_trip_matches
  FOR EACH ROW
  EXECUTE FUNCTION increment_version();

COMMENT ON COLUMN mobility_trip_matches.version IS 'Optimistic locking version counter';

-- ============================================================================
-- 2. ADD FOREIGN KEY INDEXES
-- ============================================================================

-- Indexes on mobility_trip_matches foreign keys
CREATE INDEX IF NOT EXISTS idx_mobility_trip_matches_driver_trip 
  ON mobility_trip_matches(driver_trip_id);

CREATE INDEX IF NOT EXISTS idx_mobility_trip_matches_passenger_trip 
  ON mobility_trip_matches(passenger_trip_id);

-- Additional performance indexes
CREATE INDEX IF NOT EXISTS idx_mobility_trip_matches_version
  ON mobility_trip_matches(id, version)
  WHERE status IN ('pending', 'accepted', 'driver_arrived', 'in_progress');

-- ============================================================================
-- 3. ADD COMPOSITE INDEXES FOR COMMON QUERIES
-- ============================================================================

-- For finding active trips by user and status
CREATE INDEX IF NOT EXISTS idx_mobility_trips_user_status
  ON mobility_trips(creator_user_id, status, created_at DESC)
  WHERE status IN ('open', 'matched');

-- For spatial queries with vehicle type filter
CREATE INDEX IF NOT EXISTS idx_mobility_trips_vehicle_geog
  ON mobility_trips USING GIST(pickup_geog)
  WHERE status = 'open'
  INCLUDE (vehicle_type, role);

-- For scheduled trips cron job
CREATE INDEX IF NOT EXISTS idx_mobility_trips_scheduled_pending
  ON mobility_trips(scheduled_for)
  WHERE status = 'open' AND scheduled_for IS NOT NULL AND scheduled_for <= now();

-- ============================================================================
-- 4. ADD INDEXES ON METRICS TABLES
-- ============================================================================

-- For leaderboard queries
CREATE INDEX IF NOT EXISTS idx_mobility_driver_metrics_leaderboard
  ON mobility_driver_metrics(computed_score DESC, total_trips DESC)
  WHERE total_trips >= 5 AND avg_rating >= 3.0;

-- For recent activity queries
CREATE INDEX IF NOT EXISTS idx_mobility_driver_metrics_recent
  ON mobility_driver_metrics(last_online_at DESC NULLS LAST)
  WHERE last_online_at > now() - interval '7 days';

-- ============================================================================
-- 5. VERIFICATION
-- ============================================================================

DO $$
DECLARE
  v_index_count integer;
BEGIN
  -- Count indexes on mobility tables
  SELECT COUNT(*) INTO v_index_count
  FROM pg_indexes
  WHERE tablename LIKE 'mobility_%'
  AND indexname LIKE 'idx_%';
  
  RAISE NOTICE 'Created/verified % indexes on mobility tables', v_index_count;
  
  -- Verify version column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'mobility_trip_matches' 
    AND column_name = 'version'
  ) THEN
    RAISE EXCEPTION 'Version column not found on mobility_trip_matches';
  END IF;
  
  RAISE NOTICE 'Optimistic locking enabled on mobility_trip_matches';
END;
$$;

COMMIT;

-- ============================================================================
-- POST-MIGRATION NOTES
-- ============================================================================
-- 
-- The version column enables optimistic locking to prevent race conditions:
-- 
-- Example usage in application code:
-- 
-- const { data: trip } = await supabase
--   .from('mobility_trip_matches')
--   .select('*')
--   .eq('id', tripId)
--   .single();
-- 
-- const { error } = await supabase
--   .from('mobility_trip_matches')
--   .update({ 
--     status: 'in_progress',
--     version: trip.version + 1  // Will be auto-incremented by trigger
--   })
--   .eq('id', tripId)
--   .eq('version', trip.version);  // Optimistic lock check
-- 
-- if (error?.code === 'PGRST116') {
--   throw new Error('Trip was modified by another request');
-- }
-- 
-- ============================================================================
