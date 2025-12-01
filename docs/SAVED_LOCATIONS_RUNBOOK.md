# Saved Locations - Operations Runbook

**Version**: 1.0  
**Last Updated**: 2025-12-01  
**Owner**: Platform Team

---

## Table of Contents
1. [System Overview](#system-overview)
2. [Monitoring](#monitoring)
3. [Common Issues](#common-issues)
4. [Maintenance Tasks](#maintenance-tasks)
5. [Escalation](#escalation)

---

## System Overview

### Architecture
- **Database**: `saved_locations` table in Supabase Postgres
- **Edge Functions**: geocoding, deduplication utilities
- **External APIs**: Nominatim (OpenStreetMap) for reverse geocoding
- **Cache**: 7-day in-memory cache for geocoding results

### Key Metrics
| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Adoption rate | >75% | <60% |
| Avg locations per user | >3.0 | <2.0 |
| Reuse rate | >60% | <40% |
| Geocoding success | >95% | <85% |
| Duplicate detection | >90% | <75% |

---

## Monitoring

### Dashboard Queries

**Current Metrics** (Run daily):
```sql
SELECT * FROM get_location_adoption_metrics();
```

**Daily Activity**:
```sql
SELECT * FROM location_daily_stats
WHERE day >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY day DESC;
```

**User Engagement**:
```sql
SELECT 
  COUNT(*) FILTER (WHERE location_count = 1) as single_location,
  COUNT(*) FILTER (WHERE location_count = 2) as two_locations,
  COUNT(*) FILTER (WHERE location_count >= 3) as three_plus_locations
FROM location_user_engagement;
```

### Alerts to Set Up

1. **Low Adoption Alert**:
```sql
-- Alert if adoption drops below 60%
SELECT 
  adoption_pct
FROM location_adoption_by_cohort
WHERE cohort_month = DATE_TRUNC('month', CURRENT_DATE)
HAVING adoption_pct < 60;
```

2. **Geocoding Failure Spike**:
```
-- Monitor structured logs for:
event = 'location.geocode_fail'
count > 100 per hour
```

3. **Performance Degradation**:
```sql
SELECT 
  query,
  mean_exec_time
FROM pg_stat_statements
WHERE query LIKE '%saved_locations%'
  AND mean_exec_time > 1000; -- >1 second
```

---

## Common Issues

### Issue 1: Geocoding Failures Spike

**Symptoms**:
- Users see coordinates instead of addresses
- Logs show `location.geocode_fail` events
- Addresses missing in saved locations

**Diagnosis**:
```bash
# Check Nominatim status
curl -I https://nominatim.openstreetmap.org/status

# Check recent failures in logs
SELECT 
  COUNT(*),
  jsonb_extract_path_text(metadata, 'error') as error
FROM logs
WHERE event = 'location.geocode_fail'
  AND timestamp >= NOW() - INTERVAL '1 hour'
GROUP BY 2;
```

**Resolution**:
1. **If Nominatim is down**:
   - Users will still get coordinates (graceful degradation)
   - Monitor and wait for service recovery
   - Consider temporary manual geocoding for VIP users

2. **If rate limited**:
   - Check request rate in logs
   - Verify cache is working
   - Consider adding secondary geocoding provider

3. **If cache issue**:
   - Restart edge function to clear bad cache
   - Monitor cache hit rate

**Prevention**:
- Monitor Nominatim uptime
- Set up backup geocoding provider
- Increase cache TTL if needed

---

### Issue 2: Duplicate Locations Not Detected

**Symptoms**:
- Users have multiple "Home" locations
- Same coordinates saved multiple times
- Deduplication not working

**Diagnosis**:
```sql
-- Find users with duplicate kinds
SELECT 
  user_id,
  kind,
  COUNT(*) as count,
  ARRAY_AGG(id) as location_ids,
  ARRAY_AGG(label) as labels
FROM saved_locations
GROUP BY user_id, kind
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- Find exact coordinate duplicates
SELECT 
  user_id,
  lat,
  lng,
  COUNT(*) as count,
  ARRAY_AGG(label) as labels
FROM saved_locations
GROUP BY user_id, lat, lng
HAVING COUNT(*) > 1;
```

**Resolution**:
```sql
-- Merge duplicates (keep the one with most usage)
WITH duplicates AS (
  SELECT 
    user_id,
    kind,
    ARRAY_AGG(id ORDER BY usage_count DESC, created_at ASC) as ids,
    ARRAY_AGG(usage_count) as counts
  FROM saved_locations
  GROUP BY user_id, kind
  HAVING COUNT(*) > 1
)
UPDATE saved_locations
SET usage_count = usage_count + (
  SELECT SUM(usage_count) 
  FROM saved_locations 
  WHERE id = ANY((SELECT ids FROM duplicates WHERE ids[1] = saved_locations.id)[2:])
)
WHERE id IN (SELECT ids[1] FROM duplicates);

-- Delete duplicates
DELETE FROM saved_locations
WHERE id IN (
  SELECT UNNEST(ids[2:])
  FROM (
    SELECT ARRAY_AGG(id ORDER BY usage_count DESC, created_at ASC) as ids
    FROM saved_locations
    GROUP BY user_id, kind
    HAVING COUNT(*) > 1
  ) t
);
```

**Prevention**:
- Check deduplication logic in `saveFavorite()`
- Verify 50m radius is appropriate
- Add database constraint if needed

---

### Issue 3: Low Adoption Rate

**Symptoms**:
- <60% of users have saved locations
- New user cohort not saving locations
- Post-trip prompts not converting

**Diagnosis**:
```sql
-- Check prompt effectiveness
SELECT 
  DATE_TRUNC('day', timestamp) as day,
  COUNT(*) FILTER (WHERE event = 'trip_completion.save_prompt_sent') as prompts,
  COUNT(*) FILTER (WHERE event = 'LOCATION_SAVED' AND metadata->>'source' = 'post_trip') as saves,
  ROUND(
    COUNT(*) FILTER (WHERE event = 'LOCATION_SAVED' AND metadata->>'source' = 'post_trip')::numeric /
    NULLIF(COUNT(*) FILTER (WHERE event = 'trip_completion.save_prompt_sent'), 0) * 100,
    2
  ) as conversion_pct
FROM logs
WHERE timestamp >= NOW() - INTERVAL '7 days'
GROUP BY 1
ORDER BY 1 DESC;

-- Check cohort adoption
SELECT * FROM location_adoption_by_cohort
ORDER BY cohort_month DESC
LIMIT 6;
```

**Resolution**:
1. **A/B test prompt messages**:
   - Try different copy in `trip-completion.ts`
   - Test different timing (immediately vs 5min later)
   - Test different buttons (2 vs 4 options)

2. **Improve empty state**:
   - Make instructions clearer
   - Add visual examples
   - Highlight benefits more

3. **Incentivize saves**:
   - Offer discount for saved locations
   - Gamify location collection
   - Show social proof

**Prevention**:
- Monitor conversion rates weekly
- Track by user segment
- Regular UX testing

---

### Issue 4: Performance Degradation

**Symptoms**:
- Slow location queries
- Edge function timeouts
- Database CPU spikes

**Diagnosis**:
```sql
-- Check slow queries
SELECT 
  query,
  calls,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE query LIKE '%saved_locations%'
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check missing indexes
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read
FROM pg_stat_user_indexes
WHERE tablename = 'saved_locations'
ORDER BY idx_scan ASC;

-- Check table bloat
SELECT 
  pg_size_pretty(pg_total_relation_size('saved_locations')) as total_size,
  pg_size_pretty(pg_relation_size('saved_locations')) as table_size,
  pg_size_pretty(pg_indexes_size('saved_locations')) as indexes_size;
```

**Resolution**:
```sql
-- Add missing indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_saved_locations_user_kind_usage
  ON saved_locations(user_id, kind, usage_count DESC NULLS LAST);

-- Vacuum if bloated
VACUUM ANALYZE saved_locations;

-- Reindex if needed
REINDEX TABLE CONCURRENTLY saved_locations;
```

**Prevention**:
- Monitor query performance weekly
- Set up slow query alerts
- Regular VACUUM ANALYZE

---

## Maintenance Tasks

### Daily
- [ ] Check adoption metrics
- [ ] Review geocoding success rate
- [ ] Monitor duplicate detection

### Weekly
- [ ] Review slow queries
- [ ] Check cache hit rate
- [ ] Analyze user engagement trends
- [ ] Review alert history

### Monthly
- [ ] Clean up orphaned locations (users deleted)
- [ ] Archive old analytics data
- [ ] Review and optimize indexes
- [ ] Update runbook with new learnings

### Quarterly
- [ ] Full performance audit
- [ ] Review external API costs
- [ ] A/B test improvements
- [ ] Capacity planning

---

## Escalation

### Level 1: Support Team
- User reports location not saving
- Location showing wrong address
- Cannot delete location

**Actions**: Check user's saved_locations, verify no duplicates, test manually

### Level 2: Engineering On-Call
- Geocoding API down
- Mass duplicate creation
- Performance degradation
- Data loss

**Actions**: Follow runbook procedures, escalate if unresolved in 1 hour

### Level 3: Platform Team Lead
- Database corruption
- Security incident
- Major API changes needed
- Architecture decisions

**Contact**: platform-team@easymo.rw  
**Slack**: #platform-emergencies

---

## Useful Commands

### Quick Health Check
```sql
-- One-liner health check
SELECT 
  (SELECT COUNT(*) FROM saved_locations) as total,
  (SELECT COUNT(DISTINCT user_id) FROM saved_locations) as users,
  (SELECT COUNT(*) FROM saved_locations WHERE created_at >= CURRENT_DATE) as today,
  (SELECT AVG(usage_count) FROM saved_locations WHERE usage_count > 0) as avg_usage;
```

### Find User Locations
```sql
SELECT 
  id,
  kind,
  label,
  address,
  usage_count,
  last_used_at,
  created_at
FROM saved_locations
WHERE user_id = :user_id
ORDER BY kind, created_at;
```

### Location Statistics
```sql
SELECT * FROM location_kind_distribution;
SELECT * FROM location_daily_stats WHERE day >= CURRENT_DATE - 7;
```

---

**Document Maintenance**:
- Update after each incident
- Add new issues as discovered
- Remove obsolete procedures
- Keep metrics thresholds current

**Version History**:
- 1.0 (2025-12-01): Initial version with Phase 1-3 features
