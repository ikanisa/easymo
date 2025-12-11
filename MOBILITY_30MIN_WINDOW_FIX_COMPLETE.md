# Mobility 30-Minute Window Fix - COMPLETE ✅

**Date**: 2025-12-11  
**Status**: ✅ **IMPLEMENTED - READY FOR TESTING**

---

## Summary

Successfully fixed mobility matching to use **30-minute time window** instead of 48-hour (2-day) window, and reduced trip expiry from 90 minutes to 30 minutes.

---

## Changes Made

### 1. Configuration Updates ✅

**File**: `supabase/functions/_shared/wa-webhook-shared/config/mobility.ts`

```typescript
// BEFORE (WRONG):
TRIP_EXPIRY_MINUTES: 90,
SQL_LOCATION_FRESHNESS_HOURS: 24,
DEFAULT_WINDOW_DAYS: 2,

// AFTER (FIXED):
TRIP_EXPIRY_MINUTES: 30,
TRIP_MATCHING_WINDOW_MINUTES: 30,
// Removed: DEFAULT_WINDOW_DAYS
```

**File**: `supabase/functions/_shared/location-config.ts`
```typescript
// BEFORE: TRIP_EXPIRY_MINUTES: 90
// AFTER:  TRIP_EXPIRY_MINUTES: 30
```

**File**: `supabase/functions/wa-webhook-mobility/rpc/mobility.ts`
```typescript
// BEFORE: const DEFAULT_TRIP_EXPIRY_MINUTES = 90;
// AFTER:  const DEFAULT_TRIP_EXPIRY_MINUTES = 30;
```

### 2. RPC Function Signature Changes ✅

Updated all `matchDriversForTrip` and `matchPassengersForTrip` functions:

**Files Updated**:
- `supabase/functions/_shared/wa-webhook-shared/rpc/mobility.ts`
- `supabase/functions/wa-webhook/rpc/mobility.ts`
- `supabase/functions/wa-webhook-mobility/rpc/mobility.ts`

```typescript
// BEFORE:
windowDays = 2  // 48-hour window
_window_days: windowDays

// AFTER:
windowMinutes = 30  // 30-minute window
_window_minutes: windowMinutes
```

### 3. Handler Call Updates ✅

Updated all handler files to use new window parameter:

**Files Updated**:
- `supabase/functions/wa-webhook-mobility/handlers/nearby.ts`
- `supabase/functions/wa-webhook/domains/mobility/nearby.ts`
- `supabase/functions/wa-webhook/domains/mobility/schedule.ts`
- `supabase/functions/wa-webhook-mobility/handlers/schedule/booking.ts`

```typescript
// BEFORE:
const DEFAULT_WINDOW_DAYS = MOBILITY_CONFIG.DEFAULT_WINDOW_DAYS;
await matchDriversForTrip(client, tripId, limit, preferDropoff, radiusMeters, DEFAULT_WINDOW_DAYS);

// AFTER:
const TRIP_MATCHING_WINDOW_MINUTES = MOBILITY_CONFIG.TRIP_MATCHING_WINDOW_MINUTES;
await matchDriversForTrip(client, tripId, limit, preferDropoff, radiusMeters, TRIP_MATCHING_WINDOW_MINUTES);
```

### 4. Database Migration ✅

**New Migration**: `supabase/migrations/20251211083000_fix_mobility_30min_window.sql`

**Changes**:
- Function signature: `_window_days integer` → `_window_minutes integer`
- Default value: `DEFAULT 2` → `DEFAULT 30`
- Location freshness: `interval '24 hours'` → `interval '30 minutes'`
- Trip window: `interval '1 day' * _window_days` → `interval '30 minutes'`

**SQL Filters Updated**:
```sql
-- BEFORE:
AND t.updated_at > now() - interval '24 hours'
AND t.created_at >= NOW() - (INTERVAL '1 day' * _window_days)

-- AFTER:
AND t.updated_at > now() - (v_window_minutes || ' minutes')::interval
AND t.created_at >= now() - (v_window_minutes || ' minutes')::interval
```

---

## Impact Analysis

### ✅ Benefits

1. **Accurate Real-Time Matching**
   - Only fresh trips (< 30 min) shown in results
   - Users see truly active trips, not stale ones

2. **Faster Queries**
   - Smaller dataset to scan (30 min vs. 48 hours)
   - Better database performance

3. **Consistent User Experience**
   - Matches user expectation of "30-minute window"
   - No confusion about trip freshness

4. **Reduced Database Load**
   - Fewer trips to index and query
   - Auto-expiry at 30 minutes reduces storage

### ⚠️ Potential Concerns

1. **Fewer Matches Initially**
   - Smaller time window = fewer available trips
   - Expected and intentional (higher quality matches)

2. **User Adoption**
   - Users need to understand 30-minute urgency
   - May need to search multiple times

3. **Scheduled Trips**
   - Still use 7-day expiry (unchanged)
   - Only affects intent-based "nearby" trips

---

## Verification Checklist

- [x] Updated MOBILITY_CONFIG (30 min)
- [x] Removed DEFAULT_WINDOW_DAYS
- [x] Updated all RPC function signatures
- [x] Updated all handler calls
- [x] Created SQL migration
- [x] Updated trip expiry to 30 minutes
- [x] Updated location-config.ts
- [x] Verified no remaining _window_days references
- [x] Verified no remaining 90-minute expiry
- [x] Updated logging messages (24h → 30min)

---

## Testing Plan

### 1. Unit Tests (SQL)

```sql
-- Test 1: Fresh trip should match (within 30 min)
INSERT INTO trips (user_id, role, vehicle_type, pickup_lat, pickup_lng, status, expires_at, created_at, updated_at)
VALUES ('test-user-1', 'driver', 'moto', -1.9441, 30.0619, 'open', now() + interval '30 minutes', now(), now());

-- Create passenger trip and search
INSERT INTO trips (user_id, role, vehicle_type, pickup_lat, pickup_lng, status, expires_at, created_at, updated_at)
VALUES ('test-user-2', 'passenger', 'moto', -1.9450, 30.0620, 'open', now() + interval '30 minutes', now(), now())
RETURNING id;

-- Should return 1 match (the driver)
SELECT * FROM match_drivers_for_trip_v2('[TRIP_ID]'::uuid, 9, false, 10000, 30);

-- Test 2: Stale trip should NOT match (> 30 min old)
UPDATE trips SET created_at = now() - interval '35 minutes', updated_at = now() - interval '35 minutes'
WHERE user_id = 'test-user-1';

-- Should return 0 matches
SELECT * FROM match_drivers_for_trip_v2('[TRIP_ID]'::uuid, 9, false, 10000, 30);
```

### 2. Integration Tests (API)

```bash
# Test 1: Create trip via API
curl -X POST https://api.easymo.rw/mobility/trips \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"role":"driver","vehicle_type":"moto","lat":-1.9441,"lng":30.0619}'

# Test 2: Search for matches immediately (should find it)
curl -X POST https://api.easymo.rw/mobility/search \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"role":"passenger","vehicle_type":"moto","lat":-1.9450,"lng":30.0620}'

# Test 3: Wait 31 minutes and search again (should NOT find it)
sleep 1860  # 31 minutes
curl -X POST https://api.easymo.rw/mobility/search \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"role":"passenger","vehicle_type":"moto","lat":-1.9450,"lng":30.0620}'
```

### 3. User Acceptance Testing

**Scenario 1**: Fresh Match
1. User A (driver) posts availability at 10:00 AM
2. User B (passenger) searches at 10:05 AM
3. **Expected**: User B sees User A in results

**Scenario 2**: Expired Trip
1. User A (driver) posts availability at 10:00 AM
2. User B (passenger) searches at 10:32 AM
3. **Expected**: User B does NOT see User A (expired)

**Scenario 3**: Bidirectional Discovery
1. User A (passenger) searches at 10:00 AM (creates trip)
2. User B (driver) searches at 10:05 AM
3. **Expected**: User B sees User A's trip

---

## Rollback Plan

If issues arise, revert in this order:

### 1. Revert SQL Migration
```sql
-- Run the old migration (20251208192000_fix_mobility_matching_column_names.sql)
-- This restores _window_days parameter with default 2
```

### 2. Revert TypeScript Changes
```bash
git revert <commit-hash>  # Revert config and RPC changes
```

### 3. Redeploy
```bash
pnpm build
# Deploy edge functions
supabase functions deploy
```

---

## Deployment Steps

### 1. Deploy SQL Migration
```bash
# Push migration to Supabase
supabase db push

# Verify functions updated
supabase db functions list | grep match_drivers
```

### 2. Deploy Edge Functions
```bash
# Build all functions
pnpm build

# Deploy mobility webhook
supabase functions deploy wa-webhook-mobility

# Deploy main webhook
supabase functions deploy wa-webhook
```

### 3. Monitor Logs
```bash
# Watch for errors
supabase functions logs wa-webhook-mobility --tail

# Check for NO_MATCHES_FOUND events
grep "NO_MATCHES_FOUND" logs/ | tail -20
```

---

## Monitoring Metrics

After deployment, monitor:

1. **Match Rate**
   - Count of `MATCHES_RESULT` events
   - Average matches per search
   - Target: 3-5 matches per search

2. **No Matches Rate**
   - Count of `NO_MATCHES_FOUND` events
   - Should decrease as network grows
   - Target: < 30% of searches

3. **Trip Creation Rate**
   - New trips per hour
   - Should remain steady or increase

4. **Query Performance**
   - `match_*_v2` function latency
   - Target: < 500ms per query

5. **User Engagement**
   - Searches per user per day
   - Repeat searches (may increase due to 30-min window)

---

## Documentation Updates

Updated:
- [x] MOBILITY_MATCHING_DEEP_REVIEW.md (original analysis)
- [x] This file (MOBILITY_30MIN_WINDOW_FIX_COMPLETE.md)

To Update:
- [ ] API documentation (mention 30-minute window)
- [ ] User-facing help text (explain real-time matching)
- [ ] Admin dashboard (add metrics for 30-min window)

---

## Next Steps

1. **Immediate** (Today)
   - [ ] Review this document with team
   - [ ] Deploy to staging environment
   - [ ] Run integration tests
   - [ ] Monitor logs for errors

2. **Short-term** (This week)
   - [ ] Deploy to production (off-peak hours)
   - [ ] Monitor metrics for 48 hours
   - [ ] Collect user feedback
   - [ ] Adjust if needed

3. **Long-term** (Next sprint)
   - [ ] Add UI indicator for trip freshness (e.g., "Posted 5 min ago")
   - [ ] Consider push notifications for nearby matches
   - [ ] Implement "extend trip" feature (refresh 30-min window)
   - [ ] Add analytics dashboard for match quality

---

## Success Criteria

✅ **Fix is successful if:**

1. Fresh trips (< 30 min) appear in search results
2. Stale trips (> 30 min) do NOT appear in search results
3. Query performance remains < 500ms
4. No increase in error rates
5. User feedback is positive or neutral

❌ **Rollback if:**

1. Match rate drops below 1 per search
2. Error rate increases > 5%
3. Query performance > 1 second
4. User complaints increase significantly

---

## Conclusion

The 30-minute window fix is **complete and ready for deployment**. All code changes, SQL migrations, and configurations have been updated. The system now enforces real-time matching with a 30-minute freshness guarantee.

**Risk Level**: 🟢 **Low**
- SQL functions are STABLE (can be replaced without downtime)
- Backward compatible (old trips expire naturally)
- Easy rollback (single migration revert)

**Estimated Effort**: 
- Implementation: ✅ Complete (3 hours)
- Testing: ⏳ Pending (1 hour)
- Deployment: ⏳ Pending (30 minutes)

---

**Prepared by**: AI Assistant  
**Reviewed by**: _(Pending)_  
**Approved by**: _(Pending)_  
**Deployed on**: _(Pending)_
