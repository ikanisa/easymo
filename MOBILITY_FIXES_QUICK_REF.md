# Quick Reference: Mobility Matching Fixes

## What Changed?

### 🔴 CRITICAL FIXES (Deploy Immediately)

1. **Trips Now Stay Open**
   - Before: Trips expired immediately after search → 0 matches
   - After: Trips stay 'open' for 30 minutes → discoverable by others
   - Files: `nearby.ts` (both versions)

2. **Matching Functions Fixed**
   - Before: Only found status IN ('pending', 'active') → missed all trips
   - After: Includes 'open' status + expires_at check
   - File: Migration `20251201082000_*`

3. **Driver Go Online Creates Trip**
   - Before: Only cached location → invisible to passengers
   - After: Creates trip record → passengers can find drivers
   - File: `go_online.ts`

## How to Deploy

### 1. Database Migrations
```bash
# Option A: Supabase CLI
supabase db push

# Option B: Manual SQL
psql $DATABASE_URL -f supabase/migrations/20251201082000_fix_trip_matching_and_intent_storage.sql
psql $DATABASE_URL -f supabase/migrations/20251201082100_add_recommendation_functions.sql
```

### 2. Edge Functions
```bash
supabase functions deploy wa-webhook
supabase functions deploy wa-webhook-mobility
```

## Quick Test

```sql
-- 1. Check matching works now
SELECT COUNT(*) FROM rides_trips WHERE status = 'open' AND expires_at > now();
-- Should return > 0 after users search

-- 2. Check intents saving
SELECT COUNT(*) FROM mobility_intents WHERE created_at > now() - interval '1 hour';
-- Should increase as users search

-- 3. Test recommendation
SELECT * FROM recommend_drivers_for_user('paste-user-id-here', 5);
-- Should return drivers if user has search history
```

## User-Facing Impact

### Before Fix
❌ Passenger searches → "No drivers found" (even if drivers online)
❌ Driver searches → "No passengers" (even if passengers searching)
❌ System unusable for peer-to-peer discovery

### After Fix
✅ Passenger searches → Sees drivers who went online in last 30 min
✅ Driver searches → Sees passengers who searched in last 30 min
✅ "Go Online" makes drivers discoverable
✅ Recommendations work based on location patterns

## Monitoring

Watch these metrics:
```sql
-- Trip status distribution (should shift to 'open')
SELECT status, COUNT(*) 
FROM rides_trips 
WHERE created_at > now() - interval '1 day'
GROUP BY status;

-- Matching effectiveness
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as trips,
  COUNT(CASE WHEN matched_at IS NOT NULL THEN 1 END) as matched
FROM rides_trips
WHERE created_at > now() - interval '24 hours'
GROUP BY hour
ORDER BY hour DESC;

-- Intent storage growth
SELECT 
  intent_type,
  COUNT(*) as count,
  MAX(created_at) as last_intent
FROM mobility_intents
WHERE created_at > now() - interval '1 day'
GROUP BY intent_type;
```

## Rollback (If Needed)

```bash
# Code rollback
git revert HEAD~3  # Adjust number based on commits
supabase functions deploy wa-webhook
supabase functions deploy wa-webhook-mobility

# Database rollback (CAUTION: loses mobility_intents data)
psql $DATABASE_URL << 'EOF'
BEGIN;
DROP TABLE IF EXISTS mobility_intents CASCADE;
DROP FUNCTION IF EXISTS recommend_drivers_for_user;
DROP FUNCTION IF EXISTS recommend_passengers_for_user;
DROP FUNCTION IF EXISTS find_scheduled_trips_nearby;
COMMIT;
EOF
```

## Files Changed Summary

```
✅ supabase/migrations/20251201082000_*.sql        (NEW)
✅ supabase/migrations/20251201082100_*.sql        (NEW)
✅ supabase/functions/.../nearby.ts                (2 files)
✅ supabase/functions/.../go_online.ts             (1 file)
✅ supabase/functions/.../intent_storage.ts        (NEW)
📄 MOBILITY_MATCHING_FIXES_SUMMARY.md             (Documentation)
```

## Common Questions

**Q: Will old trips still work?**
A: Yes, existing trips unaffected. Only new behavior for future searches.

**Q: What if mobility_intents table doesn't exist?**
A: Code handles gracefully (try/catch). But deploy migration first!

**Q: Do we need to restart anything?**
A: No. Edge functions hot-reload. Database migrations apply immediately.

**Q: What about performance?**
A: Improved! PostGIS indexes on mobility_intents. Fewer expired trips = less DB churn.

## Support

If issues arise:
1. Check migration applied: `SELECT * FROM mobility_intents LIMIT 1;`
2. Verify function updated: Check CloudWatch/Supabase logs for "DRIVER_TRIP_CREATED" events
3. Test matching: Run SQL test queries above
4. Contact: Backend team / DevOps

---
**Status**: ✅ Ready for production deployment
**Priority**: 🔴 CRITICAL - Fixes core discovery functionality
**Risk**: 🟢 LOW - Non-breaking changes, backward compatible
