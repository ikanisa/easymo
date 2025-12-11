# Location Implementation Guide

**Status:** ✅ Standardized as of 2025-12-11  
**Migration:** `20251211021500_standardize_location_implementation.sql`

This guide documents the standardized location implementation across EasyMO.

---

## Table of Contents

1. [Overview](#overview)
2. [Standard Pattern](#standard-pattern)
3. [Database Functions](#database-functions)
4. [TypeScript Usage](#typescript-usage)
5. [Domain-Specific Examples](#domain-specific-examples)
6. [Migration Guide](#migration-guide)

---

## Overview

### Technology Stack

- **PostGIS**: Spatial database extension for efficient geographic queries
- **Geography Type**: SRID 4326 (WGS84) for accurate distance calculations
- **GIST Indexes**: Fast spatial queries
- **Auto-sync Triggers**: Keep lat/lng and geography columns in sync

### Key Components

1. **Database Layer**: PostGIS geography columns + triggers
2. **RPC Functions**: Standardized location operations
3. **TypeScript Service**: `location-service/index.ts` - unified API
4. **Location Config**: `location-config.ts` - constants and validation

---

## Standard Pattern

### For New Tables

When adding location support to a new table:

```sql
BEGIN;

-- 1. Add location columns
ALTER TABLE my_new_table
  ADD COLUMN lat DOUBLE PRECISION NOT NULL,
  ADD COLUMN lng DOUBLE PRECISION NOT NULL,
  ADD COLUMN location_geog GEOGRAPHY(Point, 4326),
  ADD COLUMN address TEXT;

-- 2. Add coordinate validation
ALTER TABLE my_new_table
  ADD CONSTRAINT my_new_table_valid_coordinates CHECK (
    lat BETWEEN -90 AND 90 AND
    lng BETWEEN -180 AND 180
  );

-- 3. Create auto-sync trigger
CREATE OR REPLACE FUNCTION sync_my_new_table_location()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.location_geog = ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
  ELSE
    NEW.location_geog = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_my_new_table_location
BEFORE INSERT OR UPDATE OF lat, lng ON my_new_table
FOR EACH ROW
EXECUTE FUNCTION sync_my_new_table_location();

-- 4. Add spatial index
CREATE INDEX idx_my_new_table_location_geog
  ON my_new_table USING GIST(location_geog)
  WHERE location_geog IS NOT NULL;

-- 5. Document the columns
COMMENT ON COLUMN my_new_table.lat IS
  'Latitude (WGS84). Auto-synced to location_geog.';
COMMENT ON COLUMN my_new_table.lng IS
  'Longitude (WGS84). Auto-synced to location_geog.';
COMMENT ON COLUMN my_new_table.location_geog IS
  'PostGIS geography. Auto-populated from lat/lng. Use for spatial queries.';

COMMIT;
```

### Column Naming Standard

✅ **Use these names:**

- `lat` (DOUBLE PRECISION)
- `lng` (DOUBLE PRECISION)
- `location_geog` (GEOGRAPHY)
- `address` (TEXT, optional)

❌ **Avoid these deprecated names:**

- `latitude` / `longitude` (use lat/lng)
- `current_lat` / `current_lng` (use lat/lng)
- `pickup_lat` / `dropoff_lat` (OK for trips domain specifics)

---

## Database Functions

### Location Caching

#### `cache_user_location()`

Cache a user's location for future use.

```sql
SELECT cache_user_location(
  p_user_id := 'user-uuid',
  p_lat := -1.9536,
  p_lng := 30.0606,
  p_address := 'Kigali, Rwanda',
  p_source := 'user_input',
  p_context := 'mobility',
  p_ttl_hours := 24
);
```

**Parameters:**

- `p_user_id` (UUID): User ID
- `p_lat` (DOUBLE PRECISION): Latitude
- `p_lng` (DOUBLE PRECISION): Longitude
- `p_address` (TEXT): Human-readable address (optional)
- `p_source` (TEXT): Source of location ('user_input', 'gps', 'map_pin', etc.)
- `p_context` (TEXT): Domain context ('mobility', 'jobs', 'real_estate', etc.)
- `p_ttl_hours` (INTEGER): Time-to-live in hours

**Returns:** UUID of cached location

---

#### `get_recent_location()`

Retrieve user's most recent cached location for a context.

```sql
SELECT * FROM get_recent_location(
  p_user_id := 'user-uuid',
  p_context := 'mobility',
  p_max_age_minutes := 60
);
```

**Returns:**

```
lat            | DOUBLE PRECISION
lng            | DOUBLE PRECISION
address        | TEXT
source         | TEXT
cached_at      | TIMESTAMPTZ
age_minutes    | INTEGER
```

---

### Proximity Search

#### `find_nearby_items()`

Universal proximity search - works with any table.

```sql
SELECT * FROM find_nearby_items(
  p_table_name := 'businesses',
  p_lat := -1.9536,
  p_lng := 30.0606,
  p_radius_km := 5.0,
  p_limit := 20,
  p_where_clause := 'is_active = true'
);
```

**Returns:**

```
item_data      | JSONB          -- Full row as JSON
distance_km    | DOUBLE PRECISION
```

**Auto-detection:**

- Tries to use PostGIS geography column first
- Falls back to Haversine formula on lat/lng
- Supports custom WHERE clauses

---

### Domain-Specific Functions

#### Properties: `search_properties_unified_v2()`

```sql
SELECT * FROM search_properties_unified_v2(
  p_location := 'Kigali',
  p_lat := -1.9536,
  p_lng := 30.0606,
  p_radius_km := 10,
  p_price_min := 100000,
  p_price_max := 500000,
  p_bedrooms := 2,
  p_property_type := 'apartment',
  p_listing_type := 'rent',
  p_limit := 10
);
```

#### Businesses: `search_businesses_ai()`

```sql
SELECT * FROM search_businesses_ai(
  p_query := 'pharmacy',
  p_lat := -1.9536,
  p_lng := 30.0606,
  p_radius_km := 5.0,
  p_limit := 10
);
```

---

## TypeScript Usage

### Import Location Service

```typescript
import {
  cacheLocationWithContext,
  getCachedLocationByContext,
  searchNearbyItems,
  MobilityLocation,
  JobsLocation,
  RealEstateLocation,
  MarketplaceLocation,
} from "../_shared/location-service/index.ts";
```

### Basic Operations

#### Cache a Location

```typescript
// General caching
const locationId = await cacheLocationWithContext(
  supabase,
  userId,
  {
    lat: -1.9536,
    lng: 30.0606,
    address: "Kigali Convention Centre",
  },
  {
    context: "jobs",
    source: "user_input",
    ttlHours: 24,
  }
);
```

#### Retrieve Cached Location

```typescript
const cachedLocation = await getCachedLocationByContext(
  supabase,
  userId,
  "jobs", // context
  60 // max age in minutes
);

if (cachedLocation) {
  console.log(`Location: ${cachedLocation.lat}, ${cachedLocation.lng}`);
  console.log(`Age: ${cachedLocation.age_minutes} minutes`);
}
```

#### Universal Proximity Search

```typescript
const results = await searchNearbyItems(supabase, {
  tableName: "businesses",
  lat: -1.9536,
  lng: 30.0606,
  radiusKm: 5,
  whereClause: "category = 'restaurant'",
  limit: 20,
});

results.forEach((result) => {
  console.log(`${result.item.name} - ${result.distance_km.toFixed(2)}km away`);
});
```

---

## Domain-Specific Examples

### Mobility (Rides/Drivers)

```typescript
import { MobilityLocation } from "../_shared/location-service/index.ts";

// Cache driver location
await MobilityLocation.cacheDriverLocation(supabase, driverId, {
  lat: -1.9536,
  lng: 30.0606,
});

// Get recent driver location (2 hour TTL)
const driverLocation = await MobilityLocation.getCachedDriverLocation(supabase, driverId);
```

### Jobs

```typescript
import { JobsLocation } from "../_shared/location-service/index.ts";

// Cache job search location (7 day TTL)
await JobsLocation.cacheSearchLocation(supabase, userId, {
  lat: -1.9536,
  lng: 30.0606,
  address: "Kigali",
});

// Search nearby jobs (50km radius)
const nearbyJobs = await JobsLocation.searchNearbyJobs(
  supabase,
  -1.9536,
  30.0606,
  50 // radiusKm
);
```

### Real Estate

```typescript
import { RealEstateLocation } from "../_shared/location-service/index.ts";

// Cache property search location
await RealEstateLocation.cacheSearchLocation(supabase, userId, {
  lat: -1.9536,
  lng: 30.0606,
  address: "Kimironko, Kigali",
});

// Search nearby properties with filters
const properties = await RealEstateLocation.searchNearbyProperties(supabase, {
  lat: -1.9536,
  lng: 30.0606,
  radiusKm: 10,
  priceMin: 100000,
  priceMax: 500000,
  bedrooms: 2,
  propertyType: "apartment",
  listingType: "rent",
});
```

### Marketplace (Businesses)

```typescript
import { MarketplaceLocation } from "../_shared/location-service/index.ts";

// Cache search location
await MarketplaceLocation.cacheSearchLocation(supabase, userId, {
  lat: -1.9536,
  lng: 30.0606,
});

// Search businesses with natural language
const businesses = await MarketplaceLocation.searchNearbyBusinesses(
  supabase,
  "pharmacy", // query
  -1.9536, // lat
  30.0606, // lng
  5 // radiusKm
);
```

---

## Migration Guide

### Migrating Existing Tables

If you have an existing table with location data:

#### 1. Add PostGIS Support

```sql
-- Add geography column
ALTER TABLE existing_table
  ADD COLUMN IF NOT EXISTS location_geog GEOGRAPHY(Point, 4326);

-- Backfill from existing lat/lng
UPDATE existing_table
SET location_geog = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
WHERE lat IS NOT NULL AND lng IS NOT NULL AND location_geog IS NULL;

-- Add trigger for future inserts/updates
CREATE TRIGGER trigger_existing_table_location
BEFORE INSERT OR UPDATE OF lat, lng ON existing_table
FOR EACH ROW
EXECUTE FUNCTION sync_existing_table_location();

-- Add spatial index
CREATE INDEX idx_existing_table_location_geog
  ON existing_table USING GIST(location_geog)
  WHERE location_geog IS NOT NULL;
```

#### 2. Update Code

**Before:**

```typescript
// Manual Haversine distance calculation
const distance = calculateHaversineDistance(point1, point2);
```

**After:**

```typescript
// Use PostGIS via RPC
const results = await searchNearbyItems(supabase, {
  tableName: "existing_table",
  lat: point.lat,
  lng: point.lng,
  radiusKm: 10,
});
```

#### 3. Update Search Functions

**Before:**

```sql
-- Manual Haversine formula
SELECT *,
  (6371 * acos(
    cos(radians(p_lat)) * cos(radians(lat)) *
    cos(radians(lng) - radians(p_lng)) +
    sin(radians(p_lat)) * sin(radians(lat))
  )) AS distance_km
FROM existing_table
HAVING distance_km <= p_radius_km;
```

**After:**

```sql
-- Use PostGIS
SELECT *,
  ST_Distance(location_geog, p_search_point) / 1000.0 AS distance_km
FROM existing_table
WHERE ST_DWithin(location_geog, p_search_point, p_radius_km * 1000)
ORDER BY location_geog <-> p_search_point;
```

---

## Best Practices

### ✅ Do

1. **Always validate coordinates** before storing
2. **Use location cache** for repeated queries
3. **Use PostGIS geography** for new tables
4. **Add spatial indexes** on all geography columns
5. **Use context-specific caching** (mobility, jobs, etc.)
6. **Set appropriate TTLs** based on use case

### ❌ Don't

1. **Don't use string concatenation** for coordinates
2. **Don't store coordinates in JSONB** (use proper columns)
3. **Don't use deprecated column names** (latitude/longitude)
4. **Don't calculate distances client-side** (use PostGIS)
5. **Don't cache sensitive location data** without consent
6. **Don't use infinite TTLs** on cached locations

---

## Performance Tips

### Spatial Indexes

Always create GIST indexes on geography columns:

```sql
CREATE INDEX idx_table_location_geog
  ON table_name USING GIST(location_geog);
```

### Query Optimization

Use `ST_DWithin` for radius searches (uses index):

```sql
-- Fast: Uses spatial index
WHERE ST_DWithin(location_geog, point, radius_m)

-- Slow: Sequential scan
WHERE ST_Distance(location_geog, point) <= radius_m
```

### Batch Operations

For bulk location operations, use transactions:

```sql
BEGIN;
-- Multiple inserts/updates
COMMIT;
```

---

## Troubleshooting

### Issue: "function st_distance does not exist"

**Solution:** PostGIS extension not enabled. Run:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

### Issue: "Invalid coordinates"

**Solution:** Check validation constraints:

- Latitude: -90 to 90
- Longitude: -180 to 180

### Issue: Slow proximity queries

**Solution:** Check for spatial index:

```sql
CREATE INDEX IF NOT EXISTS idx_table_geog
  ON table_name USING GIST(location_geog);
```

---

## Related Documentation

- [Location Audit Report](./LOCATION_AUDIT_REPORT.md) - Full audit results
- [PostGIS Documentation](https://postgis.net/documentation/)
- [Ground Rules](./GROUND_RULES.md) - General coding standards

---

**Last Updated:** 2025-12-11  
**Maintained By:** EasyMO Platform Team
