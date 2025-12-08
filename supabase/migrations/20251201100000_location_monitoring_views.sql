-- Phase 5.2: Monitoring Views and Queries
-- Analytics views for saved locations adoption and usage

BEGIN;

-- Daily location activity stats
CREATE OR REPLACE VIEW location_daily_stats AS
SELECT 
  DATE_TRUNC('day', created_at) as day,
  COUNT(*) as saves,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(*) FILTER (WHERE kind = 'home') as home_count,
  COUNT(*) FILTER (WHERE kind = 'work') as work_count,
  COUNT(*) FILTER (WHERE kind = 'school') as school_count,
  COUNT(*) FILTER (WHERE kind = 'other') as other_count,
  COUNT(*) FILTER (WHERE address IS NOT NULL AND address NOT LIKE '%,%') as with_address,
  COUNT(*) FILTER (WHERE usage_count > 0) as used_at_least_once,
  AVG(usage_count) as avg_usage_count
FROM saved_locations
GROUP BY 1
ORDER BY 1 DESC;

-- User engagement metrics
CREATE OR REPLACE VIEW location_user_engagement AS
SELECT 
  user_id,
  COUNT(*) as location_count,
  SUM(usage_count) as total_uses,
  MAX(last_used_at) as last_activity,
  ARRAY_AGG(DISTINCT kind ORDER BY kind) as kinds_used,
  MAX(created_at) as most_recent_save,
  MIN(created_at) as first_save
FROM saved_locations
GROUP BY user_id
HAVING COUNT(*) > 0;

-- Adoption rate by cohort
CREATE OR REPLACE VIEW location_adoption_by_cohort AS
SELECT 
  DATE_TRUNC('month', p.created_at) as cohort_month,
  COUNT(DISTINCT p.user_id) as total_users,
  COUNT(DISTINCT CASE WHEN sl.user_id IS NOT NULL THEN p.user_id END) as users_with_locations,
  ROUND(
    COUNT(DISTINCT CASE WHEN sl.user_id IS NOT NULL THEN p.user_id END)::numeric / 
    NULLIF(COUNT(DISTINCT p.user_id), 0) * 100, 
    2
  ) as adoption_pct
FROM profiles p
LEFT JOIN saved_locations sl ON sl.user_id = p.user_id
WHERE p.created_at >= NOW() - INTERVAL '12 months'
GROUP BY 1
ORDER BY 1 DESC;

-- Location kind distribution
CREATE OR REPLACE VIEW location_kind_distribution AS
SELECT 
  kind,
  COUNT(*) as count,
  COUNT(DISTINCT user_id) as unique_users,
  AVG(usage_count) as avg_usage,
  ROUND(
    COUNT(*)::numeric / SUM(COUNT(*)) OVER () * 100, 
    2
  ) as percentage
FROM saved_locations
GROUP BY kind
ORDER BY count DESC;

-- Geocoding effectiveness (requires structured logs)
COMMENT ON VIEW location_daily_stats IS 
'Daily metrics for saved locations: saves, users, kind distribution, address coverage';

COMMENT ON VIEW location_user_engagement IS 
'Per-user engagement: location count, total uses, activity timestamps';

COMMENT ON VIEW location_adoption_by_cohort IS 
'Adoption rate by user registration month - track onboarding effectiveness';

COMMENT ON VIEW location_kind_distribution IS 
'Distribution of location kinds (home/work/school/other) with usage stats';

-- Function to get current adoption metrics
DROP FUNCTION IF EXISTS get_location_adoption_metrics();
CREATE OR REPLACE FUNCTION get_location_adoption_metrics()
RETURNS TABLE (
  metric text,
  value numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 'total_locations'::text, COUNT(*)::numeric FROM saved_locations
  UNION ALL
  SELECT 'users_with_locations'::text, COUNT(DISTINCT user_id)::numeric FROM saved_locations
  UNION ALL
  SELECT 'avg_per_user'::text, 
    ROUND(AVG(location_count), 2)
  FROM (SELECT user_id, COUNT(*) as location_count FROM saved_locations GROUP BY user_id) t
  UNION ALL
  SELECT 'median_per_user'::text,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY location_count)
  FROM (SELECT user_id, COUNT(*) as location_count FROM saved_locations GROUP BY user_id) t
  UNION ALL
  SELECT 'reuse_rate_pct'::text,
    ROUND(
      COUNT(DISTINCT CASE WHEN usage_count > 1 THEN id END)::numeric / 
      NULLIF(COUNT(*), 0) * 100,
      2
    )
  FROM saved_locations
  UNION ALL
  SELECT 'with_address_pct'::text,
    ROUND(
      COUNT(CASE WHEN address IS NOT NULL THEN 1 END)::numeric / 
      NULLIF(COUNT(*), 0) * 100,
      2
    )
  FROM saved_locations
  UNION ALL
  SELECT 'home_locations'::text, COUNT(*)::numeric FROM saved_locations WHERE kind = 'home'
  UNION ALL
  SELECT 'work_locations'::text, COUNT(*)::numeric FROM saved_locations WHERE kind = 'work'
  UNION ALL
  SELECT 'locations_created_today'::text, 
    COUNT(*)::numeric 
  FROM saved_locations 
  WHERE created_at >= CURRENT_DATE
  UNION ALL
  SELECT 'locations_used_today'::text,
    COUNT(DISTINCT id)::numeric
  FROM saved_locations
  WHERE last_used_at >= CURRENT_DATE;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_location_adoption_metrics IS 
'Get current snapshot of key location metrics for dashboards';

COMMIT;
