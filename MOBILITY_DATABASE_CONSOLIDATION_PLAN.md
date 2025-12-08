# MOBILITY DATABASE CONSOLIDATION PLAN
**Deep Analysis & Cleanup Strategy**

**Date**: 2025-12-08  
**Issue**: Multiple redundant/duplicate tables causing trips to not be captured correctly

---

## EXECUTIVE SUMMARY

**CRITICAL FINDING**: You have **9+ overlapping tables** for trip management with **3 different schemas** (legacy, V2, canonical) running simultaneously. This causes:
- Trips inserted into wrong tables
- Matching queries reading from outdated tables
- Data fragmentation across multiple sources
- Functions referencing non-existent tables

**ROOT CAUSE**: Multiple migration attempts without proper cleanup/deprecation of old tables.

---

## TABLE INVENTORY & ANALYSIS

### GROUP 1: TRIP REQUEST TABLES (DUPLICATE - CHOOSE ONE)

#### ❌ **rides_trips** (LEGACY - Referenced but NOT in active migrations)
- **Status**: GHOST TABLE - Referenced in RPC functions but CREATE TABLE not found
- **Used by**: `match_drivers_for_trip_v2()`, `match_passengers_for_trip_v2()`, `activate_recurring_trips()`
- **Fields**: pickup_latitude, pickup_longitude, dropoff_*, status, role, vehicle_type, expires_at
- **Problem**: Functions query this but table may not exist or is in backup only
- **Action**: **CRITICAL - Verify if exists, migrate data out**

#### ⚠️ **mobility_trips** (V2 Schema - Migration 20251204180000)
- **Status**: CREATED but possibly unused
- **Purpose**: "Single source of truth" for V2 mobility system
- **Fields**: Similar to rides_trips but with mobility_* naming
- **Status values**: open, matched, expired
- **Problem**: Coexists with canonical `trips` table - which one is active?
- **Action**: **Check if ANY data exists, determine if in use**

#### ✅ **trips** (CANONICAL - Migration 20251208092400)
- **Status**: NEWEST canonical table (created Dec 8)
- **Purpose**: "Canonical trips table: scheduled trips + request intents"
- **Fields**: trip_kind (scheduled/request), role, vehicle_type, pickup_*, dropoff_*, status (open/expired/cancelled)
- **Currently used by**: `updateTripDropoff()` in wa-webhook
- **Problem**: Code still references rides_trips instead of this
- **Action**: **KEEP - Make this the ONLY trip table**

**RECOMMENDATION**: 
```
✅ KEEP: trips (canonical)
❌ DEPRECATE: rides_trips (update all RPC functions)
❌ DEPRECATE: mobility_trips (if empty, drop it)
```

---

### GROUP 2: TRIP MATCHING/LIFECYCLE TABLES (DUPLICATE)

#### ⚠️ **mobility_matches** (Migration 20251203235959)
- **Fields**: driver_id, passenger_id, trip_id, status (8 states), pickup_*, dropoff_*, fare_estimate
- **Foreign key**: `trip_id` references `trips.id`
- **Purpose**: Track matched trips lifecycle
- **Created**: Dec 3, 2025

#### ⚠️ **mobility_trip_matches** (Migration 20251204180000)
- **Fields**: driver_trip_id, passenger_trip_id, driver_user_id, passenger_user_id, status (8 states), pickup_*, dropoff_*, actual_fare
- **Foreign key**: Both trip IDs reference `mobility_trips.id`
- **Purpose**: SAME as mobility_matches - "Accepted trip pairings with full lifecycle"
- **Created**: Dec 4, 2025 (ONE DAY LATER)

**DUPLICATE ALERT**: These are essentially the same table with different foreign key targets!

**RECOMMENDATION**:
```
✅ KEEP: mobility_matches (references canonical trips table)
❌ DROP: mobility_trip_matches (references deprecated mobility_trips)
❌ UPDATE: trip_payment_requests and trip_status_audit to reference mobility_matches
```

---

### GROUP 3: SUPPORTING TABLES (KEEP)

#### ✅ **ride_notifications** (Migration 20251204000000)
- **Purpose**: Track driver notification delivery/response
- **Status**: KEEP - Essential for notification tracking
- **Action**: Ensure trip_id references canonical `trips` table

#### ✅ **trip_payment_requests** (Migration 20251205000001)
- **Purpose**: Payment tracking
- **Current FK**: References `mobility_trip_matches` ❌
- **Action**: **UPDATE FK to reference mobility_matches.id**

#### ✅ **trip_status_audit** (Migration 20251205000001)
- **Purpose**: Audit trail for status changes
- **Current FK**: References `mobility_trip_matches` ❌
- **Action**: **UPDATE FK to reference mobility_matches.id**

#### ✅ **recurring_trips** (Migration 20251201100200)
- **Purpose**: Template for recurring trip schedules
- **Status**: KEEP - Needed for scheduled trips
- **Action**: Update `activate_recurring_trips()` to insert into canonical `trips` table

#### ✅ **mobility_intents** (Migration 20251201082000)
- **Purpose**: Track user search intents (separate from trips)
- **Status**: KEEP - Analytics/recommendations
- **Action**: None needed

#### ✅ **mobility_driver_metrics** (Migration 20251204180000)
- **Purpose**: Driver performance tracking
- **Status**: KEEP - Analytics

#### ✅ **mobility_passenger_metrics** (Migration 20251204180000)
- **Purpose**: Passenger behavior tracking
- **Status**: KEEP - Analytics

#### ✅ **mobility_pricing_config** (Migration 20251204180000)
- **Purpose**: Dynamic pricing rules
- **Status**: KEEP - Business logic

---

### GROUP 4: MISSING/PHANTOM TABLES

These are mentioned in your description but NOT found in migrations:

#### ❓ **pending_trips** - NOT FOUND
#### ❓ **pending_ride_request** - NOT FOUND  
#### ❓ **ride_driver_status** - NOT FOUND
#### ❓ **mobility_trips_compact** - NOT FOUND

**Action**: Run query to check if these exist in database or are just in old docs.

---

## CONSOLIDATION PLAN

### PHASE 1: ASSESSMENT (1 hour)

```sql
-- Check which tables actually exist
SELECT table_name, pg_size_pretty(pg_total_relation_size(table_name::regclass)) AS size
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'trips', 'rides_trips', 'mobility_trips',
    'mobility_matches', 'mobility_trip_matches',
    'pending_trips', 'pending_ride_request', 
    'ride_driver_status', 'mobility_trips_compact'
  )
ORDER BY table_name;

-- Check data counts
SELECT 'trips' as table_name, COUNT(*) FROM trips
UNION ALL
SELECT 'rides_trips', COUNT(*) FROM rides_trips
UNION ALL
SELECT 'mobility_trips', COUNT(*) FROM mobility_trips
UNION ALL
SELECT 'mobility_matches', COUNT(*) FROM mobility_matches
UNION ALL
SELECT 'mobility_trip_matches', COUNT(*) FROM mobility_trip_matches;

-- Check foreign key dependencies
SELECT 
  tc.table_name, 
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND (
    ccu.table_name IN ('trips', 'rides_trips', 'mobility_trips', 'mobility_matches', 'mobility_trip_matches')
    OR tc.table_name IN ('trip_payment_requests', 'trip_status_audit', 'ride_notifications')
  )
ORDER BY tc.table_name;
```

### PHASE 2: DATA MIGRATION (2-4 hours)

#### Step 1: Migrate rides_trips → trips (if rides_trips exists and has data)

```sql
BEGIN;

-- Insert legacy trips into canonical trips table
INSERT INTO trips (
  id,
  creator_user_id,
  trip_kind,
  role,
  vehicle_type,
  pickup_latitude,
  pickup_longitude,
  pickup_text,
  pickup_radius_m,
  dropoff_latitude,
  dropoff_longitude,
  dropoff_text,
  status,
  scheduled_at,
  recurrence,
  created_at,
  updated_at,
  expires_at,
  last_location_at,
  ref_code,
  metadata
)
SELECT 
  id,
  creator_user_id,
  CASE 
    WHEN scheduled_at IS NOT NULL THEN 'scheduled'::text
    ELSE 'request'::text
  END as trip_kind,
  role,
  vehicle_type,
  pickup_latitude,
  pickup_longitude,
  pickup_text,
  COALESCE(pickup_radius_m, 10000),
  dropoff_latitude,
  dropoff_longitude,
  dropoff_text,
  CASE 
    WHEN status IN ('pending', 'active', 'open') THEN 'open'::text
    WHEN status = 'cancelled' THEN 'cancelled'::text
    ELSE 'expired'::text
  END as status,
  scheduled_at,
  recurrence,
  created_at,
  COALESCE(updated_at, created_at),
  expires_at,
  COALESCE(last_location_update, created_at),
  ref_code,
  jsonb_build_object('source', 'rides_trips', 'original_status', status)
FROM rides_trips
WHERE NOT EXISTS (SELECT 1 FROM trips WHERE trips.id = rides_trips.id);

COMMIT;
```

#### Step 2: Migrate mobility_trips → trips (if has data)

```sql
BEGIN;

INSERT INTO trips (
  id,
  creator_user_id,
  trip_kind,
  role,
  vehicle_type,
  pickup_latitude,
  pickup_longitude,
  pickup_text,
  pickup_radius_m,
  dropoff_latitude,
  dropoff_longitude,
  dropoff_text,
  status,
  scheduled_at,
  recurrence,
  created_at,
  updated_at,
  expires_at,
  metadata
)
SELECT 
  id,
  creator_user_id,
  CASE 
    WHEN scheduled_for IS NOT NULL THEN 'scheduled'::text
    ELSE 'request'::text
  END,
  role,
  vehicle_type,
  pickup_lat,
  pickup_lng,
  pickup_text,
  COALESCE(pickup_radius_m, 10000),
  dropoff_lat,
  dropoff_lng,
  dropoff_text,
  CASE 
    WHEN status = 'matched' THEN 'open'::text  -- Keep searchable until expired
    ELSE status::text
  END,
  scheduled_for,
  recurrence,
  created_at,
  created_at,  -- mobility_trips doesn't have updated_at
  expires_at,
  jsonb_build_object('source', 'mobility_trips', 'original_status', status)
FROM mobility_trips
WHERE NOT EXISTS (SELECT 1 FROM trips WHERE trips.id = mobility_trips.id);

COMMIT;
```

#### Step 3: Migrate mobility_trip_matches → mobility_matches

```sql
BEGIN;

-- Insert from mobility_trip_matches if it has data
INSERT INTO mobility_matches (
  id,
  driver_id,
  passenger_id,
  trip_id,
  vehicle_type,
  pickup_latitude,
  pickup_longitude,
  pickup_text,
  dropoff_latitude,
  dropoff_longitude,
  dropoff_text,
  fare_estimate,
  actual_fare,
  currency,
  distance_km,
  duration_minutes,
  status,
  created_at,
  updated_at,
  matched_at,
  accepted_at,
  started_at,
  pickup_time,
  dropoff_time,
  completed_at,
  cancelled_at,
  cancellation_reason,
  driver_phone,
  passenger_phone,
  metadata
)
SELECT 
  id,
  driver_user_id,
  passenger_user_id,
  passenger_trip_id, -- Use passenger trip as reference
  vehicle_type,
  ST_Y(pickup_location::geometry),
  ST_X(pickup_location::geometry),
  pickup_address,
  ST_Y(dropoff_location::geometry),
  ST_X(dropoff_location::geometry),
  dropoff_address,
  estimated_fare,
  actual_fare,
  currency,
  distance_km,
  duration_minutes,
  status,
  created_at,
  updated_at,
  created_at, -- matched_at
  accepted_at,
  started_at,
  picked_up_at,
  completed_at,
  completed_at,
  cancelled_at,
  cancellation_reason,
  driver_phone,
  passenger_phone,
  jsonb_build_object(
    'source', 'mobility_trip_matches',
    'driver_trip_id', driver_trip_id,
    'passenger_trip_id', passenger_trip_id,
    'rating_by_passenger', rating_by_passenger,
    'rating_by_driver', rating_by_driver,
    'feedback_by_passenger', feedback_by_passenger,
    'feedback_by_driver', feedback_by_driver
  )
FROM mobility_trip_matches
WHERE NOT EXISTS (SELECT 1 FROM mobility_matches WHERE mobility_matches.id = mobility_trip_matches.id);

COMMIT;
```

### PHASE 3: UPDATE REFERENCES (1-2 hours)

#### Step 1: Update Foreign Keys

```sql
BEGIN;

-- Drop old foreign key constraints
ALTER TABLE trip_payment_requests 
  DROP CONSTRAINT IF EXISTS trip_payment_requests_trip_id_fkey;

ALTER TABLE trip_status_audit 
  DROP CONSTRAINT IF EXISTS trip_status_audit_trip_id_fkey;

-- Add new foreign key constraints
ALTER TABLE trip_payment_requests 
  ADD CONSTRAINT trip_payment_requests_trip_id_fkey 
  FOREIGN KEY (trip_id) REFERENCES mobility_matches(id) ON DELETE CASCADE;

ALTER TABLE trip_status_audit 
  ADD CONSTRAINT trip_status_audit_trip_id_fkey 
  FOREIGN KEY (trip_id) REFERENCES mobility_matches(id) ON DELETE CASCADE;

-- Ensure ride_notifications references trips (not mobility_trips)
-- (This already seems correct based on migration)

COMMIT;
```

#### Step 2: Update RPC Functions

Create new migration: `20251208150000_fix_mobility_rpc_functions.sql`

```sql
BEGIN;

-- Update match_drivers_for_trip_v2 to use canonical trips table
CREATE OR REPLACE FUNCTION public.match_drivers_for_trip_v2(
  _trip_id uuid,
  _limit integer DEFAULT 9,
  _prefer_dropoff boolean DEFAULT false,
  _radius_m integer DEFAULT 10000,
  _window_days integer DEFAULT 30
)
RETURNS TABLE (
  trip_id uuid,
  creator_user_id uuid,
  whatsapp_e164 text,
  ref_code text,
  distance_km numeric,
  drop_bonus_m numeric,
  pickup_text text,
  dropoff_text text,
  matched_at timestamptz,
  created_at timestamptz,
  vehicle_type text,
  number_plate text
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_pickup_lat double precision;
  v_pickup_lng double precision;
  v_dropoff_lat double precision;
  v_dropoff_lng double precision;
  v_vehicle_type text;
  v_radius_km double precision;
BEGIN
  -- Get trip details from CANONICAL trips table
  SELECT 
    t.pickup_latitude,
    t.pickup_longitude,
    t.dropoff_latitude,
    t.dropoff_longitude,
    t.vehicle_type,
    CASE 
      WHEN _radius_m IS NULL OR _radius_m <= 0 THEN 10.0
      ELSE _radius_m::double precision / 1000.0
    END
  INTO 
    v_pickup_lat,
    v_pickup_lng,
    v_dropoff_lat,
    v_dropoff_lng,
    v_vehicle_type,
    v_radius_km
  FROM public.trips t  -- CHANGED FROM rides_trips
  WHERE t.id = _trip_id;

  IF v_pickup_lat IS NULL THEN
    RETURN;
  END IF;

  -- Find matching drivers from CANONICAL trips table
  RETURN QUERY
  SELECT 
    t.id AS trip_id,
    t.creator_user_id,
    COALESCE(p.phone_number, p.wa_id) AS whatsapp_e164,
    COALESCE(t.ref_code, SUBSTRING(t.id::text, 1, 8)) AS ref_code,
    ROUND(
      (6371 * acos(
        cos(radians(v_pickup_lat)) * cos(radians(t.pickup_latitude)) *
        cos(radians(t.pickup_longitude) - radians(v_pickup_lng)) +
        sin(radians(v_pickup_lat)) * sin(radians(t.pickup_latitude))
      ))::numeric, 2
    ) AS distance_km,
    CASE
      WHEN _prefer_dropoff AND v_dropoff_lat IS NOT NULL AND t.dropoff_latitude IS NOT NULL THEN
        ROUND(
          (6371000 * acos(
            cos(radians(v_dropoff_lat)) * cos(radians(t.dropoff_latitude)) *
            cos(radians(t.dropoff_longitude) - radians(v_dropoff_lng)) +
            sin(radians(v_dropoff_lat)) * sin(radians(t.dropoff_latitude))
          ))::numeric, 0
        )
      ELSE NULL
    END AS drop_bonus_m,
    t.pickup_text,
    t.dropoff_text,
    NULL::timestamptz AS matched_at,  -- trips table doesn't have matched_at
    t.created_at,
    t.vehicle_type,
    t.number_plate
  FROM public.trips t  -- CHANGED FROM rides_trips
  INNER JOIN public.profiles p ON p.user_id = t.creator_user_id
  WHERE t.role = 'driver'
    AND t.status = 'open'  -- Simplified status check
    AND t.expires_at > now()
    AND t.pickup_latitude IS NOT NULL
    AND t.pickup_longitude IS NOT NULL
    AND (v_vehicle_type IS NULL OR t.vehicle_type = v_vehicle_type)
    AND t.created_at >= NOW() - (INTERVAL '1 day' * _window_days)
    AND t.id != _trip_id
    AND (
      6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(v_pickup_lat)) * cos(radians(t.pickup_latitude)) *
          cos(radians(t.pickup_longitude) - radians(v_pickup_lng)) +
          sin(radians(v_pickup_lat)) * sin(radians(t.pickup_latitude))
        ))
      )
    ) <= v_radius_km
  ORDER BY distance_km ASC
  LIMIT _limit;
END;
$$;

-- Update match_passengers_for_trip_v2 (same pattern)
CREATE OR REPLACE FUNCTION public.match_passengers_for_trip_v2(
  _trip_id uuid,
  _limit integer DEFAULT 9,
  _prefer_dropoff boolean DEFAULT false,
  _radius_m integer DEFAULT 10000,
  _window_days integer DEFAULT 30
)
RETURNS TABLE (
  trip_id uuid,
  creator_user_id uuid,
  whatsapp_e164 text,
  ref_code text,
  distance_km numeric,
  drop_bonus_m numeric,
  pickup_text text,
  dropoff_text text,
  matched_at timestamptz,
  created_at timestamptz,
  vehicle_type text
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_pickup_lat double precision;
  v_pickup_lng double precision;
  v_dropoff_lat double precision;
  v_dropoff_lng double precision;
  v_vehicle_type text;
  v_radius_km double precision;
BEGIN
  SELECT 
    t.pickup_latitude,
    t.pickup_longitude,
    t.dropoff_latitude,
    t.dropoff_longitude,
    t.vehicle_type,
    CASE 
      WHEN _radius_m IS NULL OR _radius_m <= 0 THEN 10.0
      ELSE _radius_m::double precision / 1000.0
    END
  INTO 
    v_pickup_lat,
    v_pickup_lng,
    v_dropoff_lat,
    v_dropoff_lng,
    v_vehicle_type,
    v_radius_km
  FROM public.trips t  -- CHANGED FROM rides_trips
  WHERE t.id = _trip_id;

  IF v_pickup_lat IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    t.id AS trip_id,
    t.creator_user_id,
    COALESCE(p.phone_number, p.wa_id) AS whatsapp_e164,
    COALESCE(t.ref_code, SUBSTRING(t.id::text, 1, 8)) AS ref_code,
    ROUND(
      (6371 * acos(
        cos(radians(v_pickup_lat)) * cos(radians(t.pickup_latitude)) *
        cos(radians(t.pickup_longitude) - radians(v_pickup_lng)) +
        sin(radians(v_pickup_lat)) * sin(radians(t.pickup_latitude))
      ))::numeric, 2
    ) AS distance_km,
    CASE
      WHEN _prefer_dropoff AND v_dropoff_lat IS NOT NULL AND t.dropoff_latitude IS NOT NULL THEN
        ROUND(
          (6371000 * acos(
            cos(radians(v_dropoff_lat)) * cos(radians(t.dropoff_latitude)) *
            cos(radians(t.dropoff_longitude) - radians(v_dropoff_lng)) +
            sin(radians(v_dropoff_lat)) * sin(radians(t.dropoff_latitude))
          ))::numeric, 0
        )
      ELSE NULL
    END AS drop_bonus_m,
    t.pickup_text,
    t.dropoff_text,
    NULL::timestamptz,  -- trips table doesn't have matched_at
    t.created_at,
    t.vehicle_type
  FROM public.trips t  -- CHANGED FROM rides_trips
  INNER JOIN public.profiles p ON p.user_id = t.creator_user_id
  WHERE t.role = 'passenger'
    AND t.status = 'open'
    AND t.expires_at > now()
    AND t.pickup_latitude IS NOT NULL
    AND t.pickup_longitude IS NOT NULL
    AND (v_vehicle_type IS NULL OR t.vehicle_type = v_vehicle_type)
    AND t.created_at >= NOW() - (INTERVAL '1 day' * _window_days)
    AND t.id != _trip_id
    AND (
      6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(v_pickup_lat)) * cos(radians(t.pickup_latitude)) *
          cos(radians(t.pickup_longitude) - radians(v_pickup_lng)) +
          sin(radians(v_pickup_lat)) * sin(radians(t.pickup_latitude))
        ))
      )
    ) <= v_radius_km
  ORDER BY distance_km ASC
  LIMIT _limit;
END;
$$;

-- Update activate_recurring_trips to use canonical trips table
CREATE OR REPLACE FUNCTION public.activate_recurring_trips()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_recurring_trip RECORD;
  v_created_count integer := 0;
  v_today_dow integer;
  v_today_date date := CURRENT_DATE;
  v_origin RECORD;
  v_dest RECORD;
BEGIN
  v_today_dow := EXTRACT(ISODOW FROM v_today_date);
  
  FOR v_recurring_trip IN
    SELECT rt.*, p.user_id
    FROM public.recurring_trips rt
    JOIN public.profiles p ON p.user_id = rt.user_id
    WHERE rt.active = true
      AND v_today_dow = ANY(rt.days_of_week)
  LOOP
    SELECT lat, lng, label INTO v_origin
    FROM public.saved_locations
    WHERE id = v_recurring_trip.origin_favorite_id;
    
    SELECT lat, lng, label INTO v_dest
    FROM public.saved_locations
    WHERE id = v_recurring_trip.dest_favorite_id;
    
    IF v_origin.lat IS NOT NULL AND v_dest.lat IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.trips  -- CHANGED FROM rides_trips
        WHERE creator_user_id = v_recurring_trip.user_id
          AND DATE(scheduled_at) = v_today_date
          AND pickup_latitude = v_origin.lat
          AND pickup_longitude = v_origin.lng
      ) THEN
        -- Insert into CANONICAL trips table
        INSERT INTO public.trips (  -- CHANGED FROM rides_trips
          creator_user_id,
          trip_kind,
          role,
          vehicle_type,
          pickup_latitude,
          pickup_longitude,
          pickup_text,
          dropoff_latitude,
          dropoff_longitude,
          dropoff_text,
          status,
          scheduled_at,
          recurrence,
          expires_at
        ) VALUES (
          v_recurring_trip.user_id,
          'scheduled',  -- NEW FIELD
          v_recurring_trip.role,
          v_recurring_trip.vehicle_type,
          v_origin.lat,
          v_origin.lng,
          v_origin.label,
          v_dest.lat,
          v_dest.lng,
          v_dest.label,
          'open',
          (v_today_date + v_recurring_trip.time_local)::timestamptz,
          CASE 
            WHEN array_length(v_recurring_trip.days_of_week, 1) = 7 THEN 'daily'
            WHEN array_length(v_recurring_trip.days_of_week, 1) = 5 AND 
                 v_recurring_trip.days_of_week @> ARRAY[1,2,3,4,5] THEN 'weekdays'
            ELSE 'weekly'
          END,
          (v_today_date + v_recurring_trip.time_local + interval '2 hours')::timestamptz
        );
        
        v_created_count := v_created_count + 1;
      END IF;
    END IF;
  END LOOP;
  
  IF v_created_count > 0 THEN
    INSERT INTO public.system_logs (event_type, details)
    VALUES ('RECURRING_TRIPS_ACTIVATED', jsonb_build_object(
      'created_count', v_created_count,
      'date', v_today_date,
      'timestamp', now()
    ));
  END IF;
  
  RETURN v_created_count;
END;
$$;

COMMIT;
```

#### Step 3: Update Edge Functions

**File**: `supabase/functions/_shared/wa-webhook-shared/rpc/mobility.ts`

Add wrapper function that uses canonical table:

```typescript
export async function insertTrip(
  client: SupabaseClient,
  params: {
    userId: string;
    role: 'driver' | 'passenger';
    vehicleType: string;
    pickup: { lat: number; lng: number; text?: string };
    dropoff?: { lat: number; lng: number; text?: string };
    scheduledFor?: Date;
    recurrence?: 'once' | 'daily' | 'weekdays' | 'weekly';
    expiresInMinutes?: number;
    numberPlate?: string;
  }
): Promise<string> {
  const expiresInMinutes = params.expiresInMinutes ?? 90;
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
  
  const { data, error } = await client
    .from("trips")  // Use canonical table
    .insert({
      creator_user_id: params.userId,
      trip_kind: params.scheduledFor ? 'scheduled' : 'request',
      role: params.role,
      vehicle_type: params.vehicleType,
      pickup_latitude: params.pickup.lat,
      pickup_longitude: params.pickup.lng,
      pickup_text: params.pickup.text ?? null,
      dropoff_latitude: params.dropoff?.lat ?? null,
      dropoff_longitude: params.dropoff?.lng ?? null,
      dropoff_text: params.dropoff?.text ?? null,
      scheduled_at: params.scheduledFor?.toISOString() ?? null,
      recurrence: params.recurrence ?? null,
      expires_at: expiresAt.toISOString(),
      number_plate: params.numberPlate ?? null,
      status: 'open',
    })
    .select("id")
    .single();
    
  if (error) throw error;
  return data.id;
}
```

### PHASE 4: DROP DEPRECATED TABLES (After verification - 30 min)

Create migration: `20251208160000_drop_deprecated_mobility_tables.sql`

```sql
BEGIN;

-- SAFETY: Only drop after confirming data migration and all references updated

-- Drop deprecated trip tables
DROP TABLE IF EXISTS rides_trips CASCADE;
DROP TABLE IF EXISTS mobility_trips CASCADE;
DROP TABLE IF EXISTS mobility_trip_matches CASCADE;

-- Drop phantom tables if they exist
DROP TABLE IF EXISTS pending_trips CASCADE;
DROP TABLE IF EXISTS pending_ride_request CASCADE;
DROP TABLE IF EXISTS ride_driver_status CASCADE;
DROP TABLE IF EXISTS mobility_trips_compact CASCADE;

-- Log cleanup
INSERT INTO public.system_logs (event_type, details)
VALUES ('MOBILITY_TABLES_CLEANUP', jsonb_build_object(
  'action', 'deprecated_tables_dropped',
  'tables', ARRAY['rides_trips', 'mobility_trips', 'mobility_trip_matches'],
  'timestamp', now()
));

COMMIT;
```

---

## FINAL SIMPLIFIED SCHEMA

After consolidation, you will have:

### CORE TABLES (5):
1. **trips** - All trip requests (scheduled + instant)
2. **mobility_matches** - Accepted trip pairings & lifecycle
3. **ride_notifications** - Driver notification tracking
4. **recurring_trips** - Recurring trip templates
5. **mobility_intents** - User search intents (analytics)

### SUPPORTING TABLES (5):
6. **trip_payment_requests** - Payment tracking
7. **trip_status_audit** - Audit trail
8. **mobility_driver_metrics** - Driver performance
9. **mobility_passenger_metrics** - Passenger behavior
10. **mobility_pricing_config** - Pricing rules

**TOTAL: 10 tables** (down from 15+)

---

## DATA FLOW (After Consolidation)

```
USER ACTION: "Find nearby drivers"
    ↓
1. Insert into `trips` (trip_kind='request', status='open')
2. Insert into `mobility_intents` (for analytics)
3. Call match_drivers_for_trip_v2(trip_id) → queries `trips` table
    ↓
DRIVER ACCEPTS
    ↓
4. Insert into `mobility_matches` (status='pending')
5. Insert into `ride_notifications` (status='sent')
    ↓
LIFECYCLE UPDATES
    ↓
6. UPDATE `mobility_matches` SET status='accepted' → 'driver_arrived' → 'in_progress' → 'completed'
7. INSERT INTO `trip_status_audit` (audit trail)
8. UPDATE `mobility_driver_metrics` (increment completed_trips)
    ↓
PAYMENT
    ↓
9. INSERT INTO `trip_payment_requests` (references mobility_matches)
```

---

## RISK MITIGATION

### Backup Strategy
```bash
# Before running migrations, backup existing data
pg_dump -h <host> -U <user> -t rides_trips > rides_trips_backup.sql
pg_dump -h <host> -U <user> -t mobility_trips > mobility_trips_backup.sql
pg_dump -h <host> -U <user> -t mobility_trip_matches > mobility_trip_matches_backup.sql
```

### Rollback Plan
If issues arise:
1. Restore from backups
2. Revert migration files
3. Re-run `supabase db reset` in dev environment

### Testing Checklist
- [ ] Run assessment queries (Phase 1)
- [ ] Verify data counts before/after migration
- [ ] Test trip creation in canonical `trips` table
- [ ] Test matching functions return results
- [ ] Test trip lifecycle updates in `mobility_matches`
- [ ] Verify foreign keys are correct
- [ ] Check edge functions can insert/query successfully
- [ ] Monitor error logs for 24 hours post-deployment

---

## DEPLOYMENT TIMELINE

**Total estimated time: 6-8 hours** (including testing)

1. **Assessment** (1 hour) - Run queries, understand current state
2. **Data Migration** (2-3 hours) - Migrate data to canonical tables
3. **Update References** (2-3 hours) - Fix RPC functions, FKs, edge functions
4. **Testing** (1 hour) - Verify all flows work
5. **Cleanup** (30 min) - Drop deprecated tables
6. **Monitoring** (24 hours) - Watch for issues

---

## SUCCESS CRITERIA

✅ **All trips captured in single `trips` table**  
✅ **All matches tracked in single `mobility_matches` table**  
✅ **All RPC functions query canonical tables**  
✅ **Zero duplicate or phantom tables**  
✅ **Foreign keys properly reference canonical tables**  
✅ **100% trip capture rate (no lost data)**  

---

## APPENDIX: Quick Reference Commands

```sql
-- Check current table usage
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  n_live_tup as row_count
FROM pg_stat_user_tables
WHERE tablename LIKE '%trip%' OR tablename LIKE '%ride%' OR tablename LIKE '%mobility%'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Find all functions referencing old tables
SELECT 
  proname AS function_name,
  pg_get_functiondef(oid) AS definition
FROM pg_proc
WHERE prosrc LIKE '%rides_trips%' 
   OR prosrc LIKE '%mobility_trip_matches%'
ORDER BY proname;

-- Monitor trip creation rate
SELECT 
  DATE_TRUNC('hour', created_at) AS hour,
  COUNT(*) as trips_created,
  COUNT(DISTINCT creator_user_id) as unique_users
FROM trips
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY 1
ORDER BY 1 DESC;
```

---

**END OF CONSOLIDATION PLAN**
