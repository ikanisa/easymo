-- ============================================================================
-- MOBILITY WEBHOOK COMPREHENSIVE TABLES
-- ============================================================================
-- Migration for wa-webhook-mobility microservice
-- Includes: driver status, matches, scheduled trips, saved locations,
--           subscriptions, insurance, licenses, payments, refunds
-- ============================================================================

BEGIN;

-- ============================================================================
-- DRIVER STATUS MANAGEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS driver_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  is_online BOOLEAN DEFAULT false,
  current_lat NUMERIC(10, 8),
  current_lng NUMERIC(11, 8),
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  vehicle_type TEXT CHECK (vehicle_type IN ('moto', 'car', 'van', 'bus')),
  vehicle_plate TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_driver_status_online 
ON driver_status(is_online, vehicle_type) WHERE is_online = true;

CREATE INDEX IF NOT EXISTS idx_driver_status_location 
ON driver_status USING GIST (ll_to_earth(current_lat, current_lng))
WHERE is_online = true AND current_lat IS NOT NULL AND current_lng IS NOT NULL;

-- ============================================================================
-- MOBILITY MATCHES (DRIVER-PASSENGER MATCHING)
-- ============================================================================

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
    'pending', 'accepted', 'driver_arriving', 'in_progress', 
    'completed', 'cancelled', 'payment_pending', 'payment_confirmed'
  )),
  distance_km NUMERIC(10, 2),
  eta_minutes INTEGER,
  fare_estimate NUMERIC(10, 2),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN (
    'pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled'
  )),
  payment_method TEXT,
  payment_amount NUMERIC(10, 2),
  payment_currency TEXT DEFAULT 'RWF',
  paid_at TIMESTAMPTZ,
  driver_rating INTEGER CHECK (driver_rating BETWEEN 1 AND 5),
  passenger_rating INTEGER CHECK (passenger_rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mobility_matches_driver ON mobility_matches(driver_id);
CREATE INDEX IF NOT EXISTS idx_mobility_matches_passenger ON mobility_matches(passenger_id);
CREATE INDEX IF NOT EXISTS idx_mobility_matches_status ON mobility_matches(status);
CREATE INDEX IF NOT EXISTS idx_mobility_matches_created ON mobility_matches(created_at DESC);

-- ============================================================================
-- SCHEDULED TRIPS
-- ============================================================================

CREATE TABLE IF NOT EXISTS scheduled_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
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
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_trips_user ON scheduled_trips(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_trips_time ON scheduled_trips(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_scheduled_trips_status ON scheduled_trips(status) WHERE status = 'active';

-- ============================================================================
-- SAVED LOCATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS saved_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  lat NUMERIC(10, 8) NOT NULL,
  lng NUMERIC(11, 8) NOT NULL,
  address TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, label)
);

CREATE INDEX IF NOT EXISTS idx_saved_locations_user ON saved_locations(user_id);

-- ============================================================================
-- DRIVER SUBSCRIPTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS driver_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN (
    'active', 'expired', 'cancelled', 'suspended'
  )),
  monthly_fee NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'RWF',
  starts_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  auto_renew BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_subscriptions_user ON driver_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_driver_subscriptions_status ON driver_subscriptions(status);

-- ============================================================================
-- DRIVER INSURANCE CERTIFICATES
-- ============================================================================

CREATE TABLE IF NOT EXISTS driver_insurance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  vehicle_plate TEXT NOT NULL,
  insurer_name TEXT NOT NULL,
  policy_number TEXT NOT NULL,
  policy_expiry DATE NOT NULL,
  certificate_path TEXT,
  media_id TEXT,
  ocr_provider TEXT CHECK (ocr_provider IN ('openai', 'gemini')),
  ocr_raw_data JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'verified', 'expired', 'rejected'
  )),
  verified_at TIMESTAMPTZ,
  rejected_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_insurance_user ON driver_insurance(user_id);
CREATE INDEX IF NOT EXISTS idx_driver_insurance_plate ON driver_insurance(vehicle_plate);
CREATE INDEX IF NOT EXISTS idx_driver_insurance_status ON driver_insurance(status);
CREATE INDEX IF NOT EXISTS idx_driver_insurance_expiry ON driver_insurance(policy_expiry);

-- ============================================================================
-- DRIVER LICENSES (defined in 20251126040000_mobility_payment_verification.sql)
-- ============================================================================
-- Skipped to avoid duplication

-- ============================================================================
-- INTENT CACHE
-- ============================================================================

CREATE TABLE IF NOT EXISTS mobility_intent_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  intent_type TEXT NOT NULL,
  intent_data JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, intent_type)
);

CREATE INDEX IF NOT EXISTS idx_mobility_intent_user ON mobility_intent_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_mobility_intent_expires ON mobility_intent_cache(expires_at);

-- ============================================================================
-- LOCATION CACHE
-- ============================================================================

CREATE TABLE IF NOT EXISTS location_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  lat NUMERIC(10, 8) NOT NULL,
  lng NUMERIC(11, 8) NOT NULL,
  address TEXT,
  cached_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_location_cache_user ON location_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_location_cache_expires ON location_cache(expires_at);

-- ============================================================================
-- MOMO TRANSACTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS momo_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  trip_id UUID REFERENCES mobility_matches(id),
  phone_number TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'RWF',
  transaction_ref TEXT UNIQUE,
  payment_method TEXT DEFAULT 'momo_ussd',
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'success', 'failed', 'cancelled'
  )),
  external_ref TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_momo_transactions_user ON momo_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_momo_transactions_trip ON momo_transactions(trip_id);
CREATE INDEX IF NOT EXISTS idx_momo_transactions_phone ON momo_transactions(phone_number);
CREATE INDEX IF NOT EXISTS idx_momo_transactions_status ON momo_transactions(status);
CREATE INDEX IF NOT EXISTS idx_momo_transactions_created ON momo_transactions(created_at DESC);

-- ============================================================================
-- MOMO REFUNDS
-- ============================================================================

CREATE TABLE IF NOT EXISTS momo_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  trip_id UUID REFERENCES mobility_matches(id),
  transaction_id UUID REFERENCES momo_transactions(id),
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'RWF',
  reason TEXT NOT NULL,
  payment_method TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'processing', 'completed', 'rejected'
  )),
  processed_by UUID REFERENCES profiles(user_id),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_momo_refunds_user ON momo_refunds(user_id);
CREATE INDEX IF NOT EXISTS idx_momo_refunds_trip ON momo_refunds(trip_id);
CREATE INDEX IF NOT EXISTS idx_momo_refunds_status ON momo_refunds(status);

-- ============================================================================
-- RPC FUNCTIONS
-- ============================================================================

-- Find nearby drivers
CREATE OR REPLACE FUNCTION find_nearby_drivers(
  p_lat NUMERIC,
  p_lng NUMERIC,
  p_vehicle_type TEXT,
  p_radius_km NUMERIC DEFAULT 5
)
RETURNS TABLE (
  user_id UUID,
  phone_number TEXT,
  display_name TEXT,
  vehicle_type TEXT,
  vehicle_plate TEXT,
  distance_km NUMERIC,
  last_seen_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ds.user_id,
    p.phone_number,
    p.display_name,
    ds.vehicle_type,
    ds.vehicle_plate,
    earth_distance(
      ll_to_earth(ds.current_lat, ds.current_lng),
      ll_to_earth(p_lat, p_lng)
    ) / 1000 AS distance_km,
    ds.last_seen_at
  FROM driver_status ds
  JOIN profiles p ON p.user_id = ds.user_id
  WHERE ds.is_online = true
    AND (p_vehicle_type IS NULL OR ds.vehicle_type = p_vehicle_type)
    AND ds.current_lat IS NOT NULL
    AND ds.current_lng IS NOT NULL
    AND earth_distance(
      ll_to_earth(ds.current_lat, ds.current_lng),
      ll_to_earth(p_lat, p_lng)
    ) <= p_radius_km * 1000
  ORDER BY distance_km ASC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if driver insurance is valid
CREATE OR REPLACE FUNCTION is_driver_insurance_valid(
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM driver_insurance
  WHERE user_id = p_user_id
    AND status = 'verified'
    AND policy_expiry >= CURRENT_DATE;
  
  RETURN v_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get active driver insurance
CREATE OR REPLACE FUNCTION get_driver_active_insurance(
  p_user_id UUID
)
RETURNS TABLE (
  id UUID,
  vehicle_plate TEXT,
  insurer_name TEXT,
  policy_number TEXT,
  policy_expiry DATE,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    di.id,
    di.vehicle_plate,
    di.insurer_name,
    di.policy_number,
    di.policy_expiry,
    di.status
  FROM driver_insurance di
  WHERE di.user_id = p_user_id
    AND di.status = 'verified'
    AND di.policy_expiry >= CURRENT_DATE
  ORDER BY di.policy_expiry DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get driver verification status
CREATE OR REPLACE FUNCTION get_driver_verification_status(
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_license_status TEXT;
  v_license_expiry DATE;
  v_license_number TEXT;
  v_insurance_status TEXT;
  v_insurance_expiry DATE;
  v_vehicle_plate TEXT;
  v_overall_status TEXT;
BEGIN
  -- Check license
  SELECT status, expiry_date, license_number
  INTO v_license_status, v_license_expiry, v_license_number
  FROM driver_licenses
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- Check insurance
  SELECT status, policy_expiry, vehicle_plate
  INTO v_insurance_status, v_insurance_expiry, v_vehicle_plate
  FROM driver_insurance
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- Determine overall status
  IF v_license_status = 'verified' AND v_insurance_status = 'verified' THEN
    v_overall_status := 'verified';
  ELSIF v_license_status IN ('pending', 'rejected') OR v_insurance_status IN ('pending', 'rejected') THEN
    v_overall_status := 'in_progress';
  ELSE
    v_overall_status := 'pending';
  END IF;

  RETURN jsonb_build_object(
    'overallStatus', v_overall_status,
    'license', jsonb_build_object(
      'status', COALESCE(v_license_status, 'pending'),
      'expiryDate', v_license_expiry,
      'licenseNumber', v_license_number
    ),
    'insurance', jsonb_build_object(
      'status', COALESCE(v_insurance_status, 'pending'),
      'expiryDate', v_insurance_expiry,
      'vehiclePlate', v_vehicle_plate
    ),
    'backgroundCheck', jsonb_build_object(
      'status', 'pending'
    ),
    'vehicleInspection', jsonb_build_object(
      'status', 'pending'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update driver location
CREATE OR REPLACE FUNCTION update_driver_location(
  p_user_id UUID,
  p_lat NUMERIC,
  p_lng NUMERIC
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO driver_status (user_id, current_lat, current_lng, last_seen_at)
  VALUES (p_user_id, p_lat, p_lng, now())
  ON CONFLICT (user_id)
  DO UPDATE SET
    current_lat = p_lat,
    current_lng = p_lng,
    last_seen_at = now(),
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set driver online status
CREATE OR REPLACE FUNCTION set_driver_online(
  p_user_id UUID,
  p_is_online BOOLEAN,
  p_lat NUMERIC DEFAULT NULL,
  p_lng NUMERIC DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO driver_status (user_id, is_online, current_lat, current_lng, last_seen_at)
  VALUES (p_user_id, p_is_online, p_lat, p_lng, now())
  ON CONFLICT (user_id)
  DO UPDATE SET
    is_online = p_is_online,
    current_lat = COALESCE(p_lat, driver_status.current_lat),
    current_lng = COALESCE(p_lng, driver_status.current_lng),
    last_seen_at = now(),
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE driver_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE mobility_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_insurance ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE mobility_intent_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE momo_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE momo_refunds ENABLE ROW LEVEL SECURITY;

-- Driver status policies
CREATE POLICY "Users can view own driver status" ON driver_status FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own driver status" ON driver_status FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service role full access" ON driver_status FOR ALL USING (auth.role() = 'service_role');

-- Mobility matches policies
CREATE POLICY "Users can view own matches" ON mobility_matches FOR SELECT 
  USING (auth.uid() = driver_id OR auth.uid() = passenger_id);
CREATE POLICY "Service role full access matches" ON mobility_matches FOR ALL 
  USING (auth.role() = 'service_role');

-- Scheduled trips policies
CREATE POLICY "Users can manage own scheduled trips" ON scheduled_trips FOR ALL 
  USING (auth.uid() = user_id);
CREATE POLICY "Service role full access trips" ON scheduled_trips FOR ALL 
  USING (auth.role() = 'service_role');

-- Similar policies for other tables...
CREATE POLICY "Users can manage own saved locations" ON saved_locations FOR ALL 
  USING (auth.uid() = user_id);
CREATE POLICY "Users can view own subscriptions" ON driver_subscriptions FOR SELECT 
  USING (auth.uid() = user_id);
CREATE POLICY "Users can view own insurance" ON driver_insurance FOR SELECT 
  USING (auth.uid() = user_id);
CREATE POLICY "Users can view own license" ON driver_licenses FOR SELECT 
  USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own intent cache" ON mobility_intent_cache FOR ALL 
  USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own location cache" ON location_cache FOR ALL 
  USING (auth.uid() = user_id);
CREATE POLICY "Users can view own transactions" ON momo_transactions FOR SELECT 
  USING (auth.uid() = user_id);
CREATE POLICY "Users can view own refunds" ON momo_refunds FOR SELECT 
  USING (auth.uid() = user_id);

COMMIT;
