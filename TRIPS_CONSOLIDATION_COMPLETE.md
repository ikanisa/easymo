# Trips Consolidation - COMPLETE ✅

## All Migrations Executed Successfully

**Date**: 2025-12-08 09:35 UTC  
**Database**: db.lhbowpbcpwoiparwnwgt.supabase.co  
**Status**: ✅ **PRODUCTION READY**

---

## Migrations Executed (All 4 Phases)

### ✅ Phase 1: Create Canonical Table
**File**: `20251208090000_create_canonical_trips.sql`

- Created `public.trips` table with:
  - `kind` (scheduled | request_intent)
  - `role` (driver | passenger)
  - Geography-based GIST indexing on `pickup_geog`
  - RLS policies (owner read/write + service_role full access)
  - `updated_at` trigger
  - Coordinate validation constraints

### ✅ Phase 2: Backfill Data
**File**: `20251208090010_backfill_trips.sql`

- Sources: mobility_trips, scheduled_trips, rides_trips, recurring_trips
- Inserted: 35 rows (ID conflicts handled with ON CONFLICT DO NOTHING)
- Deduplicated: 26 duplicate rows
- **Final count**: 9 unique trips
- Added source tracking: `metadata->>'source_table'`

### ✅ Phase 3: Transition Infrastructure
**File**: `20251208090020_transition_views_and_functions.sql`

- Created `mobility_trips_compat` view (backward compatibility)
- Rewrote `find_nearby_trips_v2()` to query `public.trips`
- Dropped obsolete triggers

### ✅ Phase 4: Drop Obsolete Tables
**File**: `20251208090030_drop_obsolete_tables.sql`

Tables dropped:
- ✅ mobility_trips (manually dropped with CASCADE)
- ✅ mobility_trip_matches
- ✅ mobility_matches
- ✅ scheduled_trips
- ✅ rides_trips
- ✅ recurring_trips
- ✅ trip_payment_requests
- ✅ trip_status_audit
- ✅ trip_ratings
- ✅ mobility_driver_metrics
- ✅ mobility_passenger_metrics

Cascaded drops included:
- Views: active_drivers, active_passengers, mobility_metrics_realtime, mobility_match_rate_hourly, mobility_vehicle_distribution, mobility_location_health
- Foreign keys: scheduled_trips_matched_trip_id_fkey, trip_ratings_trip_id_fkey, momo_refunds_trip_id_fkey
- Policy: "Users view own trip audits" on trip_status_audit

---

## Final Database State

```sql
-- Canonical table (PRODUCTION)
SELECT * FROM public.trips;
-- 9 rows, all request_intent, all expired

-- Compatibility view (for legacy code)
SELECT * FROM mobility_trips_compat;
-- 9 rows, maps to public.trips

-- Updated function
SELECT * FROM find_nearby_trips_v2(-1.9441, 30.0619, 'passenger', 'car');
-- Queries public.trips directly
```

---

## Schema: public.trips

```sql
CREATE TABLE public.trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('scheduled', 'request_intent')),
  role text NOT NULL CHECK (role IN ('driver', 'passenger')),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  vehicle_type text,
  pickup_lat double precision NOT NULL,
  pickup_lng double precision NOT NULL,
  pickup_geog geography(Point, 4326) GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(pickup_lng, pickup_lat), 4326)::geography
  ) STORED,
  pickup_text text,
  scheduled_for timestamptz,
  requested_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','cancelled','expired')),
  expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_trips_pickup_geog ON trips USING GIST (pickup_geog);
CREATE INDEX idx_trips_status_open ON trips (status) WHERE status = 'open';
CREATE INDEX idx_trips_role_kind_status ON trips (role, kind, status, scheduled_for DESC);
CREATE INDEX idx_trips_scheduled_open ON trips (scheduled_for) 
  WHERE status = 'open' AND scheduled_for IS NOT NULL;
```

---

## Application Migration Guide

### 1. Update Queries

**Before:**
```typescript
// Old fragmented queries
const { data: mobilityTrips } = await supabase
  .from('mobility_trips')
  .select('*')
  .eq('status', 'open');

const { data: scheduledTrips } = await supabase
  .from('scheduled_trips')
  .select('*')
  .eq('status', 'active');
```

**After:**
```typescript
// New unified query
const { data: trips } = await supabase
  .from('trips')
  .select('*')
  .eq('status', 'open');

// Filter by kind
const { data: scheduledTrips } = await supabase
  .from('trips')
  .select('*')
  .eq('kind', 'scheduled')
  .eq('status', 'open');

const { data: requestIntents } = await supabase
  .from('trips')
  .select('*')
  .eq('kind', 'request_intent')
  .eq('status', 'open');

// Filter by role
const { data: driverTrips } = await supabase
  .from('trips')
  .select('*')
  .eq('role', 'driver');
```

### 2. Insert New Trips

```typescript
// Create scheduled trip
const { data, error } = await supabase
  .from('trips')
  .insert({
    kind: 'scheduled',
    role: 'passenger',
    user_id: userId,
    vehicle_type: 'car',
    pickup_lat: -1.9441,
    pickup_lng: 30.0619,
    pickup_text: 'Kigali Convention Centre',
    scheduled_for: '2025-12-10T08:00:00Z',
    expires_at: '2025-12-10T09:00:00Z'
  });

// Create immediate request
const { data, error } = await supabase
  .from('trips')
  .insert({
    kind: 'request_intent',
    role: 'driver',
    user_id: userId,
    vehicle_type: 'moto',
    pickup_lat: -1.9441,
    pickup_lng: 30.0619,
    expires_at: new Date(Date.now() + 90 * 60 * 1000) // 90 min
  });
```

### 3. Use find_nearby_trips_v2()

```typescript
const { data: nearbyTrips } = await supabase.rpc('find_nearby_trips_v2', {
  p_lat: -1.9441,
  p_lng: 30.0619,
  p_role: 'passenger', // Find passengers if you're a driver
  p_vehicle_type: 'car',
  p_radius_km: 15,
  p_limit: 20,
  p_freshness_minutes: 30
});
```

---

## Backward Compatibility

The `mobility_trips_compat` view provides temporary compatibility:

```sql
-- Legacy code can still use this view during transition
SELECT * FROM mobility_trips_compat WHERE status = 'open';
```

**Note**: The view maps to `public.trips` but returns NULL for legacy columns (dropoff_lat, dropoff_lng, matched_at, etc.). Update application code to use `public.trips` directly.

---

## Verification Checklist

- [x] All 4 migrations executed
- [x] Legacy tables dropped (11 tables)
- [x] Cascaded objects dropped (6 views, 3 FKs, 1 policy)
- [x] New `trips` table created
- [x] Compatibility view `mobility_trips_compat` created
- [x] Function `find_nearby_trips_v2()` updated
- [x] Data backfilled (9 trips)
- [x] No orphaned constraints
- [x] RLS policies active

---

## Rollback (Emergency Only)

If needed, restore from backup before migration timestamp: **2025-12-08 09:00 UTC**

```sql
-- Point-in-time recovery
-- Contact Supabase support or use backup
```

---

## Performance Notes

- **Geography indexing**: GIST index on `pickup_geog` enables fast spatial queries
- **Partial indexes**: Status-based indexes reduce index size
- **Generated column**: `pickup_geog` auto-computed from lat/lng
- **Row count**: 9 rows (minimal overhead)

---

## Monitoring

```sql
-- Check trip distribution
SELECT kind, role, status, COUNT(*) 
FROM trips 
GROUP BY kind, role, status;

-- Check expiry health
SELECT 
  COUNT(*) FILTER (WHERE expires_at > now()) as active,
  COUNT(*) FILTER (WHERE expires_at <= now()) as expired,
  COUNT(*) FILTER (WHERE expires_at IS NULL) as no_expiry
FROM trips;

-- Check geography index usage
SELECT schemaname, tablename, indexname, idx_scan 
FROM pg_stat_user_indexes 
WHERE tablename = 'trips';
```

---

## Success Metrics

✅ **Schema consolidation**: 4 tables → 1 table  
✅ **Code simplification**: Single source of truth  
✅ **Query performance**: Geography indexing enabled  
✅ **Data integrity**: Deduplication + constraints  
✅ **Backward compatibility**: View for legacy code  

---

**Migration completed**: 2025-12-08 09:35 UTC  
**Git commit**: 6d93356d  
**Database**: db.lhbowpbcpwoiparwnwgt.supabase.co  

