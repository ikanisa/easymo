# MOBILITY MATCHING ROOT CAUSE ANALYSIS

## Executive Summary
**Users get "No matches found" even when active trips exist in the database.**

## Root Cause
**TABLE MISMATCH between TypeScript code and SQL functions:**

### What's Happening:
1. **TypeScript writes to**: `trips` table (canonical)
   - Location: `supabase/functions/wa-webhook-mobility/rpc/mobility.ts`
   - Lines 88, 126, 211: `.from("trips")`

2. **SQL functions read from**: `mobility_trips` table (V2)
   - Location: `supabase/migrations/20251206090000_fix_mobility_matching_definitive.sql`
   - Lines 99, 141, 240, 281: `FROM public.mobility_trips`

### Result:
- Passenger creates trip → saved to `trips` table
- Driver searches nearby → function queries `mobility_trips` table
- **Zero matches** because tables are different!

## Evidence from Logs
```
{"event":"TRIP_CREATED","payload":{"tripId":"2e258e30-8f58-45ba-a8f3-fbf5ce2416ea",...}}
{"event":"MATCHES_CALL","payload":{"rpc_function":"match_passengers_for_trip_v2",...}}
{"event":"NO_MATCHES_FOUND","payload":{"count":0,"possibleCauses":[...]}}
```

The trip IS created (TRIP_CREATED event), but matching finds nothing (NO_MATCHES_FOUND).

## Secondary Issues Identified

### 1. Inconsistent Column Names
- `trips` table uses: `pickup_latitude`, `pickup_longitude`
- `mobility_trips` uses: `pickup_lat`, `pickup_lng`
- Matching functions expect: `pickup_lat`, `pickup_lng`

### 2. Missing Columns in TypeScript Interface
```typescript
export type MatchResult = {
  number_plate?: string | null;  // Expected by nearby.ts line 194
  // ...but matching function might not return it
}
```

### 3. Location Cache Issues
- Function `getCachedLocation` references `locations_cache` table
- May not exist or have stale data
- 30-minute TTL might be too aggressive

## Solution Strategy

### Option A: Update SQL Functions to Use `trips` Table (RECOMMENDED)
**Pros:**
- Aligns with canonical schema
- TypeScript code already correct
- Single source of truth

**Cons:**
- Need to update matching functions
- Need to handle column name differences

### Option B: Update TypeScript to Use `mobility_trips`
**Pros:**
- Matching functions already correct
- Less SQL changes

**Cons:**
- Against consolidation direction
- Two tables remain in use

### Option C: Data Migration + Consolidation
**Pros:**
- Clean slate
- Remove duplicate tables

**Cons:**
- Risky for production
- Data loss potential

## Recommended Fix

**IMMEDIATE (Deploy Today):**
1. Update matching functions to query `trips` table
2. Handle column name mapping (`pickup_latitude` ↔ `pickup_lat`)
3. Add number_plate to profile metadata extraction
4. Test with real coordinates from logs

**FOLLOW-UP (This Week):**
1. Migrate any orphan data from `mobility_trips` → `trips`
2. Drop `mobility_trips` table
3. Update documentation

## Files to Modify
1. Create new migration: `20251209120000_fix_matching_table_mismatch.sql`
2. Update: `supabase/functions/wa-webhook-mobility/rpc/mobility.ts` (add validation)
3. Test: Run with coordinates from logs (-1.9916, 30.1059)

## Test Case from Logs
- **User**: 35677186193 (masked as ***6193)
- **Location**: -1.9915565252304, 30.105909347534 (Kigali, Rwanda)
- **Search**: Nearby passengers (as driver with cab)
- **Expected**: Should find passengers within 10km
- **Actual**: "No passengers found nearby"

## Success Criteria
1. ✅ Matching functions query correct table
2. ✅ Column names map correctly
3. ✅ Test search returns results (when trips exist)
4. ✅ Log shows MATCHES_RESULT with count > 0
5. ✅ User sees list of nearby drivers/passengers

## Deployment Plan
1. Run diagnostic script to confirm table state
2. Apply fix migration
3. Test locally with Supabase CLI
4. Deploy to staging
5. Monitor logs for MATCHES_RESULT events
6. Deploy to production

---
**Created**: 2025-12-08
**Priority**: P0 - Critical (blocking core feature)
**Status**: Root cause identified, fix ready
