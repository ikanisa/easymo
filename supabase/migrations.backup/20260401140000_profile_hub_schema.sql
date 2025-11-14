BEGIN;

-- Migration: Profile Hub Schema
-- Date: 2025-11-12
-- Description: Adds Profile hub tables for vehicles, insurance certificates, 
-- profile assets, and business ownership mapping

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================================
-- VEHICLES TABLE
-- ============================================================================

-- Vehicle status enum
DO $$ BEGIN
  CREATE TYPE public.vehicle_status AS ENUM ('pending', 'active', 'suspended');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Vehicles table
CREATE TABLE IF NOT EXISTS public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  plate TEXT NOT NULL,
  make TEXT,
  model TEXT,
  year INTEGER,
  vehicle_type TEXT, -- moto, cab, lifan, truck, etc.
  status public.vehicle_status NOT NULL DEFAULT 'pending',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT vehicles_plate_unique UNIQUE(org_id, plate)
);

-- Indexes for vehicles
CREATE INDEX IF NOT EXISTS idx_vehicles_profile_id ON public.vehicles(profile_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON public.vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_org_id ON public.vehicles(org_id);

-- ============================================================================
-- INSURANCE CERTIFICATES TABLE
-- ============================================================================

-- Insurance certificates for vehicles
CREATE TABLE IF NOT EXISTS public.insurance_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
  policy_no TEXT,
  insurer TEXT,
  effective_from DATE,
  expires_on DATE,
  ocr_raw JSONB,
  ocr_confidence NUMERIC(5, 2), -- 0.00 to 100.00
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  file_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for insurance certificates
CREATE INDEX IF NOT EXISTS idx_insurance_certificates_vehicle_id ON public.insurance_certificates(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_insurance_certificates_expires_on ON public.insurance_certificates(vehicle_id, expires_on);
CREATE INDEX IF NOT EXISTS idx_insurance_certificates_verified ON public.insurance_certificates(verified);

-- ============================================================================
-- PROFILE ASSETS TABLE
-- ============================================================================

-- Asset kind enum
DO $$ BEGIN
  CREATE TYPE public.asset_kind AS ENUM ('vehicle', 'property', 'business');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Profile assets registry (unified view of user-owned assets)
CREATE TABLE IF NOT EXISTS public.profile_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  kind public.asset_kind NOT NULL,
  ref_id UUID NOT NULL, -- points to vehicles.id / businesses.id / properties.id
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT profile_assets_unique UNIQUE(profile_id, kind, ref_id)
);

-- Indexes for profile assets
CREATE INDEX IF NOT EXISTS idx_profile_assets_profile_id ON public.profile_assets(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_assets_kind ON public.profile_assets(kind);

-- ============================================================================
-- BUSINESS OWNERS TABLE
-- ============================================================================

-- Business ownership mapping (multi-business support)
CREATE TABLE IF NOT EXISTS public.business_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('owner', 'manager', 'staff')) DEFAULT 'owner',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT business_owners_unique UNIQUE(profile_id, business_id)
);

-- Indexes for business owners
CREATE INDEX IF NOT EXISTS idx_business_owners_profile_id ON public.business_owners(profile_id);
CREATE INDEX IF NOT EXISTS idx_business_owners_business_id ON public.business_owners(business_id);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_owners ENABLE ROW LEVEL SECURITY;

-- Vehicles: Users can view/manage their own vehicles
CREATE POLICY "Users can view their own vehicles"
  ON public.vehicles
  FOR SELECT
  USING (
    profile_id = (auth.jwt()->>'sub')::uuid
    OR (auth.jwt()->>'role') IN ('admin', 'staff')
  );

CREATE POLICY "Users can insert their own vehicles"
  ON public.vehicles
  FOR INSERT
  WITH CHECK (
    profile_id = (auth.jwt()->>'sub')::uuid
  );

CREATE POLICY "Users can update their own vehicles"
  ON public.vehicles
  FOR UPDATE
  USING (
    profile_id = (auth.jwt()->>'sub')::uuid
    OR (auth.jwt()->>'role') IN ('admin', 'staff')
  );

-- Insurance certificates: Users can view/manage certificates for their vehicles
CREATE POLICY "Users can view certificates for their vehicles"
  ON public.insurance_certificates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.vehicles v
      WHERE v.id = insurance_certificates.vehicle_id
      AND (v.profile_id = (auth.jwt()->>'sub')::uuid OR (auth.jwt()->>'role') IN ('admin', 'staff'))
    )
  );

CREATE POLICY "Users can insert certificates for their vehicles"
  ON public.insurance_certificates
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vehicles v
      WHERE v.id = insurance_certificates.vehicle_id
      AND v.profile_id = (auth.jwt()->>'sub')::uuid
    )
  );

-- Profile assets: Users can view/manage their own assets
CREATE POLICY "Users can view their own assets"
  ON public.profile_assets
  FOR SELECT
  USING (
    profile_id = (auth.jwt()->>'sub')::uuid
    OR (auth.jwt()->>'role') IN ('admin', 'staff')
  );

CREATE POLICY "Users can insert their own assets"
  ON public.profile_assets
  FOR INSERT
  WITH CHECK (
    profile_id = (auth.jwt()->>'sub')::uuid
  );

CREATE POLICY "Users can delete their own assets"
  ON public.profile_assets
  FOR DELETE
  USING (
    profile_id = (auth.jwt()->>'sub')::uuid
  );

-- Business owners: Users can view businesses they own/manage
CREATE POLICY "Users can view their business ownership"
  ON public.business_owners
  FOR SELECT
  USING (
    profile_id = (auth.jwt()->>'sub')::uuid
    OR (auth.jwt()->>'role') IN ('admin', 'staff')
  );

CREATE POLICY "Users can manage their business ownership"
  ON public.business_owners
  FOR ALL
  USING (
    profile_id = (auth.jwt()->>'sub')::uuid
    OR (auth.jwt()->>'role') IN ('admin', 'staff')
  )
  WITH CHECK (
    profile_id = (auth.jwt()->>'sub')::uuid
    OR (auth.jwt()->>'role') IN ('admin', 'staff')
  );

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger function for updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to tables with updated_at
DROP TRIGGER IF EXISTS trg_vehicles_updated_at ON public.vehicles;
CREATE TRIGGER trg_vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS trg_insurance_certificates_updated_at ON public.insurance_certificates;
CREATE TRIGGER trg_insurance_certificates_updated_at
  BEFORE UPDATE ON public.insurance_certificates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_timestamp();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to check if a vehicle has valid insurance
CREATE OR REPLACE FUNCTION public.has_valid_insurance(
  p_vehicle_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_valid BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1
    FROM public.insurance_certificates
    WHERE vehicle_id = p_vehicle_id
      AND verified = TRUE
      AND ocr_confidence >= 0.8
      AND expires_on >= CURRENT_DATE
  ) INTO v_valid;
  
  RETURN COALESCE(v_valid, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to activate vehicle if insurance is valid
CREATE OR REPLACE FUNCTION public.activate_vehicle_if_insured(
  p_vehicle_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_has_insurance BOOLEAN;
BEGIN
  v_has_insurance := public.has_valid_insurance(p_vehicle_id);
  
  IF v_has_insurance THEN
    UPDATE public.vehicles
    SET status = 'active', updated_at = NOW()
    WHERE id = p_vehicle_id AND status = 'pending';
    
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.has_valid_insurance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_vehicle_if_insured(UUID) TO authenticated;

COMMIT;
