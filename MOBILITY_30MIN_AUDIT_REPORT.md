# Mobility 30-Minute Location Caching - Comprehensive Audit Report

**Date**: 2025-12-12  
**Status**: 🔴 **ISSUES IDENTIFIED - FIXES REQUIRED**

---

## Executive Summary

A thorough review of the 30-minute location caching implementation revealed **critical inconsistencies** between different layers of the system. While the database migration correctly implements 30-minute windows, the TypeScript configuration and location caching logic use **60-minute TTL**, creating a mismatch that undermines the real-time matching feature.

---

## Issues Identified

### 🔴 CRITICAL: Issue #1 - Location Cache TTL Mismatch

**Location**: `supabase/functions/_shared/location-config.ts`

**Problem**:
```typescript
// WRONG: Cache TTL is 60 minutes, but matching window is 30 minutes
FRESH_LOCATION_THRESHOLD_MINUTES: 60,  // Changed from 30 to 60
CACHE_TTL_MINUTES: 60,                  // Changed from 30 to 60
TRIP_EXPIRY_MINUTES: 30,                // ✅ Correct
```

**Impact**:
- Users' cached locations remain valid for 60 minutes
- Trips only match within 30-minute window
- Result: Stale locations (31-60 min old) are used for matching, leading to:
  - Inaccurate distance calculations
  - Matches with users who moved away
  - Poor user experience (finding drivers/passengers who are no longer nearby)

**Root Cause**: Someone changed the location cache TTL from 30 to 60 minutes without updating the matching logic, or vice versa.

**Evidence**:
```typescript
// location-config.ts line 17-18
FRESH_LOCATION_THRESHOLD_MINUTES: 60,  // Changed from 30 to 60
CACHE_TTL_MINUTES: 60, // Changed from 30 to 60

// mobility.ts line 25 (correct)
TRIP_EXPIRY_MINUTES: 30,

// mobility.ts line 27 (correct)
TRIP_MATCHING_WINDOW_MINUTES: 30,
```

---

### 🟡 MODERATE: Issue #2 - Inconsistent Configuration Sources

**Problem**: Multiple configuration files with overlapping constants:

1. `supabase/functions/_shared/location-config.ts` (60 min)
2. `supabase/functions/_shared/wa-webhook-shared/config/mobility.ts` (30 min)
3. `packages/location/src/index.ts` (90 min - legacy?)

**Impact**:
- Confusion about which config to use
- Different handlers may use different values
- Hard to maintain consistency

**Example**:
```typescript
// location-config.ts
TRIP_EXPIRY_MINUTES: 30,  // ✅ Correct

// packages/location/src/index.ts (line 50)
TRIP_EXPIRY_MINUTES: 90,  // ❌ WRONG - Legacy value!
```

---

### 🟡 MODERATE: Issue #3 - No RPC Functions for Location Cache

**Problem**: TypeScript code references RPC functions that don't exist in migrations:
- `update_user_location_cache` - **DELETED** in migration `20251209190200_fix_location_cache_duplicate.sql`
- `get_cached_location` - **NOT FOUND** in any migration

**Location**: 
- `supabase/functions/wa-webhook-mobility/locations/cache.ts:24` (calls `update_user_location_cache`)
- `supabase/functions/wa-webhook-mobility/locations/cache.ts:44` (calls `get_cached_location`)

**Impact**:
- Location caching will **fail silently** at runtime
- Users forced to share location every time (no caching benefit)
- Increased location prompt fatigue

**Evidence**:
```sql
-- Migration 20251209190200_fix_location_cache_duplicate.sql
DROP FUNCTION IF EXISTS public.update_user_location_cache(...);
-- No CREATE statement follows!
```

```typescript
// cache.ts line 24-28
const { error } = await client.rpc("update_user_location_cache", {
  _user_id: userId,
  _lat: coords.lat,
  _lng: coords.lng,
});
// This will FAIL - function doesn't exist!
```

---

### 🟢 LOW: Issue #4 - Missing Window Parameter in Handler Calls

**Problem**: Some handler calls don't pass `windowMinutes` parameter explicitly, relying on default.

**Location**: `supabase/functions/wa-webhook-mobility/handlers/nearby.ts:966-980`

**Code**:
```typescript
const matches: MatchResult[] = state.mode === "drivers"
  ? await matchDriversForTrip(
    ctx.supabase,
    tempTripId,
    max,
    Boolean(dropoff),
    radiusMeters,
    // ❌ No windowMinutes parameter passed - relies on SQL default (30)
  )
  : await matchPassengersForTrip(
    ctx.supabase,
    tempTripId,
    max,
    false,
    radiusMeters,
    // ❌ No windowMinutes parameter passed - relies on SQL default (30)
  );
```

**Impact**: Low - SQL function defaults to 30 minutes anyway, but explicit is better than implicit.

---

### 🟢 LOW: Issue #5 - Hardcoded Logging Values

**Problem**: Logging still references old expiry time.

**Location**: `supabase/functions/wa-webhook-mobility/handlers/nearby.ts:914`

```typescript
await logStructuredEvent("TRIP_CREATED", {
  // ...
  expiresIn: "90 min",  // ❌ WRONG - Should be "30 min"
});
```

**Impact**: Misleading logs/metrics, makes debugging harder.

---

## Database Layer ✅ CORRECT

The SQL migration `20251211083000_fix_mobility_30min_window.sql` is **correctly implemented**:

```sql
-- ✅ Function signature uses _window_minutes (default 30)
CREATE OR REPLACE FUNCTION public.match_drivers_for_trip_v2(
  _trip_id uuid,
  _limit integer DEFAULT 9,
  _prefer_dropoff boolean DEFAULT false,
  _radius_m integer DEFAULT 10000,
  _window_minutes integer DEFAULT 30  -- ✅ CORRECT
)

-- ✅ Location freshness check uses window_minutes
AND t.updated_at > now() - (v_window_minutes || ' minutes')::interval

-- ✅ Trip creation window uses window_minutes
AND t.created_at >= now() - (v_window_minutes || ' minutes')::interval
```

**Verdict**: Database layer is **production-ready** ✅

---

## WhatsApp Workflow ⚠️ NEEDS FIXES

The WhatsApp handlers have the right structure but suffer from configuration mismatches:

### ✅ Good Implementations:

1. **Trip Creation**: `insertTrip()` correctly uses 30-minute expiry
2. **Match Result Validation**: Line 491-507 verifies trips still exist before showing to user (EXCELLENT!)
3. **Driver Notifications**: Properly rate-limited and respects quiet hours
4. **Logging**: Comprehensive structured logging for debugging

### ⚠️ Issues:

1. **Location Cache TTL**: Uses 60 min instead of 30 min
2. **Missing RPC Functions**: Location cache functions don't exist in DB
3. **No Explicit Window Parameter**: Relies on SQL defaults

---

## Configuration Alignment

| Component | Current Value | Should Be | Status |
|-----------|--------------|-----------|--------|
| **Database** (`match_*_v2` default) | 30 min | 30 min | ✅ |
| **TypeScript** (`TRIP_EXPIRY_MINUTES`) | 30 min | 30 min | ✅ |
| **TypeScript** (`TRIP_MATCHING_WINDOW_MINUTES`) | 30 min | 30 min | ✅ |
| **Location Cache** (`CACHE_TTL_MINUTES`) | **60 min** | 30 min | ❌ |
| **Location Cache** (`FRESH_LOCATION_THRESHOLD_MINUTES`) | **60 min** | 30 min | ❌ |
| **Legacy Package** (`packages/location`) | **90 min** | 30 min | ❌ |

---

## Required Fixes

### Fix #1: Align Location Cache TTL (CRITICAL)

**File**: `supabase/functions/_shared/location-config.ts`

```typescript
// BEFORE (WRONG):
FRESH_LOCATION_THRESHOLD_MINUTES: 60,  // Changed from 30 to 60
CACHE_TTL_MINUTES: 60, // Changed from 30 to 60

// AFTER (CORRECT):
FRESH_LOCATION_THRESHOLD_MINUTES: 30,  // Match mobility window
CACHE_TTL_MINUTES: 30, // Match mobility window
```

**Rationale**: Location cache must match trip matching window to ensure accurate real-time matching.

---

### Fix #2: Create Missing RPC Functions (CRITICAL)

**File**: New migration `supabase/migrations/20251212_create_location_cache_rpcs.sql`

```sql
-- Create missing location cache RPC functions
BEGIN;

-- Function to update user's cached location
CREATE OR REPLACE FUNCTION public.update_user_location_cache(
  _user_id uuid,
  _lat double precision,
  _lng double precision
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Upsert to recent_locations table
  INSERT INTO public.recent_locations (user_id, lat, lng, captured_at, source)
  VALUES (_user_id, _lat, _lng, now(), 'user_input')
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    captured_at = EXCLUDED.captured_at,
    updated_at = now();
END;
$$;

-- Function to get cached location if still valid
CREATE OR REPLACE FUNCTION public.get_cached_location(
  _user_id uuid,
  _cache_minutes integer DEFAULT 30
)
RETURNS TABLE (
  lat double precision,
  lng double precision,
  cached_at timestamptz,
  is_valid boolean
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rl.lat,
    rl.lng,
    rl.captured_at as cached_at,
    (rl.captured_at > now() - (_cache_minutes || ' minutes')::interval) as is_valid
  FROM public.recent_locations rl
  WHERE rl.user_id = _user_id
  ORDER BY rl.captured_at DESC
  LIMIT 1;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.update_user_location_cache TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.get_cached_location TO service_role, authenticated, anon;

COMMIT;
```

---

### Fix #3: Update Legacy Package Config (LOW PRIORITY)

**File**: `packages/location/src/index.ts:50`

```typescript
// BEFORE (WRONG):
TRIP_EXPIRY_MINUTES: 90,

// AFTER (CORRECT):
TRIP_EXPIRY_MINUTES: 30,
```

**Note**: This package appears to be legacy/unused. Consider removing if not actively used.

---

### Fix #4: Pass Window Parameter Explicitly (BEST PRACTICE)

**File**: `supabase/functions/wa-webhook-mobility/handlers/nearby.ts:964-980`

```typescript
// BEFORE (implicit):
const matches: MatchResult[] = state.mode === "drivers"
  ? await matchDriversForTrip(
    ctx.supabase,
    tempTripId,
    max,
    Boolean(dropoff),
    radiusMeters,
  )
  : ...

// AFTER (explicit):
const TRIP_MATCHING_WINDOW_MINUTES = MOBILITY_CONFIG.TRIP_MATCHING_WINDOW_MINUTES;
const matches: MatchResult[] = state.mode === "drivers"
  ? await matchDriversForTrip(
    ctx.supabase,
    tempTripId,
    max,
    Boolean(dropoff),
    radiusMeters,
    TRIP_MATCHING_WINDOW_MINUTES,  // ✅ Explicit parameter
  )
  : await matchPassengersForTrip(
    ctx.supabase,
    tempTripId,
    max,
    false,
    radiusMeters,
    TRIP_MATCHING_WINDOW_MINUTES,  // ✅ Explicit parameter
  );
```

---

### Fix #5: Update Log Messages

**File**: `supabase/functions/wa-webhook-mobility/handlers/nearby.ts:914`

```typescript
// BEFORE (WRONG):
await logStructuredEvent("TRIP_CREATED", {
  // ...
  expiresIn: "90 min",
});

// AFTER (CORRECT):
await logStructuredEvent("TRIP_CREATED", {
  // ...
  expiresIn: "30 min",
  windowMinutes: MOBILITY_CONFIG.TRIP_MATCHING_WINDOW_MINUTES,
});
```

---

## Testing Recommendations

### 1. Unit Tests (SQL)

```sql
-- Test: Fresh location (< 30 min) should be cached and valid
INSERT INTO recent_locations (user_id, lat, lng, captured_at, source)
VALUES ('test-user-1', -1.9441, 30.0619, now() - interval '15 minutes', 'test');

SELECT * FROM get_cached_location('test-user-1', 30);
-- Expected: is_valid = true

-- Test: Stale location (> 30 min) should be invalid
UPDATE recent_locations 
SET captured_at = now() - interval '35 minutes'
WHERE user_id = 'test-user-1';

SELECT * FROM get_cached_location('test-user-1', 30);
-- Expected: is_valid = false
```

### 2. Integration Tests

```bash
# Test cache behavior in TypeScript
cd supabase/functions/wa-webhook-mobility
deno test --allow-all locations/cache.test.ts

# Expected: 
# - getCachedLocation returns null after 30 minutes
# - saveLocationToCache successfully stores coordinates
```

### 3. End-to-End Test

1. User A shares location at 10:00 AM
2. Check cache at 10:15 AM → Should be valid ✅
3. Check cache at 10:31 AM → Should be invalid ❌
4. User B creates trip and searches at 10:32 AM
5. Should NOT match User A (location expired)

---

## Deployment Plan

### Phase 1: Database (Zero Downtime)

```bash
# Apply missing RPC functions
supabase db push

# Verify functions exist
supabase db execute "SELECT * FROM pg_proc WHERE proname LIKE '%location_cache%'"
```

### Phase 2: Configuration (Zero Downtime)

```bash
# Update location-config.ts
git add supabase/functions/_shared/location-config.ts

# Update legacy package (if used)
git add packages/location/src/index.ts

git commit -m "fix(mobility): align location cache TTL to 30 minutes"
```

### Phase 3: Code Improvements (Zero Downtime)

```bash
# Update handlers to pass window explicitly
git add supabase/functions/wa-webhook-mobility/handlers/nearby.ts
git add supabase/functions/wa-webhook-mobility/handlers/schedule/booking.ts

git commit -m "fix(mobility): pass window minutes explicitly, update logs"
```

### Phase 4: Deploy

```bash
# Build and deploy edge functions
pnpm build
supabase functions deploy wa-webhook-mobility
supabase functions deploy wa-webhook
```

### Phase 5: Monitor

```sql
-- Monitor cache effectiveness (should be ~50% hit rate)
SELECT 
  COUNT(*) FILTER (WHERE captured_at > now() - interval '30 minutes') as valid_caches,
  COUNT(*) FILTER (WHERE captured_at <= now() - interval '30 minutes') as expired_caches,
  ROUND(
    COUNT(*) FILTER (WHERE captured_at > now() - interval '30 minutes')::numeric / 
    NULLIF(COUNT(*), 0) * 100, 
    2
  ) as cache_hit_rate_percent
FROM recent_locations
WHERE captured_at > now() - interval '2 hours';
```

---

## Risk Assessment

| Fix | Risk Level | Impact | Effort |
|-----|-----------|--------|--------|
| Fix #1 (Cache TTL) | 🟢 Low | High (improves accuracy) | 5 min |
| Fix #2 (RPC Functions) | 🟡 Medium | Critical (enables caching) | 30 min |
| Fix #3 (Legacy Package) | 🟢 Low | Low (likely unused) | 5 min |
| Fix #4 (Explicit Params) | 🟢 Low | Low (best practice) | 10 min |
| Fix #5 (Logs) | 🟢 Low | Low (better debugging) | 5 min |

**Overall Risk**: 🟢 **LOW** - All changes are additive or corrective, with clear rollback paths.

---

## Success Metrics

After deployment, monitor for 24 hours:

1. **Cache Hit Rate**: 40-60% (users reusing location within 30 min)
2. **Match Quality**: Distance accuracy improves (no matches with stale locations)
3. **Error Rate**: Zero "RPC function not found" errors
4. **User Experience**: Fewer location prompts for repeat searches

---

## Conclusion

The 30-minute location caching feature is **partially implemented** but suffers from:
1. ❌ **Configuration mismatches** (60 min cache vs 30 min window)
2. ❌ **Missing database functions** (cache RPCs don't exist)
3. ⚠️ **Legacy code drift** (old package still has 90 min config)

**Recommendation**: Apply all 5 fixes before considering this feature production-ready.

**Estimated Total Effort**: 1 hour (including testing)

**Deployment Impact**: Zero downtime, backward compatible

---

**Prepared by**: AI Assistant (Copilot)  
**Review Date**: 2025-12-12  
**Next Review**: After fixes applied  
**Status**: 🔴 REQUIRES IMMEDIATE ACTION
