-- Location Integration Monitoring Queries
-- Run these queries to monitor location system health and performance

-- ============================================================================
-- 1. CACHE PERFORMANCE OVERVIEW
-- ============================================================================

-- Overall cache statistics
SELECT
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 minutes') as active_caches,
  COUNT(*) FILTER (WHERE created_at <= NOW() - INTERVAL '30 minutes') as expired_caches,
  ROUND(
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 minutes')::numeric / 
    NULLIF(COUNT(*), 0) * 100,
    2
  ) as hit_rate_percent,
  AVG(EXTRACT(EPOCH FROM NOW() - created_at)) FILTER (WHERE created_at > NOW() - INTERVAL '30 minutes') as avg_cache_age_seconds,
  MAX(created_at) as most_recent_cache,
  COUNT(DISTINCT user_id) as unique_users
FROM location_cache
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Cache hit rate by hour (last 24 hours)
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as total_caches,
  COUNT(DISTINCT user_id) as unique_users,
  ROUND(AVG(latitude), 4) as avg_lat,
  ROUND(AVG(longitude), 4) as avg_lng
FROM location_cache
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;

-- ============================================================================
-- 2. SERVICE USAGE ANALYSIS
-- ============================================================================

-- Usage by service (context)
SELECT
  context,
  COUNT(*) as total_uses,
  COUNT(DISTINCT user_id) as unique_users,
  MIN(created_at) as first_use,
  MAX(created_at) as last_use,
  ROUND(
    COUNT(*)::numeric / 
    NULLIF((SELECT COUNT(*) FROM location_cache WHERE created_at > NOW() - INTERVAL '24 hours'), 0) * 100,
    2
  ) as percent_of_total
FROM location_cache
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY context
ORDER BY total_uses DESC;

-- Service usage trend (last 7 days)
SELECT
  DATE(created_at) as date,
  context,
  COUNT(*) as uses,
  COUNT(DISTINCT user_id) as unique_users
FROM location_cache
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at), context
ORDER BY date DESC, uses DESC;

-- ============================================================================
-- 3. GEOGRAPHIC DISTRIBUTION
-- ============================================================================

-- Top locations by cache count
SELECT
  country,
  city,
  COUNT(*) as cache_count,
  COUNT(DISTINCT user_id) as unique_users,
  ROUND(AVG(latitude), 4) as avg_lat,
  ROUND(AVG(longitude), 4) as avg_lng
FROM location_cache
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND country IS NOT NULL
GROUP BY country, city
ORDER BY cache_count DESC
LIMIT 10;

-- Country distribution
SELECT
  country,
  COUNT(*) as total_caches,
  COUNT(DISTINCT user_id) as unique_users,
  ROUND(
    COUNT(*)::numeric / 
    NULLIF((SELECT COUNT(*) FROM location_cache WHERE created_at > NOW() - INTERVAL '24 hours'), 0) * 100,
    2
  ) as percent_of_total
FROM location_cache
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND country IS NOT NULL
GROUP BY country
ORDER BY total_caches DESC;

-- ============================================================================
-- 4. SAVED LOCATIONS ANALYSIS
-- ============================================================================

-- Saved locations overview
SELECT
  location_type,
  COUNT(*) as total,
  COUNT(DISTINCT user_id) as unique_users,
  MIN(created_at) as first_saved,
  MAX(created_at) as last_saved
FROM saved_locations
GROUP BY location_type
ORDER BY total DESC;

-- Users with multiple saved locations
SELECT
  user_id,
  COUNT(*) as saved_count,
  STRING_AGG(location_type, ', ' ORDER BY location_type) as types,
  MAX(created_at) as last_saved
FROM saved_locations
GROUP BY user_id
HAVING COUNT(*) > 1
ORDER BY saved_count DESC
LIMIT 20;

-- Recent saved locations (last 24 hours)
SELECT
  user_id,
  location_type,
  label,
  CASE 
    WHEN latitude IS NOT NULL THEN 'GPS'
    ELSE 'Text Only'
  END as location_format,
  created_at
FROM saved_locations
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 50;

-- ============================================================================
-- 5. USER ACTIVITY PATTERNS
-- ============================================================================

-- Most active users (by cache usage)
SELECT
  user_id,
  COUNT(*) as cache_count,
  COUNT(DISTINCT context) as services_used,
  MIN(created_at) as first_use,
  MAX(created_at) as last_use,
  EXTRACT(EPOCH FROM MAX(created_at) - MIN(created_at))/3600 as hours_span
FROM location_cache
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY user_id
ORDER BY cache_count DESC
LIMIT 20;

-- Active users by hour of day
SELECT
  EXTRACT(HOUR FROM created_at) as hour_of_day,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(*) as total_caches
FROM location_cache
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY EXTRACT(HOUR FROM created_at)
ORDER BY hour_of_day;

-- User retention (users active in multiple days)
SELECT
  user_id,
  COUNT(DISTINCT DATE(created_at)) as active_days,
  MIN(DATE(created_at)) as first_day,
  MAX(DATE(created_at)) as last_day,
  COUNT(*) as total_caches
FROM location_cache
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY user_id
HAVING COUNT(DISTINCT DATE(created_at)) > 1
ORDER BY active_days DESC
LIMIT 20;

-- ============================================================================
-- 6. GPS SEARCH PERFORMANCE (Approximate)
-- ============================================================================

-- Jobs density by location (requires job_listings table)
SELECT
  country,
  COUNT(*) as job_count,
  COUNT(DISTINCT 
    CASE 
      WHEN location_coords IS NOT NULL THEN id 
    END
  ) as gps_enabled_jobs,
  ROUND(
    COUNT(DISTINCT CASE WHEN location_coords IS NOT NULL THEN id END)::numeric / 
    NULLIF(COUNT(*), 0) * 100,
    2
  ) as gps_percentage
FROM job_listings
WHERE status = 'active'
GROUP BY country
ORDER BY job_count DESC;

-- Marketplace products with GPS
SELECT
  category,
  COUNT(*) as total_products,
  COUNT(DISTINCT CASE WHEN location_coords IS NOT NULL THEN id END) as with_gps,
  ROUND(
    COUNT(DISTINCT CASE WHEN location_coords IS NOT NULL THEN id END)::numeric / 
    NULLIF(COUNT(*), 0) * 100,
    2
  ) as gps_percentage
FROM marketplace_products
WHERE status = 'active'
GROUP BY category
ORDER BY total_products DESC;

-- ============================================================================
-- 7. DATA QUALITY CHECKS
-- ============================================================================

-- Invalid coordinates check
SELECT
  'Invalid Latitude' as issue,
  COUNT(*) as count
FROM location_cache
WHERE latitude < -90 OR latitude > 90
UNION ALL
SELECT
  'Invalid Longitude' as issue,
  COUNT(*) as count
FROM location_cache
WHERE longitude < -180 OR longitude > 180
UNION ALL
SELECT
  'Missing Country' as issue,
  COUNT(*) as count
FROM location_cache
WHERE country IS NULL AND created_at > NOW() - INTERVAL '24 hours'
UNION ALL
SELECT
  'Zero Coordinates' as issue,
  COUNT(*) as count
FROM location_cache
WHERE latitude = 0 AND longitude = 0;

-- Duplicate cache entries (same user, same location, within 5 minutes)
SELECT
  user_id,
  latitude,
  longitude,
  COUNT(*) as duplicate_count,
  MIN(created_at) as first_cached,
  MAX(created_at) as last_cached
FROM location_cache
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY user_id, latitude, longitude
HAVING COUNT(*) > 5
ORDER BY duplicate_count DESC
LIMIT 20;

-- ============================================================================
-- 8. PERFORMANCE DIAGNOSTICS
-- ============================================================================

-- Slow queries detection (requires pg_stat_statements extension)
-- Uncomment if pg_stat_statements is enabled
/*
SELECT
  query,
  calls,
  ROUND(mean_exec_time::numeric, 2) as avg_time_ms,
  ROUND(max_exec_time::numeric, 2) as max_time_ms,
  ROUND(stddev_exec_time::numeric, 2) as stddev_time_ms
FROM pg_stat_statements
WHERE query LIKE '%location%'
  OR query LIKE '%nearby_%'
  OR query LIKE '%saved_locations%'
ORDER BY mean_exec_time DESC
LIMIT 20;
*/

-- Index usage statistics
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as times_used,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename IN ('location_cache', 'saved_locations', 'job_listings', 'marketplace_products')
ORDER BY tablename, idx_scan DESC;

-- Table sizes
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as index_size
FROM pg_tables
WHERE tablename IN ('location_cache', 'saved_locations', 'job_listings', 'marketplace_products')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ============================================================================
-- 9. REAL-TIME MONITORING (Refresh every 5 seconds)
-- ============================================================================

-- Current activity snapshot
SELECT
  'Active Caches (30min)' as metric,
  COUNT(*)::text as value
FROM location_cache
WHERE created_at > NOW() - INTERVAL '30 minutes'
UNION ALL
SELECT
  'Active Users (1h)' as metric,
  COUNT(DISTINCT user_id)::text as value
FROM location_cache
WHERE created_at > NOW() - INTERVAL '1 hour'
UNION ALL
SELECT
  'Cache Hit Rate (24h)' as metric,
  ROUND(
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 minutes')::numeric / 
    NULLIF(COUNT(*), 0) * 100,
    2
  )::text || '%' as value
FROM location_cache
WHERE created_at > NOW() - INTERVAL '24 hours'
UNION ALL
SELECT
  'Total Saved Locations' as metric,
  COUNT(*)::text as value
FROM saved_locations
UNION ALL
SELECT
  'GPS-Enabled Jobs' as metric,
  COUNT(DISTINCT CASE WHEN location_coords IS NOT NULL THEN id END)::text as value
FROM job_listings
WHERE status = 'active';

-- ============================================================================
-- 10. ALERTS & THRESHOLDS
-- ============================================================================

-- Alert: Low cache hit rate (<40%)
DO $$
DECLARE
  hit_rate numeric;
BEGIN
  SELECT
    ROUND(
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 minutes')::numeric / 
      NULLIF(COUNT(*), 0) * 100,
      2
    ) INTO hit_rate
  FROM location_cache
  WHERE created_at > NOW() - INTERVAL '24 hours';
  
  IF hit_rate < 40 THEN
    RAISE WARNING 'ALERT: Low cache hit rate: %%. Target: >=40%%', hit_rate;
  END IF;
END $$;

-- Alert: No recent activity (last 1 hour)
DO $$
DECLARE
  active_users int;
BEGIN
  SELECT COUNT(DISTINCT user_id) INTO active_users
  FROM location_cache
  WHERE created_at > NOW() - INTERVAL '1 hour';
  
  IF active_users = 0 THEN
    RAISE WARNING 'ALERT: No active users in the last hour';
  END IF;
END $$;

-- ============================================================================
-- 11. CLEANUP QUERIES (Run periodically)
-- ============================================================================

-- Delete old cache entries (>7 days)
-- CAUTION: Run in maintenance window
/*
DELETE FROM location_cache
WHERE created_at < NOW() - INTERVAL '7 days';
*/

-- Archive old saved locations (soft delete)
-- CAUTION: Run in maintenance window
/*
UPDATE saved_locations
SET deleted_at = NOW()
WHERE deleted_at IS NULL
  AND updated_at < NOW() - INTERVAL '1 year'
  AND id NOT IN (
    SELECT DISTINCT saved_location_id
    FROM recent_user_activity
    WHERE created_at > NOW() - INTERVAL '90 days'
  );
*/

-- ============================================================================
-- 12. EXPORT FOR ANALYTICS
-- ============================================================================

-- Daily summary for analytics
SELECT
  DATE(created_at) as date,
  context,
  country,
  COUNT(*) as total_caches,
  COUNT(DISTINCT user_id) as unique_users,
  ROUND(AVG(latitude), 4) as avg_lat,
  ROUND(AVG(longitude), 4) as avg_lng
FROM location_cache
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at), context, country
ORDER BY date DESC, total_caches DESC;

-- ============================================================================
-- USAGE INSTRUCTIONS
-- ============================================================================

/*
1. Run individual queries as needed for specific insights
2. Use Section 9 (Real-time Monitoring) for live dashboards
3. Schedule Section 10 (Alerts) to run every 15 minutes
4. Run Section 11 (Cleanup) weekly during off-peak hours
5. Export Section 12 daily for analytics/reporting

Performance Tips:
- Most queries are optimized with indexes
- Adjust time intervals based on data volume
- Use EXPLAIN ANALYZE to check query performance
- Add indexes if queries become slow

Monitoring Frequency:
- Real-time: Every 5-30 seconds (Section 9)
- Regular: Every 5-15 minutes (Sections 1-5)
- Periodic: Hourly/Daily (Sections 6-8)
- Maintenance: Weekly (Section 11)
*/
