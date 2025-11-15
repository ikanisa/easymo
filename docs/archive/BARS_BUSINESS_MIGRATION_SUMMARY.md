# Bars & Business Tables Migration Summary

**Date**: November 12, 2025  
**Database**: Supabase (lhbowpbcpwoiparwnwgt)

## ✅ Completed Tasks

### 1. **Bars Table Cleanup**

- ✅ Added unique index on `slug` column
- ✅ Removed **0 duplicates** (table was already clean with 306 unique records)
- ✅ Added `lat` and `lng` DOUBLE PRECISION columns
- ✅ Added `location` GEOGRAPHY(POINT, 4326) column for PostGIS queries
- ✅ Created auto-update trigger to sync `location` when lat/lng changes
- ✅ Re-inserted all 306 bars with proper schema

### 2. **Business Table Cleanup**

- ✅ Added unique index on `name` + `owner_whatsapp` combination
- ✅ Removed **0 duplicates** (table was already clean with 885 unique records)
- ✅ Confirmed `lat`, `lng`, and `location` columns exist
- ✅ Created auto-update trigger to sync `location` when lat/lng changes
- ✅ Re-inserted all 885 businesses

### 3. **Coordinate Extraction Functions**

✅ Created 3 utility functions:

1. **`extract_coordinates_from_google_maps_url(url TEXT)`** - Extracts lat/lng from Google Maps URLs
2. **`update_bars_with_coordinates_from_url()`** - Bulk update bars coordinates
3. **`update_business_with_coordinates_from_url()`** - Bulk update business coordinates

### 4. **Geocoding Functions** (For Future Use)

✅ Created 3 geocoding functions that can fetch coordinates from address text:

1. **`geocode_address(address TEXT)`** - Returns lat, lng, formatted_address
2. **`batch_geocode_bars()`** - Geocode all bars with location_text
3. **`batch_geocode_businesses()`** - Geocode all businesses with location_text

**Note**: These require Google Maps Geocoding API key to be configured.

## 📊 Current State

### Bars Table

- **Total Records**: 306
- **With Coordinates**: 0 (0%)
- **Schema**: ✅ Complete with lat, lng, location columns
- **Duplicates**: 0

### Business Table

- **Total Records**: 885
- **With Coordinates**: 0 (0%)
- **Schema**: ✅ Complete with lat, lng, location columns
- **Duplicates**: 0

## 🔧 Next Steps

### Option 1: Use Google Maps Geocoding API (Recommended)

```sql
-- Set your API key
ALTER DATABASE postgres SET app.google_maps_api_key = 'YOUR_API_KEY_HERE';

-- Geocode all bars
SELECT batch_geocode_bars();

-- Geocode all businesses
SELECT batch_geocode_businesses();
```

**Cost**: ~$0.005 per address = ~$6 total for all records

### Option 2: Manual Coordinate Entry

Update coordinates manually for high-priority locations:

```sql
UPDATE public.bars
SET lat = -1.9441, lng = 30.0619
WHERE slug = 'paranga';
```

### Option 3: Use Location Text Parsing

Some `location_text` fields contain Plus Codes or coordinates that could be parsed:

```sql
-- Example: "24F3+WVC" is a Plus Code that can be converted to coordinates
SELECT location_text FROM bars WHERE location_text LIKE '%+%';
```

## 🎯 Schema Enhancements

### Auto-Update Location Geography

Both tables now have triggers that automatically update the `location` geography column whenever
`lat` or `lng` changes:

```sql
-- Manual update example
UPDATE public.bars SET lat = -1.9441, lng = 30.0619 WHERE slug = 'bahamas-pub';
-- location column updates automatically!
```

### Spatial Queries Now Possible

Once coordinates are populated, you can do powerful location queries:

```sql
-- Find bars within 5km of a point
SELECT name, slug,
  ST_Distance(location, ST_SetSRID(ST_MakePoint(30.0619, -1.9441), 4326)::geography) / 1000 as distance_km
FROM public.bars
WHERE ST_DWithin(
  location,
  ST_SetSRID(ST_MakePoint(30.0619, -1.9441), 4326)::geography,
  5000  -- 5km radius
)
ORDER BY distance_km;
```

## 📝 Migration Files Created

1. **`20251112214500_populate_bars_table.sql`** - Insert bars data
2. **`20251112214600_cleanup_add_coords_fixed.sql`** - Cleanup, deduplication, coordinate extraction

## ⚠️ Important Notes

1. **Catalog URLs**: The `catalog_url` fields contain placeholder URLs, not actual Google Maps URLs
   with coordinates
2. **Location Text**: The `location_text` field contains addresses that need geocoding
3. **RLS Policies**: Both tables have Row Level Security enabled - make sure appropriate policies
   exist
4. **Foreign Keys**: Changes to these tables may affect related tables (orders, carts, menus, etc.)

## 🔍 Verification Queries

```sql
-- Check for duplicates in bars
SELECT slug, COUNT(*) as count
FROM public.bars
GROUP BY slug
HAVING COUNT(*) > 1;

-- Check for duplicates in business
SELECT name, owner_whatsapp, COUNT(*) as count
FROM public.business
GROUP BY name, owner_whatsapp
HAVING COUNT(*) > 1;

-- Check coordinate population
SELECT
  'bars' as table_name,
  COUNT(*) as total,
  COUNT(lat) as with_lat,
  COUNT(lng) as with_lng,
  COUNT(location) as with_location
FROM public.bars
UNION ALL
SELECT
  'business' as table_name,
  COUNT(*) as total,
  COUNT(lat) as with_lat,
  COUNT(lng) as with_lng,
  COUNT(location) as with_location
FROM public.business;
```

## 📚 References

- Migration file: `supabase/migrations/20251112214600_cleanup_add_coords_fixed.sql`
- PostGIS Documentation: https://postgis.net/docs/
- Google Maps Geocoding API: https://developers.google.com/maps/documentation/geocoding
