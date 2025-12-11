# Location Implementation Audit Report

**Date:** 2025-12-11 **Auditor:** GitHub Copilot CLI **Scope:** Complete location implementation
across EasyMO platform

---

## Executive Summary

Location handling in EasyMO uses a **hybrid approach** combining:

- **PostGIS geography columns** for spatial queries (recommended, modern)
- **Separate lat/lng columns** for simple storage and compatibility
- **Haversine formula** for distance calculations where PostGIS unavailable

**Status:** 🟡 **Partially Standardized** - Multiple patterns exist, ongoing consolidation

---

## 1. Core Location Infrastructure

### 1.1 PostGIS Extension

**Status:** ✅ Enabled  
**Migration:** `20251208100000_enable_postgis.sql`

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
```

### 1.2 Standardized Configuration

**File:** `supabase/functions/_shared/location-config.ts`

**Key Constants:**

- Default search radius: **15km** (15,000m)
- Fresh location threshold: **60 minutes** (increased from 30)
- Stale location threshold: **120 minutes**
- Cache TTL: **60 minutes**

**Features:**

- ✅ Coordinate validation (lat: -90 to 90, lng: -180 to 180)
- ✅ PostGIS point creation helper
- ✅ Location freshness checking
- ✅ Coordinate normalization (handles lat/lng, latitude/longitude aliases)
- ✅ Cache key standardization

---

## 2. Location Column Patterns

### 2.1 Three Storage Patterns Found

#### Pattern A: PostGIS Geography (RECOMMENDED) ⭐

**Used by:** `business`, `trips` (mobility)

```sql
-- Separate columns for compatibility
latitude DECIMAL(10, 8)
longitude DECIMAL(11, 8)

-- PostGIS geography for spatial queries
location GEOGRAPHY(Point, 4326)

-- Auto-sync trigger
CREATE TRIGGER trigger_business_location_geography
BEFORE INSERT OR UPDATE OF latitude, longitude ON business
FOR EACH ROW EXECUTE FUNCTION update_business_location_geography();
```

**Advantages:**

- Efficient spatial indexing (GIST)
- Native distance calculations (ST_Distance, ST_DWithin)
- Handles Earth's curvature correctly
- Auto-synced from lat/lng

**Migrations:**

- `20251209220001_enhance_business_table_for_ai.sql` (business table)
- `20251209090000_fix_mobility_trips_alignment.sql` (trips table)

---

#### Pattern B: Separate Lat/Lng Only

**Used by:** `property_listings`, `job_listings`, driver_status (legacy columns)

```sql
latitude DECIMAL / DOUBLE PRECISION
longitude DECIMAL / DOUBLE PRECISION
```

**Distance Calculation:** Haversine formula in SQL

```sql
-- Example from property search
6371 * acos(
  cos(radians(p_lat)) * cos(radians(pl.latitude)) *
  cos(radians(pl.longitude) - radians(p_lng)) +
  sin(radians(p_lat)) * sin(radians(pl.latitude))
) AS distance_km
```

**Limitations:**

- No spatial indexing support
- Slower for proximity queries
- Manual distance calculations

---

#### Pattern C: Column Name Variations ⚠️

**Inconsistency Alert!**

Found variations across tables:

- `pickup_lat` / `pickup_lng` (trips)
- `dropoff_lat` / `dropoff_lng` (trips)
- `current_lat` / `current_lng` (driver_status - old)
- `lat` / `lng` (driver_status - new, recent_locations)
- `latitude` / `longitude` (business, property_listings)

**Status:** Partially standardized via `location-config.ts` normalizeLocation()

---

### 2.2 Generated Geography Columns

**trips table** uses generated columns for dropoff:

```sql
dropoff_geog geography(Point, 4326) GENERATED ALWAYS AS (
  CASE
    WHEN dropoff_lat IS NOT NULL AND dropoff_lng IS NOT NULL THEN
      ST_SetSRID(ST_MakePoint(dropoff_lng, dropoff_lat), 4326)::geography
    ELSE NULL
  END
) STORED
```

**Advantages:**

- Always in sync with source columns
- No trigger needed
- Automatic index updates

---

## 3. Domain-Specific Implementation

### 3.1 Mobility Domain (Trips & Drivers)

**Tables:**

- `trips` - Pickup & dropoff locations
- `driver_status` - Current driver location
- `recurring_trips` - Uses favorites (references)
- `trip_notifications` - Inherited from trips

**Location Storage:**

```sql
-- trips table
pickup_lat DOUBLE PRECISION
pickup_lng DOUBLE PRECISION
pickup_geog GEOGRAPHY(Point, 4326) GENERATED ALWAYS AS (...)

dropoff_lat DOUBLE PRECISION
dropoff_lng DOUBLE PRECISION
dropoff_geog GEOGRAPHY(Point, 4326) GENERATED ALWAYS AS (...)

-- driver_status table (legacy)
current_lat DOUBLE PRECISION
current_lng DOUBLE PRECISION
location GEOGRAPHY(Point, 4326)
```

**Matching Functions:** `match_drivers_for_trip_v2`, `match_passengers_for_trip_v2`

Uses PostGIS for proximity:

```sql
ST_Distance(t.pickup_geog, v_pickup_geog) < radius_m
```

**Migration History:**

1. `20251209090000_fix_mobility_trips_alignment.sql` - Added dropoff columns
2. `20251209151000_consolidate_mobility_functions.sql` - Cleaned up deprecated functions
3. `20251208192000_fix_mobility_matching_column_names.sql` - Fixed column references

---

### 3.2 Business/Marketplace Domain

**Table:** `business`

**Location Implementation:**

```sql
latitude DECIMAL(10, 8)
longitude DECIMAL(11, 8)
location GEOGRAPHY(Point, 4326) -- Auto-synced via trigger
address TEXT
location_text TEXT -- Human-readable fallback
```

**Search Functions:**

- `search_businesses_ai()` - Full-text + geospatial
- `find_nearby_businesses()` - Simple proximity

**Migration:** `20251209220001_enhance_business_table_for_ai.sql`

**Features:**

- PostGIS spatial indexing
- Relevance scoring (combines text match + distance + rating)
- Distance-based filtering
- Fallback to text location if coordinates missing

**Search Example:**

```sql
SELECT * FROM search_businesses_ai(
  'pharmacy',
  -1.9536,  -- lat
  30.0606,  -- lng (Kigali)
  5.0       -- radius_km
);
```

---

### 3.3 Real Estate Domain

**Table:** `property_listings`

**Location Storage:** **Lat/Lng only** (no PostGIS yet)

```sql
latitude DECIMAL
longitude DECIMAL
location TEXT -- Address/description
```

**Search Function:** `search_properties_unified()`

**Distance Calculation:** Haversine formula (manual)

**Migration:** `20251210212500_standardize_property_columns.sql`

**Status:** ⚠️ **Needs Upgrade** - Should migrate to PostGIS pattern

---

### 3.4 Jobs Domain

**Table:** `job_listings`

**Location Storage:**

```sql
lat DOUBLE PRECISION
lng DOUBLE PRECISION
location_geography GEOGRAPHY(Point, 4326) -- Generated column
location TEXT
```

**Status:** ✅ Uses PostGIS geography

**Migration:** `20251210163000_jobs_backward_compatibility.sql`

**Backward Compatibility:** Views maintained for old table names (`job_posts`)

---

### 3.5 Location Cache System

**Table:** `app.recent_locations`

**Purpose:** Cache user-shared locations for quick reuse

**Schema:**

```sql
user_id UUID
lat DOUBLE PRECISION
lng DOUBLE PRECISION
address TEXT
source TEXT -- 'whatsapp', 'map_pin', 'gps', etc.
context TEXT -- 'mobility', 'real_estate', 'jobs', etc.
expires_at TIMESTAMPTZ
```

**Migration:** `20251209103000_migrate_legacy_location_data.sql`

**Features:**

- Migrated from old `whatsapp_users.location_cache` JSONB
- TTL-based expiration
- Context-specific caching
- Multiple sources supported

**Usage Pattern:**

```typescript
const cacheKey = getLocationCacheKey(userId, "mobility");
// TTL: 60 minutes (from location-config.ts)
```

---

## 4. Edge Functions Location Handling

### 4.1 Core Functions

**File:** `supabase/functions/_shared/wa-webhook-shared/rpc/mobility.ts`

**Key Functions:**

#### recordDriverPresence()

```typescript
{
  user_id: userId,
  vehicle_type: params.vehicleType,
  lat: params.lat,
  lng: params.lng,
  location: `SRID=4326;POINT(${params.lng} ${params.lat})`, // WKT format
  online: true
}
```

#### insertTrip()

```typescript
{
  pickup_lat: params.lat,
  pickup_lng: params.lng,
  pickup_text: params.pickupText ?? null,
  // Coordinates validated before insertion:
  // lat: [-90, 90], lng: [-180, 180]
}
```

**Validation:**

- ✅ Checks for finite numbers
- ✅ Validates coordinate ranges
- ✅ Uses WKT format for PostGIS columns

---

### 4.2 Location Tools

**Found in:**

- `supabase/functions/_shared/tool-executor.ts`
- `supabase/functions/wa-agent-waiter/core/bar-search.ts`
- `supabase/functions/geocode-locations/index.ts`
- `supabase/functions/ingest-businesses/index.ts`

**Common Pattern:**

```typescript
import { validateCoordinates, makePostGISPoint } from "../_shared/location-config.ts";

const coords = validateCoordinates({ lat, lng });
const geog = makePostGISPoint(coords);
```

---

## 5. Indexing Strategy

### 5.1 PostGIS Spatial Indexes (GIST)

**business table:**

```sql
CREATE INDEX idx_business_location ON business USING GIST(location);
```

**trips table:**

```sql
CREATE INDEX idx_trips_pickup_geog ON trips USING GIST(pickup_geog);
CREATE INDEX idx_trips_dropoff_geog ON trips USING GIST(dropoff_geog)
  WHERE dropoff_geog IS NOT NULL;
```

**Performance:** GIST indexes enable fast spatial queries (ST_DWithin, ST_Distance)

---

### 5.2 Coordinate Validation Constraints

**trips table:**

```sql
ALTER TABLE trips ADD CONSTRAINT trips_valid_coordinates CHECK (
  pickup_lat BETWEEN -90 AND 90
  AND pickup_lng BETWEEN -180 AND 180
  AND (dropoff_lat IS NULL OR dropoff_lat BETWEEN -90 AND 90)
  AND (dropoff_lng IS NULL OR dropoff_lng BETWEEN -180 AND 180)
);
```

---

## 6. Issues & Inconsistencies

### 🔴 Critical Issues

#### 6.1 Inconsistent Column Naming

**Severity:** Medium  
**Impact:** Developer confusion, code duplication

**Examples:**

- `latitude` vs `lat`
- `longitude` vs `lng`
- `current_lat` vs `pickup_lat` vs `lat`

**Recommendation:** Standardize on `lat`/`lng` for consistency with TypeScript conventions

---

#### 6.2 Mixed Distance Calculation Methods

**Severity:** Medium  
**Impact:** Performance, accuracy inconsistency

**Found:**

- PostGIS `ST_Distance()` (business, trips)
- Haversine formula (property_listings)
- No distance calculation (some tables)

**Recommendation:** Migrate all tables to PostGIS geography pattern

---

#### 6.3 Property Listings Lacks PostGIS

**Severity:** Low  
**Impact:** Slower proximity queries for real estate

**Status:** Property search uses Haversine in SQL

**Recommendation:** Add geography column + trigger like business table

---

### 🟡 Minor Issues

#### 6.4 Location Cache Not Used Everywhere

**Severity:** Low  
**Impact:** Users re-enter locations

**Status:** Implemented for mobility, not consistent across all domains

**Recommendation:** Enforce location cache usage in all location-requesting flows

---

#### 6.5 No Geocoding Automation

**Severity:** Low  
**Impact:** Text addresses not converted to coordinates

**Found:** Edge function `geocode-locations` exists but not integrated

**Recommendation:** Auto-geocode on address entry

---

## 7. Best Practices Observed

### ✅ What's Working Well

1. **Trigger-based Geography Sync**
   - Automatic sync from lat/lng to geography
   - Zero maintenance overhead
   - Always consistent

2. **Generated Columns**
   - Used for dropoff_geog in trips
   - Eliminates trigger complexity
   - Database-guaranteed consistency

3. **Coordinate Validation**
   - TypeScript validation in edge functions
   - SQL CHECK constraints in database
   - Prevents bad data entry

4. **Location Configuration Module**
   - Single source of truth for constants
   - Reusable validation logic
   - Type-safe coordinate handling

5. **Spatial Indexing**
   - GIST indexes on all geography columns
   - Fast proximity queries
   - Production-ready performance

---

## 8. Migration Timeline

**Early (2024):**

- Initial tables with separate lat/lng

**Mid (2025-Q1):**

- PostGIS enabled
- Mobility tables upgraded to geography

**Recent (2025-12-08 to 2025-12-10):**

- Business table enhanced with PostGIS
- Location cache consolidated
- Standardization efforts

---

## 9. Recommendations

### 🎯 High Priority

1. **Standardize All Tables to PostGIS Pattern**
   - Migrate `property_listings` to geography column
   - Ensure all new tables follow Pattern A
   - Document as standard pattern

2. **Unify Column Names**
   - Pick `lat`/`lng` as standard
   - Create migration guide for deprecated names
   - Update TypeScript interfaces

3. **Enforce Location Cache**
   - Add to all domains (jobs, real estate, marketplace)
   - Consistent TTL across platform
   - Clear cache invalidation rules

### 📋 Medium Priority

4. **Geocoding Integration**
   - Auto-geocode text addresses on entry
   - Fallback to manual coordinates if geocoding fails
   - Cache geocoding results

5. **Location Validation Middleware**
   - Centralized validation for all APIs
   - Consistent error messages
   - Telemetry for invalid location attempts

6. **Documentation**
   - Create location handling guide
   - Pattern examples for each domain
   - Migration playbook for new tables

---

## 10. Code Examples

### Recommended Pattern for New Tables

```sql
BEGIN;

CREATE TABLE my_new_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Location columns (standard pattern)
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  location GEOGRAPHY(Point, 4326),
  address TEXT,

  -- Coordinate validation
  CONSTRAINT valid_coordinates CHECK (
    lat BETWEEN -90 AND 90 AND
    lng BETWEEN -180 AND 180
  )
);

-- Auto-sync geography column
CREATE OR REPLACE FUNCTION sync_my_new_table_location()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.location = ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
  ELSE
    NEW.location = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_my_new_table_location
BEFORE INSERT OR UPDATE OF lat, lng ON my_new_table
FOR EACH ROW
EXECUTE FUNCTION sync_my_new_table_location();

-- Spatial index
CREATE INDEX idx_my_new_table_location
  ON my_new_table USING GIST(location);

COMMIT;
```

### TypeScript Usage

```typescript
import { validateCoordinates, makePostGISPoint } from "../_shared/location-config.ts";

// Validate user input
const coords = validateCoordinates({ lat: -1.9536, lng: 30.0606 });

// Insert with PostGIS
const { data, error } = await supabase.from("my_new_table").insert({
  lat: coords.lat,
  lng: coords.lng,
  address: "Kigali, Rwanda",
});

// Proximity search
const { data: nearby } = await supabase.rpc("find_nearby_items", {
  p_lat: coords.lat,
  p_lng: coords.lng,
  p_radius_km: 10,
});
```

---

## 11. Summary

**Overall Assessment:** 🟡 **Good Foundation, Needs Standardization**

**Strengths:**

- ✅ PostGIS properly enabled and used in key tables
- ✅ Modern pattern (geography + trigger) established
- ✅ Location validation in place
- ✅ Spatial indexing configured
- ✅ Location cache system implemented

**Weaknesses:**

- ⚠️ Inconsistent column naming across tables
- ⚠️ Mixed distance calculation methods
- ⚠️ Not all tables using PostGIS yet
- ⚠️ Location cache not universally adopted

**Next Steps:**

1. Migrate property_listings to PostGIS
2. Standardize column names to lat/lng
3. Create comprehensive location handling docs
4. Enforce location cache usage platform-wide

---

**End of Report**
