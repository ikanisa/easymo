-- Insurance Upload System Fixes - Database Migration
-- Creates vehicles, vehicle_ownerships, and insurance_manual_reviews tables
-- Adds RPC functions for vehicle management

BEGIN;

-- ============================================================================
-- 1. CREATE VEHICLES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_plate TEXT UNIQUE NOT NULL,
  make TEXT,
  model TEXT,
  vehicle_year INTEGER,
  vin_chassis TEXT UNIQUE,
  color TEXT,
  capacity INTEGER,
  vehicle_type TEXT, -- moto, car, van, bus
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_vehicles_plate ON public.vehicles(registration_plate);
CREATE INDEX idx_vehicles_vin ON public.vehicles(vin_chassis) WHERE vin_chassis IS NOT NULL;
CREATE INDEX idx_vehicles_status ON public.vehicles(status);
CREATE INDEX idx_vehicles_type ON public.vehicles(vehicle_type);

-- Comments
COMMENT ON TABLE public.vehicles IS 'Master vehicle registry - tracks all vehicles in the system';
COMMENT ON COLUMN public.vehicles.registration_plate IS 'Vehicle registration plate (e.g., RAB 123 A)';
COMMENT ON COLUMN public.vehicles.vin_chassis IS 'Vehicle Identification Number (17 characters)';
COMMENT ON COLUMN public.vehicles.vehicle_type IS 'Type of vehicle: moto, car, van, bus';
COMMENT ON COLUMN public.vehicles.status IS 'Vehicle status: active, inactive, or suspended';

-- ============================================================================
-- 2. CREATE VEHICLE OWNERSHIPS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.vehicle_ownerships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  insurance_certificate_id UUID REFERENCES public.driver_insurance_certificates(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  is_current BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_vehicle_ownerships_vehicle ON public.vehicle_ownerships(vehicle_id);
CREATE INDEX idx_vehicle_ownerships_user ON public.vehicle_ownerships(user_id);
CREATE INDEX idx_vehicle_ownerships_current ON public.vehicle_ownerships(is_current) WHERE is_current = TRUE;

-- Unique constraint: one current ownership per vehicle
CREATE UNIQUE INDEX idx_vehicle_ownerships_vehicle_current 
  ON public.vehicle_ownerships(vehicle_id) 
  WHERE is_current = TRUE;

-- Comments
COMMENT ON TABLE public.vehicle_ownerships IS 'Tracks vehicle ownership history and current owners';
COMMENT ON COLUMN public.vehicle_ownerships.is_current IS 'TRUE if this is the current active ownership';

-- ============================================================================
-- 3. CREATE INSURANCE MANUAL REVIEWS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.insurance_manual_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_id TEXT,
  ocr_attempts INTEGER DEFAULT 0,
  last_ocr_error TEXT,
  raw_ocr_data JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'approved', 'rejected')),
  assigned_to UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_insurance_manual_reviews_user ON public.insurance_manual_reviews(user_id);
CREATE INDEX idx_insurance_manual_reviews_status ON public.insurance_manual_reviews(status);
CREATE INDEX idx_insurance_manual_reviews_assigned ON public.insurance_manual_reviews(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_insurance_manual_reviews_created ON public.insurance_manual_reviews(created_at DESC);

-- Comments
COMMENT ON TABLE public.insurance_manual_reviews IS 'Queue for insurance certificates that failed OCR and need manual review';
COMMENT ON COLUMN public.insurance_manual_reviews.ocr_attempts IS 'Number of OCR attempts made before moving to manual review';

-- ============================================================================
-- 4. MODIFY DRIVER_INSURANCE_CERTIFICATES TABLE
-- ============================================================================

-- Add vehicle_id column
ALTER TABLE public.driver_insurance_certificates
  ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL;

-- Add expiry reminder column
ALTER TABLE public.driver_insurance_certificates
  ADD COLUMN IF NOT EXISTS expiry_reminder_sent_at TIMESTAMPTZ;

-- Change default status to 'pending' (for new inserts only)
ALTER TABLE public.driver_insurance_certificates
  ALTER COLUMN status SET DEFAULT 'pending';

-- Add index on vehicle_id
CREATE INDEX IF NOT EXISTS idx_driver_insurance_vehicle 
  ON public.driver_insurance_certificates(vehicle_id) 
  WHERE vehicle_id IS NOT NULL;

-- ============================================================================
-- 5. RPC FUNCTION: upsert_vehicle
-- ============================================================================
CREATE OR REPLACE FUNCTION public.upsert_vehicle(
  p_plate TEXT,
  p_make TEXT DEFAULT NULL,
  p_model TEXT DEFAULT NULL,
  p_year INTEGER DEFAULT NULL,
  p_vin TEXT DEFAULT NULL,
  p_vehicle_type TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_vehicle_id UUID;
BEGIN
  -- Normalize plate to uppercase
  p_plate := UPPER(TRIM(p_plate));
  
  -- Insert or update vehicle
  INSERT INTO public.vehicles (
    registration_plate,
    make,
    model,
    vehicle_year,
    vin_chassis,
    vehicle_type,
    updated_at
  ) VALUES (
    p_plate,
    p_make,
    p_model,
    p_year,
    p_vin,
    p_vehicle_type,
    NOW()
  )
  ON CONFLICT (registration_plate) DO UPDATE
  SET 
    make = COALESCE(EXCLUDED.make, vehicles.make),
    model = COALESCE(EXCLUDED.model, vehicles.model),
    vehicle_year = COALESCE(EXCLUDED.vehicle_year, vehicles.vehicle_year),
    vin_chassis = COALESCE(EXCLUDED.vin_chassis, vehicles.vin_chassis),
    vehicle_type = COALESCE(EXCLUDED.vehicle_type, vehicles.vehicle_type),
    updated_at = NOW()
  RETURNING id INTO v_vehicle_id;
  
  RETURN v_vehicle_id;
END;
$$;

-- ============================================================================
-- 6. RPC FUNCTION: create_vehicle_ownership
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_vehicle_ownership(
  p_vehicle_id UUID,
  p_user_id UUID,
  p_certificate_id UUID DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- End previous ownership for this vehicle
  UPDATE public.vehicle_ownerships
  SET 
    is_current = FALSE,
    ended_at = NOW()
  WHERE vehicle_id = p_vehicle_id
    AND is_current = TRUE;
  
  -- Create new ownership
  INSERT INTO public.vehicle_ownerships (
    vehicle_id,
    user_id,
    insurance_certificate_id,
    is_current,
    started_at
  ) VALUES (
    p_vehicle_id,
    p_user_id,
    p_certificate_id,
    TRUE,
    NOW()
  );
END;
$$;

-- ============================================================================
-- 7. RPC FUNCTION: get_pending_certificates
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_pending_certificates(
  p_limit INTEGER DEFAULT 50
) RETURNS TABLE (
  id UUID,
  user_id UUID,
  vehicle_plate TEXT,
  insurer_name TEXT,
  policy_number TEXT,
  policy_expiry DATE,
  created_at TIMESTAMPTZ,
  user_phone TEXT,
  user_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dic.id,
    dic.user_id,
    dic.vehicle_plate,
    dic.insurer_name,
    dic.policy_number,
    dic.policy_expiry,
    dic.created_at,
    COALESCE(p.phone_number, p.wa_id) AS user_phone,
    p.full_name AS user_name
  FROM public.driver_insurance_certificates dic
  INNER JOIN public.profiles p ON p.user_id = dic.user_id
  WHERE dic.status = 'pending'
  ORDER BY dic.created_at ASC
  LIMIT p_limit;
END;
$$;

-- ============================================================================
-- 8. RPC FUNCTION: get_manual_reviews
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_manual_reviews(
  p_status TEXT DEFAULT 'pending',
  p_limit INTEGER DEFAULT 50
) RETURNS TABLE (
  id UUID,
  user_id UUID,
  media_url TEXT,
  ocr_attempts INTEGER,
  last_ocr_error TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  user_phone TEXT,
  user_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    imr.id,
    imr.user_id,
    imr.media_url,
    imr.ocr_attempts,
    imr.last_ocr_error,
    imr.status,
    imr.created_at,
    COALESCE(p.phone_number, p.wa_id) AS user_phone,
    p.full_name AS user_name
  FROM public.insurance_manual_reviews imr
  INNER JOIN public.profiles p ON p.user_id = imr.user_id
  WHERE imr.status = p_status
  ORDER BY imr.created_at ASC
  LIMIT p_limit;
END;
$$;

-- ============================================================================
-- 9. RPC FUNCTION: get_expiring_insurance
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_expiring_insurance(
  p_days_before INTEGER DEFAULT 7
) RETURNS TABLE (
  id UUID,
  user_id UUID,
  vehicle_plate TEXT,
  policy_expiry DATE,
  user_phone TEXT,
  user_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dic.id,
    dic.user_id,
    dic.vehicle_plate,
    dic.policy_expiry,
    COALESCE(p.phone_number, p.wa_id) AS user_phone,
    p.full_name AS user_name
  FROM public.driver_insurance_certificates dic
  INNER JOIN public.profiles p ON p.user_id = dic.user_id
  WHERE dic.status = 'approved'
    AND dic.policy_expiry BETWEEN CURRENT_DATE AND CURRENT_DATE + (p_days_before || ' days')::INTERVAL
    AND (dic.expiry_reminder_sent_at IS NULL OR dic.expiry_reminder_sent_at < CURRENT_DATE - INTERVAL '7 days')
  ORDER BY dic.policy_expiry ASC;
END;
$$;

-- ============================================================================
-- 10. GRANT PERMISSIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.upsert_vehicle TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.create_vehicle_ownership TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_certificates TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.get_manual_reviews TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.get_expiring_insurance TO service_role;

-- ============================================================================
-- 11. ROW LEVEL SECURITY
-- ============================================================================

-- Vehicles table
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY vehicles_select_all ON public.vehicles
  FOR SELECT USING (TRUE);

CREATE POLICY vehicles_insert_service ON public.vehicles
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY vehicles_update_service ON public.vehicles
  FOR UPDATE USING (auth.role() = 'service_role');

-- Vehicle ownerships table
ALTER TABLE public.vehicle_ownerships ENABLE ROW LEVEL SECURITY;

CREATE POLICY vehicle_ownerships_select_own ON public.vehicle_ownerships
  FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY vehicle_ownerships_insert_service ON public.vehicle_ownerships
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Insurance manual reviews table
ALTER TABLE public.insurance_manual_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY insurance_manual_reviews_select_own ON public.insurance_manual_reviews
  FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY insurance_manual_reviews_insert_service ON public.insurance_manual_reviews
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY insurance_manual_reviews_update_service ON public.insurance_manual_reviews
  FOR UPDATE USING (auth.role() = 'service_role');

COMMIT;
