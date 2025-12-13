-- ============================================================================
-- COMPLETE MOBILITY SCHEMA - Production Ready
-- ============================================================================
-- Migration: 20251213091500_complete_mobility_schema.sql
-- Date: 2025-12-13
--
-- PURPOSE: Create all essential tables for mobility system from scratch
-- This replaces the broken migration chain with a single, complete schema
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: CREATE PROFILES TABLE (Foundation)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number TEXT,
  wa_id TEXT,
  full_name TEXT,
  language TEXT DEFAULT 'en' CHECK (language IN ('en', 'fr', 'rw')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_wa_id ON public.profiles(wa_id);
CREATE INDEX IF NOT EXISTS idx_profiles_phone_number ON public.profiles(phone_number);

-- ============================================================================
-- PART 2: CREATE TRIPS TABLE (Core Mobility)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT,
  ref_code TEXT NOT NULL UNIQUE DEFAULT substring(md5(random()::text) from 1 for 8),
  role TEXT NOT NULL CHECK (role IN ('driver', 'passenger')),
  vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('moto', 'car', 'lifan', 'truck', 'bus', 'van')),
  
  -- Pickup location
  pickup_lat DOUBLE PRECISION NOT NULL CHECK (pickup_lat >= -90 AND pickup_lat <= 90),
  pickup_lng DOUBLE PRECISION NOT NULL CHECK (pickup_lng >= -180 AND pickup_lng <= 180),
  pickup_text TEXT,
  pickup_radius_m INTEGER DEFAULT 1000,
  
  -- Dropoff location (optional)
  dropoff_lat DOUBLE PRECISION CHECK (dropoff_lat >= -90 AND dropoff_lat <= 90),
  dropoff_lng DOUBLE PRECISION CHECK (dropoff_lng >= -180 AND dropoff_lng <= 180),
  dropoff_text TEXT,
  dropoff_radius_m INTEGER,
  
  -- Status and scheduling
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'matched', 'completed', 'cancelled', 'expired')),
  scheduled_for TIMESTAMPTZ,
  recurrence TEXT CHECK (recurrence IN ('daily', 'weekly', 'weekdays', 'weekends')),
  
  -- Timestamps
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_trips_user_id ON public.trips(user_id);
CREATE INDEX IF NOT EXISTS idx_trips_role ON public.trips(role);
CREATE INDEX IF NOT EXISTS idx_trips_vehicle_type ON public.trips(vehicle_type);
CREATE INDEX IF NOT EXISTS idx_trips_status ON public.trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_expires_at ON public.trips(expires_at) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_trips_pickup_coords ON public.trips(pickup_lat, pickup_lng) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_trips_scheduled_for ON public.trips(scheduled_for) WHERE scheduled_for IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trips_ref_code ON public.trips(ref_code);

-- ============================================================================
-- PART 3: CREATE LOCATION CACHE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.location_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_location_cache_user_id ON public.location_cache(user_id);

-- ============================================================================
-- PART 4: CREATE FAVORITES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  address TEXT,
  category TEXT CHECK (category IN ('home', 'work', 'custom')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON public.favorites(user_id);

-- ============================================================================
-- PART 5: CREATE VEHICLES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plate_number TEXT NOT NULL,
  vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('moto', 'car', 'lifan', 'truck', 'bus', 'van')),
  make TEXT,
  model TEXT,
  color TEXT,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, plate_number)
);

CREATE INDEX IF NOT EXISTS idx_vehicles_user_id ON public.vehicles(user_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_plate_number ON public.vehicles(plate_number);

-- ============================================================================
-- PART 6: CREATE INSURANCE TABLES
-- ============================================================================

-- Insurance certificates
CREATE TABLE IF NOT EXISTS public.insurance_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  certificate_type TEXT DEFAULT 'driver' CHECK (certificate_type IN ('driver', 'vehicle')),
  insurer_name TEXT,
  policy_number TEXT,
  certificate_number TEXT,
  policy_inception DATE,
  policy_expiry DATE,
  vehicle_plate TEXT,
  make TEXT,
  model TEXT,
  certificate_media_url TEXT,
  ocr_provider TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insurance_certificates_user_id ON public.insurance_certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_insurance_certificates_status ON public.insurance_certificates(status);

-- Insurance quote requests
CREATE TABLE IF NOT EXISTS public.insurance_quote_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'quoted', 'approved', 'rejected')),
  quote_details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insurance_quote_requests_profile_id ON public.insurance_quote_requests(profile_id);
CREATE INDEX IF NOT EXISTS idx_insurance_quote_requests_status ON public.insurance_quote_requests(status);

-- ============================================================================
-- PART 7: CREATE AI AGENT SESSIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL CHECK (agent_type IN ('mobility', 'insurance', 'buy_sell', 'support')),
  session_data JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 hour')
);

CREATE INDEX IF NOT EXISTS idx_ai_agent_sessions_user_id ON public.ai_agent_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_sessions_agent_type ON public.ai_agent_sessions(agent_type);
CREATE INDEX IF NOT EXISTS idx_ai_agent_sessions_status ON public.ai_agent_sessions(status);

-- ============================================================================
-- PART 8: CREATE SUPPORT TABLES
-- ============================================================================

-- Menu items
CREATE TABLE IF NOT EXISTS public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icon TEXT,
  action TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  parent_id UUID REFERENCES public.menu_items(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Admin contacts
CREATE TABLE IF NOT EXISTS public.admin_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_contacts_category ON public.admin_contacts(category);

-- ============================================================================
-- PART 9: CREATE TRIGGERS
-- ============================================================================

-- Profiles updated_at trigger
CREATE OR REPLACE FUNCTION public.profiles_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_set_updated_at();

-- Trips updated_at trigger
CREATE OR REPLACE FUNCTION public.trips_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trips_set_updated_at ON public.trips;
CREATE TRIGGER trips_set_updated_at
  BEFORE UPDATE ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.trips_set_updated_at();

-- ============================================================================
-- PART 10: CREATE RPC FUNCTIONS
-- ============================================================================

-- Haversine distance function
CREATE OR REPLACE FUNCTION public.haversine_distance(
  lat1 DOUBLE PRECISION,
  lon1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION,
  lon2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION AS $$
DECLARE
  r DOUBLE PRECISION := 6371; -- Earth radius in km
  dlat DOUBLE PRECISION;
  dlon DOUBLE PRECISION;
  a DOUBLE PRECISION;
  c DOUBLE PRECISION;
BEGIN
  dlat := radians(lat2 - lat1);
  dlon := radians(lon2 - lon1);
  a := sin(dlat/2) * sin(dlat/2) + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2) * sin(dlon/2);
  c := 2 * atan2(sqrt(a), sqrt(1-a));
  RETURN r * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create trip function
CREATE OR REPLACE FUNCTION public.create_trip(
  _user_id UUID,
  _phone TEXT,
  _role TEXT,
  _vehicle TEXT,
  _pickup_lat DOUBLE PRECISION,
  _pickup_lng DOUBLE PRECISION,
  _pickup_text TEXT DEFAULT NULL,
  _dropoff_lat DOUBLE PRECISION DEFAULT NULL,
  _dropoff_lng DOUBLE PRECISION DEFAULT NULL,
  _dropoff_text TEXT DEFAULT NULL,
  _scheduled_for TIMESTAMPTZ DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  _trip_id UUID;
BEGIN
  INSERT INTO public.trips (
    user_id, phone, role, vehicle_type,
    pickup_lat, pickup_lng, pickup_text,
    dropoff_lat, dropoff_lng, dropoff_text,
    scheduled_for
  ) VALUES (
    _user_id, _phone, _role, _vehicle,
    _pickup_lat, _pickup_lng, _pickup_text,
    _dropoff_lat, _dropoff_lng, _dropoff_text,
    _scheduled_for
  )
  RETURNING id INTO _trip_id;
  
  RETURN _trip_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Find matches function
CREATE OR REPLACE FUNCTION public.find_matches(
  _trip_id UUID,
  _limit INTEGER DEFAULT 9
) RETURNS TABLE (
  trip_id UUID,
  user_id UUID,
  phone TEXT,
  ref_code TEXT,
  role TEXT,
  vehicle TEXT,
  distance_km NUMERIC,
  pickup_text TEXT,
  dropoff_text TEXT,
  scheduled_for TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
) AS $$
DECLARE
  _my_trip RECORD;
  _opposite_role TEXT;
BEGIN
  -- Get the requesting trip details
  SELECT * INTO _my_trip FROM public.trips WHERE id = _trip_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trip not found: %', _trip_id;
  END IF;
  
  -- Determine opposite role
  _opposite_role := CASE WHEN _my_trip.role = 'driver' THEN 'passenger' ELSE 'driver' END;
  
  -- Find matching trips within 10km
  RETURN QUERY
  SELECT 
    t.id AS trip_id,
    t.user_id,
    t.phone,
    t.ref_code,
    t.role,
    t.vehicle_type AS vehicle,
    ROUND(public.haversine_distance(
      _my_trip.pickup_lat, _my_trip.pickup_lng,
      t.pickup_lat, t.pickup_lng
    )::numeric, 2) AS distance_km,
    t.pickup_text,
    t.dropoff_text,
    t.scheduled_for,
    t.created_at,
    t.expires_at
  FROM public.trips t
  WHERE t.role = _opposite_role
    AND t.vehicle_type = _my_trip.vehicle_type
    AND t.status = 'open'
    AND t.expires_at > NOW()
    AND t.id != _trip_id
    AND public.haversine_distance(
      _my_trip.pickup_lat, _my_trip.pickup_lng,
      t.pickup_lat, t.pickup_lng
    ) <= 10
  ORDER BY distance_km ASC
  LIMIT _limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- PART 11: ENABLE RLS
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_quote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service role has full access to profiles" ON public.profiles FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- RLS Policies for trips
CREATE POLICY "Users can view own trips" ON public.trips FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own trips" ON public.trips FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own trips" ON public.trips FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service role has full access to trips" ON public.trips FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- RLS Policies for other tables (service role only for simplicity)
CREATE POLICY "Service role full access location_cache" ON public.location_cache FOR ALL USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Service role full access favorites" ON public.favorites FOR ALL USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Service role full access vehicles" ON public.vehicles FOR ALL USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Service role full access insurance_certificates" ON public.insurance_certificates FOR ALL USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Service role full access insurance_quote_requests" ON public.insurance_quote_requests FOR ALL USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Service role full access ai_agent_sessions" ON public.ai_agent_sessions FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- PART 12: GRANT PERMISSIONS
-- ============================================================================

GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;

-- ============================================================================
-- PART 13: TABLE COMMENTS
-- ============================================================================

COMMENT ON TABLE public.profiles IS 'User profiles linked to auth.users';
COMMENT ON TABLE public.trips IS 'Core mobility trips table - drivers and passengers';
COMMENT ON TABLE public.location_cache IS 'Cached user locations for quick access';
COMMENT ON TABLE public.favorites IS 'User favorite locations (home, work, etc)';
COMMENT ON TABLE public.vehicles IS 'User registered vehicles';
COMMENT ON TABLE public.insurance_certificates IS 'Insurance certificates (driver and vehicle)';
COMMENT ON TABLE public.insurance_quote_requests IS 'Insurance quote requests from users';
COMMENT ON TABLE public.ai_agent_sessions IS 'AI agent conversation sessions';

COMMIT;
