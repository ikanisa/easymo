-- ============================================================================
-- Create allowed_partners table for wallet token transfers
-- Migration: 20251216140000_create_allowed_partners_table.sql
-- Date: 2025-12-16
--
-- PURPOSE: 
-- Create table to store allowed partners that users can transfer tokens to
-- Users can only transfer tokens to partners in this list, not to any other user
-- ============================================================================

BEGIN;

-- Create allowed_partners table
CREATE TABLE IF NOT EXISTS public.allowed_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_name TEXT NOT NULL,
  partner_phone TEXT NOT NULL UNIQUE,
  partner_type TEXT NOT NULL CHECK (partner_type IN ('business', 'service', 'merchant')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_allowed_partners_phone ON public.allowed_partners(partner_phone) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_allowed_partners_type ON public.allowed_partners(partner_type) WHERE is_active = true;

-- Add comments
COMMENT ON TABLE public.allowed_partners IS 'List of allowed partners that users can transfer tokens to. Users cannot transfer tokens to other users, only to partners in this list.';
COMMENT ON COLUMN public.allowed_partners.partner_phone IS 'Partner phone number in E.164 format';
COMMENT ON COLUMN public.allowed_partners.partner_type IS 'Type of partner: business, service, or merchant';
COMMENT ON COLUMN public.allowed_partners.is_active IS 'Whether this partner is currently active and can receive transfers';

-- Enable RLS
ALTER TABLE public.allowed_partners ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "service_role_manage_partners" ON public.allowed_partners
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "users_view_active_partners" ON public.allowed_partners
  FOR SELECT USING (is_active = true);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION public.allowed_partners_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS allowed_partners_set_updated_at ON public.allowed_partners;
CREATE TRIGGER allowed_partners_set_updated_at
  BEFORE UPDATE ON public.allowed_partners
  FOR EACH ROW
  EXECUTE FUNCTION public.allowed_partners_set_updated_at();

COMMIT;

