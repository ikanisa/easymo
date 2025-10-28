-- Geospatial Index and Query Performance Tests
-- Verifies GIST indexes exist and queries use them efficiently
-- Run with: psql $SUPABASE_DB_URL -f tests/sql/geospatial_indexes.sql

BEGIN;

-- ============================================================================
-- Verify GIST Indexes Exist
-- ============================================================================

\echo 'Checking for GIST indexes on geography columns...'

SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE indexdef LIKE '%USING gist%'
  AND schemaname = 'public'
ORDER BY tablename, indexname;

-- ============================================================================
-- Test ST_DWithin Usage (Efficient)
-- ============================================================================

\echo ''
\echo 'Testing efficient geospatial query with ST_DWithin...'

-- Explain query plan for favorites lookup within radius
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT 
  id,
  label,
  ST_Distance(geog, ST_SetSRID(ST_MakePoint(30.0, -2.0), 4326)::geography) AS distance_m
FROM public.user_favorites
WHERE ST_DWithin(
  geog,
  ST_SetSRID(ST_MakePoint(30.0, -2.0), 4326)::geography,
  5000  -- 5km radius
)
ORDER BY distance_m
LIMIT 20;

-- Should show "Index Scan using idx_user_favorites_geog"

\echo ''
\echo 'Testing driver parking lookup within radius...'

EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT 
  id,
  driver_id,
  ST_Distance(geog, ST_SetSRID(ST_MakePoint(30.0, -2.0), 4326)::geography) AS distance_m
FROM public.driver_parking
WHERE ST_DWithin(
  geog,
  ST_SetSRID(ST_MakePoint(30.0, -2.0), 4326)::geography,
  10000  -- 10km radius
)
  AND expires_at IS NULL OR expires_at > NOW()
ORDER BY distance_m
LIMIT 50;

-- Should show "Index Scan using idx_driver_parking_geog"

-- ============================================================================
-- Test Inefficient Query (WITHOUT ST_DWithin)
-- ============================================================================

\echo ''
\echo 'Testing INEFFICIENT query without ST_DWithin (for comparison)...'

-- This query will NOT use the GIST index efficiently
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT 
  id,
  label,
  ST_Distance(geog, ST_SetSRID(ST_MakePoint(30.0, -2.0), 4326)::geography) AS distance_m
FROM public.user_favorites
WHERE ST_Distance(
  geog,
  ST_SetSRID(ST_MakePoint(30.0, -2.0), 4326)::geography
) < 5000
ORDER BY distance_m
LIMIT 20;

-- Should show "Seq Scan" or less efficient index usage

-- ============================================================================
-- Test Dual-Constraint Matching Query
-- ============================================================================

\echo ''
\echo 'Testing dual-constraint matching query (driver-passenger)...'

-- Create a temporary test point for pickup
WITH test_pickup AS (
  SELECT ST_SetSRID(ST_MakePoint(30.0, -2.0), 4326)::geography AS geog
)
SELECT 
  dp.id,
  dp.driver_id,
  ST_Distance(dp.geog, test_pickup.geog) AS pickup_distance_m,
  dp.notes
FROM public.driver_parking dp
CROSS JOIN test_pickup
WHERE ST_DWithin(dp.geog, test_pickup.geog, 15000)  -- 15km radius
  AND (dp.expires_at IS NULL OR dp.expires_at > NOW())
ORDER BY pickup_distance_m
LIMIT 20;

-- ============================================================================
-- Index Usage Statistics
-- ============================================================================

\echo ''
\echo 'GIST Index usage statistics...'

SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan AS index_scans,
  idx_tup_read AS tuples_read,
  idx_tup_fetch AS tuples_fetched,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE indexrelid IN (
  SELECT indexrelid 
  FROM pg_index 
  WHERE pg_get_indexdef(indexrelid) LIKE '%gist%'
)
  AND schemaname = 'public'
ORDER BY idx_scan DESC;

-- ============================================================================
-- Table Statistics
-- ============================================================================

\echo ''
\echo 'Table row counts and sizes...'

SELECT
  schemaname,
  tablename,
  n_live_tup AS row_count,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size
FROM pg_stat_user_tables
WHERE tablename IN ('user_favorites', 'driver_parking', 'driver_availability', 'trips', 'driver_status')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ============================================================================
-- Recommendations
-- ============================================================================

\echo ''
\echo '========================================================================'
\echo 'RECOMMENDATIONS:'
\echo '========================================================================'
\echo ''
\echo '1. ALWAYS use ST_DWithin for radius queries (uses GIST index efficiently)'
\echo '   Good:  WHERE ST_DWithin(geog, point, radius)'
\echo '   Bad:   WHERE ST_Distance(geog, point) < radius'
\echo ''
\echo '2. Use ST_Distance ONLY in SELECT or ORDER BY (not WHERE)'
\echo '   Good:  SELECT ST_Distance(...) ... ORDER BY distance'
\echo '   Bad:   WHERE ST_Distance(...) < 5000'
\echo ''
\echo '3. Always include LIMIT clause for geospatial queries'
\echo '   Good:  ... ORDER BY distance LIMIT 20'
\echo '   Bad:   ... ORDER BY distance  (no limit)'
\echo ''
\echo '4. Combine ST_DWithin with other filters for best performance'
\echo '   WHERE ST_DWithin(geog, point, 10000)'
\echo '     AND expires_at > NOW()'
\echo '     AND is_active = true'
\echo ''
\echo '5. Monitor index usage with pg_stat_user_indexes'
\echo '   Low idx_scan = index not being used (check query patterns)'
\echo ''
\echo '========================================================================'

ROLLBACK;
