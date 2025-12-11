# Mobility Matching Deep Review & Analysis
**Date**: 2025-12-11  
**Status**: ✅ CRITICAL ISSUES IDENTIFIED - FIXES REQUIRED

---

## Executive Summary

### 🔴 CRITICAL ISSUES FOUND

1. **30-Minute Window NOT Implemented** - Trips use 48-hour window instead of 30 minutes
2. **Open Trips May Not Appear** - Multiple filtering conditions can hide valid trips
3. **Trip Expiry at 90 Minutes** - Conflicts with user expectation of 30-minute window

### Impact
- Users searching for rides/passengers may NOT see trips created within last 30 minutes
- "No matches found" shown even when open trips exist
- Time windows are inconsistent across the system

---

## 1. Time Windows Analysis

### Current Implementation (WRONG ❌)

| Component | Current Value | Expected Value | Issue |
|-----------|--------------|----------------|-------|
| Trip Expiry | **90 minutes** | 30 minutes | Trips live too long |
| Matching Window | **48 hours (2 days)** | 30 minutes | Searches too old trips |
| Location Freshness (SQL) | **24 hours** | 30 minutes | Stale locations matched |
| Location Cache (Client) | 30 minutes | 30 minutes | ✅ Correct |
| Recent Search | 30 minutes | 30 minutes | ✅ Correct |

### Code Evidence

**File**: `supabase/functions/_shared/wa-webhook-shared/config/mobility.ts`
```typescript
export const MOBILITY_CONFIG = {
  TRIP_EXPIRY_MINUTES: 90,              // ❌ Should be 30
  DEFAULT_WINDOW_DAYS: 2,               // ❌ Should be 30 minutes (not 2 days!)
  SQL_LOCATION_FRESHNESS_HOURS: 24,     // ❌ Should be 30 minutes (0.5 hours)
  LOCATION_FRESHNESS_MINUTES: 30,       // ✅ Correct
  RECENT_SEARCH_WINDOW_MINUTES: 30,     // ✅ Correct
}
```

**File**: `supabase/functions/wa-webhook-mobility/rpc/mobility.ts`
```typescript
const TRIP_EXPIRY_MINUTES = 90;  // ❌ Should be 30
```

**File**: `supabase/migrations/20251208192000_fix_mobility_matching_column_names.sql`
```sql
-- Line 155: Location age check
AND t.updated_at > now() - interval '24 hours'  -- ❌ Should be 30 minutes

-- Line 157: Window check
AND t.created_at >= NOW() - (INTERVAL '1 day' * _window_days)  -- ❌ Uses 2 days default
```

---

## 2. Trip Status & Filtering Analysis

### SQL Matching Functions

**Functions**: `match_drivers_for_trip_v2` and `match_passengers_for_trip_v2`

#### Current Filters (from migration `20251208192000`)

```sql
WHERE t.role = 'driver'              -- ✅ Correct: Only match drivers for passenger search
  AND t.status = 'open'              -- ✅ Correct: Only open trips
  AND (t.expires_at IS NULL OR t.expires_at > now())  -- ✅ Correct: Not expired
  AND t.pickup_lat IS NOT NULL       -- ✅ Correct: Has location
  AND t.pickup_lng IS NOT NULL
  AND t.updated_at > now() - interval '24 hours'      -- ❌ TOO LONG (should be 30 min)
  AND t.created_at >= NOW() - (INTERVAL '1 day' * _window_days)  -- ❌ TOO LONG (2 days)
  AND t.id != _trip_id               -- ✅ Correct: Exclude self
  AND (distance <= radius)           -- ✅ Correct: Within radius
```

### Why Open Trips Don't Appear

**Scenario**: User creates trip at 10:00 AM, another user searches at 10:15 AM

#### Issues:
1. ❌ If trip.updated_at not updated within 24 hours (unlikely but possible if bug)
2. ❌ If _window_days set to 0 (would exclude trips from today)
3. ✅ status='open' check is correct
4. ✅ expires_at check is correct
5. ❌ **MAIN ISSUE**: Window is 48 hours instead of 30 minutes

#### Fix Required:
```sql
-- BEFORE (WRONG):
AND t.updated_at > now() - interval '24 hours'
AND t.created_at >= NOW() - (INTERVAL '1 day' * _window_days)

-- AFTER (CORRECT):
AND t.updated_at > now() - interval '30 minutes'
AND t.created_at >= NOW() - interval '30 minutes'
```

---

## 3. Trip Lifecycle Flow

### Current Flow

```
1. User opens "Find Drivers/Passengers"
   ↓
2. Selects vehicle type (moto, cab, etc.)
   ↓
3. Shares location (lat, lng)
   ↓
4. insertTrip() creates trip:
   - status: 'open'
   - role: 'passenger' (if finding drivers) or 'driver' (if finding passengers)
   - expires_at: now() + 90 minutes  ❌ Should be 30 minutes
   ↓
5. matchDriversForTrip() or matchPassengersForTrip() called
   - Queries trips table
   - Filters by: status='open', role, location, time windows
   - Returns top 9 matches
   ↓
6. Results shown to user
   ↓
7. Trip stays 'open' until:
   - expires_at reached (90 min) ❌ Should be 30 min
   - User manually closes
   - Match completed
```

### CRITICAL: Trip NOT Expired Immediately

**File**: `supabase/functions/wa-webhook-mobility/handlers/nearby.ts` (Lines 1174-1182)

```typescript
} finally {
  // CRITICAL FIX: Don't expire the trip immediately!
  // The trip should remain 'open' so it can be discovered by other users.
  // It will auto-expire via the expires_at column (default 30 min).
  // Benefits:
  // - Passenger trips stay visible when drivers search
  // - Driver trips stay visible when passengers search
  // - Enables true peer-to-peer discovery
}
```

✅ **This is CORRECT** - Trips must stay open for peer-to-peer matching!

---

## 4. Database Schema Review

### Trips Table Structure

**Note**: No explicit CREATE TABLE in recent migrations. Schema appears to be managed separately or through older migrations.

**Inferred from matching functions**:
```sql
CREATE TABLE trips (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(user_id),
  role text NOT NULL CHECK (role IN ('driver', 'passenger')),
  vehicle_type text NOT NULL,
  kind text,  -- 'request_intent' or 'scheduled'
  status text NOT NULL CHECK (status IN ('open', 'matched', 'completed', 'cancelled')),
  
  -- Pickup
  pickup_lat double precision NOT NULL,
  pickup_lng double precision NOT NULL,
  pickup_geog geography(Point, 4326) GENERATED,
  pickup_text text,
  
  -- Dropoff (optional)
  dropoff_lat double precision,
  dropoff_lng double precision,
  dropoff_geog geography(Point, 4326) GENERATED,
  dropoff_text text,
  dropoff_radius_m integer,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  expires_at timestamptz,  -- Default: now() + 90 minutes
  scheduled_for timestamptz,
  
  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Indexes
CREATE INDEX idx_trips_status_role ON trips(status, role);
CREATE INDEX idx_trips_pickup_geog ON trips USING GIST(pickup_geog);
CREATE INDEX idx_trips_dropoff_geog ON trips USING GIST(dropoff_geog);
CREATE INDEX idx_trips_created_at ON trips(created_at);
CREATE INDEX idx_trips_updated_at ON trips(updated_at);
```

**Status Values**:
- `open` - Active, searchable
- `matched` - Driver/passenger found
- `completed` - Trip finished
- `cancelled` - User cancelled

---

## 5. Root Causes

### Why 30-Minute Window Not Working

1. **Config Mismatch**
   - `MOBILITY_CONFIG.DEFAULT_WINDOW_DAYS = 2` (48 hours)
   - Should be 30 minutes (0.0208 days or better: use minutes)

2. **SQL Function Hardcoded Values**
   - `interval '24 hours'` for location freshness
   - `INTERVAL '1 day' * _window_days` for time window
   - Both should use 30 minutes

3. **Trip Expiry Too Long**
   - 90 minutes configured
   - Should be 30 minutes for intent-based trips
   - (Scheduled trips can keep 7 days)

### Why Open Trips May Not Appear

1. **Time Window Too Restrictive** (if accidentally set to 0 or negative)
2. **Location Staleness** - If trip not updated in 24 hours (shouldn't happen for fresh trips)
3. **Radius Too Small** - If search radius < actual distance
4. **Wrong Role Filter** - Should be opposite (search for 'driver' when role='passenger')
   - ✅ This is implemented correctly

---

## 6. Recommended Fixes

### Fix 1: Update MOBILITY_CONFIG (HIGH PRIORITY)

**File**: `supabase/functions/_shared/wa-webhook-shared/config/mobility.ts`

```typescript
export const MOBILITY_CONFIG = {
  DEFAULT_SEARCH_RADIUS_METERS: 10_000,
  MAX_SEARCH_RADIUS_METERS: 25_000,
  
  // FIXED: All time windows now 30 minutes
  LOCATION_FRESHNESS_MINUTES: 30,
  SQL_LOCATION_FRESHNESS_MINUTES: 30,  // NEW: Renamed from HOURS
  RECENT_SEARCH_WINDOW_MINUTES: 30,
  TRIP_EXPIRY_MINUTES: 30,              // CHANGED: 90 → 30
  TRIP_MATCHING_WINDOW_MINUTES: 30,    // NEW: Explicit matching window
  
  MAX_RESULTS_LIMIT: 9,
  
  // DEPRECATED: Remove DEFAULT_WINDOW_DAYS
  // DEFAULT_WINDOW_DAYS: 2,  // ❌ Remove this
} as const;
```

### Fix 2: Update SQL Functions (CRITICAL)

**Create new migration**: `20251211XXXXXX_fix_mobility_30min_window.sql`

```sql
BEGIN;

-- ============================================================================
-- FIX: 30-Minute Time Window for Mobility Matching
-- ============================================================================
-- ISSUE: Trips use 48-hour window instead of 30 minutes
-- FIX: Change all time filters to 30 minutes
-- ============================================================================

DROP FUNCTION IF EXISTS public.match_drivers_for_trip_v2(uuid, integer, boolean, integer, integer) CASCADE;
DROP FUNCTION IF EXISTS public.match_passengers_for_trip_v2(uuid, integer, boolean, integer, integer) CASCADE;

-- Updated function signature: _window_minutes instead of _window_days
CREATE OR REPLACE FUNCTION public.match_drivers_for_trip_v2(
  _trip_id uuid,
  _limit integer DEFAULT 9,
  _prefer_dropoff boolean DEFAULT false,
  _radius_m integer DEFAULT 10000,
  _window_minutes integer DEFAULT 30  -- CHANGED: from _window_days
)
RETURNS TABLE (
  trip_id uuid,
  creator_user_id uuid,
  whatsapp_e164 text,
  ref_code text,
  distance_km numeric,
  drop_bonus_m numeric,
  pickup_text text,
  dropoff_text text,
  matched_at timestamptz,
  created_at timestamptz,
  vehicle_type text,
  is_exact_match boolean,
  location_age_minutes integer,
  number_plate text,
  driver_name text,
  role text
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_pickup_lat double precision;
  v_pickup_lng double precision;
  v_dropoff_lat double precision;
  v_dropoff_lng double precision;
  v_vehicle_type text;
  v_radius_km double precision;
  v_window_minutes integer;
BEGIN
  -- Get requesting trip
  SELECT 
    t.pickup_lat,
    t.pickup_lng,
    t.dropoff_lat,
    t.dropoff_lng,
    t.vehicle_type,
    CASE 
      WHEN _radius_m IS NULL OR _radius_m <= 0 THEN 10.0
      ELSE _radius_m::double precision / 1000.0
    END
  INTO 
    v_pickup_lat,
    v_pickup_lng,
    v_dropoff_lat,
    v_dropoff_lng,
    v_vehicle_type,
    v_radius_km
  FROM public.trips t
  WHERE t.id = _trip_id;

  -- Return empty if trip not found
  IF v_pickup_lat IS NULL THEN
    RETURN;
  END IF;

  -- FIXED: Use 30 minutes if not specified
  v_window_minutes := COALESCE(_window_minutes, 30);

  -- Find matching drivers
  RETURN QUERY
  SELECT 
    t.id AS trip_id,
    t.user_id AS creator_user_id,
    COALESCE(p.phone_number, p.wa_id) AS whatsapp_e164,
    COALESCE(t.metadata->>'ref_code', SUBSTRING(t.id::text, 1, 8)) AS ref_code,
    ROUND(
      (6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(v_pickup_lat)) * cos(radians(t.pickup_lat)) *
          cos(radians(t.pickup_lng) - radians(v_pickup_lng)) +
          sin(radians(v_pickup_lat)) * sin(radians(t.pickup_lat))
        ))
      ))::numeric, 2
    ) AS distance_km,
    CASE
      WHEN _prefer_dropoff AND v_dropoff_lat IS NOT NULL AND t.dropoff_lat IS NOT NULL THEN
        ROUND(
          (6371000 * acos(
            LEAST(1.0, GREATEST(-1.0,
              cos(radians(v_dropoff_lat)) * cos(radians(t.dropoff_lat)) *
              cos(radians(t.dropoff_lng) - radians(v_dropoff_lng)) +
              sin(radians(v_dropoff_lat)) * sin(radians(t.dropoff_lat))
            ))
          ))::numeric, 0
        )
      ELSE NULL
    END AS drop_bonus_m,
    t.pickup_text,
    t.dropoff_text,
    NULL::timestamptz AS matched_at,
    t.created_at,
    t.vehicle_type,
    (t.vehicle_type = v_vehicle_type) AS is_exact_match,
    EXTRACT(EPOCH FROM (now() - t.updated_at))::integer / 60 AS location_age_minutes,
    COALESCE(
      (t.metadata->>'number_plate')::text,
      (p.metadata->>'number_plate')::text,
      (p.metadata->'driver'->>'number_plate')::text
    ) AS number_plate,
    COALESCE(p.display_name, p.phone_number, 'Driver') AS driver_name,
    'driver'::text AS role
  FROM public.trips t
  INNER JOIN public.profiles p ON p.user_id = t.user_id
  WHERE t.role = 'driver'
    AND t.status = 'open'
    AND (t.expires_at IS NULL OR t.expires_at > now())
    AND t.pickup_lat IS NOT NULL
    AND t.pickup_lng IS NOT NULL
    -- FIXED: 30-minute location freshness
    AND t.updated_at > now() - (v_window_minutes || ' minutes')::interval
    -- FIXED: 30-minute window for trip creation
    AND t.created_at >= now() - (v_window_minutes || ' minutes')::interval
    AND t.id != _trip_id
    AND (
      6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(v_pickup_lat)) * cos(radians(t.pickup_lat)) *
          cos(radians(t.pickup_lng) - radians(v_pickup_lng)) +
          sin(radians(v_pickup_lat)) * sin(radians(t.pickup_lat))
        ))
      )
    ) <= v_radius_km
  ORDER BY 
    distance_km ASC,
    t.updated_at DESC,
    (t.vehicle_type = v_vehicle_type) DESC
  LIMIT _limit;
END;
$$;

-- Repeat for match_passengers_for_trip_v2 (same changes)
CREATE OR REPLACE FUNCTION public.match_passengers_for_trip_v2(
  _trip_id uuid,
  _limit integer DEFAULT 9,
  _prefer_dropoff boolean DEFAULT false,
  _radius_m integer DEFAULT 10000,
  _window_minutes integer DEFAULT 30  -- CHANGED: from _window_days
)
RETURNS TABLE (
  trip_id uuid,
  creator_user_id uuid,
  whatsapp_e164 text,
  ref_code text,
  distance_km numeric,
  drop_bonus_m numeric,
  pickup_text text,
  dropoff_text text,
  matched_at timestamptz,
  created_at timestamptz,
  vehicle_type text,
  is_exact_match boolean,
  location_age_minutes integer,
  number_plate text,
  driver_name text,
  role text
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_pickup_lat double precision;
  v_pickup_lng double precision;
  v_dropoff_lat double precision;
  v_dropoff_lng double precision;
  v_vehicle_type text;
  v_radius_km double precision;
  v_window_minutes integer;
BEGIN
  SELECT 
    t.pickup_lat,
    t.pickup_lng,
    t.dropoff_lat,
    t.dropoff_lng,
    t.vehicle_type,
    CASE 
      WHEN _radius_m IS NULL OR _radius_m <= 0 THEN 10.0
      ELSE _radius_m::double precision / 1000.0
    END
  INTO 
    v_pickup_lat,
    v_pickup_lng,
    v_dropoff_lat,
    v_dropoff_lng,
    v_vehicle_type,
    v_radius_km
  FROM public.trips t
  WHERE t.id = _trip_id;

  IF v_pickup_lat IS NULL THEN
    RETURN;
  END IF;

  v_window_minutes := COALESCE(_window_minutes, 30);

  RETURN QUERY
  SELECT 
    t.id AS trip_id,
    t.user_id AS creator_user_id,
    COALESCE(p.phone_number, p.wa_id) AS whatsapp_e164,
    COALESCE(t.metadata->>'ref_code', SUBSTRING(t.id::text, 1, 8)) AS ref_code,
    ROUND(
      (6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(v_pickup_lat)) * cos(radians(t.pickup_lat)) *
          cos(radians(t.pickup_lng) - radians(v_pickup_lng)) +
          sin(radians(v_pickup_lat)) * sin(radians(t.pickup_lat))
        ))
      ))::numeric, 2
    ) AS distance_km,
    CASE
      WHEN _prefer_dropoff AND v_dropoff_lat IS NOT NULL AND t.dropoff_lat IS NOT NULL THEN
        ROUND(
          (6371000 * acos(
            LEAST(1.0, GREATEST(-1.0,
              cos(radians(v_dropoff_lat)) * cos(radians(t.dropoff_lat)) *
              cos(radians(t.dropoff_lng) - radians(v_dropoff_lng)) +
              sin(radians(v_dropoff_lat)) * sin(radians(t.dropoff_lat))
            ))
          ))::numeric, 0
        )
      ELSE NULL
    END AS drop_bonus_m,
    t.pickup_text,
    t.dropoff_text,
    NULL::timestamptz AS matched_at,
    t.created_at,
    t.vehicle_type,
    (t.vehicle_type = v_vehicle_type) AS is_exact_match,
    EXTRACT(EPOCH FROM (now() - t.updated_at))::integer / 60 AS location_age_minutes,
    NULL::text AS number_plate,
    COALESCE(p.display_name, p.phone_number, 'Passenger') AS driver_name,
    'passenger'::text AS role
  FROM public.trips t
  INNER JOIN public.profiles p ON p.user_id = t.user_id
  WHERE t.role = 'passenger'
    AND t.status = 'open'
    AND (t.expires_at IS NULL OR t.expires_at > now())
    AND t.pickup_lat IS NOT NULL
    AND t.pickup_lng IS NOT NULL
    -- FIXED: 30-minute location freshness
    AND t.updated_at > now() - (v_window_minutes || ' minutes')::interval
    -- FIXED: 30-minute window for trip creation
    AND t.created_at >= now() - (v_window_minutes || ' minutes')::interval
    AND t.id != _trip_id
    AND (
      6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(v_pickup_lat)) * cos(radians(t.pickup_lat)) *
          cos(radians(t.pickup_lng) - radians(v_pickup_lng)) +
          sin(radians(v_pickup_lat)) * sin(radians(t.pickup_lat))
        ))
      )
    ) <= v_radius_km
  ORDER BY 
    distance_km ASC,
    t.updated_at DESC,
    (t.vehicle_type = v_vehicle_type) DESC
  LIMIT _limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_drivers_for_trip_v2 TO service_role, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.match_passengers_for_trip_v2 TO service_role, authenticated, anon;

COMMIT;
```

### Fix 3: Update TypeScript RPC Calls

**File**: `supabase/functions/_shared/wa-webhook-shared/rpc/mobility.ts`

```typescript
export async function matchDriversForTrip(
  client: SupabaseClient,
  tripId: string,
  limit = MOBILITY_CONFIG.MAX_RESULTS_LIMIT,
  preferDropoff = false,
  radiusMeters?: number,
  windowMinutes = 30,  // CHANGED: from windowDays = 2
) {
  const { data, error } = await client.rpc("match_drivers_for_trip_v2", {
    _trip_id: tripId,
    _limit: limit,
    _prefer_dropoff: preferDropoff,
    _radius_m: radiusMeters ?? null,
    _window_minutes: windowMinutes,  // CHANGED: from _window_days
  } as Record<string, unknown>);
  if (error) throw error;
  return (data ?? []) as MatchResult[];
}

export async function matchPassengersForTrip(
  client: SupabaseClient,
  tripId: string,
  limit = MOBILITY_CONFIG.MAX_RESULTS_LIMIT,
  preferDropoff = false,
  radiusMeters?: number,
  windowMinutes = 30,  // CHANGED: from windowDays = 2
) {
  const { data, error } = await client.rpc("match_passengers_for_trip_v2", {
    _trip_id: tripId,
    _limit: limit,
    _prefer_dropoff: preferDropoff,
    _radius_m: radiusMeters ?? null,
    _window_minutes: windowMinutes,  // CHANGED: from _window_days
  } as Record<string, unknown>);
  if (error) throw error;
  return (data ?? []) as MatchResult[];
}

// ALSO UPDATE: insertTrip to use 30-minute expiry
export async function insertTrip(
  client: SupabaseClient,
  params: {
    userId: string;
    role: "driver" | "passenger";
    vehicleType: string;
    lat: number;
    lng: number;
    radiusMeters: number;
    pickupText?: string;
    scheduledAt?: Date | string;
    recurrence?: RecurrenceType;
  },
): Promise<string> {
  const isScheduled = params.scheduledAt !== undefined;
  const expiryMs = isScheduled ? 7 * 24 * 60 * 60 * 1000 : (30 * 60 * 1000);  // 30 min for intent
  const expires = new Date(Date.now() + expiryMs).toISOString();
  
  // ... rest of function
}
```

### Fix 4: Update Handler Calls

**Files**: 
- `supabase/functions/wa-webhook-mobility/handlers/nearby.ts`
- `supabase/functions/wa-webhook/domains/mobility/nearby.ts`

```typescript
// Change all calls from:
const matches = await matchDriversForTrip(
  ctx.supabase,
  tempTripId,
  max,
  Boolean(dropoff),
  radiusMeters,
  DEFAULT_WINDOW_DAYS,  // ❌ Remove this (2 days)
);

// To:
const matches = await matchDriversForTrip(
  ctx.supabase,
  tempTripId,
  max,
  Boolean(dropoff),
  radiusMeters,
  30,  // ✅ 30 minutes
);
```

---

## 7. Testing Plan

### Test Case 1: Fresh Trip Matching
```
1. User A creates driver trip at 10:00 AM
2. User B searches for drivers at 10:05 AM (5 min later)
3. Expected: User A's trip appears in results
4. Verify: Check trip.status='open', trip.created_at, match results
```

### Test Case 2: 30-Minute Window
```
1. User A creates driver trip at 10:00 AM
2. User B searches for drivers at 10:31 AM (31 min later)
3. Expected: User A's trip DOES NOT appear (expired)
4. Verify: trip.expires_at has passed OR not in window
```

### Test Case 3: Trip Expiry
```
1. User A creates trip at 10:00 AM
2. Wait 31 minutes
3. Check trip.status and trip.expires_at
4. Expected: status still 'open' BUT expires_at < now()
5. Verify: Trip does NOT appear in search results
```

### Test Case 4: Reverse Matching
```
1. User A (passenger) searches for drivers
2. User B (driver) searches for passengers
3. Expected: User A's trip appears for User B
4. Verify: Bidirectional discovery works
```

### SQL Verification Queries

```sql
-- Check open trips
SELECT 
  id, 
  role, 
  status, 
  created_at,
  expires_at,
  expires_at > now() as is_valid,
  EXTRACT(EPOCH FROM (now() - created_at))/60 as age_minutes
FROM trips
WHERE status = 'open'
ORDER BY created_at DESC
LIMIT 10;

-- Check matching for specific trip
SELECT * FROM match_drivers_for_trip_v2(
  'TRIP_ID_HERE'::uuid,
  9,        -- limit
  false,    -- prefer_dropoff
  10000,    -- radius_m
  30        -- window_minutes (NEW)
);

-- Check trips within 30-minute window
SELECT 
  id,
  role,
  vehicle_type,
  status,
  created_at,
  updated_at,
  expires_at,
  EXTRACT(EPOCH FROM (now() - created_at))/60 as age_minutes
FROM trips
WHERE status = 'open'
  AND created_at >= now() - interval '30 minutes'
  AND updated_at > now() - interval '30 minutes'
  AND expires_at > now()
ORDER BY created_at DESC;
```

---

## 8. Migration Checklist

- [ ] Create migration `20251211XXXXXX_fix_mobility_30min_window.sql`
- [ ] Update `MOBILITY_CONFIG` in `config/mobility.ts`
- [ ] Update `insertTrip()` expiry to 30 minutes
- [ ] Update `matchDriversForTrip()` signature and calls
- [ ] Update `matchPassengersForTrip()` signature and calls
- [ ] Update all handler calls in `nearby.ts` and `schedule.ts`
- [ ] Remove `DEFAULT_WINDOW_DAYS` from config
- [ ] Add `TRIP_MATCHING_WINDOW_MINUTES = 30` to config
- [ ] Test fresh trip matching
- [ ] Test 30-minute expiry
- [ ] Test reverse discovery (passenger → driver, driver → passenger)
- [ ] Deploy to staging
- [ ] Verify in production logs

---

## 9. Backwards Compatibility

### Breaking Changes
1. SQL function signature changed: `_window_days` → `_window_minutes`
2. TypeScript function calls need update
3. Existing trips with 90-minute expiry will persist until expired

### Mitigation
1. Deploy SQL migration first (functions auto-replaced)
2. Deploy TypeScript changes immediately after
3. No user data migration needed
4. Old trips expire naturally

### Rollback Plan
If issues arise:
1. Revert SQL functions to `_window_days` version
2. Revert TypeScript changes
3. Update config back to 48-hour window

---

## 10. Performance Impact

### Expected Changes
- **Fewer matches**: 30-minute window much smaller than 48 hours
- **Faster queries**: Smaller dataset to scan
- **More accurate results**: Only truly active/fresh trips

### Monitoring
Watch these metrics after deployment:
- Average matches per search (may decrease initially)
- "No matches found" rate (should stabilize)
- Query latency (should improve)
- Trip creation rate vs. match rate

---

## Conclusion

**Priority**: 🔴 **CRITICAL - IMMEDIATE FIX REQUIRED**

The current implementation uses a 48-hour matching window instead of the intended 30 minutes, causing:
1. Stale trips to appear in results
2. User confusion about trip freshness
3. Inconsistent experience with "30-minute window" promise

**Fixes are straightforward** and involve:
1. Config updates (5 lines)
2. SQL function updates (2 functions)
3. TypeScript call updates (~10 locations)

**Estimated effort**: 2-3 hours implementation + 1 hour testing

**Risk level**: Low (SQL functions are STABLE, can be replaced without downtime)

---

**Next Steps**:
1. Review this document with team
2. Create migration file
3. Update config and RPC calls
4. Test in development
5. Deploy to staging
6. Monitor and deploy to production
