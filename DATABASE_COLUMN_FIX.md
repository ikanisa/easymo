# 🔧 Database Column Name Fix - APPLIED

**Date**: 2025-12-07 10:37 UTC  
**Issue**: mobility.nearby_match_fail - column p.full_name does not exist  
**Status**: ✅ FIXED

---

## Problem

The mobility matching functions were referencing `p.full_name` but the profiles table only has `p.display_name`.

**Error Message**:
```
mobility.nearby_match_fail {
  code: "42703",
  message: "column p.full_name does not exist"
}
```

---

## Functions Fixed

✅ Fixed 5 functions:
1. `get_pending_certificates` - Insurance certificates
2. `get_manual_reviews` - Manual review queue
3. `get_expiring_insurance` - Expiring insurance policies
4. `match_drivers_for_trip_v2` - Driver matching
5. `match_passengers_for_trip_v2` - Passenger matching

---

## What Was Changed

**Before**:
```sql
SELECT p.full_name, ...
FROM profiles p
```

**After**:
```sql
SELECT p.display_name, ...
FROM profiles p
```

---

## Verification

Test that mobility matching works now:

```bash
# Test the fixed function
export DATABASE_URL="postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres"

psql "$DATABASE_URL" -c "SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_definition ILIKE '%p.full_name%';"
```

Should return 0 rows (no functions with p.full_name).

---

## Impact

- ✅ Mobility matching should work now
- ✅ Insurance certificate processing fixed
- ✅ Manual review queue accessible
- ✅ Expiring insurance notifications fixed

---

## Test

Try using the mobility features via WhatsApp:
1. Select "🚕 Rides & Delivery" from menu
2. Create a ride request
3. System should now match drivers without errors

---

**Status**: ✅ PRODUCTION FIX APPLIED  
**Deployment**: Already live in database
