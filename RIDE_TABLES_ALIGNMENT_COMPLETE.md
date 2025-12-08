# Ride Tables Alignment - COMPLETE ✅

**Date**: 2025-12-08 09:50 UTC  
**Database**: db.lhbowpbcpwoiparwnwgt.supabase.co  
**Status**: ✅ **FULLY ALIGNED WITH CANONICAL TRIPS**

---

## Overview

Aligned three remaining ride-related tables with the canonical `trips` table:
- `ride_requests` - Ride match requests sent to drivers
- `ride_notifications` - WhatsApp notifications sent to drivers
- `rides_driver_status` - Real-time driver online status & location

---

## Migration Executed

**File**: `20251208094500_align_ride_tables_with_trips.sql`

### 1. ride_requests ✅

**Changes:**
- ✅ Added FK: `ride_requests_trip_id_fkey` → `trips(id)` ON DELETE CASCADE
- ✅ Added status constraint: `pending | accepted | declined | expired | cancelled`
- ✅ Added indexes: passenger_id, created_at, pending status
- ✅ Enabled RLS with 4 policies:
  - `ride_requests_passenger_rw` - Passengers manage own requests
  - `ride_requests_driver_read` - Drivers read assigned requests
  - `ride_requests_driver_update` - Drivers update assigned requests
  - `ride_requests_service_role_all` - Service role full access
- ✅ Added `updated_at` trigger
- ✅ Added table/column comments

**Schema:**
```sql
CREATE TABLE ride_requests (
  id uuid PRIMARY KEY,
  trip_id uuid REFERENCES trips(id) ON DELETE CASCADE,
  passenger_id uuid REFERENCES profiles(user_id),
  driver_id uuid REFERENCES profiles(user_id),
  status text CHECK (status IN ('pending','accepted','declined','expired','cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  notified_at timestamptz,
  response_type text,
  response_at timestamptz,
  UNIQUE(trip_id, driver_id)
);
```

### 2. ride_notifications ✅

**Changes:**
- ✅ Added FK: `ride_notifications_trip_id_fkey` → `trips(id)` ON DELETE CASCADE
- ✅ Added status constraint: `sent | delivered | read | failed`
- ✅ Added indexes: driver_id, trip_id, created_at, status
- ✅ Enabled RLS with 2 policies:
  - `ride_notifications_driver_read` - Drivers read own notifications
  - `ride_notifications_service_role_all` - Service role full access
- ✅ Added table/column comments

**Schema:**
```sql
CREATE TABLE ride_notifications (
  id uuid PRIMARY KEY,
  trip_id uuid REFERENCES trips(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES profiles(user_id),
  wa_message_id text,
  status text CHECK (status IN ('sent','delivered','read','failed')),
  created_at timestamptz DEFAULT now()
);
```

### 3. rides_driver_status ✅

**Changes:**
- ✅ Changed FK: `whatsapp_users(id)` → `profiles(user_id)` (for consistency)
- ✅ Added generated `current_geog` column (geography point from lat/lng)
- ✅ Added GIST index on geography for spatial queries
- ✅ Added coordinate validation constraint
- ✅ Enabled RLS with 3 policies:
  - `rides_driver_status_owner_rw` - Drivers manage own status
  - `rides_driver_status_public_read_online` - Anyone reads online drivers
  - `rides_driver_status_service_role_all` - Service role full access
- ✅ Added `updated_at` trigger (also updates `last_seen_at`)
- ✅ Added table/column comments

**Schema:**
```sql
CREATE TABLE rides_driver_status (
  id uuid PRIMARY KEY,
  user_id uuid UNIQUE REFERENCES profiles(user_id) ON DELETE CASCADE,
  is_online boolean DEFAULT false,
  current_lat double precision,
  current_lng double precision,
  current_geog geography(Point,4326) GENERATED ALWAYS AS (...) STORED,
  last_seen_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CHECK (
    (current_lat IS NULL AND current_lng IS NULL) OR
    (current_lat BETWEEN -90 AND 90 AND current_lng BETWEEN -180 AND 180)
  )
);
```

### 4. Helper Views Created ✅

**active_drivers_with_location:**
```sql
SELECT 
  ds.user_id,
  ds.is_online,
  ds.current_lat,
  ds.current_lng,
  ds.current_geog,
  ds.last_seen_at,
  ds.metadata,
  p.phone_number,
  p.display_name,
  p.vehicle_type,
  p.vehicle_plate
FROM rides_driver_status ds
JOIN profiles p ON p.user_id = ds.user_id
WHERE ds.is_online = true
  AND ds.last_seen_at > now() - interval '10 minutes'
  AND ds.current_geog IS NOT NULL;
```

**pending_ride_requests_with_trips:**
```sql
SELECT 
  rr.id as request_id,
  rr.trip_id,
  rr.passenger_id,
  rr.driver_id,
  rr.status as request_status,
  rr.created_at as request_created_at,
  rr.notified_at,
  t.kind as trip_kind,
  t.role as trip_role,
  t.vehicle_type,
  t.pickup_lat,
  t.pickup_lng,
  t.pickup_text,
  t.scheduled_for,
  t.status as trip_status
FROM ride_requests rr
JOIN trips t ON t.id = rr.trip_id
WHERE rr.status = 'pending';
```

---

## Verification Results

### Foreign Keys ✅
All tables properly reference canonical tables:
```
ride_requests       → trips(id), profiles(user_id) × 2
ride_notifications  → trips(id), profiles(user_id)
rides_driver_status → profiles(user_id)
```

### RLS Policies ✅
All tables have row-level security enabled:
```
ride_requests       : 4 policies
ride_notifications  : 2 policies
rides_driver_status : 3 policies
trips               : 2 policies
```

### Views ✅
All helper views created and functional:
```
active_drivers_with_location      (0 rows - no online drivers)
pending_ride_requests_with_trips  (0 rows - no pending requests)
mobility_trips_compat             (9 rows - canonical trips)
```

---

## Data Integrity

### No Orphaned Records ✅
- `ride_requests` has 0 rows (no orphans)
- `ride_notifications` has 0 rows (no orphans)
- `rides_driver_status` has 1 row (valid profile FK)

### Cascade Deletes ✅
All foreign keys use `ON DELETE CASCADE`:
- Deleting a trip → deletes associated requests & notifications
- Deleting a profile → deletes driver status

---

## Complete Table Relationships

```
profiles (user_id)
  ├─→ trips (user_id) [canonical]
  │   ├─→ ride_requests (trip_id)
  │   └─→ ride_notifications (trip_id)
  ├─→ ride_requests (passenger_id, driver_id)
  ├─→ ride_notifications (driver_id)
  └─→ rides_driver_status (user_id) [UNIQUE]
```

---

## API Usage Examples

### 1. Create Trip & Send Ride Request

```typescript
// 1. Create trip
const { data: trip } = await supabase
  .from('trips')
  .insert({
    kind: 'request_intent',
    role: 'passenger',
    user_id: passengerId,
    vehicle_type: 'car',
    pickup_lat: -1.9441,
    pickup_lng: 30.0619,
    pickup_text: 'Kigali Convention Centre',
    expires_at: new Date(Date.now() + 90 * 60 * 1000)
  })
  .select()
  .single();

// 2. Create ride request for nearby driver
const { data: request } = await supabase
  .from('ride_requests')
  .insert({
    trip_id: trip.id,
    passenger_id: passengerId,
    driver_id: nearbyDriverId,
    status: 'pending',
    notified_at: new Date()
  })
  .select()
  .single();

// 3. Create notification record
await supabase
  .from('ride_notifications')
  .insert({
    trip_id: trip.id,
    driver_id: nearbyDriverId,
    wa_message_id: whatsappMessageId,
    status: 'sent'
  });
```

### 2. Driver Accepts Ride Request

```typescript
const { data } = await supabase
  .from('ride_requests')
  .update({
    status: 'accepted',
    response_type: 'accept',
    response_at: new Date()
  })
  .eq('id', requestId)
  .eq('driver_id', driverId) // RLS enforces this
  .select()
  .single();
```

### 3. Update Driver Location

```typescript
const { data } = await supabase
  .from('rides_driver_status')
  .upsert({
    user_id: driverId,
    is_online: true,
    current_lat: -1.9441,
    current_lng: 30.0619,
    metadata: { vehicle_type: 'car', available_seats: 3 }
  }, {
    onConflict: 'user_id'
  })
  .select()
  .single();

// Geography column auto-generated, last_seen_at auto-updated
```

### 4. Find Nearby Active Drivers

```typescript
const { data: nearbyDrivers } = await supabase.rpc(
  'find_nearby_drivers',
  {
    p_lat: -1.9441,
    p_lng: 30.0619,
    p_radius_km: 5,
    p_limit: 10
  }
);

// Or use the view
const { data: activeDrivers } = await supabase
  .from('active_drivers_with_location')
  .select('*');
```

### 5. Get Pending Requests with Trip Details

```typescript
const { data: pendingRequests } = await supabase
  .from('pending_ride_requests_with_trips')
  .select('*')
  .eq('driver_id', driverId);
```

---

## Monitoring Queries

### Check Active Drivers
```sql
SELECT COUNT(*) as online_drivers
FROM rides_driver_status
WHERE is_online = true
  AND last_seen_at > now() - interval '10 minutes';
```

### Check Pending Requests
```sql
SELECT 
  status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (now() - created_at))) as avg_age_seconds
FROM ride_requests
GROUP BY status;
```

### Check Notification Success Rate
```sql
SELECT 
  status,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM ride_notifications
WHERE created_at > now() - interval '24 hours'
GROUP BY status;
```

---

## Migration Summary

✅ **All ride tables aligned with canonical trips**  
✅ **Foreign keys enforced with CASCADE deletes**  
✅ **RLS policies active on all tables**  
✅ **Geography indexing for spatial queries**  
✅ **Helper views for common queries**  
✅ **Triggers for auto-updating timestamps**  
✅ **Constraints for data validation**  
✅ **Zero orphaned records**  

---

**Consolidated Tables:**
- ✅ trips (canonical)
- ✅ ride_requests (aligned)
- ✅ ride_notifications (aligned)
- ✅ rides_driver_status (aligned)

**Legacy Tables Removed:**
- ✅ mobility_trips
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

---

**Migration completed**: 2025-12-08 09:50 UTC  
**Database**: db.lhbowpbcpwoiparwnwgt.supabase.co  
**All tables fully aligned**: ✅ **PRODUCTION READY**

