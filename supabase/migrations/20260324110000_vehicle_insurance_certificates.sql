BEGIN;

-- Migration: Add vehicle insurance certificates tracking with OCR data
-- Date: 2025-11-12
-- Description: Stores insurance certificate data extracted via OCR for vehicle validation

-- Create vehicle_insurance_certificates table
CREATE TABLE IF NOT EXISTS public.vehicle_insurance_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  whatsapp_e164 TEXT NOT NULL,
  vehicle_plate TEXT,
  
  -- Insurance details from OCR
  insurer_name TEXT,
  policy_number TEXT,
  certificate_number TEXT,
  policy_inception DATE,
  policy_expiry DATE NOT NULL,
  carte_jaune_number TEXT,
  carte_jaune_expiry DATE,
  
  -- Vehicle details from OCR
  make TEXT,
  model TEXT,
  vehicle_year INTEGER,
  registration_plate TEXT,
  vin_chassis TEXT,
  usage TEXT,
  licensed_to_carry INTEGER,
  
  -- Document metadata
  certificate_url TEXT,
  media_id TEXT,
  ocr_data JSONB,
  ocr_extracted_at TIMESTAMPTZ,
  
  -- Validation status
  is_valid BOOLEAN GENERATED ALWAYS AS (
    policy_expiry IS NOT NULL AND policy_expiry >= CURRENT_DATE
  ) STORED,
  validation_errors TEXT[],
  
  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT vehicle_insurance_expiry_check CHECK (policy_expiry IS NOT NULL)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_vehicle_insurance_profile_id 
  ON public.vehicle_insurance_certificates(profile_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_insurance_whatsapp 
  ON public.vehicle_insurance_certificates(whatsapp_e164);
CREATE INDEX IF NOT EXISTS idx_vehicle_insurance_plate 
  ON public.vehicle_insurance_certificates(vehicle_plate);
CREATE INDEX IF NOT EXISTS idx_vehicle_insurance_expiry 
  ON public.vehicle_insurance_certificates(policy_expiry);
CREATE INDEX IF NOT EXISTS idx_vehicle_insurance_valid 
  ON public.vehicle_insurance_certificates(is_valid);

-- Add RLS policies
ALTER TABLE public.vehicle_insurance_certificates ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own certificates
CREATE POLICY "Users can view their own insurance certificates"
  ON public.vehicle_insurance_certificates
  FOR SELECT
  USING (
    whatsapp_e164 = auth.jwt()->>'phone'
    OR profile_id = (auth.jwt()->>'sub')::UUID
  );

-- Policy: Users can insert their own certificates
CREATE POLICY "Users can add their own insurance certificates"
  ON public.vehicle_insurance_certificates
  FOR INSERT
  WITH CHECK (
    whatsapp_e164 = auth.jwt()->>'phone'
    OR profile_id = (auth.jwt()->>'sub')::UUID
  );

-- Policy: Users can update their own certificates
CREATE POLICY "Users can update their own insurance certificates"
  ON public.vehicle_insurance_certificates
  FOR UPDATE
  USING (
    whatsapp_e164 = auth.jwt()->>'phone'
    OR profile_id = (auth.jwt()->>'sub')::UUID
  );

-- Policy: Admin users can view all certificates
CREATE POLICY "Admins can view all insurance certificates"
  ON public.vehicle_insurance_certificates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (auth.jwt()->>'sub')::UUID
      AND (p.metadata->>'is_admin')::BOOLEAN = TRUE
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_vehicle_insurance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_vehicle_insurance_updated_at
  BEFORE UPDATE ON public.vehicle_insurance_certificates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_vehicle_insurance_updated_at();

-- Function to get valid insurance for a vehicle plate
CREATE OR REPLACE FUNCTION public.get_valid_vehicle_insurance(
  p_plate TEXT
)
RETURNS TABLE (
  id UUID,
  policy_number TEXT,
  insurer_name TEXT,
  policy_expiry DATE,
  is_valid BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    vic.id,
    vic.policy_number,
    vic.insurer_name,
    vic.policy_expiry,
    vic.is_valid
  FROM public.vehicle_insurance_certificates vic
  WHERE vic.vehicle_plate = p_plate
    AND vic.is_valid = TRUE
  ORDER BY vic.policy_expiry DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_valid_vehicle_insurance(TEXT) TO authenticated;

COMMIT;
