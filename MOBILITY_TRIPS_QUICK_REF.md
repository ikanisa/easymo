# Mobility Trips - Quick Reference

## TL;DR - What Changed

**Before**: 8 fragmented trip tables, split code paths, full ride-hailing lifecycle  
**After**: 1 canonical `trips` table, unified code, simplified scope (scheduling + nearby only)

---

## Core Concepts

### Trip Kinds (2 types)
- **`scheduled`**: User planning a future trip → sets `scheduled_for` timestamp
- **`request`**: User searching for nearby drivers/passengers → intent logging

### Trip Statuses (3 states)
- **`active`**: Trip is searchable, not expired
- **`expired`**: Past TTL or scheduled time
- **`cancelled`**: User cancelled

### NO Matching
- We show nearby results
- User clicks to chat via WhatsApp
- Everything after that is outside our system

---

## Database Schema

### Main Table: `trips`
```sql
-- Essential columns
id uuid
user_id uuid
role text  -- 'driver' | 'passenger'
vehicle_type text  -- 'moto', 'cab', 'lifan', 'truck'
trip_kind text  -- 'scheduled' | 'request'
status text  -- 'active', 'expired', 'cancelled'

-- Location
pickup_lat/lng double precision
pickup_geog geography(Point, 4326)  -- Auto-generated
dropoff_lat/lng double precision (optional)
dropoff_geog geography(Point, 4326)

-- Scheduling
scheduled_for timestamptz (for trip_kind='scheduled')
recurrence_id uuid (FK to recurring_trips)

-- Timestamps
created_at, expires_at, cancelled_at, updated_at
```

### Key Indexes
- `idx_trips_pickup_geog` - Fast spatial queries
- `idx_trips_role_vehicle_active` - Filter active trips by type

---

## TypeScript API

### Create Trip
```typescript
import { insertTrip } from '../rpc/mobility.ts';

// Nearby search (request intent)
const tripId = await insertTrip(client, {
  userId: 'xxx',
  role: 'passenger',
  vehicleType: 'moto',
  lat: -1.95,
  lng: 30.06,
  radiusMeters: 5000,
  pickupText: 'Kigali City Center',
});
// → Creates trip with trip_kind='request', status='active'

// Scheduled trip
const tripId = await insertTrip(client, {
  userId: 'yyy',
  role: 'driver',
  vehicleType: 'moto',
  lat: -1.95,
  lng: 30.06,
  radiusMeters: 1000,
  scheduledAt: new Date('2025-12-10T08:00:00Z'),
});
// → Creates trip with trip_kind='scheduled', status='active'
```

### Find Nearby
```typescript
import { matchDriversForTrip } from '../rpc/mobility.ts';

// Find drivers near passenger's trip
const drivers = await matchDriversForTrip(client, passengerTripId, {
  limit: 10,
  preferDropoff: false,
  radiusMeters: 10000,
  windowDays: 2,
});
// → Returns nearby active drivers, sorted by distance
```

### Update Dropoff
```typescript
import { updateTripDropoff } from '../rpc/mobility.ts';

await updateTripDropoff(client, {
  tripId: 'xxx',
  lat: -1.94,
  lng: 30.07,
  dropoffText: 'Airport',
  radiusMeters: 500,
});
```

---

## SQL RPC Functions

### `match_drivers_for_trip_v2`
```sql
SELECT * FROM match_drivers_for_trip_v2(
  _trip_id := 'passenger-trip-uuid',
  _limit := 10,
  _prefer_dropoff := false,
  _radius_m := 10000,
  _window_days := 2
);
```
**Returns**: Nearby drivers with distance, location age, vehicle info

### `match_passengers_for_trip_v2`
```sql
SELECT * FROM match_passengers_for_trip_v2(
  _trip_id := 'driver-trip-uuid',
  _limit := 10,
  _prefer_dropoff := false,
  _radius_m := 10000,
  _window_days := 2
);
```
**Returns**: Nearby passengers with distance, dropoff matching bonus

### `find_nearby_trips` (Generic)
```sql
SELECT * FROM find_nearby_trips(
  _lat := -1.95,
  _lng := 30.06,
  _role := 'driver',
  _vehicle_type := 'moto',
  _radius_m := 10000,
  _limit := 20,
  _window_days := 2
);
```
**Returns**: All nearby active trips matching criteria

---

## Common Queries

### Active Trips by Vehicle Type
```sql
SELECT vehicle_type, role, COUNT(*) 
FROM trips 
WHERE status = 'active'
GROUP BY vehicle_type, role;
```

### Recent User Trips
```sql
SELECT id, trip_kind, status, created_at, scheduled_for
FROM trips
WHERE user_id = 'xxx'
ORDER BY created_at DESC
LIMIT 10;
```

### Nearby Drivers (Raw SQL)
```sql
SELECT 
  t.id,
  p.display_name,
  p.whatsapp_e164,
  ROUND((ST_Distance(
    t.pickup_geog,
    ST_SetSRID(ST_MakePoint(30.06, -1.95), 4326)::geography
  ) / 1000.0)::numeric, 2) AS distance_km
FROM trips t
JOIN profiles p ON p.user_id = t.user_id
WHERE t.role = 'driver'
  AND t.status = 'active'
  AND t.vehicle_type = 'moto'
  AND ST_DWithin(
    t.pickup_geog,
    ST_SetSRID(ST_MakePoint(30.06, -1.95), 4326)::geography,
    10000
  )
ORDER BY distance_km
LIMIT 10;
```

---

## Cron Jobs

### Expire Old Trips (every 5 min)
```sql
SELECT expire_old_trips();
-- Sets status='expired' WHERE status='active' AND expires_at < now()
```

### Expire Past Scheduled Trips (every 10 min)
```sql
SELECT expire_past_scheduled_trips();
-- Sets status='expired' WHERE trip_kind='scheduled' AND scheduled_for < now()
```

---

## Migration Reference

### Column Name Changes
| Old (rides_trips/mobility_trips) | New (trips) |
|----------------------------------|-------------|
| creator_user_id | user_id |
| pickup_latitude | pickup_lat |
| pickup_longitude | pickup_lng |
| pickup (geometry) | pickup_geog (geography) |
| dropoff_latitude | dropoff_lat |
| dropoff_longitude | dropoff_lng |
| scheduled_at | scheduled_for |
| status ('open'/'matched') | status ('active'/'expired') + trip_kind |

### Status Mapping
| Old Status | New Status | New trip_kind |
|------------|------------|---------------|
| open | active | request |
| scheduled | active | scheduled |
| matched | expired | request |
| expired | expired | request/scheduled |
| cancelled | cancelled | request/scheduled |

---

## Troubleshooting

### "Table rides_trips does not exist"
✅ **Fixed**: Code now uses `trips` table  
🔧 **If error persists**: Check migrations applied (`supabase db push`)

### "Column creator_user_id does not exist"
✅ **Fixed**: Column renamed to `user_id`  
🔧 **If error persists**: Update code to use new column names

### Slow nearby queries
🔍 **Check indexes**: `SELECT * FROM pg_indexes WHERE tablename = 'trips';`  
🔧 **Verify GIST index used**: Run `EXPLAIN ANALYZE` on query

### Trips not expiring
🔍 **Check cron jobs**: `SELECT * FROM cron.job WHERE jobname LIKE '%trip%';`  
🔧 **Manual expire**: `SELECT expire_old_trips();`

---

## Performance Benchmarks

| Query | Expected Time | Rows Scanned |
|-------|---------------|--------------|
| Nearby drivers (10km) | < 100ms | Index-only |
| User trip history | < 10ms | Index-only |
| Expire old trips | < 5s | Full table (filtered) |
| Insert trip | < 20ms | Single row |

---

## Files to Know

### SQL Migrations
- `20251208090000_mobility_trips_canonical_schema.sql` - Create trips table
- `20251208090001_migrate_data_to_canonical_trips.sql` - Backfill data
- `20251208090002_update_matching_rpcs_for_trips.sql` - Update RPCs
- `20251208090003_drop_old_trip_tables.sql` - Cleanup
- `20251208090004_update_cron_jobs_for_trips.sql` - Cron setup

### TypeScript Code
- `supabase/functions/_shared/wa-webhook-shared/rpc/mobility.ts` - Core RPC wrappers
- `supabase/functions/wa-webhook-mobility/rpc/mobility.ts` - Mobility-specific RPCs
- `supabase/functions/wa-webhook/rpc/mobility.ts` - Legacy wrapper (deprecated)

### Documentation
- `MOBILITY_TRIPS_CLEANUP_SUMMARY.md` - Complete technical documentation
- `MOBILITY_TRIPS_QUICK_REF.md` - This file

---

## Deployment

### Quick Deploy
```bash
./deploy-mobility-trips-cleanup.sh
```

### Manual Deploy
```bash
# 1. Apply migrations
supabase db push

# 2. Deploy edge functions
supabase functions deploy wa-webhook
supabase functions deploy wa-webhook-mobility

# 3. Verify
supabase db execute "SELECT COUNT(*) FROM trips;"
```

---

## Support

**Questions?** Check:
1. This quick ref
2. Full documentation: `MOBILITY_TRIPS_CLEANUP_SUMMARY.md`
3. Migration files in `supabase/migrations/`

**Errors?** Check:
1. Supabase logs: `supabase functions logs --tail`
2. Database logs: `supabase db logs`
3. Applied migrations: `SELECT version FROM supabase_migrations.schema_migrations;`

---

**Last Updated**: 2025-12-08
