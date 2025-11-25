-- Migration: Create Insurance Claims Table
-- Purpose: Create the insurance_claims table referenced in apply_intent_insurance.sql
-- This table is required for the file_claim intent to work properly.
-- Created: 2025-11-25

BEGIN;

-- Create insurance_claims table
-- This table stores insurance claim submissions from users
CREATE TABLE IF NOT EXISTS public.insurance_claims (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    policy_id uuid REFERENCES public.insurance_policies(id) ON DELETE SET NULL,
    user_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
    incident_date date,
    claim_type text, -- accident, theft, damage, medical, etc.
    description text,
    estimated_amount numeric,
    approved_amount numeric,
    currency text DEFAULT 'RWF',
    status text DEFAULT 'submitted', -- submitted, in_review, approved, rejected, paid
    submitted_at timestamptz DEFAULT now(),
    reviewed_at timestamptz,
    reviewed_by uuid REFERENCES public.profiles(user_id),
    notes text,
    supporting_docs text[], -- array of storage paths
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_insurance_claims_policy_id ON public.insurance_claims(policy_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_user_id ON public.insurance_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_status ON public.insurance_claims(status);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_created_at ON public.insurance_claims(created_at DESC);

-- Enable RLS
ALTER TABLE public.insurance_claims ENABLE ROW LEVEL SECURITY;

-- Service role bypass (for webhooks and admin operations)
GRANT ALL ON public.insurance_claims TO service_role;

-- RLS Policy: Users can view their own claims
CREATE POLICY "Users can view own claims"
  ON public.insurance_claims
  FOR SELECT
  USING (user_id = auth.uid());

-- RLS Policy: Users can insert their own claims
CREATE POLICY "Users can submit claims"
  ON public.insurance_claims
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Add comment for documentation
COMMENT ON TABLE public.insurance_claims IS 'Insurance claim submissions from users, referenced by the file_claim intent in apply_intent_insurance';

COMMIT;
