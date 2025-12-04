-- ============================================================================
-- MOBILITY V2 SCHEMA - COMPLETE REBUILD
-- ============================================================================
-- Migration: 20251204180000_mobility_v2_complete_schema.sql
-- Purpose: Clean, production-ready mobility schema with clear responsibilities
-- 
-- BREAKING CHANGE: This creates NEW tables (mobility_*) alongside existing ones
-- Migration strategy: Dual-write period, then cutover
-- ============================================================================

BEGIN;

-- Drop existing v2 tables if this is a re-run
DROP TABLE IF EXISTS mobility_trip_matches CASCADE;
DROP TABLE IF EXISTS mobility_trips CASCADE;
DROP TABLE IF EXISTS mobility_driver_metrics CASCADE;
DROP TABLE IF EXISTS mobility_passenger_metrics CASCADE;
DROP TABLE IF EXISTS mobility_pricing_config CASCADE;

-- ============================================================================
-- 1. TRIPS TABLE: Single source of truth for all trip requests
-- ============================================================================
CREATE TABLE mobility_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User & Role
  creator_user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('driver', 'passenger')),
  vehicle_type text NOT NULL,
  
  -- Pickup Location (required)
  pickup_lat double precision NOT NULL,
  pickup_lng double precision NOT NULL,
  pickup_geog geography(Point, 4326) GENERATED ALWAYS AS 
    (ST_SetSRID(ST_MakePoint(pickup_lng, pickup_lat), 4326)::geography) STORED,
  pickup_text text,
  pickup_radius_m integer DEFAULT 1000,
  
  -- Dropoff Location (optional)
  dropoff_lat double precision,
  dropoff_lng double precision,
  dropoff_geog geography(Point, 4326) GENERATED ALWAYS AS 
    (CASE WHEN dropoff_lat IS NOT NULL AND dropoff_lng IS NOT NULL 
      THEN ST_SetSRID(ST_MakePoint(dropoff_lng, dropoff_lat), 4326)::geography 
      ELSE NULL END) STORED,
  dropoff_text text,
  dropoff_radius_m integer,
  
  -- Status: Simplified to 3 states
  -- open: Actively looking for match
  -- matched: Found a match (moved to mobility_trip_matches)
  -- expired: Passed expiry time
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'matched', 'expired')),
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  matched_at timestamptz,
  expires_at timestamptz NOT NULL,
  last_location_update timestamptz NOT NULL DEFAULT now(),
  
  -- Scheduling (optional for future trips)
  scheduled_for timestamptz,
  recurrence text CHECK (recurrence IN ('once', 'daily', 'weekdays', 'weekly', 'monthly')),
  
  -- Metadata (flexible for future features)
  metadata jsonb DEFAULT '{}'::jsonb,
  
  -- Data integrity constraints
  CONSTRAINT valid_coordinates CHECK (
    pickup_lat BETWEEN -90 AND 90 AND 
    pickup_lng BETWEEN -180 AND 180 AND
    (dropoff_lat IS NULL OR (dropoff_lat BETWEEN -90 AND 90)) AND
    (dropoff_lng IS NULL OR (dropoff_lng BETWEEN -180 AND 180))
  ),
  
  CONSTRAINT valid_expiry CHECK (expires_at > created_at),
  CONSTRAINT valid_schedule CHECK (scheduled_for IS NULL OR scheduled_for > created_at)
);

COMMENT ON TABLE mobility_trips IS 'All trip requests (driver/passenger). Status=open until matched or expired.';
COMMENT ON COLUMN mobility_trips.role IS 'driver: offering ride, passenger: requesting ride';
COMMENT ON COLUMN mobility_trips.status IS 'open=active, matched=accepted by counterparty, expired=TTL reached';
COMMENT ON COLUMN mobility_trips.pickup_geog IS 'PostGIS geography for spatial queries (auto-generated)';

-- ============================================================================
-- 2. TRIP MATCHES TABLE: Accepted pairings with lifecycle tracking
-- ============================================================================
CREATE TABLE mobility_trip_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Trip References (both must exist)
  driver_trip_id uuid NOT NULL REFERENCES mobility_trips(id) ON DELETE CASCADE,
  passenger_trip_id uuid NOT NULL REFERENCES mobility_trips(id) ON DELETE CASCADE,
  
  -- Participant IDs (denormalized for quick lookups)
  driver_user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
  passenger_user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
  
  -- Trip Details (snapshot at match time)
  vehicle_type text NOT NULL,
  pickup_location geography(Point, 4326) NOT NULL,
  dropoff_location geography(Point, 4326),
  pickup_address text,
  dropoff_address text,
  
  -- Lifecycle Status
  -- pending: Driver notified, awaiting acceptance
  -- accepted: Driver confirmed, passenger notified
  -- driver_arrived: Driver at pickup location
  -- in_progress: Trip started (passenger picked up)
  -- completed: Successfully finished
  -- cancelled_driver: Driver cancelled
  -- cancelled_passenger: Passenger cancelled
  -- expired: No response within timeout
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'accepted',
    'driver_arrived',
    'in_progress',
    'completed',
    'cancelled_driver',
    'cancelled_passenger',
    'expired'
  )),
  
  -- Fare Information
  estimated_fare numeric(10,2),
  actual_fare numeric(10,2),
  currency text DEFAULT 'RWF',
  surge_multiplier numeric(3,2) DEFAULT 1.0,
  distance_km numeric(10,2),
  duration_minutes integer,
  
  -- Contact Info (for WhatsApp notifications)
  driver_phone text NOT NULL,
  passenger_phone text NOT NULL,
  
  -- Lifecycle Timestamps (track every transition)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  started_at timestamptz,
  arrived_at_pickup_at timestamptz,
  picked_up_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  
  -- Quality & Feedback
  rating_by_passenger integer CHECK (rating_by_passenger BETWEEN 1 AND 5),
  rating_by_driver integer CHECK (rating_by_driver BETWEEN 1 AND 5),
  feedback_by_passenger text,
  feedback_by_driver text,
  
  -- Cancellation tracking
  cancellation_reason text,
  cancelled_by_user_id uuid REFERENCES profiles(user_id),
  
  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,
  
  -- Business Rules
  CONSTRAINT unique_active_match UNIQUE (driver_trip_id, passenger_trip_id),
  CONSTRAINT different_users CHECK (driver_user_id != passenger_user_id),
  CONSTRAINT valid_rating_passenger CHECK (
    rating_by_passenger IS NULL OR 
    (rating_by_passenger >= 1 AND rating_by_passenger <= 5 AND status = 'completed')
  ),
  CONSTRAINT valid_rating_driver CHECK (
    rating_by_driver IS NULL OR 
    (rating_by_driver >= 1 AND rating_by_driver <= 5 AND status = 'completed')
  )
);

COMMENT ON TABLE mobility_trip_matches IS 'Accepted trip pairings with full lifecycle tracking';
COMMENT ON COLUMN mobility_trip_matches.status IS 'pending→accepted→driver_arrived→in_progress→completed';
COMMENT ON COLUMN mobility_trip_matches.surge_multiplier IS 'Dynamic pricing multiplier (1.0 = no surge)';

-- ============================================================================
-- 3. DRIVER METRICS TABLE: Performance & quality tracking
-- ============================================================================
CREATE TABLE mobility_driver_metrics (
  user_id uuid PRIMARY KEY REFERENCES profiles(user_id) ON DELETE CASCADE,
  
  -- Trip Counters
  total_trips integer DEFAULT 0 CHECK (total_trips >= 0),
  completed_trips integer DEFAULT 0 CHECK (completed_trips >= 0),
  cancelled_trips integer DEFAULT 0 CHECK (cancelled_trips >= 0),
  
  -- Quality Metrics
  avg_rating numeric(3,2) CHECK (avg_rating IS NULL OR (avg_rating >= 1.0 AND avg_rating <= 5.0)),
  total_ratings integer DEFAULT 0,
  acceptance_rate numeric(5,2) DEFAULT 100.0 CHECK (acceptance_rate BETWEEN 0 AND 100),
  avg_response_seconds integer CHECK (avg_response_seconds IS NULL OR avg_response_seconds >= 0),
  
  -- Revenue Tracking
  total_earnings numeric(12,2) DEFAULT 0 CHECK (total_earnings >= 0),
  currency text DEFAULT 'RWF',
  
  -- Activity Tracking
  last_trip_at timestamptz,
  last_online_at timestamptz,
  total_online_hours numeric(10,2) DEFAULT 0,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Computed fields (for ranking)
  computed_score numeric(5,4) GENERATED ALWAYS AS (
    CASE 
      WHEN total_trips = 0 THEN 0.5000
      ELSE (
        COALESCE(avg_rating / 5.0, 0.6) * 0.4 +
        LEAST(acceptance_rate / 100.0, 1.0) * 0.3 +
        LEAST(completed_trips::numeric / NULLIF(total_trips, 0), 1.0) * 0.3
      )
    END
  ) STORED,
  
  CONSTRAINT valid_completed CHECK (completed_trips <= total_trips),
  CONSTRAINT valid_cancelled CHECK (cancelled_trips <= total_trips)
);

COMMENT ON TABLE mobility_driver_metrics IS 'Driver performance metrics for ranking and analytics';
COMMENT ON COLUMN mobility_driver_metrics.computed_score IS 'Auto-calculated score (0-1) for ranking: 40% rating + 30% acceptance + 30% completion';
COMMENT ON COLUMN mobility_driver_metrics.acceptance_rate IS 'Percentage of offers accepted (100 = perfect)';

-- ============================================================================
-- 4. PASSENGER METRICS TABLE: Passenger behavior tracking
-- ============================================================================
CREATE TABLE mobility_passenger_metrics (
  user_id uuid PRIMARY KEY REFERENCES profiles(user_id) ON DELETE CASCADE,
  
  -- Trip Counters
  total_trips integer DEFAULT 0 CHECK (total_trips >= 0),
  completed_trips integer DEFAULT 0 CHECK (completed_trips >= 0),
  cancelled_trips integer DEFAULT 0 CHECK (cancelled_trips >= 0),
  
  -- Quality
  avg_rating numeric(3,2) CHECK (avg_rating IS NULL OR (avg_rating >= 1.0 AND avg_rating <= 5.0)),
  total_ratings integer DEFAULT 0,
  
  -- Spending
  total_spent numeric(12,2) DEFAULT 0 CHECK (total_spent >= 0),
  currency text DEFAULT 'RWF',
  
  -- Activity
  last_trip_at timestamptz,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_completed CHECK (completed_trips <= total_trips),
  CONSTRAINT valid_cancelled CHECK (cancelled_trips <= total_trips)
);

COMMENT ON TABLE mobility_passenger_metrics IS 'Passenger behavior metrics for fraud detection and analytics';

-- ============================================================================
-- 5. PRICING CONFIG TABLE: Dynamic pricing rules
-- ============================================================================
CREATE TABLE mobility_pricing_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Scope
  vehicle_type text NOT NULL,
  region text DEFAULT 'default',
  
  -- Base Rates (per unit)
  base_rate_per_km numeric(10,2) NOT NULL CHECK (base_rate_per_km > 0),
  base_rate_per_min numeric(10,2) NOT NULL CHECK (base_rate_per_min >= 0),
  minimum_fare numeric(10,2) NOT NULL CHECK (minimum_fare > 0),
  
  -- Surge Pricing
  surge_enabled boolean DEFAULT false,
  max_surge_multiplier numeric(3,2) DEFAULT 2.0 CHECK (max_surge_multiplier >= 1.0),
  
  -- Peak Hours (JSON array: [{"start": "07:00", "end": "09:00", "multiplier": 1.3}])
  peak_hours jsonb DEFAULT '[]'::jsonb,
  peak_multiplier numeric(3,2) DEFAULT 1.3 CHECK (peak_multiplier >= 1.0),
  
  -- Status
  active boolean DEFAULT true,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_vehicle_region UNIQUE (vehicle_type, region)
);

COMMENT ON TABLE mobility_pricing_config IS 'Configurable pricing rules per vehicle type and region';
COMMENT ON COLUMN mobility_pricing_config.peak_hours IS 'JSON array of time ranges with custom multipliers';

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Trips: Spatial + active status
CREATE INDEX idx_mobility_trips_open 
  ON mobility_trips(status, expires_at, last_location_update)
  WHERE status = 'open';

CREATE INDEX idx_mobility_trips_pickup_geog 
  ON mobility_trips USING GIST(pickup_geog)
  WHERE status = 'open';

CREATE INDEX idx_mobility_trips_role_vehicle 
  ON mobility_trips(role, vehicle_type, status)
  WHERE status = 'open';

CREATE INDEX idx_mobility_trips_scheduled 
  ON mobility_trips(scheduled_for)
  WHERE scheduled_for IS NOT NULL AND status = 'open';

CREATE INDEX idx_mobility_trips_user_recent
  ON mobility_trips(creator_user_id, created_at DESC);

-- Matches: Lifecycle queries
CREATE INDEX idx_mobility_matches_driver 
  ON mobility_trip_matches(driver_user_id, status, created_at DESC);

CREATE INDEX idx_mobility_matches_passenger 
  ON mobility_trip_matches(passenger_user_id, status, created_at DESC);

CREATE INDEX idx_mobility_matches_active 
  ON mobility_trip_matches(status, created_at DESC)
  WHERE status IN ('pending', 'accepted', 'driver_arrived', 'in_progress');

CREATE INDEX idx_mobility_matches_completed
  ON mobility_trip_matches(completed_at DESC)
  WHERE status = 'completed';

-- Metrics: Ranking queries
CREATE INDEX idx_mobility_driver_metrics_ranking
  ON mobility_driver_metrics(computed_score DESC, last_online_at DESC)
  WHERE acceptance_rate >= 70.0 AND total_trips > 0;

CREATE INDEX idx_mobility_driver_metrics_activity
  ON mobility_driver_metrics(last_online_at DESC)
  WHERE last_online_at > now() - interval '24 hours';

-- Pricing: Lookups
CREATE INDEX idx_mobility_pricing_active
  ON mobility_pricing_config(vehicle_type, region)
  WHERE active = true;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION mobility_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_mobility_trip_matches_updated_at
  BEFORE UPDATE ON mobility_trip_matches
  FOR EACH ROW
  EXECUTE FUNCTION mobility_update_updated_at();

CREATE TRIGGER trg_mobility_driver_metrics_updated_at
  BEFORE UPDATE ON mobility_driver_metrics
  FOR EACH ROW
  EXECUTE FUNCTION mobility_update_updated_at();

CREATE TRIGGER trg_mobility_passenger_metrics_updated_at
  BEFORE UPDATE ON mobility_passenger_metrics
  FOR EACH ROW
  EXECUTE FUNCTION mobility_update_updated_at();

CREATE TRIGGER trg_mobility_pricing_config_updated_at
  BEFORE UPDATE ON mobility_pricing_config
  FOR EACH ROW
  EXECUTE FUNCTION mobility_update_updated_at();

-- ============================================================================
-- METRICS AUTO-UPDATE TRIGGERS
-- ============================================================================

-- Update driver metrics when match completes
CREATE OR REPLACE FUNCTION mobility_update_driver_metrics_on_match()
RETURNS TRIGGER AS $$
DECLARE
  v_new_avg_rating numeric(3,2);
BEGIN
  -- On completion: update trip counters and earnings
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    INSERT INTO mobility_driver_metrics (
      user_id, 
      total_trips, 
      completed_trips, 
      last_trip_at, 
      total_earnings
    )
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
      
    -- Update passenger metrics
    INSERT INTO mobility_passenger_metrics (
      user_id, 
      total_trips, 
      completed_trips, 
      last_trip_at, 
      total_spent
    )
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
  
  -- On driver cancellation: increment cancelled counter
  IF NEW.status = 'cancelled_driver' AND OLD.status != 'cancelled_driver' THEN
    INSERT INTO mobility_driver_metrics (user_id, total_trips, cancelled_trips)
    VALUES (NEW.driver_user_id, 1, 1)
    ON CONFLICT (user_id) DO UPDATE SET
      total_trips = mobility_driver_metrics.total_trips + 1,
      cancelled_trips = mobility_driver_metrics.cancelled_trips + 1,
      updated_at = now();
  END IF;
  
  -- On passenger cancellation: increment cancelled counter
  IF NEW.status = 'cancelled_passenger' AND OLD.status != 'cancelled_passenger' THEN
    INSERT INTO mobility_passenger_metrics (user_id, total_trips, cancelled_trips)
    VALUES (NEW.passenger_user_id, 1, 1)
    ON CONFLICT (user_id) DO UPDATE SET
      total_trips = mobility_passenger_metrics.total_trips + 1,
      cancelled_trips = mobility_passenger_metrics.cancelled_trips + 1,
      updated_at = now();
  END IF;
  
  -- On driver rating: update average
  IF NEW.rating_by_passenger IS NOT NULL AND OLD.rating_by_passenger IS NULL THEN
    UPDATE mobility_driver_metrics
    SET 
      total_ratings = total_ratings + 1,
      avg_rating = (
        COALESCE(avg_rating * total_ratings, 0) + NEW.rating_by_passenger
      ) / (total_ratings + 1),
      updated_at = now()
    WHERE user_id = NEW.driver_user_id;
  END IF;
  
  -- On passenger rating: update average
  IF NEW.rating_by_driver IS NOT NULL AND OLD.rating_by_driver IS NULL THEN
    UPDATE mobility_passenger_metrics
    SET 
      total_ratings = total_ratings + 1,
      avg_rating = (
        COALESCE(avg_rating * total_ratings, 0) + NEW.rating_by_driver
      ) / (total_ratings + 1),
      updated_at = now()
    WHERE user_id = NEW.passenger_user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_mobility_update_metrics_on_match
  AFTER UPDATE ON mobility_trip_matches
  FOR EACH ROW
  EXECUTE FUNCTION mobility_update_driver_metrics_on_match();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE mobility_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE mobility_trip_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE mobility_driver_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE mobility_passenger_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE mobility_pricing_config ENABLE ROW LEVEL SECURITY;

-- Trips: Users manage their own
CREATE POLICY "Users manage own trips" 
  ON mobility_trips
  FOR ALL 
  USING (auth.uid() = creator_user_id);

CREATE POLICY "Service role full access trips" 
  ON mobility_trips
  FOR ALL 
  TO service_role 
  USING (true);

-- Matches: Users can view matches involving them
CREATE POLICY "Users view own matches" 
  ON mobility_trip_matches
  FOR SELECT 
  USING (
    auth.uid() = driver_user_id OR 
    auth.uid() = passenger_user_id
  );

CREATE POLICY "Service role full access matches" 
  ON mobility_trip_matches
  FOR ALL 
  TO service_role 
  USING (true);

-- Driver Metrics: Users can view own
CREATE POLICY "Drivers view own metrics" 
  ON mobility_driver_metrics
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access driver metrics" 
  ON mobility_driver_metrics
  FOR ALL 
  TO service_role 
  USING (true);

-- Passenger Metrics: Users can view own
CREATE POLICY "Passengers view own metrics" 
  ON mobility_passenger_metrics
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access passenger metrics" 
  ON mobility_passenger_metrics
  FOR ALL 
  TO service_role 
  USING (true);

-- Pricing: Public read, service role write
CREATE POLICY "Anyone can view active pricing" 
  ON mobility_pricing_config
  FOR SELECT 
  USING (active = true);

CREATE POLICY "Service role manage pricing" 
  ON mobility_pricing_config
  FOR ALL 
  TO service_role 
  USING (true);

-- ============================================================================
-- SEED DATA: Default pricing for Rwanda
-- ============================================================================

INSERT INTO mobility_pricing_config (
  vehicle_type, 
  region, 
  base_rate_per_km, 
  base_rate_per_min, 
  minimum_fare, 
  surge_enabled,
  max_surge_multiplier,
  peak_multiplier,
  active
)
VALUES
  ('moto', 'rwanda', 200, 50, 500, false, 1.5, 1.2, true),
  ('cab', 'rwanda', 500, 100, 1000, false, 2.0, 1.3, true),
  ('lifan', 'rwanda', 300, 75, 750, false, 1.8, 1.25, true),
  ('truck', 'rwanda', 800, 150, 2000, false, 2.0, 1.5, true)
ON CONFLICT (vehicle_type, region) DO UPDATE SET
  base_rate_per_km = EXCLUDED.base_rate_per_km,
  base_rate_per_min = EXCLUDED.base_rate_per_min,
  minimum_fare = EXCLUDED.minimum_fare,
  updated_at = now();

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

-- Function to expire old trips (called by cron)
CREATE OR REPLACE FUNCTION mobility_expire_old_trips()
RETURNS integer AS $$
DECLARE
  v_expired_count integer;
BEGIN
  UPDATE mobility_trips
  SET status = 'expired', updated_at = now()
  WHERE status = 'open' 
    AND expires_at < now();
  
  GET DIAGNOSTICS v_expired_count = ROW_COUNT;
  
  RAISE NOTICE 'Expired % old trips', v_expired_count;
  RETURN v_expired_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION mobility_expire_old_trips IS 'Expires trips past their TTL. Run via pg_cron every 5 minutes.';

-- Function to calculate dynamic surge
CREATE OR REPLACE FUNCTION mobility_calculate_surge(
  p_vehicle_type text,
  p_lat double precision,
  p_lng double precision,
  p_radius_km numeric DEFAULT 5.0
)
RETURNS numeric AS $$
DECLARE
  v_driver_count integer;
  v_passenger_count integer;
  v_ratio numeric;
  v_config RECORD;
BEGIN
  -- Get pricing config
  SELECT surge_enabled, max_surge_multiplier INTO v_config
  FROM mobility_pricing_config
  WHERE vehicle_type = p_vehicle_type AND active = true
  LIMIT 1;
  
  -- If surge disabled, return 1.0
  IF NOT FOUND OR v_config.surge_enabled = false THEN
    RETURN 1.0;
  END IF;
  
  -- Count nearby drivers (last 10 min)
  SELECT COUNT(*) INTO v_driver_count
  FROM mobility_trips
  WHERE role = 'driver'
    AND status = 'open'
    AND vehicle_type = p_vehicle_type
    AND last_location_update > now() - interval '10 minutes'
    AND ST_DWithin(
      pickup_geog,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_km * 1000
    );
  
  -- Count nearby passengers (last 10 min)
  SELECT COUNT(*) INTO v_passenger_count
  FROM mobility_trips
  WHERE role = 'passenger'
    AND status = 'open'
    AND vehicle_type = p_vehicle_type
    AND last_location_update > now() - interval '10 minutes'
    AND ST_DWithin(
      pickup_geog,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_km * 1000
    );
  
  -- If no drivers, return max surge
  IF v_driver_count = 0 THEN
    RETURN v_config.max_surge_multiplier;
  END IF;
  
  -- Calculate demand ratio
  v_ratio := v_passenger_count::numeric / v_driver_count::numeric;
  
  -- Surge tiers:
  -- 0-0.5 ratio = 1.0x (more supply than demand)
  -- 0.5-1.0 ratio = 1.2x (balanced)
  -- 1.0-2.0 ratio = 1.5x (high demand)
  -- 2.0+ ratio = max surge (very high demand)
  RETURN LEAST(
    CASE
      WHEN v_ratio < 0.5 THEN 1.0
      WHEN v_ratio < 1.0 THEN 1.2
      WHEN v_ratio < 2.0 THEN 1.5
      ELSE v_config.max_surge_multiplier
    END,
    v_config.max_surge_multiplier
  );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION mobility_calculate_surge IS 'Calculate dynamic surge multiplier based on supply/demand ratio';

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON mobility_trips TO authenticated;
GRANT SELECT ON mobility_trip_matches TO authenticated;
GRANT SELECT ON mobility_driver_metrics TO authenticated;
GRANT SELECT ON mobility_passenger_metrics TO authenticated;
GRANT SELECT ON mobility_pricing_config TO authenticated;

GRANT ALL ON mobility_trips TO service_role;
GRANT ALL ON mobility_trip_matches TO service_role;
GRANT ALL ON mobility_driver_metrics TO service_role;
GRANT ALL ON mobility_passenger_metrics TO service_role;
GRANT ALL ON mobility_pricing_config TO service_role;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify table creation
DO $$
DECLARE
  v_tables_count integer;
BEGIN
  SELECT COUNT(*) INTO v_tables_count
  FROM information_schema.tables
  WHERE table_schema = 'public' 
    AND table_name LIKE 'mobility_%';
  
  IF v_tables_count < 5 THEN
    RAISE EXCEPTION 'Expected 5+ mobility tables, found %', v_tables_count;
  END IF;
  
  RAISE NOTICE 'Successfully created % mobility tables', v_tables_count;
END;
$$;

COMMIT;

-- ============================================================================
-- POST-MIGRATION NOTES
-- ============================================================================
-- 
-- NEXT STEPS:
-- 1. Run: SELECT mobility_expire_old_trips(); -- Test expiry function
-- 2. Run: SELECT mobility_calculate_surge('moto', -1.95, 30.06); -- Test surge
-- 3. Deploy matching-service microservice
-- 4. Deploy ranking-service extension
-- 5. Dual-write from edge functions (both old + new schemas)
-- 6. Monitor for 1 week
-- 7. Cutover to new schema
-- 8. Drop old tables (rides_trips, mobility_intents, mobility_matches)
-- 
-- ============================================================================
