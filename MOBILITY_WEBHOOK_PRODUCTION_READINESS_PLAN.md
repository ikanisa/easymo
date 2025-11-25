# Mobility Webhook Production Readiness Implementation Plan

**Service**: `wa-webhook-mobility`  
**Current Score**: 50% Production Ready  
**Target Score**: 85%+ Production Ready  
**Timeline**: 6 weeks

## Executive Summary

This plan addresses critical gaps in the largest WhatsApp webhook microservice (200KB+, 50+ files) handling ride-sharing operations. Priority focus on eliminating code duplication (~150KB), implementing complete trip lifecycle, and achieving 80%+ test coverage.

---

## Phase 1: Critical Stabilization (Week 1-2) 🔴

### 1.1 Code Consolidation (Priority: CRITICAL)

**Problem**: ~150KB of duplicated code between `handlers/` and `mobility/` directories
- `nearby.ts`: 28KB × 2 = 56KB duplication
- `schedule.ts`: 40KB × 2 = 80KB duplication  
- Test files: ~15KB × 2 = 30KB duplication

**Action Items**:
```bash
# Step 1: Verify no imports from mobility/
grep -r "from.*mobility/" supabase/functions/wa-webhook-mobility/ --include="*.ts"

# Step 2: Compare files to identify newer version
diff handlers/nearby.ts mobility/nearby.ts
diff handlers/schedule.ts mobility/schedule.ts

# Step 3: Remove duplicates and backups
rm -rf supabase/functions/wa-webhook-mobility/mobility/
rm supabase/functions/wa-webhook-mobility/handlers/*.bak

# Step 4: Update any remaining imports
# (Manual code review)

# Step 5: Verify build
cd supabase/functions/wa-webhook-mobility
deno cache --lock=deno.lock deps.ts
```

**Expected Outcome**: 
- ✅ Repository size reduced by ~150KB
- ✅ Single source of truth for handlers
- ✅ Build passes without errors

---

### 1.2 Database Schema Implementation (Priority: CRITICAL)

**Problem**: Core tables missing or incomplete

**Action Items**:

**File**: `supabase/migrations/YYYYMMDD_mobility_core_tables.sql`

```sql
BEGIN;

-- ============================================================================
-- DRIVER STATUS MANAGEMENT
-- ============================================================================
CREATE TABLE IF NOT EXISTS driver_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  is_online BOOLEAN DEFAULT false,
  current_lat NUMERIC,
  current_lng NUMERIC,
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  vehicle_type TEXT,
  vehicle_plate TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Geospatial index for proximity searches
CREATE INDEX IF NOT EXISTS idx_driver_status_location 
ON driver_status USING GIST (point(current_lng, current_lat))
WHERE is_online = true;

CREATE INDEX IF NOT EXISTS idx_driver_status_online
ON driver_status(is_online, vehicle_type, last_seen_at) 
WHERE is_online = true;

-- ============================================================================
-- MOBILITY MATCHES (Driver-Passenger Connections)
-- ============================================================================
CREATE TABLE IF NOT EXISTS mobility_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  passenger_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  vehicle_type TEXT NOT NULL,
  pickup_lat NUMERIC NOT NULL,
  pickup_lng NUMERIC NOT NULL,
  pickup_address TEXT,
  dropoff_lat NUMERIC,
  dropoff_lng NUMERIC,
  dropoff_address TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'accepted', 'driver_arrived', 'in_progress', 
    'completed', 'cancelled_by_driver', 'cancelled_by_passenger'
  )),
  distance_km NUMERIC,
  eta_minutes INTEGER,
  fare_estimate NUMERIC,
  actual_fare NUMERIC,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mobility_matches_driver 
ON mobility_matches(driver_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_mobility_matches_passenger 
ON mobility_matches(passenger_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_mobility_matches_status 
ON mobility_matches(status, created_at);

-- ============================================================================
-- SCHEDULED TRIPS
-- ============================================================================
CREATE TABLE IF NOT EXISTS scheduled_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('driver', 'passenger')),
  vehicle_type TEXT NOT NULL,
  pickup_lat NUMERIC NOT NULL,
  pickup_lng NUMERIC NOT NULL,
  pickup_address TEXT,
  dropoff_lat NUMERIC,
  dropoff_lng NUMERIC,
  dropoff_address TEXT,
  scheduled_time TIMESTAMPTZ NOT NULL,
  recurrence TEXT DEFAULT 'once' CHECK (recurrence IN (
    'once', 'daily', 'weekdays', 'weekly', 'monthly'
  )),
  status TEXT DEFAULT 'active' CHECK (status IN (
    'active', 'completed', 'cancelled', 'expired'
  )),
  matched_trip_id UUID REFERENCES mobility_matches(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_trips_user 
ON scheduled_trips(user_id, status, scheduled_time);

CREATE INDEX IF NOT EXISTS idx_scheduled_trips_upcoming 
ON scheduled_trips(scheduled_time, status) 
WHERE status = 'active';

-- ============================================================================
-- SAVED LOCATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS saved_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  address TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, label)
);

CREATE INDEX IF NOT EXISTS idx_saved_locations_user 
ON saved_locations(user_id, is_default);

-- ============================================================================
-- DRIVER SUBSCRIPTIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS driver_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL,
  plan_name TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN (
    'active', 'expired', 'cancelled', 'suspended'
  )),
  features JSONB DEFAULT '{}',
  starts_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_subscriptions_user 
ON driver_subscriptions(user_id, status, expires_at);

-- ============================================================================
-- DRIVER INSURANCE
-- ============================================================================
CREATE TABLE IF NOT EXISTS driver_insurance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  vehicle_plate TEXT NOT NULL,
  insurer_name TEXT,
  policy_number TEXT,
  policy_expiry DATE NOT NULL,
  certificate_path TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'verified', 'expired', 'rejected'
  )),
  rejection_reason TEXT,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES profiles(user_id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_insurance_user 
ON driver_insurance(user_id, status, policy_expiry);

CREATE INDEX IF NOT EXISTS idx_driver_insurance_expiry 
ON driver_insurance(policy_expiry, status) 
WHERE status = 'verified';

-- ============================================================================
-- INTENT CACHE
-- ============================================================================
CREATE TABLE IF NOT EXISTS mobility_intent_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  intent_type TEXT NOT NULL,
  intent_data JSONB DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, intent_type)
);

CREATE INDEX IF NOT EXISTS idx_mobility_intent_cache_user 
ON mobility_intent_cache(user_id, expires_at);

-- Auto-cleanup expired intents
CREATE INDEX IF NOT EXISTS idx_mobility_intent_cache_expiry 
ON mobility_intent_cache(expires_at);

-- ============================================================================
-- LOCATION CACHE
-- ============================================================================
CREATE TABLE IF NOT EXISTS location_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  address TEXT,
  cached_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_location_cache_user 
ON location_cache(user_id, expires_at);

-- ============================================================================
-- TRIP RATINGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS trip_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES mobility_matches(id) ON DELETE CASCADE,
  rater_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  rated_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(trip_id, rater_id)
);

CREATE INDEX IF NOT EXISTS idx_trip_ratings_rated 
ON trip_ratings(rated_id, rating, created_at);

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE driver_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE mobility_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_insurance ENABLE ROW LEVEL SECURITY;
ALTER TABLE mobility_intent_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_ratings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Driver Status: Users can only update their own status
CREATE POLICY driver_status_select ON driver_status FOR SELECT USING (true);
CREATE POLICY driver_status_insert ON driver_status FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY driver_status_update ON driver_status FOR UPDATE USING (auth.uid() = user_id);

-- Mobility Matches: Users can see their own matches
CREATE POLICY mobility_matches_select ON mobility_matches FOR SELECT 
USING (auth.uid() IN (driver_id, passenger_id));
CREATE POLICY mobility_matches_insert ON mobility_matches FOR INSERT WITH CHECK (true);
CREATE POLICY mobility_matches_update ON mobility_matches FOR UPDATE 
USING (auth.uid() IN (driver_id, passenger_id));

-- Scheduled Trips: Users can manage their own trips
CREATE POLICY scheduled_trips_select ON scheduled_trips FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY scheduled_trips_insert ON scheduled_trips FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY scheduled_trips_update ON scheduled_trips FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY scheduled_trips_delete ON scheduled_trips FOR DELETE USING (auth.uid() = user_id);

-- Saved Locations: Users can manage their own locations
CREATE POLICY saved_locations_select ON saved_locations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY saved_locations_insert ON saved_locations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY saved_locations_update ON saved_locations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY saved_locations_delete ON saved_locations FOR DELETE USING (auth.uid() = user_id);

-- Other policies follow similar pattern...

COMMIT;
```

**Validation**:
```bash
supabase db push
psql $DATABASE_URL -c "\dt *driver_status*"
psql $DATABASE_URL -c "\dt *mobility_matches*"
```

---

### 1.3 Critical Test Coverage (Priority: CRITICAL)

**Problem**: 30% test coverage, missing tests for largest files

**Action Items**:

**File**: `supabase/functions/wa-webhook-mobility/handlers/nearby.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  handleSeeDrivers,
  handleSeePassengers,
  handleVehicleSelection,
  handleNearbyLocation,
  handleNearbyResultSelection,
} from "./nearby.ts";

describe("Nearby Handlers - Driver Discovery", () => {
  let mockCtx;
  let mockState;

  beforeEach(() => {
    mockCtx = {
      client: {
        from: vi.fn(() => ({
          select: vi.fn().mockResolvedValue({ data: [], error: null }),
        })),
        rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
      },
      sender: "+250788123456",
      profile: {
        user_id: "test-user-id",
        phone_number: "+250788123456",
      },
      locale: "en",
    };
    mockState = { key: "home", data: {} };
  });

  describe("handleSeeDrivers", () => {
    it("should prompt for vehicle type selection", async () => {
      const result = await handleSeeDrivers(mockCtx);
      
      expect(result).toBe(true);
      // Verify state transition to mobility_nearby_select
      // Verify WhatsApp message sent with vehicle options
    });

    it("should require valid profile", async () => {
      mockCtx.profile = null;
      const result = await handleSeeDrivers(mockCtx);
      
      expect(result).toBe(false);
    });

    it("should handle database errors gracefully", async () => {
      mockCtx.client.from = vi.fn(() => ({
        select: vi.fn().mockRejectedValue(new Error("DB Error")),
      }));
      
      const result = await handleSeeDrivers(mockCtx);
      expect(result).toBe(false);
    });
  });

  describe("handleNearbyLocation", () => {
    it("should find nearby drivers within radius", async () => {
      const coords = { latitude: -1.9441, longitude: 30.0619 };
      mockState = { key: "mobility_nearby_location", data: { vehicleType: "sedan" } };
      
      mockCtx.client.rpc = vi.fn().mockResolvedValue({
        data: [
          {
            id: "driver-1",
            name: "John Doe",
            vehicle_plate: "RAD 123A",
            distance_km: 2.5,
          },
        ],
        error: null,
      });

      const result = await handleNearbyLocation(mockCtx, mockState, coords);
      
      expect(result).toBe(true);
      expect(mockCtx.client.rpc).toHaveBeenCalledWith(
        "find_nearby_drivers",
        expect.objectContaining({
          p_lat: coords.latitude,
          p_lng: coords.longitude,
          p_vehicle_type: "sedan",
        })
      );
    });

    it("should handle no drivers found", async () => {
      const coords = { latitude: -1.9441, longitude: 30.0619 };
      mockState = { key: "mobility_nearby_location", data: { vehicleType: "sedan" } };
      
      mockCtx.client.rpc = vi.fn().mockResolvedValue({ data: [], error: null });

      const result = await handleNearbyLocation(mockCtx, mockState, coords);
      
      expect(result).toBe(true);
      // Verify "no drivers found" message sent
    });

    it("should validate coordinates", async () => {
      const invalidCoords = { latitude: 200, longitude: -300 };
      mockState = { key: "mobility_nearby_location", data: { vehicleType: "sedan" } };

      const result = await handleNearbyLocation(mockCtx, mockState, invalidCoords);
      
      expect(result).toBe(false);
    });
  });

  describe("handleNearbyResultSelection", () => {
    it("should create match on driver selection", async () => {
      const matchId = "MTCH::driver-1";
      mockState = {
        key: "mobility_nearby_results",
        data: {
          matches: [{ id: "driver-1", role: "driver" }],
          pickupLat: -1.9441,
          pickupLng: 30.0619,
        },
      };

      mockCtx.client.from = vi.fn(() => ({
        insert: vi.fn().mockResolvedValue({ data: { id: "match-uuid" }, error: null }),
      }));

      const result = await handleNearbyResultSelection(mockCtx, mockState, matchId);
      
      expect(result).toBe(true);
      expect(mockCtx.client.from).toHaveBeenCalledWith("mobility_matches");
    });

    it("should notify driver of passenger request", async () => {
      // Test notification flow
    });
  });
});

describe("Nearby Handlers - Passenger Discovery", () => {
  // Similar tests for passenger perspective
});

describe("Nearby Handlers - Location Caching", () => {
  it("should use cached location when available", async () => {
    // Test location cache retrieval
  });

  it("should expire old cached locations", async () => {
    // Test expiration logic
  });
});
```

**File**: `supabase/functions/wa-webhook-mobility/handlers/schedule.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  startScheduleTrip,
  handleScheduleRole,
  handleScheduleVehicle,
  handleScheduleLocation,
  handleScheduleTimeSelection,
} from "./schedule.ts";

describe("Schedule Handlers - Trip Scheduling", () => {
  // Comprehensive tests for 40KB file
  
  describe("startScheduleTrip", () => {
    it("should check insurance for drivers", async () => {});
    it("should prompt for role selection", async () => {});
  });

  describe("handleScheduleRole", () => {
    it("should handle driver role selection", async () => {});
    it("should handle passenger role selection", async () => {});
  });

  describe("handleScheduleLocation", () => {
    it("should accept pickup location", async () => {});
    it("should prompt for dropoff location", async () => {});
    it("should allow skipping dropoff for drivers", async () => {});
  });

  describe("handleScheduleTimeSelection", () => {
    it("should handle 'now' selection", async () => {});
    it("should handle future time selection", async () => {});
    it("should validate selected time is in future", async () => {});
  });

  describe("Recurrence", () => {
    it("should create one-time trip", async () => {});
    it("should create daily recurring trip", async () => {});
    it("should create weekday recurring trip", async () => {});
  });
});
```

**Test Execution**:
```bash
cd supabase/functions/wa-webhook-mobility
deno test --allow-all handlers/nearby.test.ts
deno test --allow-all handlers/schedule.test.ts
```

**Coverage Target**: 80%+ for critical files

---

## Phase 2: Trip Lifecycle (Week 2-3) 🟡

### 2.1 Complete Trip Flow Implementation

**New File**: `supabase/functions/wa-webhook-mobility/handlers/trip_lifecycle.ts`

```typescript
/**
 * Complete trip lifecycle management
 * Handles: start → in-progress → complete → rating
 */

export async function handleTripStart(ctx, tripId: string): Promise<boolean> {
  // 1. Verify both driver and passenger ready
  // 2. Update trip status to 'in_progress'
  // 3. Notify both parties
  // 4. Start real-time tracking
  // 5. Record metric: TRIP_STARTED
}

export async function handleTripArrivedAtPickup(ctx, tripId: string): Promise<boolean> {
  // 1. Update trip status to 'driver_arrived'
  // 2. Notify passenger
  // 3. Record metric: DRIVER_ARRIVED
}

export async function handleTripComplete(ctx, tripId: string): Promise<boolean> {
  // 1. Update trip status to 'completed'
  // 2. Calculate final fare
  // 3. Initiate payment
  // 4. Request ratings from both parties
  // 5. Record metrics: TRIP_COMPLETED, TRIP_DURATION
}

export async function handleTripCancel(
  ctx,
  tripId: string,
  reason: string,
  cancelledBy: "driver" | "passenger"
): Promise<boolean> {
  // 1. Update trip status
  // 2. Calculate cancellation fee (if applicable)
  // 3. Notify other party
  // 4. Record metric: TRIP_CANCELLED
}

export async function handleTripRating(
  ctx,
  tripId: string,
  rating: number,
  comment?: string
): Promise<boolean> {
  // 1. Validate rating (1-5)
  // 2. Insert into trip_ratings table
  // 3. Update user's average rating
  // 4. Record metric: TRIP_RATED
}
```

### 2.2 Real-Time Tracking

**New File**: `supabase/functions/wa-webhook-mobility/handlers/tracking.ts`

```typescript
export async function startDriverTracking(ctx, tripId: string): Promise<boolean> {
  // Enable location updates for active trip
}

export async function updateDriverLocation(
  ctx,
  tripId: string,
  coords: { latitude: number; longitude: number }
): Promise<boolean> {
  // Update driver_status table
  // Calculate new ETA
  // Notify passenger if ETA changes significantly
}

export async function calculateETA(
  driverLocation: Coords,
  destination: Coords
): Promise<number> {
  // Use Google Maps Distance Matrix API
  // Or simple haversine + average speed
}
```

---

## Phase 3: Payment Integration (Week 3-4) 🟡

### 3.1 Fare Calculation

**New File**: `supabase/functions/wa-webhook-mobility/handlers/fare.ts`

```typescript
export interface FareEstimate {
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  surgePricing: number;
  totalFare: number;
  currency: string;
}

export async function calculateFare(
  pickup: Coords,
  dropoff: Coords,
  vehicleType: string
): Promise<FareEstimate> {
  // 1. Calculate distance
  // 2. Estimate time
  // 3. Apply pricing model
  // 4. Check for surge pricing
  // 5. Return breakdown
}

const PRICING_CONFIG = {
  sedan: {
    baseFare: 1000, // RWF
    perKm: 500,
    perMinute: 100,
  },
  suv: {
    baseFare: 1500,
    perKm: 700,
    perMinute: 150,
  },
  bus: {
    baseFare: 3000,
    perKm: 1000,
    perMinute: 200,
  },
};
```

### 3.2 Payment Flow Integration

**Update**: `supabase/functions/wa-webhook-mobility/flows/momo/`

```typescript
export async function initiateTripPayment(ctx, tripId: string): Promise<boolean> {
  // 1. Get final fare from trip
  // 2. Call MoMo payment initiation
  // 3. Update trip with payment_id
  // 4. Send payment prompt to passenger
}

export async function handlePaymentCallback(ctx, paymentId: string): Promise<boolean> {
  // 1. Verify payment signature
  // 2. Update trip payment status
  // 3. Release funds to driver (escrow)
  // 4. Send confirmation to both parties
}
```

---

## Phase 4: Enhanced Features (Week 4-5) 🟢

### 4.1 Driver Verification System

**New File**: `supabase/functions/wa-webhook-mobility/handlers/driver_verification.ts`

```typescript
export interface VerificationStatus {
  insurance: "pending" | "verified" | "expired" | "rejected";
  license: "pending" | "verified" | "expired" | "rejected";
  vehicle: "pending" | "verified" | "rejected";
  backgroundCheck: "pending" | "verified" | "rejected";
  overall: "incomplete" | "pending" | "verified" | "rejected";
}

export async function checkDriverVerificationStatus(ctx): Promise<VerificationStatus> {
  // Query all verification tables
  // Return aggregated status
}

export async function startLicenseVerification(ctx): Promise<boolean> {
  // Prompt for license upload
  // OCR extraction
  // Admin review
}

export async function startVehicleInspection(ctx): Promise<boolean> {
  // Schedule inspection appointment
  // Upload inspection photos
  // Admin approval
}
```

### 4.2 Rating System

**New File**: `supabase/functions/wa-webhook-mobility/handlers/ratings.ts`

```typescript
export async function promptRating(ctx, tripId: string): Promise<boolean> {
  // Send rating request (1-5 stars + comment)
}

export async function getDriverRating(userId: string): Promise<RatingData> {
  // Calculate average rating
  // Get total trips completed
  // Get recent reviews
}

export interface RatingData {
  averageRating: number;
  totalRatings: number;
  totalTrips: number;
  recentReviews: Array<{
    rating: number;
    comment: string;
    createdAt: string;
  }>;
}
```

---

## Phase 5: Testing & Observability (Week 5-6) 🟢

### 5.1 Integration Tests

**New File**: `supabase/functions/wa-webhook-mobility/__tests__/integration/complete_ride_flow.test.ts`

```typescript
describe("Complete Ride Flow - Passenger Perspective", () => {
  it("should complete full journey: request → match → trip → payment → rating", async () => {
    // 1. Passenger requests ride
    // 2. System finds nearby drivers
    // 3. Driver accepts request
    // 4. Driver arrives at pickup
    // 5. Trip starts
    // 6. Driver updates location during trip
    // 7. Trip completes
    // 8. Payment processed
    // 9. Both parties rate each other
  });
});

describe("Complete Ride Flow - Driver Perspective", () => {
  it("should complete driver journey: go online → receive request → complete trip", async () => {
    // Driver flow
  });
});

describe("Error Scenarios", () => {
  it("should handle driver cancellation gracefully", async () => {});
  it("should handle payment failure with retry", async () => {});
  it("should handle expired insurance during trip request", async () => {});
});
```

### 5.2 Metrics & Monitoring

**Update**: `supabase/functions/wa-webhook-mobility/observe/metrics.ts`

```typescript
// Add comprehensive metrics
export const MOBILITY_METRICS = {
  // Request metrics
  DRIVER_REQUEST_RECEIVED: "mobility.driver_request.received",
  DRIVER_REQUEST_MATCHED: "mobility.driver_request.matched",
  DRIVER_REQUEST_FAILED: "mobility.driver_request.failed",
  
  // Trip metrics
  TRIP_STARTED: "mobility.trip.started",
  TRIP_COMPLETED: "mobility.trip.completed",
  TRIP_CANCELLED: "mobility.trip.cancelled",
  TRIP_DURATION_SECONDS: "mobility.trip.duration_seconds",
  TRIP_DISTANCE_KM: "mobility.trip.distance_km",
  
  // Driver metrics
  DRIVER_WENT_ONLINE: "mobility.driver.went_online",
  DRIVER_WENT_OFFLINE: "mobility.driver.went_offline",
  DRIVER_MATCH_TIME_SECONDS: "mobility.driver.match_time_seconds",
  
  // Payment metrics
  PAYMENT_INITIATED: "mobility.payment.initiated",
  PAYMENT_SUCCEEDED: "mobility.payment.succeeded",
  PAYMENT_FAILED: "mobility.payment.failed",
};

// Usage in handlers
await recordMetric(MOBILITY_METRICS.TRIP_STARTED, 1, { 
  vehicleType, 
  country: ctx.profile.country 
});
```

---

## Verification & Deployment Checklist

### Pre-Deployment
- [ ] All duplicate code removed
- [ ] All `.bak` files deleted
- [ ] Database migrations applied successfully
- [ ] All tests passing (target: 80%+ coverage)
- [ ] No imports from removed `mobility/` directory
- [ ] Build succeeds without warnings

### Deployment
```bash
# 1. Deploy database schema
supabase db push

# 2. Verify tables created
psql $DATABASE_URL -c "\dt *driver_status*"
psql $DATABASE_URL -c "\dt *mobility_matches*"

# 3. Deploy edge function
supabase functions deploy wa-webhook-mobility

# 4. Run smoke tests
curl https://PROJECT.supabase.co/functions/v1/wa-webhook-mobility/health

# 5. Monitor logs
supabase functions logs wa-webhook-mobility --tail
```

### Post-Deployment
- [ ] Health check endpoint responding
- [ ] Webhook verification working
- [ ] Test ride request flow end-to-end
- [ ] Monitor error rates
- [ ] Check metric reporting

---

## Success Metrics

| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| Code Duplication | ~150KB | 0KB | Week 1 |
| Test Coverage | 30% | 80% | Week 3 |
| Production Readiness | 50% | 85% | Week 6 |
| Trip Completion Rate | - | >90% | Week 4 |
| Average Match Time | - | <30s | Week 5 |
| Payment Success Rate | - | >95% | Week 4 |

---

## Risk Mitigation

### High Risk Items
1. **Database Migration**: Test on staging first, have rollback plan
2. **Code Removal**: Verify no imports before deletion
3. **Breaking Changes**: Deploy during low-traffic window

### Rollback Plan
```bash
# If issues detected post-deployment
supabase functions deploy wa-webhook-mobility --ref previous-commit-sha
supabase db reset --db-url STAGING_URL
```

---

## Notes for Implementation

1. **Always build shared packages first**: `pnpm --filter @va/shared build`
2. **Use feature flags**: Gate new trip lifecycle features with `FEATURE_TRIP_LIFECYCLE=true`
3. **Observability is mandatory**: All new handlers must emit structured logs
4. **Security first**: Verify all webhook signatures, mask PII in logs

---

**Status**: Ready for Phase 1 execution  
**Next Action**: Remove duplicate code and backup files  
**Owner**: Development Team  
**Review**: Weekly progress checkpoints
