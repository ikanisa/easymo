# Mobility Orchestrator Service - DEPRECATED

**Status:** ⛔ DEPRECATED  
**Date:** 2025-12-14  
**Migration:** 20251214000000_simplified_mobility_schema.sql

## Why This Service Was Deprecated

The mobility-orchestrator microservice was part of an over-engineered approach to trip matching that included:

1. **Complex orchestration** - Multiple microservices coordinating trip matching
2. **Duplicate tables** - `mobility_trips`, `scheduled_trips`, `recurring_trips`, etc.
3. **Over-engineered matching** - PostGIS queries, complex scoring algorithms
4. **Unnecessary notifications** - Complex notification system with rate limiting

## Simplified Replacement

The new simplified system uses:

### Single Trips Table
- One canonical `public.trips` table
- Direct phone numbers for contact
- Simple status tracking (`open`, `matched`, `completed`, `cancelled`, `expired`)

### Simple Functions
1. **`find_matches(trip_id, limit)`** - Distance-based matching within 10km
2. **`create_trip(...)`** - Create trip with auto-expiry
3. **`cleanup_expired_trips()`** - Mark expired trips

### Direct WhatsApp Contact
- No complex notifications
- Users see matches and contact directly via WhatsApp
- Simple phone number exchange

## Migration Path

### Before (Complex)
```typescript
// Multiple services, complex orchestration
await mobilityOrchestrator.createTrip(...)
await mobilityOrchestrator.matchDrivers(...)
await notificationService.notifyDrivers(...)
```

### After (Simple)
```typescript
// Single RPC call, simple matching
const tripId = await supabase.rpc('create_trip', {...})
const matches = await supabase.rpc('find_matches', { _trip_id: tripId, _limit: 9 })
// User contacts matches directly via WhatsApp
```

## What Was Removed

### Tables Dropped
- `scheduled_trips`
- `recurring_trips`
- `mobility_trips_compact`
- `pending_trips`
- `driver_status`
- `trip_notifications`

### Functions Dropped
- `match_drivers_for_trip_v2` (replaced by `find_matches`)
- `match_passengers_for_trip_v2` (replaced by `find_matches`)
- Complex orchestration RPCs with 10+ parameters

### Code Simplified
- `rpc/mobility.ts` - Simplified to use new RPC functions
- `handlers/nearby.ts` - Removed notification logic
- Driver presence tracking removed (trips are now the source of truth)

## Benefits of Simplification

1. **Fewer Tables** - Reduced from 323 to ~10-20 essential tables
2. **Simple Matching** - Haversine distance, no PostGIS complexity
3. **Direct Contact** - Users exchange phone numbers naturally
4. **Auto-Expiry** - Trips expire after 30 minutes automatically
5. **No Orchestration** - Edge functions call simple RPC functions directly

## For Developers

If you need to work with mobility features:

1. **Read the migration:** `supabase/migrations/20251214000000_simplified_mobility_schema.sql`
2. **Use simplified RPCs:** `create_trip()`, `find_matches()`, `cleanup_expired_trips()`
3. **Update edge functions:** Use simplified `rpc/mobility.ts` functions
4. **Keep it simple:** No complex orchestration, just distance-based matching

## References

- Migration: `supabase/migrations/20251214000000_simplified_mobility_schema.sql`
- Edge function: `supabase/functions/wa-webhook-mobility/`
- RPC module: `supabase/functions/wa-webhook-mobility/rpc/mobility.ts`
- Handler: `supabase/functions/wa-webhook-mobility/handlers/nearby.ts`

---

**DO NOT** attempt to restore this service. The simplified approach is intentional and provides better maintainability, performance, and user experience.
