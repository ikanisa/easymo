# EasyMO Mobility - Complete Implementation Plan

**Date**: December 4, 2025  
**Status**: CRITICAL - FULL IMPLEMENTATION REQUIRED  
**Timeline**: 4 weeks (no shortcuts)

---

## Critical Decision: Complete Rebuild Required

After deep analysis, the mobility system needs a **ground-up refactor**, not incremental fixes. The current architecture has fundamental flaws that cannot be patched.

### Why Incremental Fixes Won't Work

1. **Architectural Debt**: 3 overlapping data models (rides_trips, mobility_intents, mobility_matches)
2. **Unused Services**: ranking-service exists but not integrated
3. **Monolithic Handlers**: 1121-line files violate SOLID principles
4. **No Service Boundaries**: Edge function doing database + business logic + UI
5. **Performance Issues**: No caching, duplicate sorting, inefficient queries

**Decision**: Implement proper microservices architecture from scratch alongside current system, then migrate.

---

## Target Architecture (Production-Grade)

```
┌──────────────────────────────────────────────────────────────┐
│                    WhatsApp Users                            │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│          wa-webhook-mobility (Thin Controller)               │
│  - Webhook verification                                      │
│  - Message parsing                                           │
│  - Route to mobility-orchestrator                           │
│  (100 lines max)                                             │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│         mobility-orchestrator (NEW - NestJS)                 │
│  - State management                                          │
│  - Workflow coordination                                     │
│  - Calls downstream services                                 │
│  Port: 4600                                                  │
└─────┬────────┬─────────┬──────────┬──────────────────────────┘
      │        │         │          │
      ▼        ▼         ▼          ▼
┌─────────┐┌─────────┐┌─────────┐┌──────────┐
│matching-││ranking- ││tracking-││payment-  │
│service  ││service  ││service  ││service   │
│(NEW)    ││(EXTEND) ││(NEW)    ││(EXTRACT) │
│Port:4700││Port:4500││Port:4800││Port:4900 │
└────┬────┘└────┬────┘└────┬────┘└────┬─────┘
     │          │          │          │
     └──────────┴──────────┴──────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│              PostgreSQL + PostGIS + Redis                    │
│  - Unified schema (mobility_v2)                              │
│  - Clear table responsibilities                              │
│  - Proper indexes + partitioning                             │
└──────────────────────────────────────────────────────────────┘
```

---

## Week 1: Foundation & Services Setup

### Day 1-2: Database Schema V2 (Complete Rebuild)

**Action**: Create clean mobility schema with clear responsibilities

```sql
-- supabase/migrations/20251204180000_mobility_v2_schema.sql

BEGIN;

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- 1. TRIPS: Single source of truth for all trip requests
CREATE TABLE mobility_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Who & What
  creator_user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('driver', 'passenger')),
  vehicle_type text NOT NULL,
  
  -- Location (pickup required, dropoff optional)
  pickup_lat double precision NOT NULL,
  pickup_lng double precision NOT NULL,
  pickup_geog geography(Point, 4326) GENERATED ALWAYS AS 
    (ST_SetSRID(ST_MakePoint(pickup_lng, pickup_lat), 4326)::geography) STORED,
  pickup_text text,
  pickup_radius_m integer DEFAULT 1000,
  
  dropoff_lat double precision,
  dropoff_lng double precision,
  dropoff_geog geography(Point, 4326) GENERATED ALWAYS AS 
    (CASE WHEN dropoff_lat IS NOT NULL AND dropoff_lng IS NOT NULL 
      THEN ST_SetSRID(ST_MakePoint(dropoff_lng, dropoff_lat), 4326)::geography 
      ELSE NULL END) STORED,
  dropoff_text text,
  dropoff_radius_m integer,
  
  -- Status (simplified: only 3 states)
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'matched', 'expired')),
  
  -- Lifecycle timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  matched_at timestamptz,
  expires_at timestamptz NOT NULL,
  last_location_update timestamptz NOT NULL DEFAULT now(),
  
  -- Scheduling (optional)
  scheduled_for timestamptz,
  recurrence text CHECK (recurrence IN ('once', 'daily', 'weekdays', 'weekly', 'monthly')),
  
  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,
  
  -- Constraints
  CONSTRAINT valid_coordinates CHECK (
    pickup_lat BETWEEN -90 AND 90 AND 
    pickup_lng BETWEEN -180 AND 180 AND
    (dropoff_lat IS NULL OR (dropoff_lat BETWEEN -90 AND 90)) AND
    (dropoff_lng IS NULL OR (dropoff_lng BETWEEN -180 AND 180))
  )
);

-- 2. MATCHES: Accepted trip pairings
CREATE TABLE mobility_trip_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Participants
  driver_trip_id uuid NOT NULL REFERENCES mobility_trips(id) ON DELETE CASCADE,
  passenger_trip_id uuid NOT NULL REFERENCES mobility_trips(id) ON DELETE CASCADE,
  driver_user_id uuid NOT NULL REFERENCES profiles(user_id),
  passenger_user_id uuid NOT NULL REFERENCES profiles(user_id),
  
  -- Trip details
  vehicle_type text NOT NULL,
  pickup_location geography(Point, 4326) NOT NULL,
  dropoff_location geography(Point, 4326),
  
  -- Status (clear lifecycle)
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',           -- Driver notified, awaiting response
    'accepted',          -- Driver accepted
    'driver_arrived',    -- At pickup
    'in_progress',       -- Trip started
    'completed',         -- Successfully completed
    'cancelled_driver',  -- Cancelled by driver
    'cancelled_passenger', -- Cancelled by passenger
    'expired'            -- No response
  )),
  
  -- Fare
  estimated_fare numeric(10,2),
  actual_fare numeric(10,2),
  currency text DEFAULT 'RWF',
  surge_multiplier numeric(3,2) DEFAULT 1.0,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  started_at timestamptz,
  arrived_at_pickup_at timestamptz,
  picked_up_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  
  -- Contact info (for notifications)
  driver_phone text NOT NULL,
  passenger_phone text NOT NULL,
  
  -- Metadata
  cancellation_reason text,
  rating_by_passenger integer CHECK (rating_by_passenger BETWEEN 1 AND 5),
  rating_by_driver integer CHECK (rating_by_driver BETWEEN 1 AND 5),
  metadata jsonb DEFAULT '{}'::jsonb,
  
  -- Constraints
  CONSTRAINT unique_active_match UNIQUE (driver_trip_id, passenger_trip_id),
  CONSTRAINT different_users CHECK (driver_user_id != passenger_user_id)
);

-- 3. DRIVER METRICS: Performance tracking
CREATE TABLE mobility_driver_metrics (
  user_id uuid PRIMARY KEY REFERENCES profiles(user_id) ON DELETE CASCADE,
  
  -- Counters
  total_trips integer DEFAULT 0,
  completed_trips integer DEFAULT 0,
  cancelled_trips integer DEFAULT 0,
  
  -- Quality metrics
  avg_rating numeric(3,2),
  acceptance_rate numeric(5,2), -- Percentage (0-100)
  avg_response_seconds integer,
  
  -- Revenue
  total_earnings numeric(12,2) DEFAULT 0,
  
  -- Activity
  last_trip_at timestamptz,
  last_online_at timestamptz,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. PASSENGER METRICS: Track passenger behavior
CREATE TABLE mobility_passenger_metrics (
  user_id uuid PRIMARY KEY REFERENCES profiles(user_id) ON DELETE CASCADE,
  
  -- Counters
  total_trips integer DEFAULT 0,
  completed_trips integer DEFAULT 0,
  cancelled_trips integer DEFAULT 0,
  
  -- Quality
  avg_rating numeric(3,2),
  
  -- Spending
  total_spent numeric(12,2) DEFAULT 0,
  
  -- Activity
  last_trip_at timestamptz,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. PRICING CONFIG: Dynamic pricing rules
CREATE TABLE mobility_pricing_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_type text NOT NULL,
  region text DEFAULT 'default',
  
  -- Base rates
  base_rate_per_km numeric(10,2) NOT NULL,
  base_rate_per_min numeric(10,2) NOT NULL,
  minimum_fare numeric(10,2) NOT NULL,
  
  -- Surge settings
  surge_enabled boolean DEFAULT false,
  max_surge_multiplier numeric(3,2) DEFAULT 2.0,
  
  -- Peak hours (jsonb array of hour ranges)
  peak_hours jsonb DEFAULT '[]'::jsonb,
  peak_multiplier numeric(3,2) DEFAULT 1.3,
  
  -- Active
  active boolean DEFAULT true,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_vehicle_region UNIQUE (vehicle_type, region)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Trips: Spatial + status queries
CREATE INDEX idx_mobility_trips_open ON mobility_trips(status, expires_at, last_location_update)
  WHERE status = 'open';

CREATE INDEX idx_mobility_trips_pickup_geog ON mobility_trips USING GIST(pickup_geog)
  WHERE status = 'open';

CREATE INDEX idx_mobility_trips_role_vehicle ON mobility_trips(role, vehicle_type, status);

CREATE INDEX idx_mobility_trips_scheduled ON mobility_trips(scheduled_for)
  WHERE scheduled_for IS NOT NULL AND status = 'open';

-- Matches: Lifecycle queries
CREATE INDEX idx_mobility_matches_driver ON mobility_trip_matches(driver_user_id, status, created_at DESC);
CREATE INDEX idx_mobility_matches_passenger ON mobility_trip_matches(passenger_user_id, status, created_at DESC);
CREATE INDEX idx_mobility_matches_active ON mobility_trip_matches(status, created_at DESC)
  WHERE status IN ('pending', 'accepted', 'driver_arrived', 'in_progress');

-- Metrics: User lookups
CREATE INDEX idx_mobility_driver_metrics_activity ON mobility_driver_metrics(last_online_at DESC, acceptance_rate DESC)
  WHERE acceptance_rate >= 70.0;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_mobility_trip_matches_updated_at
  BEFORE UPDATE ON mobility_trip_matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_mobility_driver_metrics_updated_at
  BEFORE UPDATE ON mobility_driver_metrics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_mobility_passenger_metrics_updated_at
  BEFORE UPDATE ON mobility_passenger_metrics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update driver metrics on match completion
CREATE OR REPLACE FUNCTION update_driver_metrics_on_match()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    INSERT INTO mobility_driver_metrics (user_id, total_trips, completed_trips, last_trip_at, total_earnings)
    VALUES (
      NEW.driver_user_id, 
      1, 
      1, 
      now(), 
      COALESCE(NEW.actual_fare, 0)
    )
    ON CONFLICT (user_id) DO UPDATE SET
      total_trips = mobility_driver_metrics.total_trips + 1,
      completed_trips = mobility_driver_metrics.completed_trips + 1,
      last_trip_at = now(),
      total_earnings = mobility_driver_metrics.total_earnings + COALESCE(NEW.actual_fare, 0),
      updated_at = now();
      
    -- Update passenger metrics too
    INSERT INTO mobility_passenger_metrics (user_id, total_trips, completed_trips, last_trip_at, total_spent)
    VALUES (
      NEW.passenger_user_id,
      1,
      1,
      now(),
      COALESCE(NEW.actual_fare, 0)
    )
    ON CONFLICT (user_id) DO UPDATE SET
      total_trips = mobility_passenger_metrics.total_trips + 1,
      completed_trips = mobility_passenger_metrics.completed_trips + 1,
      last_trip_at = now(),
      total_spent = mobility_passenger_metrics.total_spent + COALESCE(NEW.actual_fare, 0),
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_metrics_on_completion
  AFTER UPDATE ON mobility_trip_matches
  FOR EACH ROW
  EXECUTE FUNCTION update_driver_metrics_on_match();

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE mobility_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE mobility_trip_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE mobility_driver_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE mobility_passenger_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE mobility_pricing_config ENABLE ROW LEVEL SECURITY;

-- Trips: Users can CRUD their own
CREATE POLICY "Users manage own trips" ON mobility_trips
  FOR ALL USING (auth.uid() = creator_user_id);

-- Service role full access
CREATE POLICY "Service role full access trips" ON mobility_trips
  FOR ALL TO service_role USING (true);

-- Matches: Users can view matches involving them
CREATE POLICY "Users view own matches" ON mobility_trip_matches
  FOR SELECT USING (
    auth.uid() = driver_user_id OR 
    auth.uid() = passenger_user_id
  );

CREATE POLICY "Service role full access matches" ON mobility_trip_matches
  FOR ALL TO service_role USING (true);

-- Metrics: Users can view own metrics
CREATE POLICY "Users view own driver metrics" ON mobility_driver_metrics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users view own passenger metrics" ON mobility_passenger_metrics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access metrics" ON mobility_driver_metrics
  FOR ALL TO service_role USING (true);

CREATE POLICY "Service role full access passenger metrics" ON mobility_passenger_metrics
  FOR ALL TO service_role USING (true);

-- Pricing: Public read, admin write
CREATE POLICY "Anyone can view pricing" ON mobility_pricing_config
  FOR SELECT USING (active = true);

CREATE POLICY "Service role manage pricing" ON mobility_pricing_config
  FOR ALL TO service_role USING (true);

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Default pricing for Rwanda
INSERT INTO mobility_pricing_config (vehicle_type, region, base_rate_per_km, base_rate_per_min, minimum_fare, surge_enabled)
VALUES
  ('moto', 'rwanda', 200, 50, 500, false),
  ('cab', 'rwanda', 500, 100, 1000, false),
  ('lifan', 'rwanda', 300, 75, 750, false),
  ('truck', 'rwanda', 800, 150, 2000, false)
ON CONFLICT (vehicle_type, region) DO NOTHING;

COMMIT;
```

### Day 3-4: Matching Service (NEW)

**Location**: `services/matching-service/`

This service is responsible ONLY for finding candidate matches (no ranking).

**Implementation**: See next file creation...

---

## Implementation Order

1. **Week 1**: Database + Matching Service + Ranking Service Extension
2. **Week 2**: Orchestrator Service + Tracking Service
3. **Week 3**: Payment Service + Edge Function Refactor
4. **Week 4**: Testing + Migration + Deployment

**No shortcuts. Every component production-grade with tests.**

---

## Next Steps

1. Review and approve this plan
2. I will implement each service fully with:
   - Complete TypeScript code
   - Unit tests
   - Integration tests
   - Docker configs
   - Environment configs
   - Deployment scripts
   - Documentation

This is the **ONLY way** to fix the mobility system properly.

**Estimated**: 160 hours of development work (4 weeks, 1 full-time engineer).

