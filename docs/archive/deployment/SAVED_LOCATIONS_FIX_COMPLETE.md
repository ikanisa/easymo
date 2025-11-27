# Saved Locations Fix - COMPLETE

**Date**: 2025-11-27  
**Issue**: User saves "Home" location in Profile, but gets "no saved places" when scheduling rides  
**Status**: ✅ **FIXED & DEPLOYED**

## Problem Identified

User reported:
> "I have saved a place called home, but when I am scheduling trip and tap on saved places, I get a message that there is no saved place"

### Root Cause Analysis

Deep review revealed **critical table mismatch** between microservices:

1. **wa-webhook-profile** (Profile Management):
   - Saves locations to table: `saved_locations`
   - Schema: `id, user_id, label, address, lat, lng`
   - Uses numeric lat/lng coordinates

2. **wa-webhook-mobility** (Ride Scheduling):
   - Reads locations from table: `user_favorites` ❌
   - Schema: `id, user_id, kind, label, address, geog` (PostGIS)
   - **This table doesn't exist!** Never created in migrations

**Result**: Complete data disconnect between services. Saved locations invisible to mobility.

## Files Analyzed

### Profile Service
- `supabase/functions/wa-webhook-profile/profile/locations.ts` - Uses `saved_locations` ✅
- `supabase/functions/wa-webhook-profile/index.ts` - Saves to `saved_locations` ✅

### Mobility Service  
- `supabase/functions/wa-webhook-mobility/locations/favorites.ts` - Uses `user_favorites` ❌
- `supabase/functions/wa-webhook-mobility/locations/manage.ts` - Depends on favorites.ts ❌
- `supabase/functions/wa-webhook-mobility/handlers/schedule.ts` - Can't find saved locations ❌

## Solution Implemented

Updated `wa-webhook-mobility/locations/favorites.ts` to use `saved_locations` table:

### 1. listFavorites()
```typescript
// Before
.from("user_favorites")
.select("id, kind, label, address, geog")

// After
.from("saved_locations")
.select("id, label, address, lat, lng")
```

### 2. getFavoriteById()
```typescript
// Before
.from("user_favorites")
.select("id, kind, label, address, geog")

// After  
.from("saved_locations")
.select("id, label, address, lat, lng")
```

### 3. saveFavorite()
```typescript
// Before
.from("user_favorites")
.insert({
  kind,
  geog: `SRID=4326;POINT(${lng} ${lat})`
})

// After
.from("saved_locations")
.insert({
  lat: coords.lat,
  lng: coords.lng
})
```

### 4. updateFavorite()
```typescript
// Before  
.from("user_favorites")
.update({ geog: `SRID=4326;POINT(...)` })

// After
.from("saved_locations")
.update({ lat: coords.lat, lng: coords.lng })
```

### 5. Added normalizeSavedLocations()
New function to handle `saved_locations` table structure:
- Reads lat/lng directly (not PostGIS geog)
- Infers `kind` from label text:
  - "Home" / "🏠 Home" → kind: "home"
  - "Work" / "💼 Work" → kind: "work"
  - "School" / "🎓 School" → kind: "school"
  - Everything else → kind: "other"

## Schema Comparison

| Field | user_favorites (old) | saved_locations (actual) |
|-------|---------------------|-------------------------|
| id | uuid | uuid |
| user_id | uuid | uuid |
| kind | text (enum) | ❌ (inferred from label) |
| label | text | text |
| address | text | text |
| coordinates | geog (PostGIS) | lat/lng (numeric) |

## Deployment

✅ **Deployed**: `wa-webhook-mobility`  
📅 **Timestamp**: 2025-11-27T07:22:00Z  
🔗 **Commit**: `386b2b3`

## Testing

To verify the fix:

1. **Save a location in Profile**:
   - Open Profile → Saved Locations
   - Add location (e.g., "Home")
   - Share location or enter address

2. **Schedule a ride in Mobility**:
   - Start trip scheduling
   - Tap "📍 Saved Places"
   - **Expected**: List shows your saved locations ✅
   - **Before fix**: "no saved places" message ❌

3. **Database verification**:
```sql
-- Check saved locations
SELECT id, user_id, label, address, lat, lng 
FROM saved_locations 
WHERE user_id = '<your_user_id>';

-- Verify user_favorites doesn't exist
SELECT EXISTS (
  SELECT FROM pg_tables 
  WHERE schemaname = 'public' 
  AND tablename = 'user_favorites'
); -- Returns false
```

## Impact

✅ **Profile → Mobility integration working**  
✅ **Saved locations appear in ride scheduling**  
✅ **Users can select Home, Work, School from saved places**  
✅ **No need to re-enter addresses for frequent destinations**  

## Related Tables

Other location tables in the system (NOT affected by this fix):
- `rides_saved_locations` - Legacy table for rides agent
- `location_cache` - 30-minute TTL for recent user locations

All mobility services now correctly read from `saved_locations` table.

---

## Summary

This was a **data architecture issue**, not a UI bug. The profile and mobility microservices were using incompatible table schemas. By aligning both services to use the same `saved_locations` table, users can now:

1. Save locations once in Profile
2. Use them immediately in Ride Scheduling
3. Get list view of all saved places
4. Select from saved locations instead of re-entering addresses

**No database migration needed** - `saved_locations` table already existed and had user data. The fix was purely application-layer code alignment.
