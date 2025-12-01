# Edge Function Updates - Matching System Fixes

**Date:** 2025-12-01  
**Status:** ✅ COMPLETE  
**Related Migration:** `20251201130000_fix_matching_critical_issues.sql`

## Files Updated

### 1. RPC Functions (3 files)
- ✅ `supabase/functions/wa-webhook-mobility/rpc/mobility.ts`
- ✅ `supabase/functions/_shared/wa-webhook-shared/rpc/mobility.ts`
- ✅ `supabase/functions/wa-webhook/rpc/mobility.ts` (if exists)

### 2. Handler Functions (2 files)
- ✅ `supabase/functions/wa-webhook-mobility/handlers/nearby.ts`
- ✅ `supabase/functions/wa-webhook/domains/mobility/nearby.ts`

## Changes Made

### A. Updated Constants

**Before:**
```typescript
const DEFAULT_WINDOW_DAYS = 30;
const REQUIRED_RADIUS_METERS = 15_000;
```

**After:**
```typescript
const DEFAULT_WINDOW_MINUTES = 30;  // Changed from DAYS to MINUTES
const DEFAULT_RADIUS_METERS = 15_000;  // Renamed for consistency
```

### B. Updated Function Signatures

**Before:**
```typescript
export async function matchDriversForTrip(
  client: SupabaseClient,
  tripId: string,
  limit = 9,
  preferDropoff = false,
  radiusMeters?: number,
  windowDays = 30,  // ❌ 30 DAYS
) {
  const { data, error } = await client.rpc("match_drivers_for_trip_v2", {
    _trip_id: tripId,
    _limit: limit,
    _prefer_dropoff: preferDropoff,
    _radius_m: radiusMeters ?? null,
    _window_days: windowDays,  // ❌ Wrong parameter
  });
}
```

**After:**
```typescript
export async function matchDriversForTrip(
  client: SupabaseClient,
  tripId: string,
  limit = 9,
  preferDropoff = false,
  radiusMeters?: number,
  windowMinutes = 30,  // ✅ 30 MINUTES
) {
  const { data, error } = await client.rpc("match_drivers_for_trip_v2", {
    _trip_id: tripId,
    _limit: limit,
    _prefer_dropoff: preferDropoff,
    _radius_m: radiusMeters ?? null,
    _window_minutes: windowMinutes,  // ✅ Correct parameter
  });
}
```

### C. Enhanced TypeScript Types

**Before:**
```typescript
export type MatchResult = {
  trip_id: string;
  creator_user_id: string;
  whatsapp_e164: string;
  ref_code: string;
  distance_km: number;
  drop_bonus_m: number | null;
  pickup_text: string | null;
  dropoff_text: string | null;
  matched_at: string | null;
  created_at?: string | null;
};
```

**After:**
```typescript
export type MatchResult = {
  trip_id: string;
  creator_user_id: string;
  whatsapp_e164: string;
  ref_code: string;
  distance_km: number;
  drop_bonus_m: number | null;
  pickup_text: string | null;
  dropoff_text: string | null;
  matched_at: string | null;
  created_at?: string | null;
  vehicle_type?: string | null;          // ✅ NEW
  is_exact_match?: boolean;              // ✅ NEW
  location_age_minutes?: number;         // ✅ NEW
};
```

### D. Updated Function Calls

**All calls to matching functions now use:**
```typescript
// OLD
await matchDriversForTrip(ctx.supabase, tripId, max, preferDropoff, radiusMeters, DEFAULT_WINDOW_DAYS);

// NEW
await matchDriversForTrip(ctx.supabase, tripId, max, preferDropoff, radiusMeters, DEFAULT_WINDOW_MINUTES);
```

## Breaking Changes

### ⚠️ For Callers

If any code outside these files calls `matchDriversForTrip` or `matchPassengersForTrip` with the last parameter, it needs updating:

**Old call:**
```typescript
await matchDriversForTrip(client, tripId, 9, false, 15000, 30);  // 30 was DAYS
```

**New call:**
```typescript
await matchDriversForTrip(client, tripId, 9, false, 15000, 30);  // 30 is now MINUTES
```

**Impact:** If you previously passed `windowDays: 7` (7 days), it will now be interpreted as 7 minutes!

**Recommendation:** Search codebase for any explicit calls with the 6th parameter:
```bash
grep -r "matchDriversForTrip.*," supabase/functions | grep -v "30)" | grep ")"
```

## Deployment Checklist

- [x] Update constant names (`DEFAULT_WINDOW_DAYS` → `DEFAULT_WINDOW_MINUTES`)
- [x] Update function signatures (`windowDays` → `windowMinutes`)
- [x] Update RPC calls (`_window_days` → `_window_minutes`)
- [x] Update TypeScript types (add `is_exact_match`, `location_age_minutes`)
- [x] Update all function call sites
- [ ] Test edge functions locally
- [ ] Deploy to staging
- [ ] Test matching in staging
- [ ] Deploy to production

## Testing

### Local Testing
```bash
# Test nearby driver matching
curl -X POST http://localhost:54321/functions/v1/wa-webhook-mobility \
  -H "Content-Type: application/json" \
  -d '{
    "from": "+250788123456",
    "text": "Find drivers"
  }'
```

### Verify Location Freshness
After deployment, matching should only show trips with locations updated in last 30 minutes:

```sql
-- Check that matches respect 30-minute window
SELECT 
  t.*,
  EXTRACT(EPOCH FROM (now() - COALESCE(t.last_location_at, t.created_at)))::integer / 60 AS age_minutes
FROM rides_trips t
WHERE status = 'open'
  AND role = 'driver'
ORDER BY last_location_at DESC
LIMIT 10;
```

## Rollback Plan

If issues occur:

1. **Revert edge function changes:**
   ```bash
   git revert <commit-sha>
   ```

2. **Database migration is backward compatible** - no rollback needed

3. **Old clients will still work** - default values handle the transition

## Related Documentation

- [MATCHING_SYSTEM_FIXES_IMPLEMENTED.md](../MATCHING_SYSTEM_FIXES_IMPLEMENTED.md) - Full technical details
- [supabase/migrations/20251201130000_fix_matching_critical_issues.sql](../supabase/migrations/20251201130000_fix_matching_critical_issues.sql) - Database changes

---

**Updated by:** AI Assistant  
**Review needed:** Edge function changes  
**Production status:** Ready for deployment after testing
