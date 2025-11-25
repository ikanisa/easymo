-- ============================================================================
-- MOBILITY CORE TABLES MIGRATION
-- ============================================================================
-- Description: Creates core tables for mobility/ride-sharing functionality
-- Dependencies: profiles table must exist
-- Author: EasyMO Platform Team
-- Date: 2025-11-25
-- ============================================================================

BEGIN;

-- ============================================================================
-- DRIVER STATUS MANAGEMENT
-- ============================================================================
-- Tracks online drivers, their location, and availability
CREATE TABLE IF NOT EXISTS driver_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  is_online BOOLEAN DEFAULT false,
  current_lat NUMERIC(10, 8),
  current_lng NUMERIC(11, 8),
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  vehicle_type TEXT,
  vehicle_plate TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT driver_status_user_unique UNIQUE(user_id)
);

-- Geospatial index for proximity searches (PostGIS-style point index)
CREATE INDEX IF NOT EXISTS idx_driver_status_location 
ON driver_status USING GIST (point(current_lng, current_lat))
WHERE is_online = true;

-- Index for finding online drivers by vehicle type
CREATE INDEX IF NOT EXISTS idx_driver_status_online
ON driver_status(is_online, vehicle_type, last_seen_at) 
WHERE is_online = true;

-- Index for quick user lookup
CREATE INDEX IF NOT EXISTS idx_driver_status_user
ON driver_status(user_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_driver_status_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER driver_status_updated_at
  BEFORE UPDATE ON driver_status
  FOR EACH ROW
  EXECUTE FUNCTION update_driver_status_updated_at();

-- ============================================================================
-- MOBILITY MATCHES (Driver-Passenger Connections)
-- ============================================================================
-- Represents trip requests and their lifecycle
CREATE TABLE IF NOT EXISTS mobility_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  passenger_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  vehicle_type TEXT NOT NULL,
  pickup_lat NUMERIC(10, 8) NOT NULL,
  pickup_lng NUMERIC(11, 8) NOT NULL,
  pickup_address TEXT,
  dropoff_lat NUMERIC(10, 8),
  dropoff_lng NUMERIC(11, 8),
  dropoff_address TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',                    -- Initial request
    'accepted',                   -- Driver accepted
    'driver_arrived',             -- Driver at pickup
    'in_progress',                -- Trip started
    'completed',                  -- Trip finished
    'cancelled_by_driver',        -- Driver cancelled
    'cancelled_by_passenger',     -- Passenger cancelled
    'expired'                     -- No response timeout
  )),
  distance_km NUMERIC(10, 2),
  duration_minutes INTEGER,
  eta_minutes INTEGER,
  fare_estimate NUMERIC(10, 2),
  actual_fare NUMERIC(10, 2),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN (
    'pending', 'processing', 'completed', 'failed', 'refunded'
  )),
  payment_id TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_mobility_matches_driver 
ON mobility_matches(driver_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mobility_matches_passenger 
ON mobility_matches(passenger_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mobility_matches_status 
ON mobility_matches(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mobility_matches_payment
ON mobility_matches(payment_status, updated_at)
WHERE payment_status IN ('pending', 'processing');

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_mobility_matches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER mobility_matches_updated_at
  BEFORE UPDATE ON mobility_matches
  FOR EACH ROW
  EXECUTE FUNCTION update_mobility_matches_updated_at();

-- ============================================================================
-- SCHEDULED TRIPS
-- ============================================================================
-- Future trip bookings with recurrence support
CREATE TABLE IF NOT EXISTS scheduled_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('driver', 'passenger')),
  vehicle_type TEXT NOT NULL,
  pickup_lat NUMERIC(10, 8) NOT NULL,
  pickup_lng NUMERIC(11, 8) NOT NULL,
  pickup_address TEXT,
  dropoff_lat NUMERIC(10, 8),
  dropoff_lng NUMERIC(11, 8),
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
  updated_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_scheduled_trips_user 
ON scheduled_trips(user_id, status, scheduled_time);

-- Index for upcoming active scheduled trips (without now() to avoid immutability issue)
CREATE INDEX IF NOT EXISTS idx_scheduled_trips_upcoming 
ON scheduled_trips(scheduled_time, status) 
WHERE status = 'active';

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_scheduled_trips_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER scheduled_trips_updated_at
  BEFORE UPDATE ON scheduled_trips
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduled_trips_updated_at();

-- ============================================================================
-- SAVED LOCATIONS
-- ============================================================================
-- User's frequently used locations (Home, Work, etc.)
CREATE TABLE IF NOT EXISTS saved_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  lat NUMERIC(10, 8) NOT NULL,
  lng NUMERIC(11, 8) NOT NULL,
  address TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT saved_locations_user_label_unique UNIQUE(user_id, label)
);

CREATE INDEX IF NOT EXISTS idx_saved_locations_user 
ON saved_locations(user_id, is_default);

-- Ensure only one default location per user
CREATE OR REPLACE FUNCTION ensure_one_default_location()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE saved_locations 
    SET is_default = false 
    WHERE user_id = NEW.user_id AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER saved_locations_default_check
  BEFORE INSERT OR UPDATE ON saved_locations
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION ensure_one_default_location();

-- ============================================================================
-- DRIVER SUBSCRIPTIONS
-- ============================================================================
-- Driver subscription plans and features
CREATE TABLE IF NOT EXISTS driver_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL,
  plan_name TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN (
    'active', 'expired', 'cancelled', 'suspended'
  )),
  features JSONB DEFAULT '{}'::jsonb,
  starts_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_subscriptions_user 
ON driver_subscriptions(user_id, status, expires_at);

CREATE INDEX IF NOT EXISTS idx_driver_subscriptions_expiring
ON driver_subscriptions(expires_at, status)
WHERE status = 'active' AND expires_at IS NOT NULL;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_driver_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER driver_subscriptions_updated_at
  BEFORE UPDATE ON driver_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_driver_subscriptions_updated_at();

-- ============================================================================
-- DRIVER INSURANCE
-- ============================================================================
-- Driver insurance certificates and verification
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
ON driver_insurance(user_id, status, policy_expiry DESC);

CREATE INDEX IF NOT EXISTS idx_driver_insurance_expiry 
ON driver_insurance(policy_expiry, status) 
WHERE status = 'verified';

CREATE INDEX IF NOT EXISTS idx_driver_insurance_pending
ON driver_insurance(status, created_at)
WHERE status = 'pending';

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_driver_insurance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER driver_insurance_updated_at
  BEFORE UPDATE ON driver_insurance
  FOR EACH ROW
  EXECUTE FUNCTION update_driver_insurance_updated_at();

-- ============================================================================
-- INTENT CACHE
-- ============================================================================
-- Temporary storage for user intents during multi-step flows
CREATE TABLE IF NOT EXISTS mobility_intent_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  intent_type TEXT NOT NULL,
  intent_data JSONB DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT mobility_intent_cache_user_type_unique UNIQUE(user_id, intent_type)
);

CREATE INDEX IF NOT EXISTS idx_mobility_intent_cache_user 
ON mobility_intent_cache(user_id, expires_at);

-- Index for cleanup of expired intents
CREATE INDEX IF NOT EXISTS idx_mobility_intent_cache_expiry 
ON mobility_intent_cache(expires_at);

-- ============================================================================
-- LOCATION CACHE
-- ============================================================================
-- Short-term location cache to avoid repeated location requests
CREATE TABLE IF NOT EXISTS location_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  lat NUMERIC(10, 8) NOT NULL,
  lng NUMERIC(11, 8) NOT NULL,
  address TEXT,
  cached_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT location_cache_user_unique UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_location_cache_user 
ON location_cache(user_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_location_cache_expiry
ON location_cache(expires_at);

-- ============================================================================
-- TRIP RATINGS
-- ============================================================================
-- Driver and passenger ratings for completed trips
CREATE TABLE IF NOT EXISTS trip_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES mobility_matches(id) ON DELETE CASCADE,
  rater_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  rated_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT trip_ratings_unique UNIQUE(trip_id, rater_id)
);

CREATE INDEX IF NOT EXISTS idx_trip_ratings_rated 
ON trip_ratings(rated_id, rating, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trip_ratings_trip
ON trip_ratings(trip_id);

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
-- RLS POLICIES - DRIVER STATUS
-- ============================================================================
-- Anyone can view online drivers (for matching)
CREATE POLICY driver_status_select_online ON driver_status 
  FOR SELECT 
  USING (is_online = true);

-- Users can view their own status
CREATE POLICY driver_status_select_own ON driver_status 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Users can insert their own status
CREATE POLICY driver_status_insert ON driver_status 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own status
CREATE POLICY driver_status_update ON driver_status 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- ============================================================================
-- RLS POLICIES - MOBILITY MATCHES
-- ============================================================================
-- Users can see matches they're involved in
CREATE POLICY mobility_matches_select ON mobility_matches 
  FOR SELECT 
  USING (auth.uid() IN (driver_id, passenger_id));

-- Service role can insert matches
CREATE POLICY mobility_matches_insert ON mobility_matches 
  FOR INSERT 
  WITH CHECK (true);

-- Users can update matches they're involved in
CREATE POLICY mobility_matches_update ON mobility_matches 
  FOR UPDATE 
  USING (auth.uid() IN (driver_id, passenger_id));

-- ============================================================================
-- RLS POLICIES - SCHEDULED TRIPS
-- ============================================================================
CREATE POLICY scheduled_trips_select ON scheduled_trips 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY scheduled_trips_insert ON scheduled_trips 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY scheduled_trips_update ON scheduled_trips 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY scheduled_trips_delete ON scheduled_trips 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- ============================================================================
-- RLS POLICIES - SAVED LOCATIONS
-- ============================================================================
CREATE POLICY saved_locations_select ON saved_locations 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY saved_locations_insert ON saved_locations 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY saved_locations_update ON saved_locations 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY saved_locations_delete ON saved_locations 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- ============================================================================
-- RLS POLICIES - DRIVER SUBSCRIPTIONS
-- ============================================================================
CREATE POLICY driver_subscriptions_select ON driver_subscriptions 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY driver_subscriptions_insert ON driver_subscriptions 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY driver_subscriptions_update ON driver_subscriptions 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- ============================================================================
-- RLS POLICIES - DRIVER INSURANCE
-- ============================================================================
CREATE POLICY driver_insurance_select ON driver_insurance 
  FOR SELECT 
  USING (auth.uid() = user_id OR auth.uid() = verified_by);

CREATE POLICY driver_insurance_insert ON driver_insurance 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY driver_insurance_update ON driver_insurance 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- ============================================================================
-- RLS POLICIES - INTENT CACHE
-- ============================================================================
CREATE POLICY mobility_intent_cache_all ON mobility_intent_cache 
  FOR ALL 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- RLS POLICIES - LOCATION CACHE
-- ============================================================================
CREATE POLICY location_cache_all ON location_cache 
  FOR ALL 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- RLS POLICIES - TRIP RATINGS
-- ============================================================================
-- Users can see ratings they gave or received
CREATE POLICY trip_ratings_select ON trip_ratings 
  FOR SELECT 
  USING (auth.uid() IN (rater_id, rated_id));

-- Users can insert ratings for trips they're involved in
CREATE POLICY trip_ratings_insert ON trip_ratings 
  FOR INSERT 
  WITH CHECK (auth.uid() = rater_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Calculate distance between two points (Haversine formula)
CREATE OR REPLACE FUNCTION calculate_distance_km(
  lat1 NUMERIC, lng1 NUMERIC,
  lat2 NUMERIC, lng2 NUMERIC
) RETURNS NUMERIC AS $$
DECLARE
  r NUMERIC := 6371; -- Earth's radius in km
  dlat NUMERIC;
  dlng NUMERIC;
  a NUMERIC;
  c NUMERIC;
BEGIN
  dlat := radians(lat2 - lat1);
  dlng := radians(lng2 - lng1);
  
  a := sin(dlat/2) * sin(dlat/2) + 
       cos(radians(lat1)) * cos(radians(lat2)) * 
       sin(dlng/2) * sin(dlng/2);
  
  c := 2 * atan2(sqrt(a), sqrt(1-a));
  
  RETURN r * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Find nearby drivers
CREATE OR REPLACE FUNCTION find_nearby_drivers(
  p_lat NUMERIC,
  p_lng NUMERIC,
  p_vehicle_type TEXT DEFAULT NULL,
  p_radius_km NUMERIC DEFAULT 5,
  p_limit INTEGER DEFAULT 10
) RETURNS TABLE (
  driver_id UUID,
  distance_km NUMERIC,
  vehicle_type TEXT,
  vehicle_plate TEXT,
  last_seen_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ds.user_id,
    calculate_distance_km(p_lat, p_lng, ds.current_lat, ds.current_lng) as distance,
    ds.vehicle_type,
    ds.vehicle_plate,
    ds.last_seen_at
  FROM driver_status ds
  WHERE ds.is_online = true
    AND ds.current_lat IS NOT NULL
    AND ds.current_lng IS NOT NULL
    AND (p_vehicle_type IS NULL OR ds.vehicle_type = p_vehicle_type)
    AND calculate_distance_km(p_lat, p_lng, ds.current_lat, ds.current_lng) <= p_radius_km
  ORDER BY distance
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clean up expired intents and location cache
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM mobility_intent_cache WHERE expires_at < now();
  DELETE FROM location_cache WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON TABLE driver_status IS 'Tracks online drivers and their current location';
COMMENT ON TABLE mobility_matches IS 'Trip requests and lifecycle from request to completion';
COMMENT ON TABLE scheduled_trips IS 'Future trip bookings with recurrence support';
COMMENT ON TABLE saved_locations IS 'User favorite locations (Home, Work, etc.)';
COMMENT ON TABLE driver_subscriptions IS 'Driver subscription plans and features';
COMMENT ON TABLE driver_insurance IS 'Driver insurance certificates and verification status';
COMMENT ON TABLE mobility_intent_cache IS 'Temporary storage for multi-step conversation flows';
COMMENT ON TABLE location_cache IS 'Short-term location cache (5 min TTL)';
COMMENT ON TABLE trip_ratings IS 'Trip ratings from drivers and passengers';

COMMENT ON FUNCTION find_nearby_drivers IS 'Finds online drivers within specified radius';
COMMENT ON FUNCTION calculate_distance_km IS 'Calculates distance between two lat/lng coordinates using Haversine formula';
COMMENT ON FUNCTION cleanup_expired_cache IS 'Removes expired intent and location cache entries';

COMMIT;
