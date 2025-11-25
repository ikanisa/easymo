-- Migration: Create Insurance Renewals Table
-- Purpose: Create the insurance_renewals table referenced in apply_intent_insurance.sql
-- This table is required for the renew_policy intent to work properly.
-- Created: 2025-11-25

BEGIN;

-- Create insurance_renewals table
-- This table stores policy renewal records
CREATE TABLE IF NOT EXISTS public.insurance_renewals (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    policy_id uuid REFERENCES public.insurance_policies(id) ON DELETE SET NULL,
    user_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
    renewal_date date NOT NULL DEFAULT CURRENT_DATE,
    new_expiry_date date NOT NULL,
    premium_amount numeric,
    currency text DEFAULT 'RWF',
    status text DEFAULT 'pending_payment', -- pending_payment, paid, cancelled, expired
    payment_reference text,
    paid_at timestamptz,
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_insurance_renewals_policy_id ON public.insurance_renewals(policy_id);
CREATE INDEX IF NOT EXISTS idx_insurance_renewals_user_id ON public.insurance_renewals(user_id);
CREATE INDEX IF NOT EXISTS idx_insurance_renewals_status ON public.insurance_renewals(status);

-- Enable RLS
ALTER TABLE public.insurance_renewals ENABLE ROW LEVEL SECURITY;

-- Service role bypass
GRANT ALL ON public.insurance_renewals TO service_role;

-- RLS Policy: Users can view their own renewals
CREATE POLICY "Users can view own renewals"
  ON public.insurance_renewals
  FOR SELECT
  USING (user_id = auth.uid());

-- Add comment for documentation
COMMENT ON TABLE public.insurance_renewals IS 'Insurance policy renewal records, referenced by the renew_policy intent in apply_intent_insurance';

COMMIT;
