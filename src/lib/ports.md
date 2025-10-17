# Adapter Ports Documentation - Phase 2 Implementation Guide

## Overview
The adapter pattern provides a clean boundary between the frontend UI and backend data operations. The Phase-2 implementation wires `RealAdapter` directly to Supabase using the helper functions in `src/lib/supabase-admin-service.ts`.

## Interface Contract

### Core Data Operations
```typescript
// Settings Management
getSettings(): Promise<Settings>
updateSettings(patch: Partial<Settings>): Promise<Settings>

// Users
getUsers(): Promise<User[]>           // Most recent first

// Trips
getTrips(): Promise<Trip[]>           // Most recent first (created_at desc)
closeTrip(id: number): Promise<void>

// Subscriptions
getSubscriptions(): Promise<Subscription[]>
approveSubscription(id: number, txnId?: string): Promise<void>
rejectSubscription(id: number, reason?: string): Promise<void>

// Admin Stats
getAdminStats(): Promise<AdminStats>
```

### Simulator Operations
```typescript
simulateSeeNearbyDrivers(params: {
  lat: number;
  lng: number;
  vehicle_type: VehicleType;
  radius_km?: number;
  max?: number;
}): Promise<DriverPresence[]>

simulateSeeNearbyPassengers(params: {
  lat: number;
  lng: number;
  vehicle_type: VehicleType;
  driver_ref_code?: string;
  force_access?: boolean;
  radius_km?: number;
  max?: number;
}): Promise<{ access: boolean; trips?: Trip[]; reason?: string }>

simulateScheduleTripPassenger(params: {
  vehicle_type: VehicleType;
  lat: number;
  lng: number;
  refCode: string;
}): Promise<Trip>

simulateScheduleTripDriver(params: {
  vehicle_type: VehicleType;
  lat: number;
  lng: number;
  refCode: string;
  hasAccess: boolean;
}): Promise<Trip | 'NO_ACCESS'>

getProfileByRefCode(refCode: string): Promise<Profile | null>
```

## Supabase Mappings

| UI action | Supabase interaction |
|-----------|----------------------|
| Fetch settings | `from('settings').select(...).single()` |
| Update settings | `from('settings').update(...).eq('id', 1)` |
| List users | `from('profiles').select(..., subscriptions(...))` |
| List trips | `from('trips').select(..., profiles(...))` |
| Close trip | `from('trips').update({ status: 'closed' }).eq('id', id)` |
| List subscriptions | `from('subscriptions').select(..., profiles(...))` |
| Approve subscription | `from('subscriptions').update({...}).in('status', ['pending', 'review', 'pending_review'])` |
| Reject subscription | `from('subscriptions').update({ status: 'rejected' })` |
| Admin stats | Count queries on `driver_presence`, `trips`, `subscriptions` |
| Nearby drivers | RPC `simulator_find_nearby_drivers` |
| Nearby passengers | RPC `simulator_find_nearby_passenger_trips` |
| Schedule passenger trip | `from('trips').insert(... role='passenger')` |
| Schedule driver trip | `from('trips').insert(... role='driver')` |

## Geospatial Helpers

`easymo/supabase/migrations/20251112090000_phase2_mobility_core.sql` creates the PostGIS RPC functions used by the simulator:

- `simulator_find_nearby_drivers(lat, lng, radius_km, max_results, vehicle_type)` returns the latest `driver_presence` rows within the radius.
- `simulator_find_nearby_passenger_trips(lat, lng, radius_km, max_results, vehicle_type)` returns JSON with passenger trip metadata.

Both RPCs limit to 10 results by default and perform `ST_DWithin` proximity filtering.

## Testing Strategy

- Vitest exercises the adapter delegation (`src/lib/adapter.real.test.ts`).
- Deno tests under `easymo/supabase/functions/tests` cover edge-function request handling.
- When running end-to-end checks, seed the database with `phase_b_seed.sql` so simulator flows have sample data.

