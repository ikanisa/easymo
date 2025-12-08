BEGIN;

-- =====================================================
-- MARKETPLACE PHASE 2: PAYMENT & TRANSACTIONS
-- =====================================================
-- Date: 2025-11-25
-- Adds transaction tracking and payment flow for marketplace
-- =====================================================

-- 1. Transaction Table
CREATE TABLE IF NOT EXISTS public.marketplace_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- References
  listing_id UUID NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  buyer_phone TEXT NOT NULL,
  seller_phone TEXT NOT NULL,
  
  -- Amount & Currency
  agreed_price NUMERIC NOT NULL CHECK (agreed_price > 0),
  currency TEXT DEFAULT 'RWF',
  
  -- Payment Details
  payment_method TEXT NOT NULL DEFAULT 'momo_ussd' CHECK (payment_method IN ('momo_ussd', 'cash', 'other')),
  payment_reference TEXT,        -- User-provided reference (e.g., MoMo transaction ID)
  merchant_code TEXT,             -- Our MTN merchant code used
  ussd_code TEXT,                 -- USSD string sent to buyer
  
  -- Status Flow
  status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN (
    'initiated',      -- Transaction created, payment link sent
    'pending',        -- Buyer acknowledged, payment in progress
    'confirming',     -- Buyer claims payment sent, awaiting seller confirmation
    'completed',      -- Seller confirmed receipt
    'disputed',       -- Seller disputes payment
    'cancelled',      -- Buyer or seller cancelled
    'expired'         -- Expired without completion
  )),
  
  -- Negotiation
  initial_listing_price NUMERIC,  -- Original listing price
  buyer_offer NUMERIC,             -- Buyer's negotiated offer
  negotiation_messages JSONB DEFAULT '[]', -- Chat history
  
  -- Confirmation
  buyer_confirmed_at TIMESTAMPTZ,
  seller_confirmed_at TIMESTAMPTZ,
  payment_proof_url TEXT,          -- Optional: Screenshot of MoMo confirmation
  
  -- Dispute Resolution
  dispute_reason TEXT,
  dispute_resolved_at TIMESTAMPTZ,
  admin_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
  completed_at TIMESTAMPTZ,
  
  -- Indexes
  CONSTRAINT valid_price_negotiation CHECK (
    (buyer_offer IS NULL) OR (buyer_offer > 0 AND buyer_offer <= initial_listing_price)
  )
);

-- 2. Buyer Intents Table (Enhanced from Phase 1)
-- Add transaction tracking to buyer intents
ALTER TABLE public.marketplace_buyer_intents
  ADD COLUMN IF NOT EXISTS matched_transactions UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS last_matched_at TIMESTAMPTZ;

-- 3. Listing Status Updates
-- Track when listing is in transaction
ALTER TABLE public.marketplace_listings
  ADD COLUMN IF NOT EXISTS in_transaction BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS reserved_by_phone TEXT,
  ADD COLUMN IF NOT EXISTS reserved_until TIMESTAMPTZ;

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_marketplace_transactions_listing 
  ON public.marketplace_transactions(listing_id);

CREATE INDEX IF NOT EXISTS idx_marketplace_transactions_buyer 
  ON public.marketplace_transactions(buyer_phone);

CREATE INDEX IF NOT EXISTS idx_marketplace_transactions_seller 
  ON public.marketplace_transactions(seller_phone);

CREATE INDEX IF NOT EXISTS idx_marketplace_transactions_status 
  ON public.marketplace_transactions(status);

CREATE INDEX IF NOT EXISTS idx_marketplace_transactions_created 
  ON public.marketplace_transactions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketplace_transactions_pending 
  ON public.marketplace_transactions(status, created_at) 
  WHERE status IN ('initiated', 'pending', 'confirming');

CREATE INDEX IF NOT EXISTS idx_marketplace_listings_reserved 
  ON public.marketplace_listings(in_transaction, reserved_until) 
  WHERE in_transaction = true;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Auto-update updated_at on transaction changes
CREATE OR REPLACE FUNCTION public.update_marketplace_transaction_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_marketplace_transaction_updated_at
  BEFORE UPDATE ON public.marketplace_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_marketplace_transaction_updated_at();

-- Auto-expire transactions
CREATE OR REPLACE FUNCTION public.expire_marketplace_transactions()
RETURNS void AS $$
BEGIN
  UPDATE public.marketplace_transactions
  SET 
    status = 'expired',
    updated_at = NOW()
  WHERE 
    status IN ('initiated', 'pending')
    AND expires_at < NOW();
    
  -- Release reserved listings
  UPDATE public.marketplace_listings
  SET 
    in_transaction = false,
    reserved_by_phone = NULL,
    reserved_until = NULL,
    updated_at = NOW()
  WHERE 
    in_transaction = true
    AND reserved_until < NOW();
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- RPC FUNCTIONS
-- =====================================================

-- Get transaction summary for a user
CREATE OR REPLACE FUNCTION public.get_user_transaction_summary(
  p_phone TEXT
)
RETURNS TABLE (
  total_as_buyer BIGINT,
  total_as_seller BIGINT,
  completed_as_buyer BIGINT,
  completed_as_seller BIGINT,
  pending_as_buyer BIGINT,
  pending_as_seller BIGINT,
  total_spent NUMERIC,
  total_earned NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE buyer_phone = p_phone) as total_as_buyer,
    COUNT(*) FILTER (WHERE seller_phone = p_phone) as total_as_seller,
    COUNT(*) FILTER (WHERE buyer_phone = p_phone AND status = 'completed') as completed_as_buyer,
    COUNT(*) FILTER (WHERE seller_phone = p_phone AND status = 'completed') as completed_as_seller,
    COUNT(*) FILTER (WHERE buyer_phone = p_phone AND status IN ('initiated', 'pending', 'confirming')) as pending_as_buyer,
    COUNT(*) FILTER (WHERE seller_phone = p_phone AND status IN ('initiated', 'pending', 'confirming')) as pending_as_seller,
    COALESCE(SUM(agreed_price) FILTER (WHERE buyer_phone = p_phone AND status = 'completed'), 0) as total_spent,
    COALESCE(SUM(agreed_price) FILTER (WHERE seller_phone = p_phone AND status = 'completed'), 0) as total_earned
  FROM public.marketplace_transactions;
END;
$$ LANGUAGE plpgsql;

-- Get active transactions for a phone number
CREATE OR REPLACE FUNCTION public.get_active_transactions(
  p_phone TEXT
)
RETURNS TABLE (
  transaction_id UUID,
  listing_title TEXT,
  other_party_phone TEXT,
  role TEXT,
  agreed_price NUMERIC,
  status TEXT,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    l.title,
    CASE 
      WHEN t.buyer_phone = p_phone THEN t.seller_phone
      ELSE t.buyer_phone
    END as other_party_phone,
    CASE 
      WHEN t.buyer_phone = p_phone THEN 'buyer'
      ELSE 'seller'
    END as role,
    t.agreed_price,
    t.status,
    t.created_at,
    t.expires_at
  FROM public.marketplace_transactions t
  JOIN public.marketplace_listings l ON t.listing_id = l.id
  WHERE 
    (t.buyer_phone = p_phone OR t.seller_phone = p_phone)
    AND t.status IN ('initiated', 'pending', 'confirming')
  ORDER BY t.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE public.marketplace_transactions ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access" ON public.marketplace_transactions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Users can view their own transactions
CREATE POLICY "Users view own transactions" ON public.marketplace_transactions
  FOR SELECT
  TO authenticated
  USING (
    auth.jwt() ->> 'phone' = buyer_phone 
    OR auth.jwt() ->> 'phone' = seller_phone
  );

-- =====================================================
-- SCHEDULED JOB PLACEHOLDER
-- =====================================================
-- Note: Create a scheduled edge function to call expire_marketplace_transactions()
-- Frequency: Every 15 minutes
-- Command: SELECT expire_marketplace_transactions();

COMMENT ON TABLE public.marketplace_transactions IS 'Tracks buyer-seller transactions in marketplace with USSD MoMo payment flow';
COMMENT ON FUNCTION public.expire_marketplace_transactions() IS 'Expires stale transactions and releases reserved listings. Run every 15 minutes.';
COMMENT ON FUNCTION public.get_user_transaction_summary(TEXT) IS 'Get transaction statistics for a user (buyer and seller activity)';
COMMENT ON FUNCTION public.get_active_transactions(TEXT) IS 'Get all active transactions for a phone number';

COMMIT;
