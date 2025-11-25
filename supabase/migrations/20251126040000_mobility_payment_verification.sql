-- ============================================================================
-- MOBILITY PAYMENT & DRIVER VERIFICATION TABLES
-- ============================================================================
-- Adds support for:
-- - Trip payment tracking (MOMO USSD workflow)
-- - Driver license verification (OCR)
-- - Driver insurance certificates (OCR)
-- - Vehicle inspections
-- - Complete driver verification workflow
-- ============================================================================

BEGIN;

-- ============================================================================
-- DRIVER LICENSES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS driver_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  
  -- License data (extracted via OCR)
  license_number TEXT NOT NULL,
  full_name TEXT NOT NULL,
  date_of_birth DATE,
  issue_date DATE,
  expiry_date DATE NOT NULL,
  license_class TEXT NOT NULL,
  nationality TEXT,
  address TEXT,
  gender TEXT CHECK (gender IN ('M', 'F')),
  blood_group TEXT,
  
  -- Media & OCR metadata
  license_media_url TEXT,
  license_media_id TEXT,
  ocr_provider TEXT CHECK (ocr_provider IN ('openai', 'gemini')),
  raw_ocr_data JSONB,
  
  -- Verification status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  is_validated BOOLEAN DEFAULT false,
  validated_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CONSTRAINT unique_license_number UNIQUE (license_number)
);

-- Indexes
CREATE INDEX idx_driver_licenses_user_id ON driver_licenses(user_id);
CREATE INDEX idx_driver_licenses_status ON driver_licenses(status);
CREATE INDEX idx_driver_licenses_expiry ON driver_licenses(expiry_date);

-- ============================================================================
-- DRIVER INSURANCE CERTIFICATES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS driver_insurance_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  
  -- Insurance data (extracted via OCR)
  insurer_name TEXT NOT NULL,
  policy_number TEXT NOT NULL,
  certificate_number TEXT NOT NULL,
  policy_inception DATE NOT NULL,
  policy_expiry DATE NOT NULL,
  carte_jaune_number TEXT,
  carte_jaune_expiry DATE,
  
  -- Vehicle data
  vehicle_plate TEXT NOT NULL,
  make TEXT,
  model TEXT,
  vehicle_year INTEGER,
  vin_chassis TEXT,
  usage TEXT,
  licensed_to_carry INTEGER,
  
  -- Media & OCR metadata
  certificate_media_url TEXT,
  certificate_media_id TEXT,
  ocr_provider TEXT CHECK (ocr_provider IN ('openai', 'gemini')),
  raw_ocr_data JSONB,
  
  -- Verification status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  is_validated BOOLEAN DEFAULT false,
  validated_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_driver_insurance_user_id ON driver_insurance_certificates(user_id);
CREATE INDEX idx_driver_insurance_vehicle_plate ON driver_insurance_certificates(vehicle_plate);
CREATE INDEX idx_driver_insurance_status ON driver_insurance_certificates(status);
CREATE INDEX idx_driver_insurance_expiry ON driver_insurance_certificates(policy_expiry);

-- ============================================================================
-- VEHICLE INSPECTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS vehicle_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  
  -- Vehicle details
  vehicle_plate TEXT NOT NULL,
  inspection_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  inspector_name TEXT,
  inspection_center TEXT,
  
  -- Inspection results
  status TEXT NOT NULL CHECK (status IN ('passed', 'failed', 'pending')),
  notes TEXT,
  
  -- Media
  certificate_media_url TEXT,
  certificate_media_id TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_vehicle_inspections_user_id ON vehicle_inspections(user_id);
CREATE INDEX idx_vehicle_inspections_vehicle_plate ON vehicle_inspections(vehicle_plate);
CREATE INDEX idx_vehicle_inspections_status ON vehicle_inspections(status);

-- ============================================================================
-- TRIP PAYMENT REQUESTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS trip_payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES mobility_matches(id) ON DELETE CASCADE,
  payer_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  
  -- Payment details
  recipient_phone TEXT NOT NULL,
  amount_rwf INTEGER NOT NULL,
  ussd_code TEXT NOT NULL,
  qr_url TEXT,
  
  -- Payment status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'skipped')),
  payment_reference TEXT,
  confirmed_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_trip_payment_requests_trip_id ON trip_payment_requests(trip_id);
CREATE INDEX idx_trip_payment_requests_payer_id ON trip_payment_requests(payer_id);
CREATE INDEX idx_trip_payment_requests_status ON trip_payment_requests(status);

-- ============================================================================
-- UPDATE MOBILITY_MATCHES TABLE (add payment columns)
-- ============================================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'mobility_matches' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE mobility_matches 
    ADD COLUMN payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'pending_verification', 'skipped')),
    ADD COLUMN payment_reference TEXT,
    ADD COLUMN payment_confirmed_at TIMESTAMPTZ;
  END IF;
END $$;

-- ============================================================================
-- UPDATE PROFILES TABLE (add verification flags)
-- ============================================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'driver_license_number'
  ) THEN
    ALTER TABLE profiles 
    ADD COLUMN driver_license_number TEXT,
    ADD COLUMN driver_license_verified BOOLEAN DEFAULT false,
    ADD COLUMN background_check_status TEXT CHECK (background_check_status IN ('pending', 'in_progress', 'cleared', 'failed')),
    ADD COLUMN background_check_date DATE;
  END IF;
END $$;

-- ============================================================================
-- RPC FUNCTIONS
-- ============================================================================

-- Check if driver has valid insurance
CREATE OR REPLACE FUNCTION is_driver_insurance_valid(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_has_valid BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM driver_insurance_certificates
    WHERE user_id = p_user_id
      AND status = 'approved'
      AND policy_expiry >= CURRENT_DATE
  ) INTO v_has_valid;
  
  RETURN v_has_valid;
END;
$$;

-- Get active driver insurance
CREATE OR REPLACE FUNCTION get_driver_active_insurance(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  vehicle_plate TEXT,
  insurer_name TEXT,
  policy_number TEXT,
  policy_expiry DATE,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dic.id,
    dic.vehicle_plate,
    dic.insurer_name,
    dic.policy_number,
    dic.policy_expiry,
    dic.status
  FROM driver_insurance_certificates dic
  WHERE dic.user_id = p_user_id
    AND dic.status = 'approved'
    AND dic.policy_expiry >= CURRENT_DATE
  ORDER BY dic.policy_expiry DESC
  LIMIT 1;
END;
$$;

-- Check for duplicate vehicle plate
CREATE OR REPLACE FUNCTION check_duplicate_vehicle_plate(
  p_plate TEXT,
  p_exclude_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM driver_insurance_certificates
    WHERE vehicle_plate = UPPER(p_plate)
      AND status = 'approved'
      AND policy_expiry >= CURRENT_DATE
      AND (p_exclude_user_id IS NULL OR user_id != p_exclude_user_id)
  ) INTO v_exists;
  
  RETURN v_exists;
END;
$$;

-- Check if driver has valid license
CREATE OR REPLACE FUNCTION is_driver_license_valid(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_has_valid BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM driver_licenses
    WHERE user_id = p_user_id
      AND status = 'approved'
      AND expiry_date >= CURRENT_DATE
  ) INTO v_has_valid;
  
  RETURN v_has_valid;
END;
$$;

-- Get driver verification status
CREATE OR REPLACE FUNCTION get_driver_verification_status(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_license_valid BOOLEAN;
  v_insurance_valid BOOLEAN;
  v_inspection_valid BOOLEAN;
  v_background_cleared BOOLEAN;
  v_result JSONB;
BEGIN
  -- Check license
  v_license_valid := is_driver_license_valid(p_user_id);
  
  -- Check insurance
  v_insurance_valid := is_driver_insurance_valid(p_user_id);
  
  -- Check vehicle inspection (optional)
  SELECT EXISTS (
    SELECT 1 
    FROM vehicle_inspections
    WHERE user_id = p_user_id
      AND status = 'passed'
      AND expiry_date >= CURRENT_DATE
  ) INTO v_inspection_valid;
  
  -- Check background check
  SELECT background_check_status = 'cleared'
  FROM profiles
  WHERE user_id = p_user_id
  INTO v_background_cleared;
  
  v_result := jsonb_build_object(
    'license_verified', v_license_valid,
    'insurance_verified', v_insurance_valid,
    'vehicle_inspected', v_inspection_valid,
    'background_check', COALESCE(v_background_cleared, false),
    'overall_complete', v_license_valid AND v_insurance_valid
  );
  
  RETURN v_result;
END;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE driver_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_insurance_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_payment_requests ENABLE ROW LEVEL SECURITY;

-- Policies for driver_licenses
CREATE POLICY driver_licenses_select_own ON driver_licenses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY driver_licenses_insert_own ON driver_licenses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policies for driver_insurance_certificates
CREATE POLICY driver_insurance_select_own ON driver_insurance_certificates
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY driver_insurance_insert_own ON driver_insurance_certificates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policies for vehicle_inspections
CREATE POLICY vehicle_inspections_select_own ON vehicle_inspections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY vehicle_inspections_insert_own ON vehicle_inspections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policies for trip_payment_requests
CREATE POLICY trip_payment_requests_select_own ON trip_payment_requests
  FOR SELECT USING (auth.uid() = payer_id);

CREATE POLICY trip_payment_requests_insert_own ON trip_payment_requests
  FOR INSERT WITH CHECK (auth.uid() = payer_id);

COMMIT;
