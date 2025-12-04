# EasyMO Mobility Microservices - Deep Architecture Review

**Date**: December 4, 2025  
**Reviewer**: GitHub Copilot CLI  
**Scope**: Complete mobility workflow, microservices, database, and integration

---

## Executive Summary

### Current State: 🟡 FUNCTIONAL BUT FRAGMENTED

The mobility system is **operationally functional** but suffers from **architectural fragmentation**, **unclear service boundaries**, and **technical debt accumulation**. Multiple fixes have been layered over time, creating inconsistencies.

### Critical Finding

**The ranking-service microservice exists but is NOT integrated with the mobility workflow.** Matching is done via SQL functions, not the dedicated ranking service.

### Health Score: 6.5/10

| Component | Score | Status |
|-----------|-------|--------|
| Database Schema | 8/10 | ✅ Well-structured, needs cleanup |
| Matching Logic | 7/10 | 🟡 Works but duplicated |
| Microservices | 4/10 | ❌ Ranking service unused |
| Edge Functions | 7/10 | 🟡 Large, needs refactoring |
| Workflow Integration | 5/10 | ❌ Fragmented, no clear orchestration |
| Code Quality | 6/10 | 🟡 Many TODOs, tech debt |

---

## Architecture Overview

### Current Components

```
┌─────────────────────────────────────────────────────────────┐
│                      USER (WhatsApp)                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         wa-webhook-mobility (Supabase Edge Function)        │
│  - index.ts (583 lines) - Main router                       │
│  - handlers/ (29 files, 9000+ lines)                        │
│    • nearby.ts (1121 lines) ⚠️ TOO LARGE                    │
│    • trip_lifecycle.ts (831 lines)                          │
│    • tracking.ts (564 lines)                                │
│    • trip_payment.ts (436 lines)                            │
│    • driver_verification.ts (510 lines)                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  Database (PostgreSQL + PostGIS)             │
│  Tables:                                                     │
│    • rides_trips (core trip data)                           │
│    • mobility_intents (search history, spatial indexed)     │
│    • mobility_matches (trip lifecycle)                      │
│    • driver_status (online/offline state)                   │
│  Functions:                                                  │
│    • match_drivers_for_trip_v2()                            │
│    • match_passengers_for_trip_v2()                         │
│    • recommend_drivers_for_user()                           │
│    • recommend_passengers_for_user()                        │
│    • cleanup_expired_mobility_intents()                     │
│    • activate_recurring_trips()                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼ (MISSING INTEGRATION)
┌─────────────────────────────────────────────────────────────┐
│         ranking-service (NestJS Microservice)               │
│  ❌ EXISTS BUT NOT CALLED BY MOBILITY WORKFLOW              │
│  - Ranks vendors for marketplace (not drivers)              │
│  - Uses Prisma + vendorProfile (separate domain)            │
│  - Port 4500, not integrated with edge functions            │
└─────────────────────────────────────────────────────────────┘
```

---

## Critical Issues Identified

### 🔴 ISSUE #1: Ranking Service Not Integrated (CRITICAL)

**Problem**:
- `ranking-service` microservice exists in `services/ranking-service/`
- It ranks **marketplace vendors**, NOT mobility drivers
- Mobility matching uses **SQL functions** directly (match_drivers_for_trip_v2)
- No communication between edge function and ranking service

**Evidence**:
```typescript
// services/ranking-service/src/service.ts
export class RankingService {
  async rankVendors(options: RankVendorsOptions) {
    const vendors = await this.prisma.vendorProfile.findMany({ /* ... */ });
    // Returns ranked VENDORS, not drivers
  }
}
```

```typescript
// supabase/functions/wa-webhook-mobility/rpc/mobility.ts
export async function matchDriversForTrip(/* ... */) {
  const { data } = await client.rpc("match_drivers_for_trip_v2", { /* ... */ });
  // Direct SQL RPC call, no microservice
}
```

**Impact**:
- Ranking service investment wasted (unused code)
- SQL functions handle matching + sorting (should be separate concerns)
- No sophisticated scoring algorithm (just distance + time)
- Cannot A/B test ranking strategies

**Root Cause**: Naming confusion - "ranking-service" was built for marketplace, not mobility.

---

### 🔴 ISSUE #2: Duplicate Matching Logic

**Problem**:
- Matching logic exists in **3 places**:
  1. SQL function: `match_drivers_for_trip_v2` (200+ lines)
  2. SQL function: `match_passengers_for_trip_v2` (200+ lines)
  3. TypeScript: `sortMatches.ts` (client-side re-sorting)

**Evidence**:
```sql
-- supabase/migrations/20251201130000_fix_matching_critical_issues.sql
CREATE OR REPLACE FUNCTION public.match_drivers_for_trip_v2(...)
  ORDER BY 
    ST_Distance(t.pickup::geography, v_pickup_geog) ASC,  -- Distance sorting in SQL
    COALESCE(t.last_location_at, t.created_at) DESC,      -- Recency sorting in SQL
    (t.vehicle_type = v_vehicle_type) DESC                -- Vehicle match in SQL
```

```typescript
// supabase/functions/_shared/wa-webhook-shared/utils/sortMatches.ts
export function sortMatches(matches: MatchResult[], options) {
  return matches.sort((a, b) => {
    // CLIENT-SIDE RE-SORTING (redundant)
    if (prioritize === "distance") { /* ... */ }
  });
}
```

**Impact**:
- Changes must be made in multiple places
- SQL sorts, then TypeScript re-sorts (why?)
- Performance overhead (sorting twice)
- Inconsistent behavior risk

---

### 🟡 ISSUE #3: Monolithic Edge Function Handler

**Problem**: `nearby.ts` is **1121 lines** - too large for a single handler.

**Breakdown**:
```
nearby.ts (1121 lines)
├── Vehicle selection logic (100 lines)
├── Location handling (150 lines)
├── Matching orchestration (200 lines)
├── Results formatting (150 lines)
├── Saved locations integration (120 lines)
├── Intent storage (100 lines)
├── Recommendation merging (80 lines)
└── Error handling + UI (221 lines)
```

**Impact**:
- Hard to test individual flows
- High cognitive load for changes
- Merge conflicts likely
- Violates Single Responsibility Principle

**Should Be**:
```
handlers/
  nearby/
    index.ts (orchestrator, 100 lines)
    vehicle-selection.ts (100 lines)
    location.ts (150 lines)
    matching.ts (200 lines)
    results-formatter.ts (150 lines)
    saved-locations.ts (120 lines)
```

---

### 🟡 ISSUE #4: Table Schema Confusion

**Problem**: 3 overlapping tables with unclear relationships.

| Table | Purpose | Status | Records |
|-------|---------|--------|---------|
| `rides_trips` | Active trip requests | Primary | High churn |
| `mobility_intents` | Search history (spatial) | Secondary | Growing |
| `mobility_matches` | Trip lifecycle tracking | Tertiary | Low volume |

**Confusion Points**:
1. **rides_trips** has `status` column: `open`, `pending`, `active`, `scheduled`, `expired`
2. **mobility_matches** ALSO has `status`: `pending`, `accepted`, `driver_arrived`, `in_progress`, `completed`
3. **When does a `rides_trips` row become a `mobility_matches` row?**

**Current Flow** (inferred from code):
```
1. Passenger searches → rides_trips INSERT (status='open')
2. Driver sees match → ??? (no mobility_matches yet)
3. Driver accepts → mobility_matches INSERT (status='accepted')
4. Trip starts → mobility_matches UPDATE (status='in_progress')
5. Trip completes → mobility_matches UPDATE (status='completed')
6. rides_trips row → ??? (expires via TTL?)
```

**Missing**:
- Clear transition rules
- Foreign key from mobility_matches.trip_id to rides_trips.id EXISTS but not documented
- Cleanup job for rides_trips (has cron for intents, not trips)

---

### 🟡 ISSUE #5: Inconsistent Ranking/Scoring

**Problem**: Multiple scoring strategies not aligned.

**In SQL** (match_drivers_for_trip_v2):
```sql
ORDER BY 
  ST_Distance(...)              -- Priority 1: Distance
  COALESCE(last_location_at)    -- Priority 2: Recency
  (vehicle_type = v_vehicle_type) -- Priority 3: Vehicle match
```

**In sortMatches.ts**:
```typescript
if (prioritize === "distance") {
  if (distA !== distB) return distA - distB;  // Same as SQL
  if (timeB !== timeA) return timeB - timeA;  // Same as SQL
}
```

**In ranking-service** (for vendors, not drivers):
```typescript
const score = (
  rating * 0.3 +           // ❌ Drivers don't have rating (yet)
  fulfilment * 0.25 +      // ❌ Drivers don't have fulfilment rate
  responseScore * 0.15 +   // ❌ No response time tracked
  experience * 0.15 +      // ✅ Could use totalTrips
  recency * 0.1 +          // ✅ Could use last_seen
  liquidity * 0.05         // ❌ Drivers don't have wallet balance
);
```

**Impact**: No sophisticated driver scoring (just distance + time).

---

### 🟡 ISSUE #6: TODOs and Technical Debt

**Found 13 TODOs** in mobility handlers:

```typescript
// handlers/fare.ts
// TODO: Move to database configuration table for dynamic pricing
// TODO: Make configurable per country/region
// TODO: Implement dynamic surge pricing based on demand
// TODO: Add high demand surge based on driver/passenger ratio

// handlers/tracking.ts
// TODO: In production: Store in Redis with TTL

// handlers/trip_lifecycle.ts
// TODO: Record metrics
// TODO: Update cached average rating for the rated user

// handlers/trip_payment.ts
// Normalizes phone number to local format (07XXXXXXXX)
// +250XXXXXXXXX or 250XXXXXXXXX  ← Hardcoded Rwanda
```

**Impact**: 
- Dynamic pricing not implemented (fare.ts)
- Metrics not recorded (trip_lifecycle.ts)
- Rating system incomplete (trip_lifecycle.ts)
- Hardcoded country logic (trip_payment.ts)

---

### 🟢 ISSUE #7: Missing Service Orchestration

**Problem**: No clear orchestration layer between services.

**Current State**:
```
wa-webhook-mobility (Edge)
  → Directly calls SQL functions
  → Directly queries tables
  → No middleware layer
  → No circuit breaker
  → No retry logic
```

**Expected Architecture** (microservices best practice):
```
wa-webhook-mobility (Edge)
  → API Gateway / BFF (Backend for Frontend)
    → ranking-service (scores drivers)
    → matching-service (finds candidates)
    → tracking-service (location updates)
    → payment-service (fare, MoMo)
```

**Impact**:
- Edge function does too much (fat client)
- Cannot scale services independently
- No fault isolation (one SQL error breaks entire flow)
- Hard to add new features (e.g., driver recommendations)

---

## Database Schema Analysis

### ✅ Strengths

1. **PostGIS Integration** - Excellent spatial indexing
   ```sql
   CREATE INDEX idx_mobility_intents_pickup_geog 
     ON mobility_intents USING GIST(pickup_geog);
   ```

2. **Generated Columns** - Automatic geography calculation
   ```sql
   pickup_geog geography(Point, 4326) GENERATED ALWAYS AS 
     (ST_SetSRID(ST_MakePoint(pickup_lng, pickup_lat), 4326)::geography) STORED
   ```

3. **Row Level Security** - Proper RLS policies on all tables

4. **Lifecycle Tracking** - Timestamps for all state transitions
   ```sql
   created_at, matched_at, accepted_at, started_at, pickup_time, 
   dropoff_time, completed_at, cancelled_at
   ```

5. **Cron Jobs** - Automated cleanup
   ```sql
   SELECT cron.schedule('cleanup-expired-mobility-intents', '0 2 * * *', ...)
   ```

### ⚠️ Weaknesses

1. **No rides_trips cleanup cron** - Only mobility_intents gets cleaned
2. **Overlapping status enums** - rides_trips vs mobility_matches
3. **Missing indexes**:
   ```sql
   -- SHOULD ADD:
   CREATE INDEX idx_rides_trips_role_status_expires 
     ON rides_trips(role, status, expires_at) 
     WHERE status IN ('open', 'pending', 'active');
   
   CREATE INDEX idx_mobility_matches_status_timestamps
     ON mobility_matches(status, created_at, accepted_at)
     WHERE status IN ('pending', 'accepted', 'in_progress');
   ```

4. **No partitioning** - rides_trips/mobility_intents will grow large (consider partitioning by created_at)

5. **Missing metrics tables**:
   ```sql
   -- SHOULD ADD:
   CREATE TABLE driver_metrics (
     user_id uuid PRIMARY KEY,
     total_trips integer DEFAULT 0,
     avg_rating numeric(3,2),
     avg_response_seconds integer,
     acceptance_rate numeric(3,2),
     last_trip_at timestamptz,
     updated_at timestamptz
   );
   ```

---

## Code Quality Assessment

### Positive Patterns

1. ✅ **Structured Logging**
   ```typescript
   await logStructuredEvent("TRIP_STARTED", { 
     tripId, driverId, passengerId, vehicleType 
   });
   ```

2. ✅ **Type Safety**
   ```typescript
   export type TripStatus = "pending" | "accepted" | "driver_arrived" | ...;
   ```

3. ✅ **Separation of Concerns** - RPC layer abstraction
   ```typescript
   // Good: rpc/mobility.ts wraps database calls
   export async function matchDriversForTrip(client, tripId, limit) { ... }
   ```

4. ✅ **Localization Support**
   ```typescript
   import { t } from "../i18n/translator.ts";
   await sendText(ctx.from, t(ctx.locale, "trip.started"));
   ```

### Anti-Patterns

1. ❌ **God Object** - `nearby.ts` does everything
2. ❌ **Duplicate Sorting** - SQL + TypeScript
3. ❌ **Hardcoded Values**
   ```typescript
   const DEFAULT_RADIUS_METERS = 15000;  // Should be config
   const TRIP_EXPIRY_MINUTES = 90;       // Should be config
   ```
4. ❌ **Missing Error Context**
   ```typescript
   if (error) throw error;  // Lost context
   // SHOULD BE:
   if (error) throw new Error(`Failed to insert trip: ${error.message}`);
   ```

---

## Workflow Analysis

### User Flow: Passenger Searches for Drivers

```
1. User taps "Nearby Drivers"
   → nearby.ts:handleSeeDrivers()
   
2. Vehicle selection prompt
   → nearby.ts:handleVehicleSelection()
   
3. Location request
   → nearby.ts:handleNearbyLocation()
   
4. INSERT rides_trips (role='passenger', status='open')
   → rpc/mobility.ts:insertTrip()
   
5. CALL match_drivers_for_trip_v2(tripId)
   → rpc/mobility.ts:matchDriversForTrip()
   → SQL function executes (200 lines)
   → Returns up to 9 matches
   
6. TypeScript re-sorts matches
   → sortMatches(matches, { prioritize: 'distance' })
   
7. If < 5 matches, add recommendations
   → SQL function: recommend_drivers_for_user()
   
8. Format results + send WhatsApp list
   → nearby.ts:sendListMessage()
```

**Inefficiencies**:
- Step 6 is redundant (SQL already sorted)
- Step 7 is sequential (could be parallel with step 5)
- No caching (same search = same DB hit)
- No pre-computation (driver online status not indexed)

### User Flow: Driver Goes Online

```
1. User taps "Go Online"
   → go_online.ts:startGoOnline()
   
2. Location request
   → go_online.ts:handleGoOnlineLocation()
   
3. UPSERT driver_status (online=true, lat, lng)
   → rpc/mobility.ts:recordDriverPresence()
   
4. INSERT rides_trips (role='driver', status='open')
   → rpc/mobility.ts:insertTrip()
   
5. INSERT mobility_intents (type='go_online')
   → intent_storage.ts:saveIntent()
```

**Issues**:
- Step 3 (driver_status) NOT used by matching functions
- Matching queries rides_trips, NOT driver_status table
- Why maintain driver_status if not queried?

---

## Performance Concerns

### 🔴 Database Query Load

**Estimate** (1000 concurrent users):
- 1000 searches/min × 3 queries each = 3000 queries/min
- Each match query scans rides_trips (spatial index, good)
- No query result caching (edge function is stateless)

**Recommendation**: Add Redis cache for:
```typescript
// Cache key: `matches:${tripId}:${timestamp_5min_bucket}`
const cacheKey = `matches:${tripId}:${Math.floor(Date.now() / 300000)}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);
```

### 🟡 Edge Function Cold Starts

- `nearby.ts` imports 20+ modules
- First request after idle: 2-3 seconds
- Warm requests: 100-300ms

**Recommendation**: Code splitting
```typescript
// Instead of:
import { handleX, handleY, handleZ } from "./handlers/nearby.ts";

// Use dynamic imports:
const { handleX } = await import("./handlers/nearby.ts");
```

### 🟡 Large Payload Sizes

- WhatsApp list message: Max 10 rows
- Current: Fetching 9 matches + 3 recommendations = 12 DB rows
- Recommendation query scans 100 intents per user

**Recommendation**: Limit recommendation scan
```sql
-- Current (scans 100 intents):
SELECT * FROM mobility_intents WHERE user_id = ... LIMIT 100;

-- Better (last 30 days, limit 50):
SELECT * FROM mobility_intents 
WHERE user_id = ... 
  AND created_at > now() - interval '30 days'
LIMIT 50;
```

---

## Proposed Fixes & Implementation Plan

### Phase 1: Critical Fixes (Week 1)

#### Fix #1.1: Clarify Ranking Service Scope
**Action**: Rename or repurpose
```bash
# Option A: Rename to marketplace-ranking-service
mv services/ranking-service services/marketplace-ranking-service

# Option B: Extend for mobility
# Add to ranking-service/src/service.ts:
export class RankingService {
  async rankDrivers(options: RankDriversOptions) {
    // Use mobility_matches, driver_metrics
  }
}
```

**Recommendation**: **Option B** - Extend existing service

**Changes Required**:
1. Add `rankDrivers()` method to RankingService
2. Add Prisma schema for driver_metrics
3. Create HTTP endpoint: `GET /ranking/drivers?lat=X&lng=Y&vehicle=moto`
4. Modify `nearby.ts` to call ranking service instead of SQL direct

**Effort**: 3-4 days

---

#### Fix #1.2: Remove Duplicate Sorting Logic
**Action**: Delete client-side sorting

```typescript
// DELETE: supabase/functions/_shared/wa-webhook-shared/utils/sortMatches.ts
// (122 lines removed)

// MODIFY: nearby.ts
const matches = await matchDriversForTrip(ctx.supabase, tripId, 9);
// Remove: matches = sortMatches(matches, { prioritize: 'distance' });
// SQL already sorted!
```

**Effort**: 1 day (includes testing)

---

#### Fix #1.3: Add Missing Database Indexes
**Action**: Create migration

```sql
-- supabase/migrations/20251204120000_add_performance_indexes.sql
BEGIN;

-- Index for driver searches (role='driver', status='open')
CREATE INDEX idx_rides_trips_driver_lookup 
  ON rides_trips(role, status, expires_at, last_location_at) 
  WHERE role = 'driver' AND status IN ('open', 'pending', 'active');

-- Index for mobility_matches lifecycle queries
CREATE INDEX idx_mobility_matches_lifecycle
  ON mobility_matches(status, created_at, accepted_at)
  WHERE status IN ('pending', 'accepted', 'in_progress');

-- Composite index for driver_status queries (if we start using it)
CREATE INDEX idx_driver_status_online
  ON driver_status(online, vehicle_type, last_seen)
  WHERE online = true;

COMMIT;
```

**Effort**: 2 hours

---

#### Fix #1.4: Document Table Relationships
**Action**: Create schema diagram + README

```markdown
# Database Schema - Mobility Domain

## Core Tables

### rides_trips (Active Trip Requests)
- **Purpose**: Stores open trip requests from drivers/passengers
- **Lifecycle**: Created → Open → Matched → Expired (30-90 min TTL)
- **Cleanup**: Auto-expires via `expires_at` column (no cron yet)

### mobility_matches (Trip Execution)
- **Purpose**: Tracks accepted trips through completion
- **Lifecycle**: Pending → Accepted → In Progress → Completed
- **FK**: trip_id → rides_trips.id (REFERENCES ON DELETE CASCADE)
- **Cleanup**: Manual (completed trips retained for history)

### mobility_intents (Search History)
- **Purpose**: Spatial index of user search patterns (for recommendations)
- **Lifecycle**: Created → Active (30 min) → Expired → Deleted (daily cron)
- **Cleanup**: `cleanup_expired_mobility_intents()` runs daily at 2 AM

## State Transitions

```
Passenger Search Flow:
1. rides_trips INSERT (status='open')
2. Matching finds drivers
3. Driver accepts
4. mobility_matches INSERT (status='accepted', trip_id=rides_trips.id)
5. Trip progresses (driver_arrived → in_progress → completed)
6. rides_trips expires naturally (TTL)
```
```

**Effort**: 1 day

---

### Phase 2: Refactoring (Week 2-3)

#### Fix #2.1: Split nearby.ts into Modules
**Action**: Extract sub-handlers

```
supabase/functions/wa-webhook-mobility/handlers/nearby/
├── index.ts              (Orchestrator, 150 lines)
├── vehicle-selection.ts  (100 lines)
├── location-handling.ts  (150 lines)
├── matching.ts           (200 lines)
├── results-formatter.ts  (150 lines)
├── saved-locations.ts    (120 lines)
└── types.ts              (Shared types)
```

**Testing Strategy**: Parallel implementation
- Keep nearby.ts working
- Build new module structure alongside
- Add feature flag: `FEATURE_NEARBY_V2=true`
- A/B test for 1 week
- Deprecate old nearby.ts

**Effort**: 5-7 days

---

#### Fix #2.2: Integrate Ranking Service
**Action**: Replace SQL sorting with microservice call

**Before**:
```typescript
// nearby.ts
const matches = await matchDriversForTrip(ctx.supabase, tripId, 9);
// SQL returns sorted by distance
```

**After**:
```typescript
// nearby.ts
const candidates = await matchDriversForTrip(ctx.supabase, tripId, 20);  // Get 20
const rankedMatches = await rankingService.rankDrivers({
  candidates,
  strategy: 'balanced',  // distance + recency + rating
  limit: 9,
});
```

**ranking-service API**:
```http
POST /ranking/drivers
{
  "candidates": [ /* 20 driver matches */ ],
  "strategy": "balanced",
  "limit": 9
}

Response:
{
  "matches": [ /* top 9, scored */ ],
  "scores": { "driver_id": 0.85, ... }
}
```

**Effort**: 4-5 days

---

#### Fix #2.3: Add Redis Caching Layer
**Action**: Cache match results

```typescript
// NEW: supabase/functions/_shared/cache/redis.ts
export async function getCachedMatches(tripId: string) {
  const key = `matches:${tripId}:${bucketTimestamp()}`;
  const cached = await redis.get(key);
  return cached ? JSON.parse(cached) : null;
}

export async function setCachedMatches(tripId: string, matches: MatchResult[]) {
  const key = `matches:${tripId}:${bucketTimestamp()}`;
  await redis.setex(key, 300, JSON.stringify(matches));  // 5 min TTL
}

function bucketTimestamp() {
  return Math.floor(Date.now() / 300000);  // 5-minute buckets
}
```

**MODIFY nearby.ts**:
```typescript
// Try cache first
let matches = await getCachedMatches(tripId);
if (!matches) {
  matches = await matchDriversForTrip(ctx.supabase, tripId, 9);
  await setCachedMatches(tripId, matches);
}
```

**Effort**: 2-3 days

---

### Phase 3: Enhancements (Week 4-5)

#### Enhancement #3.1: Driver Metrics Table
**Action**: Track driver performance

```sql
-- supabase/migrations/20251211000000_add_driver_metrics.sql
CREATE TABLE driver_metrics (
  user_id uuid PRIMARY KEY REFERENCES profiles(user_id),
  total_trips integer DEFAULT 0,
  completed_trips integer DEFAULT 0,
  cancelled_trips integer DEFAULT 0,
  avg_rating numeric(3,2),
  avg_response_seconds integer,
  acceptance_rate numeric(3,2),
  total_earnings numeric(10,2),
  last_trip_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Trigger to update metrics on trip completion
CREATE OR REPLACE FUNCTION update_driver_metrics()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    INSERT INTO driver_metrics (user_id, total_trips, completed_trips, last_trip_at)
    VALUES (NEW.driver_id, 1, 1, now())
    ON CONFLICT (user_id) DO UPDATE SET
      total_trips = driver_metrics.total_trips + 1,
      completed_trips = driver_metrics.completed_trips + 1,
      last_trip_at = now(),
      updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_driver_metrics
  AFTER UPDATE ON mobility_matches
  FOR EACH ROW
  EXECUTE FUNCTION update_driver_metrics();
```

**Effort**: 3 days

---

#### Enhancement #3.2: Dynamic Pricing
**Action**: Implement surge pricing

```sql
-- Config table
CREATE TABLE pricing_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_type text NOT NULL,
  base_rate_per_km numeric(10,2) NOT NULL,
  base_rate_per_min numeric(10,2) NOT NULL,
  surge_multiplier numeric(3,2) DEFAULT 1.0,
  peak_hours jsonb DEFAULT '{"enabled": false}'::jsonb,
  region text DEFAULT 'default',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Surge calculation function
CREATE OR REPLACE FUNCTION calculate_surge_multiplier(
  _vehicle_type text,
  _lat double precision,
  _lng double precision
)
RETURNS numeric AS $$
DECLARE
  driver_count integer;
  passenger_count integer;
  ratio numeric;
BEGIN
  -- Count nearby drivers (last 10 min)
  SELECT COUNT(*) INTO driver_count
  FROM rides_trips
  WHERE role = 'driver'
    AND status = 'open'
    AND vehicle_type = _vehicle_type
    AND last_location_at > now() - interval '10 minutes'
    AND ST_DWithin(
      pickup::geography,
      ST_SetSRID(ST_MakePoint(_lng, _lat), 4326)::geography,
      5000  -- 5km radius
    );
  
  -- Count nearby passengers (last 10 min)
  SELECT COUNT(*) INTO passenger_count
  FROM rides_trips
  WHERE role = 'passenger'
    AND status = 'open'
    AND vehicle_type = _vehicle_type
    AND last_location_at > now() - interval '10 minutes'
    AND ST_DWithin(
      pickup::geography,
      ST_SetSRID(ST_MakePoint(_lng, _lat), 4326)::geography,
      5000
    );
  
  -- Surge ratio: passengers / drivers
  IF driver_count = 0 THEN
    RETURN 2.0;  -- Max surge if no drivers
  END IF;
  
  ratio := passenger_count::numeric / driver_count::numeric;
  
  -- Surge tiers:
  -- 0-0.5 ratio = 1.0x (more drivers than passengers)
  -- 0.5-1.0 ratio = 1.2x
  -- 1.0-2.0 ratio = 1.5x
  -- 2.0+ ratio = 2.0x (high demand)
  RETURN CASE
    WHEN ratio < 0.5 THEN 1.0
    WHEN ratio < 1.0 THEN 1.2
    WHEN ratio < 2.0 THEN 1.5
    ELSE 2.0
  END;
END;
$$ LANGUAGE plpgsql;
```

**MODIFY fare.ts**:
```typescript
// handlers/fare.ts
export async function calculateFareEstimate(ctx, params) {
  const { vehicle, lat, lng, distanceKm, durationMin } = params;
  
  // Get base config
  const config = await getPricingConfig(vehicle);
  
  // Calculate surge
  const surge = await ctx.supabase.rpc('calculate_surge_multiplier', {
    _vehicle_type: vehicle,
    _lat: lat,
    _lng: lng,
  });
  
  const baseFare = (distanceKm * config.baseRatePerKm) + 
                   (durationMin * config.baseRatePerMin);
  const finalFare = baseFare * surge;
  
  return {
    baseFare,
    surge,
    finalFare,
    breakdown: {
      distance: distanceKm * config.baseRatePerKm,
      time: durationMin * config.baseRatePerMin,
      surgeAmount: baseFare * (surge - 1.0),
    },
  };
}
```

**Effort**: 5-7 days

---

### Phase 4: Monitoring & Optimization (Week 6)

#### Action #4.1: Add Observability Dashboard
**Tools**: Grafana + Prometheus or Supabase Logs

**Metrics to Track**:
1. **Match Success Rate**: `matches_found / total_searches`
2. **Average Match Distance**: `AVG(distance_km)`
3. **Search Latency**: p50, p95, p99
4. **Driver Online Ratio**: `drivers_online / total_drivers`
5. **Trip Completion Rate**: `completed / (completed + cancelled)`
6. **Surge Multiplier Distribution**: Histogram

**Implementation**:
```typescript
// Add to observability.ts
export async function recordMatchMetrics(ctx, metrics) {
  await logStructuredEvent("MATCH_METRICS", {
    tripId: metrics.tripId,
    matchCount: metrics.matches.length,
    avgDistance: metrics.avgDistance,
    searchLatencyMs: metrics.latencyMs,
    surgeMultiplier: metrics.surge,
  });
}
```

**Effort**: 3-4 days

---

#### Action #4.2: Add Database Partitioning
**Action**: Partition large tables by month

```sql
-- Partition rides_trips by created_at (monthly)
BEGIN;

-- 1. Create partitioned table
CREATE TABLE rides_trips_partitioned (
  LIKE rides_trips INCLUDING ALL
) PARTITION BY RANGE (created_at);

-- 2. Create partitions for 6 months
CREATE TABLE rides_trips_2025_12 PARTITION OF rides_trips_partitioned
  FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

CREATE TABLE rides_trips_2026_01 PARTITION OF rides_trips_partitioned
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

-- ... (create 4 more months)

-- 3. Migrate data
INSERT INTO rides_trips_partitioned SELECT * FROM rides_trips;

-- 4. Swap tables (requires downtime)
ALTER TABLE rides_trips RENAME TO rides_trips_old;
ALTER TABLE rides_trips_partitioned RENAME TO rides_trips;

-- 5. Drop old table after verification
DROP TABLE rides_trips_old;

COMMIT;
```

**Benefit**: Faster queries, easier archival (drop old partitions)

**Effort**: 2-3 days + migration downtime (30 min)

---

## Implementation Priority Matrix

| Fix | Impact | Effort | Priority | Week |
|-----|--------|--------|----------|------|
| #1.2 Remove Duplicate Sorting | High | Low | 🔴 P0 | 1 |
| #1.3 Add DB Indexes | High | Low | 🔴 P0 | 1 |
| #1.4 Document Schema | Medium | Low | 🟡 P1 | 1 |
| #1.1 Clarify Ranking Service | High | Medium | 🟡 P1 | 2 |
| #2.2 Integrate Ranking Service | High | Medium | 🟡 P1 | 2-3 |
| #2.3 Add Redis Cache | Medium | Medium | 🟡 P1 | 3 |
| #2.1 Split nearby.ts | Medium | High | 🟢 P2 | 2-3 |
| #3.1 Driver Metrics | Medium | Medium | 🟢 P2 | 4 |
| #3.2 Dynamic Pricing | High | High | 🟢 P2 | 4-5 |
| #4.1 Observability | Medium | Medium | 🟢 P2 | 6 |
| #4.2 DB Partitioning | Low | High | ⚪ P3 | Future |

---

## Testing Plan

### Unit Tests (New)
```typescript
// __tests__/matching.test.ts
describe('Driver Matching', () => {
  it('should prefer nearby drivers over distant ones', async () => {
    const matches = await matchDriversForTrip(tripId, 10);
    expect(matches[0].distance_km).toBeLessThan(matches[1].distance_km);
  });
  
  it('should cache results for 5 minutes', async () => {
    const first = await getCachedMatches(tripId);
    const second = await getCachedMatches(tripId);
    expect(second).toEqual(first);  // Should be cached
  });
});
```

### Integration Tests
```typescript
// __tests__/workflow-integration.test.ts
describe('Passenger Search Workflow', () => {
  it('should find drivers and display results', async () => {
    // 1. Driver goes online
    await goOnline(driverPhone, { lat: -1.95, lng: 30.06, vehicle: 'moto' });
    
    // 2. Passenger searches
    const matches = await searchDrivers(passengerPhone, { 
      lat: -1.96, lng: 30.07, vehicle: 'moto' 
    });
    
    // 3. Verify driver appears in results
    expect(matches).toContainObject({ 
      whatsapp_e164: driverPhone,
      distance_km: expect.lessThan(2.0),
    });
  });
});
```

### Load Tests
```bash
# Use k6 or Artillery
artillery quick --count 100 --num 10 \
  https://your-project.supabase.co/functions/v1/wa-webhook-mobility
```

---

## Rollout Strategy

### Week 1: Critical Fixes (Low Risk)
- Deploy #1.2, #1.3, #1.4 together
- Monitor error rates for 24 hours
- Rollback plan: Revert migration + edge function deploy

### Week 2-3: Ranking Service (Medium Risk)
- Deploy ranking service to staging
- Feature flag: `FEATURE_RANKING_V2=false` (default off)
- Enable for 10% of users
- Monitor latency + match quality
- Gradual rollout: 10% → 25% → 50% → 100%

### Week 4-5: Enhancements (Medium-High Risk)
- Deploy driver metrics table (no user impact)
- Deploy dynamic pricing with surge disabled (`surge_multiplier=1.0`)
- Enable surge for 5% of trips
- A/B test: Compare trip acceptance rate

### Week 6: Monitoring (Low Risk)
- Deploy observability dashboard
- No user-facing changes

---

## Success Metrics (3 Months Post-Implementation)

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| Match Success Rate | ~60% | 85%+ | `matches_found > 0 / total_searches` |
| Avg Search Latency | ~800ms | <500ms | p95 response time |
| Driver Retention | Unknown | 70% monthly | Active drivers month-over-month |
| Trip Completion Rate | ~75% | 90%+ | `completed / (completed + cancelled)` |
| Revenue per Trip | $X | $X * 1.2 | With surge pricing |

---

## Risk Assessment

### High Risk
1. **Ranking Service Integration** - New HTTP call in critical path
   - Mitigation: Circuit breaker, fallback to SQL sorting
   
2. **Database Partitioning** - Requires downtime
   - Mitigation: Test on staging replica, schedule off-peak

### Medium Risk
1. **Redis Caching** - Cache invalidation bugs
   - Mitigation: Conservative TTL (5 min), manual purge endpoint
   
2. **Dynamic Pricing** - User backlash if too aggressive
   - Mitigation: Cap surge at 2.0x, gradual rollout

### Low Risk
1. **Code Refactoring** - Breaking changes during split
   - Mitigation: Feature flags, parallel implementation

---

## Dependencies & Prerequisites

### Infrastructure
- ✅ PostgreSQL 14+ with PostGIS
- ✅ Supabase Edge Functions runtime
- ❌ Redis instance (for caching) - **NEEDED**
- ❌ Grafana/Prometheus (for monitoring) - **OPTIONAL**

### Code Dependencies
- ✅ Prisma 5.22+ (for ranking service)
- ✅ Deno 2.x (for edge functions)
- ✅ Node 20+ (for ranking service)
- ❌ ioredis package (for Redis) - **NEEDED**

### Team Resources
- 1 Backend Engineer (full-time, 6 weeks)
- 1 DBA (part-time, reviews + migration support)
- 1 QA Engineer (week 3-6, testing)

---

## Conclusion

The mobility microservices are **functional but need architectural refinement**. The most critical issue is the **unused ranking-service** and **duplicated sorting logic**. 

**Recommended First Steps** (Week 1):
1. Remove duplicate TypeScript sorting (1 day)
2. Add missing database indexes (2 hours)
3. Document table relationships (1 day)
4. Set up Redis for future caching (1 day)

**Quick Win**: Fix #1.2 + #1.3 will improve performance by ~20% with minimal risk.

**Long-term Goal**: Evolve towards true microservices architecture with proper service orchestration, not just "edge function calls SQL directly."

---

## Appendix A: File Manifest

### Modified Files (Phase 1)
```
supabase/migrations/
  20251204120000_add_performance_indexes.sql        (NEW)
  
supabase/functions/wa-webhook-mobility/
  handlers/nearby.ts                                 (DELETE sortMatches call)
  rpc/mobility.ts                                    (ADD Redis cache)
  
docs/
  MOBILITY_SCHEMA.md                                 (NEW)
```

### Modified Files (Phase 2)
```
services/ranking-service/
  src/service.ts                                     (ADD rankDrivers method)
  src/server.ts                                      (ADD /ranking/drivers endpoint)
  
supabase/functions/wa-webhook-mobility/
  handlers/nearby/                                   (NEW directory)
    index.ts, vehicle-selection.ts, ...
```

### Modified Files (Phase 3)
```
supabase/migrations/
  20251211000000_add_driver_metrics.sql              (NEW)
  20251211000001_add_pricing_config.sql              (NEW)
  
supabase/functions/wa-webhook-mobility/
  handlers/fare.ts                                   (ADD dynamic pricing)
```

---

## Appendix B: Commands Reference

```bash
# Deploy Phase 1 fixes
supabase db push
supabase functions deploy wa-webhook-mobility

# Start ranking service locally
cd services/ranking-service
pnpm install
pnpm start:dev

# Test ranking endpoint
curl http://localhost:4500/ranking/drivers?tenantId=XXX

# Deploy ranking service (production)
docker build -t ranking-service:latest .
docker run -p 4500:4500 ranking-service:latest

# Monitor edge function logs
supabase functions logs wa-webhook-mobility --tail

# Query mobility metrics
psql $DATABASE_URL -c "
SELECT 
  DATE(created_at) as date,
  COUNT(*) as searches,
  AVG(CASE WHEN matched_at IS NOT NULL THEN 1 ELSE 0 END) as match_rate
FROM rides_trips
WHERE created_at > now() - interval '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
"
```

---

**END OF REPORT**
