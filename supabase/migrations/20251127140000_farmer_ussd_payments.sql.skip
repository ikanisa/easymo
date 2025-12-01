-- Migration: Farmer Payments via USSD
-- Created: 2025-11-27
-- Purpose: Track USSD payment transactions for farmer produce sales

BEGIN;

-- Farmer payments table
CREATE TABLE IF NOT EXISTS public.farmer_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES public.farmer_listings(id) ON DELETE CASCADE,
  buyer_phone TEXT NOT NULL,
  farmer_phone TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  currency TEXT DEFAULT 'RWF',
  ussd_code TEXT NOT NULL,
  payment_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'initiated', 'completed', 'failed', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::JSONB,
  CONSTRAINT valid_expiry CHECK (expires_at > created_at)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS farmer_payments_listing_idx ON public.farmer_payments(listing_id);
CREATE INDEX IF NOT EXISTS farmer_payments_buyer_phone_idx ON public.farmer_payments(buyer_phone);
CREATE INDEX IF NOT EXISTS farmer_payments_farmer_phone_idx ON public.farmer_payments(farmer_phone);
CREATE INDEX IF NOT EXISTS farmer_payments_status_idx ON public.farmer_payments(status);
CREATE INDEX IF NOT EXISTS farmer_payments_created_at_idx ON public.farmer_payments(created_at DESC);
CREATE INDEX IF NOT EXISTS farmer_payments_reference_idx ON public.farmer_payments(payment_reference) WHERE payment_reference IS NOT NULL;

-- Enable RLS
ALTER TABLE public.farmer_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$
BEGIN
  -- Service role can manage all payments
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' 
      AND tablename='farmer_payments' 
      AND policyname='farmer_payments_service_all'
  ) THEN
    CREATE POLICY farmer_payments_service_all ON public.farmer_payments
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  -- Users can view their own payments (as buyer or farmer)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' 
      AND tablename='farmer_payments' 
      AND policyname='farmer_payments_user_view'
  ) THEN
    CREATE POLICY farmer_payments_user_view ON public.farmer_payments
      FOR SELECT TO authenticated
      USING (
        buyer_phone = (SELECT whatsapp_e164 FROM profiles WHERE user_id = auth.uid())
        OR farmer_phone = (SELECT whatsapp_e164 FROM profiles WHERE user_id = auth.uid())
      );
  END IF;
END $$;

-- Function: Get payment summary for farmer
CREATE OR REPLACE FUNCTION public.get_farmer_payment_summary(p_farmer_phone TEXT)
RETURNS TABLE(
  total_earnings NUMERIC,
  completed_count BIGINT,
  pending_count BIGINT,
  total_transactions BIGINT,
  avg_transaction NUMERIC
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT 
    COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0) as total_earnings,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
    COUNT(*) as total_transactions,
    COALESCE(AVG(amount) FILTER (WHERE status = 'completed'), 0) as avg_transaction
  FROM public.farmer_payments
  WHERE farmer_phone = p_farmer_phone;
$$;

-- Function: Expire old pending payments
CREATE OR REPLACE FUNCTION public.expire_pending_payments()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_expired_count INTEGER;
BEGIN
  UPDATE public.farmer_payments
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW()
  RETURNING COUNT(*) INTO v_expired_count;
  
  RETURN COALESCE(v_expired_count, 0);
END;
$$;

-- Function: Confirm payment with reference
CREATE OR REPLACE FUNCTION public.confirm_farmer_payment(
  p_payment_id UUID,
  p_reference TEXT,
  p_buyer_phone TEXT
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  farmer_phone TEXT,
  amount NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payment RECORD;
BEGIN
  -- Get payment details
  SELECT * INTO v_payment
  FROM public.farmer_payments
  WHERE id = p_payment_id
    AND buyer_phone = p_buyer_phone
    AND status = 'pending'
    AND expires_at > NOW();
  
  IF v_payment IS NULL THEN
    RETURN QUERY SELECT 
      false, 
      'Payment not found or already processed'::TEXT,
      NULL::TEXT,
      NULL::NUMERIC;
    RETURN;
  END IF;
  
  -- Update payment status
  UPDATE public.farmer_payments
  SET 
    status = 'completed',
    payment_reference = p_reference,
    completed_at = NOW()
  WHERE id = p_payment_id;
  
  -- Return success
  RETURN QUERY SELECT 
    true,
    'Payment confirmed successfully'::TEXT,
    v_payment.farmer_phone,
    v_payment.amount;
END;
$$;

-- Function: Get recent payments for listing
CREATE OR REPLACE FUNCTION public.get_listing_payments(p_listing_id UUID)
RETURNS TABLE(
  payment_id UUID,
  buyer_phone TEXT,
  amount NUMERIC,
  status TEXT,
  payment_reference TEXT,
  created_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT 
    id,
    buyer_phone,
    amount,
    status,
    payment_reference,
    created_at,
    completed_at
  FROM public.farmer_payments
  WHERE listing_id = p_listing_id
  ORDER BY created_at DESC;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION public.get_farmer_payment_summary(TEXT) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_pending_payments() TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_farmer_payment(UUID, TEXT, TEXT) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.get_listing_payments(UUID) TO service_role, authenticated;

-- Comments
COMMENT ON TABLE public.farmer_payments IS 'USSD payment tracking for farmer produce transactions';
COMMENT ON FUNCTION public.get_farmer_payment_summary IS 'Get earnings summary for a farmer';
COMMENT ON FUNCTION public.expire_pending_payments IS 'Expire payments that exceeded their timeout';
COMMENT ON FUNCTION public.confirm_farmer_payment IS 'Confirm payment with USSD reference number';

COMMIT;
