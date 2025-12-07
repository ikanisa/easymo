# Mobility Matching Fix Summary

**Date**: 2025-12-07  
**Status**: ✅ FIXED  
**Priority**: 🔴 P0 - Critical (Matching not working)

---

## 🔴 Critical Issue Fixed

### Column Name Mismatch: `full_name` → `display_name`

**Error**: `column p.full_name does not exist` (PostgreSQL error 42703)

**Root Cause**: 
- Matching functions (`match_drivers_for_trip_v2`, `match_passengers_for_trip_v2`) use `p.full_name`
- Profiles table uses `display_name` column instead

**Impact**: **ALL matching queries fail** - drivers and passengers cannot find each other

**Files Affected**:
- `supabase/migrations/20251206090000_fix_mobility_matching_definitive.sql` (lines 139, 279)

---

## ✅ Fix Applied

Created migration: `20251207130000_fix_matching_display_name.sql`

**Changes**:
```sql
-- BEFORE (line 139, 279)
p.full_name AS driver_name,

-- AFTER  
COALESCE(p.display_name, p.phone_number, p.wa_id) AS driver_name,
```

**Benefits**:
1. Uses correct column name (`display_name`)
2. Falls back to phone number or WhatsApp ID if display_name is null
3. Ensures driver/passenger name is always returned

---

## 🔍 Other Issues Identified (Already Fixed in Previous Migrations)

### 1. ✅ Table Consistency
- **Issue**: Some old migrations reference `rides_trips` instead of `mobility_trips`
- **Status**: Latest migration (20251206090000) uses correct table (`mobility_trips`)
- **Note**: Old migrations are .skip files, won't run

### 2. ✅ Location Freshness
- **Issue**: Was 30 minutes (too strict)
- **Status**: Fixed to 24 hours in migration 20251206090000
- **Impact**: More matches found (drivers don't need to update location every 30 min)

### 3. ✅ Expiry Handling
- **Issue**: NULL expires_at caused trips to be excluded
- **Status**: Fixed - NULL now treated as "never expires"

### 4. ⚠️ PostGIS Extension (Environment Specific)
- **Issue**: Spatial functions require PostGIS
- **Check**: Run diagnostics script to verify
- **Fix**: `CREATE EXTENSION IF NOT EXISTS postgis;`

---

## 📋 Deployment

### Quick Deploy
```bash
# 1. Apply migration
supabase db push

# 2. Verify functions
supabase db execute "SELECT proname FROM pg_proc WHERE proname LIKE 'match_%_for_trip_v2';"

# 3. Test matching
# (Use diagnostics script below)
```

### Run Diagnostics
```bash
export DATABASE_URL="postgresql://..."
./diagnose-mobility-matching.sh
```

The script checks:
- ✅ PostGIS enabled
- ✅ Tables exist (mobility_trips, profiles)
- ✅ Matching functions exist
- ✅ Column names (full_name vs display_name)
- ✅ Active trips count
- ✅ Location freshness
- ✅ Sample matching test

---

## 🧪 Testing

### Test 1: Create Test Trips
```sql
-- Create passenger trip
INSERT INTO mobility_trips (
  creator_user_id, role, vehicle_type, status,
  pickup_lat, pickup_lng, pickup_text,
  pickup_geog, last_location_update
)
VALUES (
  'user-uuid-here', 'passenger', 'car', 'open',
  -1.9536, 30.0606, 'Kigali',
  ST_SetSRID(ST_MakePoint(30.0606, -1.9536), 4326)::geography,
  now()
);

-- Create driver trip
INSERT INTO mobility_trips (
  creator_user_id, role, vehicle_type, status,
  pickup_lat, pickup_lng, pickup_text,
  pickup_geog, last_location_update
)
VALUES (
  'driver-uuid-here', 'driver', 'car', 'open',
  -1.9500, 30.0600, 'Kigali CBD',
  ST_SetSRID(ST_MakePoint(30.0600, -1.9500), 4326)::geography,
  now()
);
```

### Test 2: Run Matching
```sql
-- Get a passenger trip ID
SELECT id FROM mobility_trips WHERE role = 'passenger' AND status = 'open' LIMIT 1;

-- Find nearby drivers
SELECT 
  trip_id,
  distance_km,
  driver_name,
  vehicle_type,
  is_exact_match,
  location_age_minutes
FROM match_drivers_for_trip_v2(
  'passenger-trip-id-here',  -- trip_id
  9,                          -- limit
  false,                      -- prefer_dropoff
  10000,                      -- radius_m (10km)
  2                           -- window_days
);
```

**Expected Results**:
- Should return nearby drivers
- `driver_name` should contain actual name (not NULL)
- `distance_km` should be calculated
- No `column p.full_name does not exist` error

---

## 📊 Migration Details

**File**: `20251207130000_fix_matching_display_name.sql`

**Actions**:
1. Drop existing `match_drivers_for_trip_v2` function
2. Drop existing `match_passengers_for_trip_v2` function
3. Recreate both functions with `display_name` fix
4. Grant permissions (service_role, authenticated, anon)
5. Verify functions created successfully

**Rollback**: Revert to migration 20251206090000 (uses `full_name`)

---

## 🔧 Configuration

### Location Freshness (Configurable)
Current: **24 hours** (hardcoded in function)

To change:
```sql
-- Edit line 156 and 296 in migration:
AND COALESCE(t.last_location_update, t.created_at) > now() - interval '24 hours'
                                                                         ^^^^^^^^
-- Change to '1 hour', '12 hours', '48 hours', etc.
```

### Search Radius (Dynamic)
Default: **10,000 meters (10km)**

Called via WhatsApp webhook with custom radius:
```typescript
const matches = await supabase.rpc('match_drivers_for_trip_v2', {
  _trip_id: tripId,
  _limit: 9,
  _prefer_dropoff: false,
  _radius_m: 20000,  // 20km
  _window_days: 7    // Search trips from last 7 days
});
```

---

## 🆘 Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| `column p.full_name does not exist` | Old migration still active | Apply migration 20251207130000 |
| `relation "mobility_trips" does not exist` | Wrong database or schema | Check connection string, run `supabase db push` |
| No matches found | No active trips in database | Create test trips (see Testing section) |
| No matches found | Location too old | User needs to search again to update location |
| No matches found | Search radius too small | Increase radius_m parameter (default 10km) |
| No matches found | Trips expired | Check expires_at column, create new trips |
| PostGIS error | Extension not enabled | Run `CREATE EXTENSION postgis;` |

---

## 📝 Files Created

| File | Purpose | Size |
|------|---------|------|
| `supabase/migrations/20251207130000_fix_matching_display_name.sql` | Fix full_name → display_name | 9.1 KB |
| `diagnose-mobility-matching.sh` | Diagnostic script | 5.6 KB |
| `MOBILITY_MATCHING_FIX_SUMMARY.md` | This document | 5.4 KB |

---

## 📚 Related Documentation

- `DRIVER_MATCHING_FIXED.md` - Flexible vehicle matching
- `MOBILITY_NEARBY_WORKFLOW_FIX.md` - UI workflow simplification
- `MATCHING_FIXES_FINAL_STATUS.md` - Previous matching fixes
- Migration `20251206090000_fix_mobility_matching_definitive.sql` - Base migration (had full_name bug)
- Migration `20251201150000_fix_matching_location_freshness.sql` - Location freshness fix

---

## ✅ Verification Checklist

After deployment:

- [ ] Migration 20251207130000 applied successfully
- [ ] Both matching functions exist (run diagnostics)
- [ ] No `full_name` errors in logs
- [ ] Test matching returns results (if test trips exist)
- [ ] WhatsApp nearby search works
- [ ] Admin panel matching works
- [ ] Logs show `MATCHES_RESULT` with count > 0

---

## 🎯 Success Criteria

1. **No SQL errors** - Matching queries execute without column errors
2. **Functions return data** - driver_name populated (not NULL)
3. **WhatsApp works** - Users see nearby drivers/passengers
4. **Logs clean** - No `p.full_name` errors in Supabase function logs

---

**Status**: ✅ READY FOR DEPLOYMENT  
**Action**: Run `supabase db push` to apply fix  
**Verification**: Run `./diagnose-mobility-matching.sh`  

---

## Quick Deploy Commands

```bash
# 1. Apply migration
cd /Users/jeanbosco/workspace/easymo
supabase db push

# 2. Run diagnostics
export DATABASE_URL="your-database-url"
./diagnose-mobility-matching.sh

# 3. Test via WhatsApp
# Send "Find driver" or "Find passenger" message
# Check logs: supabase functions logs wa-webhook-mobility --tail

# 4. Verify in Supabase dashboard
# SQL Editor → Run: SELECT * FROM match_drivers_for_trip_v2(...);
```

---

**Next Steps**: Deploy and test! 🚀
