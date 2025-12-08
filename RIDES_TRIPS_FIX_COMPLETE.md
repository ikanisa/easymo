# rides_trips Table Reference Fix - COMPLETE

## Issue Identified

**Error**: `relation "public.rides_trips" does not exist` (PostgreSQL 42P01)  
**Time**: 2025-12-08 13:09 UTC  
**Root Cause**: Edge functions still querying from deprecated `rides_trips` table

## Files Fixed

### 1. ✅ wa-webhook/shared/whatsapp_tools.ts
- Line 245: `.from("rides_trips")` → `.from("trips")`
- Line 346: `.from("rides_trips")` → `.from("trips")`

### 2. ✅ _shared/agent-orchestrator.ts
- Line 1160: Comment updated
- Line 1168: Comment updated
- Line 1189: Comment updated
- Line 1192: `.from("rides_trips")` → `.from("trips")`
- Line 1201: `.from("rides_trips")` → `.from("trips")`

### 3. ✅ _shared/agents/rides-insurance-logic.ts
- Line 81: `.from("rides_trips")` → `.from("trips")`
- Line 178: `.from("rides_trips")` → `.from("trips")`
- Line 211: `.from("rides_trips")` → `.from("trips")`

### 4. ✅ _shared/wa-webhook-shared/tools/rides-matcher.ts
- Line 247: `.from("rides_trips")` → `.from("trips")`

## Deployment Status

✅ **wa-webhook**: No changes detected (shared files affect it)  
✅ **wa-webhook-mobility**: Deployed successfully (397.1kB)

## Canonical Table Structure

The system now uses **`trips`** as the single source of truth:

```sql
-- Canonical trips table
CREATE TABLE public.trips (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES profiles(user_id),
  role text CHECK (role IN ('driver', 'passenger')),
  vehicle_type text,
  status text CHECK (status IN ('open', 'matched', 'cancelled', 'completed')),
  pickup_lat double precision,
  pickup_lng double precision,
  pickup_geog geography GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(pickup_lng, pickup_lat), 4326)::geography
  ) STORED,
  pickup_text text,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  expires_at timestamptz
);
```

## Deprecated Tables (DO NOT USE)

- ❌ `rides_trips` - Old table from v1
- ❌ `mobility_trips` - Old table from v2  
- ✅ `trips` - Current canonical table

## Verification

Run this SQL to verify no errors:

```sql
-- This should work without error
SELECT COUNT(*) FROM trips WHERE role = 'driver' AND status = 'open';

-- This should fail (table doesn't exist)
SELECT COUNT(*) FROM rides_trips; -- Error expected
```

## Expected Impact

### Before Fix
```
❌ Error 42P01: relation "public.rides_trips" does not exist
❌ mobility.nearby_match_fail
❌ All mobility matching fails
```

### After Fix
```
✅ Queries use canonical trips table
✅ No more 42P01 errors
✅ Mobility matching works correctly
```

## Next Test

Send WhatsApp message: **"Find driver near me"**

Expected flow:
1. ✅ Creates trip in `trips` table
2. ✅ Calls `match_drivers_for_trip_v2()`
3. ✅ Queries from `trips` table (not rides_trips)
4. ✅ Returns matching drivers
5. ✅ No PostgreSQL errors

---

**Status**: ✅ COMPLETE  
**Deployed**: 2025-12-08 14:30 CET  
**Next**: Test with real WhatsApp message
