# Mobility Matching - Quick Reference

## 🚀 Quick Fix

```bash
# Deploy the fix
cd /Users/jeanbosco/workspace/easymo
supabase db push

# Verify
supabase db execute "SELECT proname FROM pg_proc WHERE proname LIKE 'match_%';"

# Test
export DATABASE_URL="your-db-url"
./diagnose-mobility-matching.sh
```

---

## 🔴 Issue Fixed

**Error**: `column p.full_name does not exist`

**Cause**: Matching functions used `p.full_name`, but profiles table has `display_name`

**Fix**: Migration 20251207130000 changes `p.full_name` → `COALESCE(p.display_name, p.phone_number, p.wa_id)`

---

## 🧪 Quick Test

```sql
-- 1. Check if functions exist
SELECT proname FROM pg_proc WHERE proname LIKE 'match_%_for_trip_v2';

-- 2. Count active trips
SELECT role, COUNT(*) 
FROM mobility_trips 
WHERE status = 'open' AND (expires_at IS NULL OR expires_at > now())
GROUP BY role;

-- 3. Test matching (replace UUID with actual trip ID)
SELECT trip_id, driver_name, distance_km, vehicle_type
FROM match_drivers_for_trip_v2(
  'YOUR-TRIP-UUID',  -- Get from step 2
  5,                 -- limit
  false,             -- prefer_dropoff
  50000,             -- radius_m (50km)
  7                  -- window_days
);
```

---

## 📊 Expected Behavior

### ✅ Success
```json
{
  "event": "MATCHES_CALL",
  "tripId": "abc123...",
  "radius": 10000,
  "limit": 9
}
{
  "event": "MATCHES_RESULT",
  "count": 3,
  "matches": [...]
}
```

### ❌ Failure (Before Fix)
```
ERROR: column p.full_name does not exist
LINE 139: p.full_name AS driver_name,
```

---

## 🔧 Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| Location freshness | 24 hours | How old can location be |
| Search radius | 10 km | How far to search |
| Window days | 2 days | How old can trips be |
| Trip expiry | 90 min | Auto-expire after this |

---

## 🆘 Troubleshooting

| Symptom | Fix |
|---------|-----|
| `full_name` error | Deploy migration 20251207130000 |
| No matches | Check active trips exist |
| PostGIS error | `CREATE EXTENSION postgis;` |
| Stale location | User searches again |

---

## 📝 Files

- **Migration**: `supabase/migrations/20251207130000_fix_matching_display_name.sql`
- **Diagnostics**: `diagnose-mobility-matching.sh`
- **Full Guide**: `MOBILITY_MATCHING_FIX_SUMMARY.md`

---

**Status**: Ready to deploy  
**Deploy**: `supabase db push`  
**Verify**: `./diagnose-mobility-matching.sh`
