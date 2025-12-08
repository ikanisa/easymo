-- =====================================================================
-- DRIVER INSURANCE CERTIFICATES TABLE
-- =====================================================================
-- Migration: Create table to store driver insurance certificate data
-- This replaces the simple vehicle_plate field with full insurance validation
-- Created: 2025-11-24
-- =====================================================================

BEGIN;

-- Create driver insurance certificates table
CREATE TABLE IF NOT EXISTS public.driver_insurance_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Insurance details
  insurer_name text NOT NULL,
  policy_number text NOT NULL,
  certificate_number text,
  policy_inception date NOT NULL,
  policy_expiry date NOT NULL,
  carte_jaune_number text,
  carte_jaune_expiry date,
  
  -- Vehicle details
  vehicle_plate text NOT NULL,
  make text,
  model text,
  vehicle_year integer,
  vin_chassis text,
  usage text,
  licensed_to_carry integer,
  
  -- Media
  certificate_media_url text NOT NULL,
  certificate_media_id text,
  
  -- OCR metadata
  ocr_provider text NOT NULL CHECK (ocr_provider IN ('openai', 'gemini')),
  ocr_confidence numeric,
  raw_ocr_data jsonb,
  
  -- Validation
  is_validated boolean DEFAULT false,
  validation_errors jsonb,
  validated_at timestamptz,
  validated_by uuid REFERENCES auth.users(id),
  
  -- Status
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  rejection_reason text,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_driver_insurance_user ON public.driver_insurance_certificates(user_id);
CREATE INDEX idx_driver_insurance_plate ON public.driver_insurance_certificates(vehicle_plate);
CREATE INDEX idx_driver_insurance_expiry ON public.driver_insurance_certificates(policy_expiry);
CREATE INDEX idx_driver_insurance_status ON public.driver_insurance_certificates(status);
CREATE INDEX idx_driver_insurance_created ON public.driver_insurance_certificates(created_at DESC);

-- Create unique constraints
-- Only one approved insurance per user
CREATE UNIQUE INDEX idx_driver_insurance_user_approved 
  ON public.driver_insurance_certificates(user_id) 
  WHERE status = 'approved';

-- Only one approved insurance per vehicle plate
CREATE UNIQUE INDEX idx_driver_insurance_plate_approved 
  ON public.driver_insurance_certificates(vehicle_plate) 
  WHERE status = 'approved';

-- Enable RLS
ALTER TABLE public.driver_insurance_certificates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own insurance certificates" 
  ON public.driver_insurance_certificates
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access to insurance certificates" 
  ON public.driver_insurance_certificates
  FOR ALL 
  USING (auth.role() = 'service_role');

-- Function to check if user has valid insurance
CREATE OR REPLACE FUNCTION public.is_driver_insurance_valid(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.driver_insurance_certificates
    WHERE user_id = p_user_id
      AND status = 'approved'
      AND policy_expiry > CURRENT_DATE
  );
END;
$$;

-- Function to get active insurance for user
CREATE OR REPLACE FUNCTION public.get_driver_active_insurance(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  vehicle_plate text,
  insurer_name text,
  policy_number text,
  policy_expiry date,
  status text
)
LANGUAGE plpgsql
STABLE
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
  FROM public.driver_insurance_certificates dic
  WHERE dic.user_id = p_user_id
    AND dic.status = 'approved'
    AND dic.policy_expiry > CURRENT_DATE
  ORDER BY dic.created_at DESC
  LIMIT 1;
END;
$$;

-- Function to check for duplicate vehicle plate
CREATE OR REPLACE FUNCTION public.check_duplicate_vehicle_plate(
  p_plate text,
  p_exclude_user_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.driver_insurance_certificates
    WHERE UPPER(vehicle_plate) = UPPER(p_plate)
      AND status = 'approved'
      AND policy_expiry > CURRENT_DATE
      AND (p_exclude_user_id IS NULL OR user_id != p_exclude_user_id)
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_driver_insurance_valid TO service_role, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_driver_active_insurance TO service_role, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.check_duplicate_vehicle_plate TO service_role, authenticated, anon;

-- Add comments for documentation
COMMENT ON TABLE public.driver_insurance_certificates IS 'Stores driver insurance certificate data extracted via OCR for driver onboarding validation';
COMMENT ON COLUMN public.driver_insurance_certificates.ocr_provider IS 'OCR service used: openai or gemini';
COMMENT ON COLUMN public.driver_insurance_certificates.status IS 'Certificate status: pending, approved, rejected, or expired';
COMMENT ON FUNCTION public.is_driver_insurance_valid IS 'Check if user has valid (approved and not expired) insurance';
COMMENT ON FUNCTION public.get_driver_active_insurance IS 'Get active insurance certificate for a user';
COMMENT ON FUNCTION public.check_duplicate_vehicle_plate IS 'Check if vehicle plate is already registered by another user';

COMMIT;
