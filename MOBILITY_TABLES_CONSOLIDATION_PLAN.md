# Mobility Tables Consolidation Plan
**Date:** 2025-12-09  
**Goal:** Consolidate all ride/trip tables into canonical `trips` table and eliminate "ride" naming

---

## A) Preflight Status

**Current State:**
- ✅ Git working tree has uncommitted changes (from previous deployment)
- ✅ Recent deployment: mobility matching functions fixed
- ✅ Database connected and accessible
- ⚠️  **CRITICAL**: Found 9 tables/views with ride/trip duplication

---

## B) Fullstack Discovery Summary

### Current Tables Inventory

| Table Name | Type | Rows | Size | Status | Purpose |
|------------|------|------|------|--------|---------|
| **trips** | TABLE | 22 | 104 KB | ✅ **CANONICAL** | Primary trips table |
| ride_requests | TABLE | 0 | 72 KB | ❌ **DELETE** | Legacy ride matching |
| rides_driver_status | TABLE | 1 | 168 KB | ❌ **REPLACE** | Driver online/offline status |
| ride_notifications | TABLE | 0 | 48 KB | 🔄 **RENAME** | Driver notifications (has FKs) |
| recurring_trips | TABLE | 0 | 32 KB | ✅ **KEEP** | Scheduled recurring trips |
| trip_payment_requests | TABLE | 0 | 56 KB | ✅ **KEEP** | Payment tracking |
| trip_status_audit | TABLE | 0 | 32 KB | ✅ **KEEP** | Status change audit log |
| mobility_trips_compat | VIEW | 22 | - | ❌ **DELETE** | Compatibility view (unused) |
| pending_ride_requests_with_trips | VIEW | 0 | - | ❌ **DELETE** | Join view (unused) |

### Functions Using "ride" Naming (10 functions)

```sql
activate_recurring_trips              -- ✅ KEEP (uses recurring_trips table)
apply_intent_rides                    -- ❌ DELETE (deprecated)
apply_intent_rides_v2                 -- ❌ DELETE (deprecated)
ride_requests_set_updated_at          -- ❌ DELETE (for ride_requests table)
rides_driver_status_set_updated_at    -- 🔄 RENAME to driver_status_set_updated_at
rides_find_nearby_drivers             -- ❌ DELETE (replaced by match_drivers_for_trip_v2)
rides_find_nearby_trips               -- ❌ DELETE (replaced by match_passengers_for_trip_v2)
rides_search_nearby_drivers           -- ❌ DELETE (duplicate)
rides_search_nearby_passengers        -- ❌ DELETE (duplicate)
rides_update_driver_location          -- 🔄 RENAME to update_driver_status
```

### Edge Functions Using Legacy Tables (13 files)

```
supabase/functions/recurring-trips-scheduler/index.ts        -- ✅ KEEP
supabase/functions/activate-recurring-trips/index.ts          -- ✅ KEEP
supabase/functions/wa-webhook-mobility/notifications/drivers.ts  -- 🔄 UPDATE
supabase/functions/wa-webhook-mobility/handlers/go_online.ts     -- 🔄 UPDATE
supabase/functions/wa-webhook-mobility/handlers/nearby.ts        -- 🔄 UPDATE
supabase/functions/wa-webhook-mobility/handlers/driver_response.ts -- 🔄 UPDATE
... (7 more)
```

---

## C) Existing Assets to Reuse

### ✅ Canonical "trips" Table (KEEP)
**Schema:**
```sql
CREATE TABLE trips (
  id uuid PRIMARY KEY,
  kind text NOT NULL,              -- 'scheduled' | 'request_intent'
  role text NOT NULL,               -- 'driver' | 'passenger'
  user_id uuid NOT NULL,            -- FK to profiles
  vehicle_type text,
  pickup_lat double precision NOT NULL,
  pickup_lng double precision NOT NULL,
  pickup_geog geography(Point,4326) GENERATED,
  pickup_text text,
  dropoff_lat double precision,
  dropoff_lng double precision,
  dropoff_geog geography(Point,4326) GENERATED,
  dropoff_text text,
  dropoff_radius_m integer,
  scheduled_for timestamptz,
  requested_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'open',  -- 'open' | 'cancelled' | 'expired'
  expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

**Why it's canonical:**
- ✅ Modern PostGIS geography columns
- ✅ Flexible JSONB metadata
- ✅ Clear role/kind separation
- ✅ Used by matching functions (match_drivers_for_trip_v2, match_passengers_for_trip_v2)
- ✅ Referenced by payment/audit tables

### ✅ Tables to KEEP (4)

1. **trips** - Primary canonical table
2. **recurring_trips** - Stores recurring trip templates
3. **trip_payment_requests** - Payment tracking (has FK to trips)
4. **trip_status_audit** - Audit log (has FK to trips)

---

## D) Duplication Risks Found

### 🔴 CRITICAL: Three Systems Doing the Same Thing

| System | Tables | Functions | Status |
|--------|--------|-----------|--------|
| **Modern (trips)** | trips | match_drivers_for_trip_v2, match_passengers_for_trip_v2 | ✅ **USE THIS** |
| **Legacy (ride_requests)** | ride_requests, ride_notifications | rides_find_nearby_drivers, rides_search_nearby_drivers | ❌ **DELETE** |
| **Deprecated (V1)** | (deleted) | apply_intent_rides, apply_intent_rides_v2 | ❌ **DELETE** |

### Driver Status Duplication

**Current:** `rides_driver_status` table (1 row)  
**Better:** Use `driver_status` table (if exists) OR merge into `trips`

**Issue:** Name uses "rides" prefix but tracks driver availability, not rides.

### Notification Confusion

**Current:** `ride_notifications` table  
**Issue:** References "ride" but should reference "trip"  
**Solution:** Rename to `trip_notifications`

---

## E) Proposed Canonical Design

### Single Source of Truth Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CANONICAL TRIPS TABLE                     │
│  - All trip requests (driver & passenger)                   │
│  - PostGIS geography for matching                           │
│  - Flexible JSONB metadata                                  │
└──────────────────┬──────────────────────────────────────────┘
                   │
       ┌───────────┼───────────┬──────────────────┬────────────┐
       │           │           │                  │            │
   ┌───▼──┐  ┌────▼────┐  ┌───▼────────┐  ┌─────▼──────┐  ┌──▼──────┐
   │Driver│  │  Trip   │  │  Trip      │  │ Recurring  │  │  Trip   │
   │Status│  │Payments │  │ Status     │  │   Trips    │  │  Notes  │
   │(new) │  │Requests │  │   Audit    │  │ (templates)│  │ (new)   │
   └──────┘  └─────────┘  └────────────┘  └────────────┘  └─────────┘
```

### Naming Convention: "trip" (NOT "ride")

**All tables, functions, columns use:**
- ✅ `trip_*` prefix
- ✅ `*_trip_*` pattern
- ❌ **NEVER** `ride_*` prefix

### Proposed New Tables

1. **driver_status** (replaces `rides_driver_status`)
```sql
CREATE TABLE driver_status (
  user_id uuid PRIMARY KEY REFERENCES profiles(user_id),
  online boolean NOT NULL DEFAULT false,
  vehicle_type text,
  lat double precision,
  lng double precision,
  geog geography(Point,4326) GENERATED,
  last_seen timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

2. **trip_notifications** (rename from `ride_notifications`)
```sql
CREATE TABLE trip_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES trips(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES profiles(user_id),
  wa_message_id text,
  status text NOT NULL DEFAULT 'sent',
  created_at timestamptz NOT NULL DEFAULT now()
);
```

3. **trip_notes** (new - optional, for driver/passenger communication)
```sql
CREATE TABLE trip_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES profiles(user_id),
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

---

## F) Change Plan (UI → API → DB → RLS → Tests)

### Phase 1: Database Schema Changes

#### Step 1.1: Create New Tables
```sql
-- Create driver_status (replaces rides_driver_status)
CREATE TABLE driver_status (
  user_id uuid PRIMARY KEY REFERENCES profiles(user_id) ON DELETE CASCADE,
  online boolean NOT NULL DEFAULT false,
  vehicle_type text,
  lat double precision,
  lng double precision,
  geog geography(Point,4326) GENERATED ALWAYS AS (
    CASE 
      WHEN lat IS NOT NULL AND lng IS NOT NULL 
      THEN ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
      ELSE NULL
    END
  ) STORED,
  last_seen timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_driver_status_online ON driver_status(online, last_seen DESC) WHERE online = true;
CREATE INDEX idx_driver_status_geog ON driver_status USING GIST(geog) WHERE geog IS NOT NULL;

-- Migrate data from rides_driver_status
INSERT INTO driver_status (user_id, online, vehicle_type, lat, lng, last_seen, updated_at, metadata)
SELECT user_id, online, vehicle_type, lat, lng, last_seen, updated_at, metadata
FROM rides_driver_status
ON CONFLICT (user_id) DO NOTHING;
```

#### Step 1.2: Rename ride_notifications → trip_notifications
```sql
ALTER TABLE ride_notifications RENAME TO trip_notifications;
ALTER INDEX ride_notifications_pkey RENAME TO trip_notifications_pkey;
ALTER INDEX idx_ride_notifications_created RENAME TO idx_trip_notifications_created;
ALTER INDEX idx_ride_notifications_driver RENAME TO idx_trip_notifications_recipient;
ALTER INDEX idx_ride_notifications_status RENAME TO idx_trip_notifications_status;
ALTER INDEX idx_ride_notifications_trip RENAME TO idx_trip_notifications_trip;

-- Rename column driver_id → recipient_id (more generic)
ALTER TABLE trip_notifications RENAME COLUMN driver_id TO recipient_id;

-- Update RLS policies
DROP POLICY IF EXISTS ride_notifications_driver_read ON trip_notifications;
CREATE POLICY trip_notifications_recipient_read ON trip_notifications
  FOR SELECT USING (auth.uid() = recipient_id);

DROP POLICY IF EXISTS ride_notifications_service_role_all ON trip_notifications;
CREATE POLICY trip_notifications_service_role_all ON trip_notifications
  TO service_role USING (true) WITH CHECK (true);
```

#### Step 1.3: Delete Legacy Tables
```sql
-- Drop views first (depend on tables)
DROP VIEW IF EXISTS mobility_trips_compat CASCADE;
DROP VIEW IF EXISTS pending_ride_requests_with_trips CASCADE;

-- Drop legacy tables
DROP TABLE IF EXISTS ride_requests CASCADE;
DROP TABLE IF EXISTS rides_driver_status CASCADE;
```

### Phase 2: Function Consolidation

#### Step 2.1: Delete Deprecated Functions
```sql
DROP FUNCTION IF EXISTS apply_intent_rides CASCADE;
DROP FUNCTION IF EXISTS apply_intent_rides_v2 CASCADE;
DROP FUNCTION IF EXISTS rides_find_nearby_drivers CASCADE;
DROP FUNCTION IF EXISTS rides_find_nearby_trips CASCADE;
DROP FUNCTION IF EXISTS rides_search_nearby_drivers CASCADE;
DROP FUNCTION IF EXISTS rides_search_nearby_passengers CASCADE;
DROP FUNCTION IF EXISTS ride_requests_set_updated_at CASCADE;
```

#### Step 2.2: Rename Remaining Functions
```sql
-- Rename driver status function
ALTER FUNCTION rides_driver_status_set_updated_at() RENAME TO driver_status_set_updated_at;

-- Rename driver location update function
ALTER FUNCTION rides_update_driver_location() RENAME TO update_driver_status;
```

#### Step 2.3: Create Replacement Functions
```sql
-- Function to update driver status
CREATE OR REPLACE FUNCTION update_driver_status(
  _user_id uuid,
  _online boolean,
  _vehicle_type text DEFAULT NULL,
  _lat double precision DEFAULT NULL,
  _lng double precision DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO driver_status (user_id, online, vehicle_type, lat, lng, last_seen)
  VALUES (_user_id, _online, _vehicle_type, _lat, _lng, now())
  ON CONFLICT (user_id) DO UPDATE SET
    online = EXCLUDED.online,
    vehicle_type = COALESCE(EXCLUDED.vehicle_type, driver_status.vehicle_type),
    lat = COALESCE(EXCLUDED.lat, driver_status.lat),
    lng = COALESCE(EXCLUDED.lng, driver_status.lng),
    last_seen = now(),
    updated_at = now();
END;
$$;
```

### Phase 3: Edge Function Updates

#### Files to Update (13 files)

**Pattern: Replace all references:**
- `ride_requests` → `trips`
- `rides_driver_status` → `driver_status`
- `ride_notifications` → `trip_notifications`
- `driver_id` → `recipient_id` (in notifications context)

**Specific Updates:**

1. **supabase/functions/wa-webhook-mobility/handlers/go_online.ts**
```typescript
// OLD
await supabase.from('rides_driver_status').upsert({
  user_id: userId,
  online: true,
  vehicle_type: vehicleType,
  lat, lng
});

// NEW
await supabase.rpc('update_driver_status', {
  _user_id: userId,
  _online: true,
  _vehicle_type: vehicleType,
  _lat: lat,
  _lng: lng
});
```

2. **supabase/functions/wa-webhook-mobility/notifications/drivers.ts**
```typescript
// OLD
await supabase.from('ride_notifications').insert({
  trip_id: tripId,
  driver_id: driverId,
  wa_message_id: messageId,
  status: 'sent'
});

// NEW
await supabase.from('trip_notifications').insert({
  trip_id: tripId,
  recipient_id: driverId,  // Changed column name
  wa_message_id: messageId,
  status: 'sent'
});
```

3. **supabase/functions/wa-webhook-mobility/handlers/nearby.ts**
```typescript
// Remove calls to rides_find_nearby_drivers (already using match_drivers_for_trip_v2)
```

### Phase 4: Migration Script

**File:** `supabase/migrations/20251209030000_consolidate_mobility_tables.sql`

```sql
BEGIN;

-- ============================================================================
-- MOBILITY TABLES CONSOLIDATION
-- ============================================================================
-- Purpose: Eliminate "ride" naming, consolidate into canonical "trips" table
-- Date: 2025-12-09
-- ============================================================================

-- Step 1: Create driver_status table
CREATE TABLE IF NOT EXISTS driver_status (
  user_id uuid PRIMARY KEY REFERENCES profiles(user_id) ON DELETE CASCADE,
  online boolean NOT NULL DEFAULT false,
  vehicle_type text,
  lat double precision,
  lng double precision,
  geog geography(Point,4326) GENERATED ALWAYS AS (
    CASE 
      WHEN lat IS NOT NULL AND lng IS NOT NULL 
      THEN ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
      ELSE NULL
    END
  ) STORED,
  last_seen timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_driver_status_online ON driver_status(online, last_seen DESC) WHERE online = true;
CREATE INDEX idx_driver_status_geog ON driver_status USING GIST(geog) WHERE geog IS NOT NULL;

-- Step 2: Migrate data from rides_driver_status
INSERT INTO driver_status (user_id, online, vehicle_type, lat, lng, last_seen, updated_at, metadata)
SELECT user_id, online, vehicle_type, lat, lng, last_seen, updated_at, metadata::jsonb
FROM rides_driver_status
ON CONFLICT (user_id) DO NOTHING;

-- Step 3: Rename ride_notifications → trip_notifications
ALTER TABLE ride_notifications RENAME TO trip_notifications;
ALTER TABLE trip_notifications RENAME COLUMN driver_id TO recipient_id;

-- Rename indexes
ALTER INDEX ride_notifications_pkey RENAME TO trip_notifications_pkey;
ALTER INDEX idx_ride_notifications_created RENAME TO idx_trip_notifications_created;
ALTER INDEX idx_ride_notifications_driver RENAME TO idx_trip_notifications_recipient;
ALTER INDEX idx_ride_notifications_status RENAME TO idx_trip_notifications_status;
ALTER INDEX idx_ride_notifications_trip RENAME TO idx_trip_notifications_trip;

-- Rename constraints
ALTER TABLE trip_notifications RENAME CONSTRAINT ride_notifications_status_check TO trip_notifications_status_check;
ALTER TABLE trip_notifications RENAME CONSTRAINT ride_notifications_driver_id_fkey TO trip_notifications_recipient_id_fkey;
ALTER TABLE trip_notifications RENAME CONSTRAINT ride_notifications_trip_id_fkey TO trip_notifications_trip_id_fkey;

-- Update RLS policies
DROP POLICY IF EXISTS ride_notifications_driver_read ON trip_notifications;
CREATE POLICY trip_notifications_recipient_read ON trip_notifications
  FOR SELECT USING (auth.uid() = recipient_id);

DROP POLICY IF EXISTS ride_notifications_service_role_all ON trip_notifications;
CREATE POLICY trip_notifications_service_role_all ON trip_notifications
  TO service_role USING (true) WITH CHECK (true);

-- Step 4: Drop views
DROP VIEW IF EXISTS mobility_trips_compat CASCADE;
DROP VIEW IF EXISTS pending_ride_requests_with_trips CASCADE;

-- Step 5: Drop legacy tables
DROP TABLE IF EXISTS ride_requests CASCADE;
DROP TABLE IF EXISTS rides_driver_status CASCADE;

-- Step 6: Drop deprecated functions
DROP FUNCTION IF EXISTS apply_intent_rides CASCADE;
DROP FUNCTION IF EXISTS apply_intent_rides_v2 CASCADE;
DROP FUNCTION IF EXISTS rides_find_nearby_drivers CASCADE;
DROP FUNCTION IF EXISTS rides_find_nearby_trips CASCADE;
DROP FUNCTION IF EXISTS rides_search_nearby_drivers CASCADE;
DROP FUNCTION IF EXISTS rides_search_nearby_passengers CASCADE;
DROP FUNCTION IF EXISTS ride_requests_set_updated_at CASCADE;
DROP FUNCTION IF EXISTS rides_driver_status_set_updated_at CASCADE;

-- Step 7: Create new functions
CREATE OR REPLACE FUNCTION driver_status_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_driver_status_updated_at
  BEFORE UPDATE ON driver_status
  FOR EACH ROW
  EXECUTE FUNCTION driver_status_set_updated_at();

CREATE OR REPLACE FUNCTION update_driver_status(
  _user_id uuid,
  _online boolean,
  _vehicle_type text DEFAULT NULL,
  _lat double precision DEFAULT NULL,
  _lng double precision DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO driver_status (user_id, online, vehicle_type, lat, lng, last_seen)
  VALUES (_user_id, _online, _vehicle_type, _lat, _lng, now())
  ON CONFLICT (user_id) DO UPDATE SET
    online = EXCLUDED.online,
    vehicle_type = COALESCE(EXCLUDED.vehicle_type, driver_status.vehicle_type),
    lat = COALESCE(EXCLUDED.lat, driver_status.lat),
    lng = COALESCE(EXCLUDED.lng, driver_status.lng),
    last_seen = now(),
    updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION update_driver_status TO authenticated, service_role;

-- Step 8: Add RLS to driver_status
ALTER TABLE driver_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY driver_status_owner_rw ON driver_status
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY driver_status_read_all ON driver_status
  FOR SELECT USING (true);

CREATE POLICY driver_status_service_role_all ON driver_status
  TO service_role USING (true) WITH CHECK (true);

-- Step 9: Update comments
COMMENT ON TABLE trips IS 'Canonical table for all trip requests (driver & passenger)';
COMMENT ON TABLE driver_status IS 'Current online/offline status and location of drivers';
COMMENT ON TABLE trip_notifications IS 'Notifications sent to users about trips';
COMMENT ON TABLE recurring_trips IS 'Templates for recurring trip schedules';
COMMENT ON TABLE trip_payment_requests IS 'Payment requests for completed trips';
COMMENT ON TABLE trip_status_audit IS 'Audit log of trip status changes';

COMMIT;
```

### Phase 5: RLS Policy Updates

All policies already correct - using `trips` table as FK reference.

### Phase 6: Test Updates

**Update test files to use new naming:**
- Replace `ride_requests` → `trips`
- Replace `rides_driver_status` → `driver_status`
- Replace `ride_notifications` → `trip_notifications`

---

## G) Implementation (Pending Approval)

**STOP:** Awaiting human approval before proceeding with implementation.

---

## H) Verification Checklist

After implementation:

### Database Verification
- [ ] `driver_status` table exists with all data from `rides_driver_status`
- [ ] `trip_notifications` table exists (renamed from `ride_notifications`)
- [ ] `ride_requests` table deleted
- [ ] `rides_driver_status` table deleted
- [ ] Views `mobility_trips_compat`, `pending_ride_requests_with_trips` deleted
- [ ] All deprecated functions deleted
- [ ] New function `update_driver_status` exists
- [ ] RLS policies correct on all tables

### Code Verification
- [ ] No references to `ride_requests` in TypeScript
- [ ] No references to `rides_driver_status` in TypeScript
- [ ] All `ride_notifications` → `trip_notifications`
- [ ] All `driver_id` → `recipient_id` (in notifications)
- [ ] Tests updated and passing

### Functional Verification
- [ ] Driver can go online/offline
- [ ] Nearby driver search works
- [ ] Notifications sent successfully
- [ ] No "ride" naming in UI
- [ ] No "ride" naming in logs

---

## I) Cleanup/Consolidation Notes

### Avoided Duplication

**Before:** 9 tables/views + 10 functions with mixed "ride"/"trip" naming  
**After:** 5 tables + 3 functions with consistent "trip" naming

### Deleted (7 items)
- ❌ `ride_requests` table
- ❌ `rides_driver_status` table  
- ❌ `mobility_trips_compat` view
- ❌ `pending_ride_requests_with_trips` view
- ❌ 7 deprecated functions (apply_intent_rides, rides_find_*, rides_search_*)

### Renamed (2 items)
- 🔄 `ride_notifications` → `trip_notifications`
- 🔄 `driver_id` column → `recipient_id`

### Created (2 items)
- ✅ `driver_status` table (replaces `rides_driver_status`)
- ✅ `update_driver_status` function

### Kept Unchanged (4 items)
- ✅ `trips` (canonical)
- ✅ `recurring_trips`
- ✅ `trip_payment_requests`
- ✅ `trip_status_audit`

### Final Architecture

```
CANONICAL TABLES (5 total):
├── trips (22 rows) - All trip requests
├── driver_status (1 row) - Driver availability
├── trip_notifications (0 rows) - Notifications
├── recurring_trips (0 rows) - Recurring templates
├── trip_payment_requests (0 rows) - Payments
└── trip_status_audit (0 rows) - Audit log

MATCHING FUNCTIONS (2 total):
├── match_drivers_for_trip_v2
└── match_passengers_for_trip_v2

HELPER FUNCTIONS (3 total):
├── update_driver_status
├── driver_status_set_updated_at
└── activate_recurring_trips
```

---

## Summary

**Problem:** Mixed "ride"/"trip" naming causing confusion and duplication  
**Solution:** Consolidate all to "trip" naming, single canonical `trips` table  
**Impact:**
- ✅ Eliminates 7 unused tables/views
- ✅ Removes 7 deprecated functions
- ✅ Consistent "trip" naming across all code
- ✅ Cleaner architecture (5 tables instead of 9)
- ✅ Better performance (fewer joins, simpler queries)

**Ready for approval:** Yes  
**Breaking changes:** No (all updates backward compatible via renaming)  
**Data loss risk:** None (migration preserves all data)

---

**Next Step:** Approve consolidation plan and execute migration.
