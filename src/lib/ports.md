# Adapter Ports Documentation - Phase 2 Implementation Guide

## Overview
The adapter pattern provides a clean boundary between the frontend UI and backend data operations. In production the `RealAdapter`
delegates to the `AdminAPI`, which in turn calls Supabase Edge Functions secured by the admin token. This keeps the Supabase
service role key on the server while preserving a simple async API for the React application.

## Interface Contract

### Core Data Operations
```typescript
// Settings Management
getSettings(): Promise<Settings>
updateSettings(patch: Partial<Settings>): Promise<Settings>

// Users
getUsers(): Promise<User[]>

// Trips
getTrips(): Promise<Trip[]>
updateTripStatus(id: number, status: Trip['status']): Promise<void>

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
  hasAccess?: boolean;
  radius_km?: number;
  max?: number;
}): Promise<Trip[] | 'NO_ACCESS'>

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

## Edge Function Mappings

| Adapter method | Edge function endpoint |
|----------------|------------------------|
| `getSettings`, `updateSettings` | `/admin-settings` |
| `getUsers` | `/admin-users` |
| `getTrips`, `updateTripStatus` | `/admin-trips` (with `action=list` / `action=close`) |
| `getSubscriptions`, `approveSubscription`, `rejectSubscription` | `/admin-subscriptions` |
| `getAdminStats` | `/admin-stats` |
| `simulateSeeNearbyDrivers` | `/simulator?action=drivers` |
| `simulateSeeNearbyPassengers` | `/simulator?action=passengers` |
| `simulateScheduleTripPassenger` | `/simulator?action=schedule_passenger` |
| `simulateScheduleTripDriver` | `/simulator?action=schedule_driver` |
| `getProfileByRefCode` | `/simulator?action=profile` |

## Testing Strategy

- Vitest exercises adapter delegation (`src/lib/adapter.real.test.ts`).
- React Query hooks in the admin screens call `AdminAPI` directly; smoke testing the screens verifies integration.
- For end-to-end checks run the Supabase Edge Functions locally (`supabase start`) and seed data with `supabase/seeders/phase2_seed.sql`.
