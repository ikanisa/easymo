# Adapter Ports Documentation - Phase 2 Implementation Guide

## Overview
The adapter pattern provides a clean boundary between the frontend UI and backend data operations. Phase-1 uses `MockAdapter` with localStorage. Phase-2 will implement `RealAdapter` with Supabase + Edge Functions.

This document serves as the comprehensive interface contract for Phase-2 Supabase implementation.

## Interface Contract

### Core Data Operations
```typescript
// Settings Management
getSettings(): Promise<Settings>
updateSettings(patch: Partial<Settings>): Promise<Settings>

// Users  
getUsers(): Promise<User[]>           // Most recent first
listUsers(): Promise<User[]>          // Alias for compatibility

// Trips
getTrips(): Promise<Trip[]>           // Most recent first (created_at desc)

// Subscriptions
getSubscriptions(): Promise<Subscription[]>  // All subscriptions
approveSubscription(id: number, txnId?: string): Promise<void>
rejectSubscription(id: number): Promise<void>

// Admin Stats
getAdminStats(): Promise<AdminStats>
```

### Simulator Operations (Phase-2: Replace with WhatsApp webhook)
```typescript
// Geospatial Queries (Phase-2: Use PostGIS)
simulateSeeNearbyDrivers(params: {
  lat: number, lng: number, vehicle_type: VehicleType
}): Promise<DriverPresence[]>  // Max 10, sorted by last_seen desc

simulateSeeNearbyPassengers(params: {
  lat: number, lng: number, vehicle_type: VehicleType, hasAccess: boolean
}): Promise<Trip[] | 'NO_ACCESS'>  // Max 10, sorted by created_at desc

// Trip Creation
simulateScheduleTripPassenger(params: {
  vehicle_type: VehicleType,
  lat: number,
  lng: number,
  refCode?: string,            // Required in Phase-2 (Supabase)
}): Promise<Trip>

simulateScheduleTripDriver(params: {
  vehicle_type: VehicleType,
  lat: number,
  lng: number,
  hasAccess: boolean,
  refCode?: string,             // Required in Phase-2 (Supabase)
}): Promise<Trip | 'NO_ACCESS'>

// Utility
getProfileByRefCode(refCode: string): Promise<Profile | null>
resetMockData(): Promise<void>  // Dev only
```

## Phase-2 Implementation Notes

### Database Schema (Supabase)
- **profiles**: user_id, whatsapp_e164, ref_code, credits_balance, created_at
- **driver_presence**: user_id, vehicle_type, last_seen, location (PostGIS)
- **trips**: id, creator_user_id, role, vehicle_type, created_at, location (PostGIS), status
- **subscriptions**: id, user_id, status, started_at, expires_at, amount, proof_url, created_at

### Geospatial Queries (PostGIS)
```sql
-- Find nearby drivers
SELECT * FROM driver_presence dp
JOIN profiles p ON dp.user_id = p.user_id  
WHERE dp.vehicle_type = $1
  AND ST_DWithin(dp.location, ST_Point($2, $3)::geography, $4 * 1000)
  AND dp.last_seen > NOW() - INTERVAL '30 minutes'
ORDER BY dp.last_seen DESC
LIMIT $5;
```

### Access Control
- **Driver Features**: Check active subscription OR credits_balance > 0
- **Admin Commands**: Verify phone number in settings.admin_whatsapp_numbers
- **Rate Limiting**: Implement per-user message limits in Edge Functions

### WhatsApp Webhook Integration
- **Replace Simulator**: State machine logic moves to Edge Function
- **Message Parsing**: Parse incoming WhatsApp messages (buttons, lists, location)
- **Response Builder**: Generate WhatsApp API responses (buttons, lists, chat links)
- **State Persistence**: Store user flow state in database

### Environment Variables (Phase-2)
```
VITE_USE_MOCK=0                    # Use real adapter
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # Edge Functions only
WHATSAPP_ACCESS_TOKEN=EAA...
WHATSAPP_VERIFY_TOKEN=your_token
```

## Testing Strategy
- **Unit Tests**: Continue testing format.ts, waSimFlows.ts logic
- **Integration Tests**: Test real adapter with Supabase (test database)
- **E2E Tests**: WhatsApp webhook simulation with ngrok tunneling

## Migration Path
1. **Implement RealAdapter**: Replace all throw statements with Supabase calls
2. **Create Edge Functions**: /webhook-whatsapp, /admin-stats, /geospatial-search
3. **Setup Supabase**: Database, RLS policies, PostGIS extension
4. **Environment Switch**: Change VITE_USE_MOCK=0
5. **WhatsApp Setup**: Business API, webhook verification, number registration

**All existing UI components will work unchanged - that's the power of the adapter pattern!**
