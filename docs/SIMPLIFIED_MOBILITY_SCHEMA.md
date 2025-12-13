# Simplified Mobility Schema - Implementation Guide

## Overview

This migration simplifies the EasyMO mobility system from 323 tables down to ~10-20 essential tables, replacing complex matching with simple distance-based lookup.

## What Changed

### Database Tables

#### Dropped Tables
- `scheduled_trips` - Replaced by `scheduled_for` column in trips
- `recurring_trips` - Simplified, no longer needed
- `driver_status` - Drivers are now discovered through active trips only
- `trip_notifications` - Users contact each other directly via WhatsApp
- `mobility_trips_compact` - Duplicate removed
- `pending_trips` - Duplicate removed

#### Modified Tables
- `public.trips` - Added `phone` column for direct WhatsApp contact

#### Preserved Tables
- `public.business` (8,232+ records) - **CRITICAL** business data preserved
- All PostGIS system tables (spatial_ref_sys, geometry_columns, etc.)
- All Supabase internal tables

### Functions

#### New Simplified Functions
1. **`find_matches(trip_id, limit)`**
   - Finds opposite-role trips within 10km
   - Uses simple Haversine distance (no PostGIS required)
   - Returns up to 9 matches by default
   - Sorted by vehicle match, then distance

2. **`create_trip(...)`**
   - Creates new trip with auto-expiry (30 minutes)
   - Parameters: user_id, phone, role, vehicle, pickup coordinates, optional dropoff, optional scheduled_for
   - Returns trip UUID

3. **`cleanup_expired_trips()`** *(already existed)*
   - Marks trips as 'expired' after expires_at timestamp
   - Should be called periodically (every 5 minutes)

#### Removed Functions
- `match_drivers_for_trip_v2()` - Replaced by `find_matches()`
- `match_passengers_for_trip_v2()` - Replaced by `find_matches()`

### Edge Functions

#### Updated Files
- `supabase/functions/wa-webhook-mobility/rpc/mobility.ts`
  - Removed `recordDriverPresence()` - no longer needed
  - Updated `insertTrip()` to use `create_trip` RPC
  - Added `findMatches()` wrapper
  - Simplified `MatchResult` type

- `supabase/functions/wa-webhook-mobility/handlers/nearby.ts`
  - Updated to use simplified `phone` field
  - Removed complex driver notifications
  - Removed `isDriverQuiet()` function

## Migration Strategy

### Backward Compatibility

The migration maintains backward compatibility with existing code:

**Vehicle Column**: 
- Existing code uses `vehicle_type` column
- New code can use `vehicle` column (generated alias)
- Functions use `COALESCE(vehicle, vehicle_type)` to work with both
- Future migrations can consolidate to single column

**Phone Numbers**:
- New trips have `phone` column
- Old trips fall back to `profiles.phone_number` or `profiles.wa_id`
- Functions use `COALESCE(t.phone, p.phone_number, p.wa_id)`

### Usage Examples

#### Creating a Trip

```typescript
// Old way (direct insert)
const { data } = await supabase.from("trips").insert({
  user_id: userId,
  role: "passenger",
  vehicle_type: "moto",
  pickup_lat: lat,
  pickup_lng: lng,
  status: "open",
  expires_at: expiresAt,
});

// New way (simplified RPC)
const tripId = await supabase.rpc("create_trip", {
  _user_id: userId,
  _phone: phoneNumber,
  _role: "passenger",
  _vehicle: "moto",
  _pickup_lat: lat,
  _pickup_lng: lng,
});
```

#### Finding Matches

```typescript
// Old way (complex with many parameters)
const { data } = await supabase.rpc("match_drivers_for_trip_v2", {
  _trip_id: tripId,
  _limit: 9,
  _prefer_dropoff: false,
  _radius_m: 10000,
  _window_minutes: 30,
});

// New way (simplified)
const matches = await supabase.rpc("find_matches", {
  _trip_id: tripId,
  _limit: 9,
});
```

## Benefits

### Before (Complex System)
- 323+ database tables
- Complex matching with PostGIS
- Multiple microservices for orchestration
- Complex notification system with rate limiting
- Driver presence tracking table
- Scheduled/recurring trips in separate tables

### After (Simplified System)
- ~10-20 essential tables
- Simple Haversine distance matching
- Direct RPC calls from edge functions
- Direct WhatsApp contact (no notifications)
- Trips are the source of truth for driver availability
- Single trips table with scheduled_for column

### Quantified Improvements
- **90% fewer tables**: From 323 to ~20
- **Simple matching**: 10km radius, basic distance calculation
- **30-minute auto-expiry**: Trips clean up automatically
- **Direct contact**: No complex notification orchestration
- **Better performance**: Fewer joins, simpler queries

## Testing Checklist

- [x] Migration has proper BEGIN/COMMIT structure
- [x] Migration passes hygiene checks
- [x] No references to removed functions
- [x] Backward compatibility maintained
- [x] Documentation added
- [ ] Test trip creation via RPC
- [ ] Test matching via RPC
- [ ] Test WhatsApp flow end-to-end
- [ ] Verify business table preserved

## Rollback Plan

If issues arise, the migration can be rolled back by:

1. Restore from database backup before migration
2. Revert edge function changes
3. Restore removed services

**Note**: The migration is designed to be non-destructive to critical data (business table preserved).

## Maintenance

### Scheduled Tasks
- Run `cleanup_expired_trips()` every 5 minutes
- Monitor trip counts and expiry metrics

### Monitoring
Watch for:
- Trip creation failures
- Match query performance
- Expired trip cleanup metrics

## References

- Migration: `supabase/migrations/20251214000000_simplified_mobility_schema.sql`
- Edge Functions: `supabase/functions/wa-webhook-mobility/`
- Deprecated Service: `services/mobility-orchestrator/DEPRECATED.md`
- Ground Rules: `docs/GROUND_RULES.md`

---

**Last Updated**: 2025-12-14  
**Migration Version**: 20251214000000
