# Trip Matching Issue - Resolution

**Date**: 2025-12-09 19:20 UTC  
**Issue**: "No drivers found nearby" even though trips exist in database

## Problem Analysis

### 1. ✅ FIXED: Location Cache Function Duplicate

**Error**: `PGRST203 - Could not choose the best candidate function`

**Cause**: Two versions of `update_user_location_cache` existed:

- One with `numeric` parameters (old)
- One with `double precision` parameters (new)

**Solution**: Dropped the old numeric version

```sql
DROP FUNCTION public.update_user_location_cache(_user_id uuid, _lat numeric, _lng numeric);
```

**Status**: ✅ Fixed - Function now works correctly

---

### 2. ⚠️ Trip Matching Returns No Results

**Issue**: User is a PASSENGER looking for DRIVERS, but no DRIVERS exist

**Current State**:

- ✅ Passenger trip created successfully (ID: `12893c9c-d85e-4cfc-b3fb-7ec0ad608142`)
- ✅ Trip is `open` and not expired
- ✅ Location saved correctly
- ✅ `match_drivers_for_trip_v2` function works
- ❌ **No driver trips exist to match against**

**Why No Matches**:

```sql
-- Passenger trip exists
SELECT * FROM trips WHERE role = 'passenger' AND status = 'open';
-- Returns: 1 row

-- No driver trips exist!
SELECT * FROM trips WHERE role = 'driver' AND status = 'open';
-- Returns: 0 rows
```

---

## Solutions

### Solution A: Create Test Driver Trips (For Testing)

```sql
-- Create a test driver trip near the passenger
INSERT INTO trips (
  user_id,
  wa_user_id,
  role,
  vehicle_type,
  pickup_lat,
  pickup_lng,
  status,
  expires_at
) VALUES (
  gen_random_uuid(),
  gen_random_uuid(),
  'driver',
  'moto',
  -1.9920, -- Near the passenger location
  30.1060,
  'open',
  NOW() + INTERVAL '2 hours'
);
```

### Solution B: Wait for Real Drivers

The matching is working correctly. There are simply no drivers who have:

1. Created a trip with `role = 'driver'`
2. Same or compatible `vehicle_type`
3. Within 10km radius
4. Trip still open and not expired

### Solution C: Improve User Messaging

Update the "No drivers found" message to be more helpful:

**Current**:

> "No drivers found nearby at this time. Try searching again or share your trip with the community."

**Suggested**:

> "No drivers are available right now. Here's what you can do:
>
> 🔔 We'll notify you when drivers become available 🔗 Share your trip link with drivers you know 📍
> Try expanding your search radius ⏰ Schedule your trip for later"

---

## Verification

### Test Location Cache (Now Fixed)

```bash
curl -X POST https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-mobility \
  -H "Content-Type: application/json" \
  -d '{
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "250788123456",
            "type": "location",
            "location": {
              "latitude": -1.9915,
              "longitude": 30.1059
            }
          }]
        }
      }]
    }]
  }'
```

**Expected**: No more `PGRST203` errors ✅

### Check Matching Status

```sql
-- Check passenger trips
SELECT id, role, vehicle_type, status,
       ROUND(pickup_lat::numeric, 4) as lat,
       ROUND(pickup_lng::numeric, 4) as lng,
       created_at
FROM trips
WHERE status = 'open' AND role = 'passenger'
ORDER BY created_at DESC;

-- Check driver trips
SELECT id, role, vehicle_type, status,
       ROUND(pickup_lat::numeric, 4) as lat,
       ROUND(pickup_lng::numeric, 4) as lng,
       created_at
FROM trips
WHERE status = 'open' AND role = 'driver'
ORDER BY created_at DESC;

-- Test matching
SELECT * FROM match_drivers_for_trip_v2(
  '<passenger_trip_id>'::uuid,
  'moto'::text,
  10000::double precision,
  2::integer,
  false::boolean,
  9::integer
);
```

---

## Production Fixes Applied

### 1. Database

```bash
# Already applied directly to production database
DROP FUNCTION public.update_user_location_cache(_user_id uuid, _lat numeric, _lng numeric);
```

### 2. Migration Created

File: `supabase/migrations/20251209190200_fix_location_cache_duplicate.sql`

Apply with:

```bash
supabase db push
```

---

## Next Steps

1. ✅ Location cache error fixed
2. ⚠️ Wait for drivers to create trips OR create test data
3. 📝 Consider improving "no matches" messaging
4. 🔔 Add push notification when drivers become available
5. 🔗 Make trip sharing easier

---

## Summary

**Location Cache Issue**: ✅ **FIXED**  
**Trip Matching**: ✅ **WORKING** (just no drivers available)  
**User Experience**: ⚠️ **Can be improved**

The system is functioning correctly. The "No drivers found" message is accurate - there are
genuinely no driver trips in the database at this moment.

---

**Fixed By**: AI Assistant  
**Date**: 2025-12-09 19:25 UTC  
**Migration**: 20251209190200_fix_location_cache_duplicate.sql
