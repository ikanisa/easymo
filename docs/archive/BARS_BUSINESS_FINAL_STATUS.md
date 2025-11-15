# 🎯 Bars & Business Tables - Final Status Report

**Date**: November 12, 2025, 8:43 PM UTC  
**Database**: Supabase Production (lhbowpbcpwoiparwnwgt)  
**Status**: ✅ **COMPLETE - READY FOR GEOCODING**

---

## 📊 Summary

| Table | Records | Duplicates | Schema | Coordinates | Ready |
|-------|---------|------------|--------|-------------|-------|
| **bars** | 306 | 0 | ✅ Complete | 0/306 (0%) | ✅ Yes |
| **business** | 885 | 0 | ✅ Complete | 0/885 (0%) | ✅ Yes |

---

## ✅ Completed Work

### 1. **Table Cleanup & Deduplication**
- ✅ Removed all duplicate entries
- ✅ Added unique constraints:
  - `bars`: unique on `slug`
  - `business`: unique on (`name`, `owner_whatsapp`)

### 2. **Schema Enhancements**
Both tables now have:
- ✅ `lat` DOUBLE PRECISION - Latitude coordinate
- ✅ `lng` DOUBLE PRECISION - Longitude coordinate  
- ✅ `location` GEOGRAPHY(POINT, 4326) - PostGIS geography for spatial queries
- ✅ Auto-update triggers that sync `location` when `lat`/`lng` changes
- ✅ Spatial indexes for efficient location-based queries

### 3. **Utility Functions Created**
```sql
-- Coordinate extraction from Google Maps URLs
extract_coordinates_from_google_maps_url(url TEXT)

-- Batch coordinate updates
update_bars_with_coordinates_from_url()
update_business_with_coordinates_from_url()

-- Address geocoding (requires API key)
geocode_address(address TEXT)
batch_geocode_bars()
batch_geocode_businesses()

-- Plus Code parsing
parse_plus_code_coordinates(plus_code TEXT)
```

---

## 🚀 Next Steps: Populate Coordinates

### Option 1: Google Maps Geocoding API (Recommended)

**Cost**: ~$0.005 per address = ~$6 total for 1,191 records

```sql
-- 1. Set your API key
ALTER DATABASE postgres SET app.google_maps_api_key = 'YOUR_API_KEY_HERE';

-- 2. Geocode all bars (306 records)
SELECT batch_geocode_bars();

-- 3. Geocode all businesses (885 records)
SELECT batch_geocode_businesses();

-- 4. Verify results
SELECT 
  'bars' as table_name,
  COUNT(*) as total,
  COUNT(location) as with_coords,
  ROUND(COUNT(location)::NUMERIC / COUNT(*) * 100, 1) as percentage
FROM public.bars
UNION ALL
SELECT 
  'business' as table_name,
  COUNT(*) as total,
  COUNT(location) as with_coords,
  ROUND(COUNT(location)::NUMERIC / COUNT(*) * 100, 1) as percentage
FROM public.business;
```

### Option 2: Manual Entry (For High-Priority Locations)

```sql
-- Update a specific bar
UPDATE public.bars 
SET lat = -1.9441, lng = 30.0619 
WHERE slug = 'bahamas-pub';
-- location column updates automatically via trigger!

-- Update a specific business
UPDATE public.business 
SET lat = -1.9578, lng = 30.1127 
WHERE name = 'Kigali City Market';
```

### Option 3: Parse Plus Codes

Some location_text fields contain Plus Codes (e.g., "24F3+WVC"):

```sql
-- Find records with Plus Codes
SELECT id, name, location_text 
FROM public.bars 
WHERE location_text ~ '[0-9A-Z]{4}\+[0-9A-Z]{2,3}';

-- Parse Plus Code and update
UPDATE public.bars 
SET lat = (SELECT lat FROM parse_plus_code_coordinates('24F3+WVC')),
    lng = (SELECT lng FROM parse_plus_code_coordinates('24F3+WVC'))
WHERE location_text LIKE '%24F3+WVC%';
```

---

## 🗺️ Spatial Queries (Once Coordinates Are Populated)

### Find Nearby Bars
```sql
-- Find bars within 5km of a point
SELECT 
  name, 
  slug,
  location_text,
  ST_Distance(
    location,
    ST_SetSRID(ST_MakePoint(30.0619, -1.9441), 4326)::geography
  ) / 1000 as distance_km
FROM public.bars
WHERE location IS NOT NULL
  AND ST_DWithin(
    location,
    ST_SetSRID(ST_MakePoint(30.0619, -1.9441), 4326)::geography,
    5000  -- 5km radius in meters
  )
ORDER BY distance_km
LIMIT 10;
```

### Find Closest Businesses by Category
```sql
SELECT 
  name,
  location_text,
  category_id,
  ST_Distance(
    location,
    ST_SetSRID(ST_MakePoint(30.0619, -1.9441), 4326)::geography
  ) / 1000 as distance_km
FROM public.business
WHERE location IS NOT NULL
  AND category_id = 'Pharmacy'
ORDER BY location <-> ST_SetSRID(ST_MakePoint(30.0619, -1.9441), 4326)::geography
LIMIT 5;
```

---

## 📁 Migration Files

1. **`supabase/migrations/20251112214500_populate_bars_table.sql`**
   - Inserts 306 bars with schema

2. **`supabase/migrations/20251112214600_cleanup_add_coords_fixed.sql`**
   - Deduplication logic
   - Coordinate column additions
   - Utility functions
   - Triggers and indexes

---

## 🔍 Verification Commands

```sql
-- Check for duplicates
SELECT slug, COUNT(*) 
FROM public.bars 
GROUP BY slug 
HAVING COUNT(*) > 1;

SELECT name, owner_whatsapp, COUNT(*) 
FROM public.business 
GROUP BY name, owner_whatsapp 
HAVING COUNT(*) > 1;

-- Check coordinate coverage
SELECT 
  COUNT(*) as total_bars,
  COUNT(lat) as with_lat,
  COUNT(lng) as with_lng,
  COUNT(location) as with_location,
  ROUND(COUNT(location)::NUMERIC / COUNT(*) * 100, 1) || '%' as coverage
FROM public.bars;

SELECT 
  COUNT(*) as total_businesses,
  COUNT(lat) as with_lat,
  COUNT(lng) as with_lng,
  COUNT(location) as with_location,
  ROUND(COUNT(location)::NUMERIC / COUNT(*) * 100, 1) || '%' as coverage
FROM public.business;

-- Check triggers
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name
FROM pg_trigger
WHERE tgname LIKE '%location%'
  AND tgrelid::regclass::text IN ('bars', 'business');
```

---

## ⚠️ Important Notes

1. **Catalog URLs**: The `catalog_url` and `google_maps_url` fields contain placeholder URLs, not parseable Google Maps URLs with coordinates.

2. **Location Text**: Most coordinate data must come from geocoding the `location_text` field.

3. **RLS Policies**: Both tables have Row Level Security enabled. Ensure appropriate policies exist for your use case.

4. **Foreign Keys**: Changes to these tables may affect:
   - `bar_managers`
   - `bar_numbers`
   - `bar_settings`
   - `bar_tables`
   - `categories`
   - `menus`
   - `items`
   - `orders`
   - `carts`

5. **Performance**: Once coordinates are populated, spatial queries will be very fast thanks to GIST indexes.

---

## 🎓 Resources

- **PostGIS Documentation**: https://postgis.net/docs/
- **Google Maps Geocoding API**: https://developers.google.com/maps/documentation/geocoding
- **Plus Codes**: https://plus.codes/
- **Geographic Coordinate System (WGS 84)**: SRID 4326

---

## 📞 Support

For questions or issues:
1. Check migration files in `supabase/migrations/`
2. Review function source: `\df+ function_name` in psql
3. Check trigger definitions: `\d+ table_name` in psql

---

**Status**: ✅ **TABLES READY FOR PRODUCTION USE**  
**Action Required**: Populate coordinates via geocoding API or manual entry

