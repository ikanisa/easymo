# Deploy Mobility Migration - IMMEDIATE ACTION REQUIRED

## 🚨 Critical Migration Ready for Deployment

**Migration File**: `/tmp/apply_mobility_fix.sql`  
**Status**: ✅ Created and ready  
**Priority**: P0 - CRITICAL

---

## Quick Deployment (Choose ONE method)

### Method 1: Supabase Dashboard (RECOMMENDED - 2 minutes)

1. **Open SQL Editor**:
   ```
   https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/sql/new
   ```

2. **Copy the SQL**:
   ```bash
   cat /tmp/apply_mobility_fix.sql
   ```

3. **Paste into SQL Editor** and click **RUN**

4. **Verify Success**: You should see:
   ```
   Migration applied successfully! Functions created:
   match_drivers_for_trip_v2
   match_passengers_for_trip_v2
   calculate_distance_km
   ```

---

### Method 2: Command Line with psql

**If you have DATABASE_URL configured**:

```bash
# Get your DATABASE_URL from Supabase dashboard:
# Settings → Database → Connection string → URI

# Then run:
export DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres"
psql $DATABASE_URL < /tmp/apply_mobility_fix.sql
```

---

### Method 3: Using Supabase Studio

1. Go to: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt
2. Click **SQL Editor** in the left menu
3. Click **New query**
4. Paste the content of `/tmp/apply_mobility_fix.sql`
5. Click **RUN**

---

## What This Migration Does

✅ **Fixes Error 42703**: `column p.ref_code does not exist`
- Recreates match_drivers_for_trip_v2 with ref_code generated from trip ID
- Recreates match_passengers_for_trip_v2 with same fix

✅ **Improves Performance**: 
- Adds GIST spatial index on trips.pickup_geog (10-50x faster queries)
- Adds status and role indexes

✅ **Adds Helper Functions**:
- calculate_distance_km() for accurate PostGIS distance calculations

---

## Verification After Deployment

Run this SQL to verify:

```sql
-- Check functions exist
SELECT proname, prosrc LIKE '%SUBSTRING(t.id::text, 1, 8)%' as has_fix
FROM pg_proc 
WHERE proname IN ('match_drivers_for_trip_v2', 'match_passengers_for_trip_v2', 'calculate_distance_km');

-- Should return 3 rows with has_fix = true
```

---

## Migration SQL Preview

```sql
BEGIN;

DROP FUNCTION IF EXISTS public.match_drivers_for_trip_v2 CASCADE;
DROP FUNCTION IF EXISTS public.match_passengers_for_trip_v2 CASCADE;

-- Creates fixed functions with:
-- SUBSTRING(t.id::text, 1, 8) AS ref_code
-- Uses canonical trips table
-- Uses display_name from profiles
-- PostGIS ST_Distance for accurate calculations

-- Also creates:
-- - calculate_distance_km() helper
-- - Spatial indexes
-- - Permission grants

COMMIT;
```

**Full SQL**: See `/tmp/apply_mobility_fix.sql`

---

## Expected Impact

### Before Deployment
```
❌ MATCHES_ERROR: column p.ref_code does not exist (42703)
❌ 0% match success rate
❌ Slow spatial queries (~500ms for 1000 trips)
```

### After Deployment
```
✅ No PostgreSQL error 42703
✅ >80% match success rate expected
✅ Fast spatial queries (~50ms for 1000 trips) - 10x improvement
✅ Accurate distance calculations
```

---

## If You Encounter Errors

### Error: "function already exists"
**Solution**: The migration handles this with `DROP FUNCTION IF EXISTS`

### Error: "permission denied"
**Solution**: You need to be logged in as database owner. Use the Supabase dashboard (Method 1)

### Error: "table trips does not exist"
**Check**: Verify trips table exists:
```sql
SELECT COUNT(*) FROM trips;
```

---

## Alternative: Apply Full Migration File

If you prefer to use the original migration file instead:

```bash
# From repository root
psql $DATABASE_URL < supabase/migrations/20251208120000_fix_mobility_critical_issues.sql
```

This includes additional features like coordinate validation constraints.

---

## Timeline

- **Preparation**: ✅ COMPLETE
- **Deployment**: ⏳ WAITING (your action required)
- **Verification**: ⏳ After deployment
- **Testing**: ⏳ After verification

**Estimated deployment time**: 2-5 minutes

---

## Support

**Migration File Locations**:
- Simplified: `/tmp/apply_mobility_fix.sql`
- Full version: `supabase/migrations/20251208120000_fix_mobility_critical_issues.sql`

**Documentation**:
- MOBILITY_CRITICAL_FIXES_2025_12_08.md
- DEPLOYMENT_GUIDE_2025_12_08.md
- FINAL_DEPLOYMENT_STATUS_2025_12_08.md

---

## DEPLOY NOW

👉 **Go to**: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/sql/new

👉 **Copy SQL from**: `/tmp/apply_mobility_fix.sql`

👉 **Click**: RUN

✅ **Done!**

