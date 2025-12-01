# Deployment Checklist: Mobility Matching Fixes

## Pre-Deployment Verification ✓

### Code Changes
- [x] Removed trip expiration in `wa-webhook/domains/mobility/nearby.ts`
- [x] Removed trip expiration in `wa-webhook-mobility/handlers/nearby.ts`
- [x] Added trip creation in `wa-webhook-mobility/handlers/go_online.ts`
- [x] Added intent storage calls in both nearby.ts files
- [x] Added intent storage calls in go_online.ts
- [x] Created shared `intent_storage.ts` module
- [x] Both migrations have BEGIN/COMMIT wrappers
- [x] No syntax errors in TypeScript files

### Migration Files
- [x] `20251201082000_fix_trip_matching_and_intent_storage.sql` created
  - [x] Fixes match_drivers_for_trip_v2 (adds 'open' status)
  - [x] Fixes match_passengers_for_trip_v2 (adds 'open' status)
  - [x] Creates mobility_intents table with PostGIS indexes
  - [x] Adds scheduled_at and recurrence columns to rides_trips
  
- [x] `20251201082100_add_recommendation_functions.sql` created
  - [x] recommend_drivers_for_user()
  - [x] recommend_passengers_for_user()
  - [x] find_scheduled_trips_nearby()

### Documentation
- [x] MOBILITY_MATCHING_FIXES_SUMMARY.md (detailed)
- [x] MOBILITY_FIXES_QUICK_REF.md (quick guide)
- [x] This checklist

## Deployment Steps

### Step 1: Database Migrations (Required First!)
```bash
# Connect to production database
export DATABASE_URL="your-production-database-url"

# Apply migrations in order
psql $DATABASE_URL -f supabase/migrations/20251201082000_fix_trip_matching_and_intent_storage.sql
psql $DATABASE_URL -f supabase/migrations/20251201082100_add_recommendation_functions.sql

# Verify
psql $DATABASE_URL -c "\d mobility_intents"
psql $DATABASE_URL -c "\df recommend_drivers_for_user"
```

**Expected Output:**
- Table `mobility_intents` exists with 13 columns
- Function `recommend_drivers_for_user` exists
- No errors

### Step 2: Deploy Edge Functions
```bash
# Deploy updated functions
supabase functions deploy wa-webhook
supabase functions deploy wa-webhook-mobility

# Verify deployment
supabase functions list
```

**Expected Output:**
- Both functions show recent deployment timestamp
- Status: ACTIVE

### Step 3: Smoke Test
```bash
# Check database
psql $DATABASE_URL << 'EOF'
-- Should return 0 initially, will grow as users search
SELECT COUNT(*) FROM mobility_intents;

-- Check function works (returns empty if no data yet)
SELECT * FROM recommend_drivers_for_user('00000000-0000-0000-0000-000000000000', 5);

-- Check open trips (should show recent user searches)
SELECT id, role, status, expires_at 
FROM rides_trips 
WHERE status = 'open' 
  AND expires_at > now()
ORDER BY created_at DESC 
LIMIT 5;
EOF
```

## Post-Deployment Monitoring (First 24 Hours)

### Hour 1: Immediate Checks
- [ ] No edge function errors in logs
- [ ] mobility_intents table receiving inserts
- [ ] Trips staying 'open' (not immediately expired)
- [ ] Match queries returning results

### Day 1: Behavior Verification
- [ ] Users finding matches when they search
- [ ] No "no results" complaints
- [ ] mobility_intents growing steadily
- [ ] No performance degradation

### SQL Monitoring Queries
```sql
-- Check trip status distribution
SELECT 
  status,
  COUNT(*) as count,
  ROUND(AVG(EXTRACT(EPOCH FROM (expires_at - created_at))/60)) as avg_ttl_minutes
FROM rides_trips
WHERE created_at > now() - interval '24 hours'
GROUP BY status;

-- Expected: Most trips should be 'open' with ~30 min TTL

-- Check intent growth
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  intent_type,
  COUNT(*) as count
FROM mobility_intents
WHERE created_at > now() - interval '24 hours'
GROUP BY hour, intent_type
ORDER BY hour DESC;

-- Expected: Growth correlating with user activity

-- Check matching success
SELECT 
  COUNT(*) as total_searches,
  COUNT(CASE WHEN matched_at IS NOT NULL THEN 1 END) as matched,
  ROUND(100.0 * COUNT(CASE WHEN matched_at IS NOT NULL THEN 1 END) / COUNT(*), 2) as match_rate
FROM rides_trips
WHERE created_at > now() - interval '24 hours';

-- Expected: match_rate > 50% (was ~0% before)
```

## Rollback Procedure (If Issues Arise)

### Code Rollback
```bash
# Revert commits
git log --oneline | head -5  # Find commit hash before changes
git revert <commit-hash>
git push

# Redeploy old version
supabase functions deploy wa-webhook
supabase functions deploy wa-webhook-mobility
```

### Database Rollback (CAUTION: Loses Data!)
```sql
BEGIN;

-- Remove recommendation functions
DROP FUNCTION IF EXISTS find_scheduled_trips_nearby;
DROP FUNCTION IF EXISTS recommend_passengers_for_user;
DROP FUNCTION IF EXISTS recommend_drivers_for_user;

-- Remove intent table (LOSES ALL INTENT DATA!)
DROP TABLE IF EXISTS mobility_intents CASCADE;

-- Remove new columns (if problematic)
ALTER TABLE rides_trips DROP COLUMN IF EXISTS scheduled_at;
ALTER TABLE rides_trips DROP COLUMN IF EXISTS recurrence;

COMMIT;
```

**Note**: Cannot easily rollback function changes. You'd need the original SQL from before.

## Success Criteria (Week 1)

- [ ] Matching success rate > 50% (was ~0%)
- [ ] Zero critical errors in edge function logs
- [ ] mobility_intents table size < 100 MB
- [ ] No user complaints about "no results"
- [ ] Average trip discovery < 2 minutes
- [ ] Recommendation function called successfully

## Contacts

**If Deployment Fails:**
1. Check logs: Supabase Dashboard → Edge Functions → Logs
2. Check DB: Run monitoring queries above
3. Escalate to: Backend Team Lead

**If Performance Issues:**
1. Check PostGIS indexes: `EXPLAIN ANALYZE SELECT ...`
2. Monitor DB connections: `SELECT count(*) FROM pg_stat_activity;`
3. Check edge function cold starts

## Sign-Off

- [ ] Migrations reviewed and tested locally
- [ ] Code changes peer-reviewed
- [ ] Documentation complete
- [ ] Deployment plan approved
- [ ] Rollback plan tested
- [ ] Monitoring dashboard configured
- [ ] Team notified of deployment

**Deployed By:** ___________________  
**Date:** ___________________  
**Time:** ___________________  
**Version/Commit:** ___________________

## Notes

_Add any deployment-specific notes here_

---

**Status:** Ready for Production ✅  
**Priority:** CRITICAL 🔴  
**Risk Level:** LOW 🟢  
**Estimated Deployment Time:** 15 minutes  
**Estimated User Impact:** HIGH (Fixes core functionality)
