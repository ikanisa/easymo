-- ================================================================
-- Marketplace Tables Migration
-- ================================================================
-- Creates the core marketplace infrastructure tables for the
-- EasyMO Marketplace service including listings, transactions,
-- and reviews.
--
-- Tables:
--   - marketplace_listings: Product/service listings for sale
--   - marketplace_transactions: Purchase transactions
--   - marketplace_reviews: Buyer/seller reviews
--
-- Created: 2025-11-25
-- ================================================================

BEGIN;

-- ================================================================
-- 1. MARKETPLACE LISTINGS TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS public.marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Seller reference
  seller_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  seller_phone TEXT, -- For WhatsApp users without profile
  
  -- Listing details
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2),
  currency TEXT DEFAULT 'RWF',
  category TEXT,
  condition TEXT CHECK (condition IN ('new', 'used', 'refurbished')),
  
  -- Images (array of storage paths or URLs)
  images TEXT[] DEFAULT '{}'::text[],
  
  -- Location
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  location_name TEXT,
  
  -- Status tracking
  status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'sold', 'removed', 'expired')),
  views INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
);

COMMENT ON TABLE public.marketplace_listings IS 
  'Marketplace listings for buying and selling items via WhatsApp';

-- Indexes for marketplace_listings
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_seller_id 
  ON public.marketplace_listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_seller_phone 
  ON public.marketplace_listings(seller_phone);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_category 
  ON public.marketplace_listings(category);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_status 
  ON public.marketplace_listings(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_price 
  ON public.marketplace_listings(price);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_created_at 
  ON public.marketplace_listings(created_at DESC);

-- Full-text search index for listings
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_search 
  ON public.marketplace_listings 
  USING gin(to_tsvector('english', 
    COALESCE(title, '') || ' ' || 
    COALESCE(description, '') || ' ' || 
    COALESCE(category, '') || ' ' ||
    COALESCE(location_name, '')
  ));

-- ================================================================
-- 2. MARKETPLACE TRANSACTIONS TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS public.marketplace_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- References
  listing_id UUID REFERENCES public.marketplace_listings(id) ON DELETE SET NULL,
  buyer_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  seller_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  buyer_phone TEXT,
  seller_phone TEXT,
  
  -- Transaction details
  price NUMERIC(10,2),
  currency TEXT DEFAULT 'RWF',
  payment_method TEXT CHECK (payment_method IN ('momo', 'tokens', 'cash', 'airtel_money', 'other')),
  
  -- Status tracking
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
  delivery_status TEXT DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'in_transit', 'delivered', 'cancelled')),
  
  -- Payment reference (e.g., MOMO transaction ID)
  payment_reference TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.marketplace_transactions IS 
  'Transaction records for marketplace purchases';

-- Indexes for marketplace_transactions
CREATE INDEX IF NOT EXISTS idx_marketplace_transactions_listing_id 
  ON public.marketplace_transactions(listing_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_transactions_buyer_id 
  ON public.marketplace_transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_transactions_seller_id 
  ON public.marketplace_transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_transactions_payment_status 
  ON public.marketplace_transactions(payment_status);
CREATE INDEX IF NOT EXISTS idx_marketplace_transactions_created_at 
  ON public.marketplace_transactions(created_at DESC);

-- ================================================================
-- 3. MARKETPLACE REVIEWS TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS public.marketplace_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- References
  transaction_id UUID REFERENCES public.marketplace_transactions(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  reviewee_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  reviewer_phone TEXT,
  reviewee_phone TEXT,
  
  -- Review details
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.marketplace_reviews IS 
  'Reviews from marketplace transactions for buyer/seller reputation';

-- Indexes for marketplace_reviews
CREATE INDEX IF NOT EXISTS idx_marketplace_reviews_transaction_id 
  ON public.marketplace_reviews(transaction_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_reviews_reviewer_id 
  ON public.marketplace_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_reviews_reviewee_id 
  ON public.marketplace_reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_reviews_rating 
  ON public.marketplace_reviews(rating);

-- ================================================================
-- 4. ROW LEVEL SECURITY
-- ================================================================

ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_reviews ENABLE ROW LEVEL SECURITY;

-- Listings: Anyone can read active listings
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'marketplace_listings' 
    AND policyname = 'marketplace_listings_read_public'
  ) THEN
    CREATE POLICY "marketplace_listings_read_public"
      ON public.marketplace_listings
      FOR SELECT
      USING (status = 'active' OR seller_id = auth.uid());
  END IF;
END $$;

-- Listings: Users can manage their own listings
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'marketplace_listings' 
    AND policyname = 'marketplace_listings_manage_own'
  ) THEN
    CREATE POLICY "marketplace_listings_manage_own"
      ON public.marketplace_listings
      FOR ALL
      TO authenticated
      USING (seller_id = auth.uid())
      WITH CHECK (seller_id = auth.uid());
  END IF;
END $$;

-- Service role has full access
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'marketplace_listings' 
    AND policyname = 'marketplace_listings_service_role'
  ) THEN
    CREATE POLICY "marketplace_listings_service_role"
      ON public.marketplace_listings
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Transactions: Users can see their own transactions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'marketplace_transactions' 
    AND policyname = 'marketplace_transactions_own'
  ) THEN
    CREATE POLICY "marketplace_transactions_own"
      ON public.marketplace_transactions
      FOR SELECT
      TO authenticated
      USING (buyer_id = auth.uid() OR seller_id = auth.uid());
  END IF;
END $$;

-- Service role has full access to transactions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'marketplace_transactions' 
    AND policyname = 'marketplace_transactions_service_role'
  ) THEN
    CREATE POLICY "marketplace_transactions_service_role"
      ON public.marketplace_transactions
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Reviews: Anyone can read reviews
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'marketplace_reviews' 
    AND policyname = 'marketplace_reviews_read_public'
  ) THEN
    CREATE POLICY "marketplace_reviews_read_public"
      ON public.marketplace_reviews
      FOR SELECT
      USING (true);
  END IF;
END $$;

-- Service role has full access to reviews
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'marketplace_reviews' 
    AND policyname = 'marketplace_reviews_service_role'
  ) THEN
    CREATE POLICY "marketplace_reviews_service_role"
      ON public.marketplace_reviews
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ================================================================
-- 5. TRIGGERS
-- ================================================================

-- Updated_at trigger for marketplace_listings
CREATE OR REPLACE FUNCTION public.update_marketplace_listings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_marketplace_listings_updated_at ON public.marketplace_listings;
CREATE TRIGGER trigger_marketplace_listings_updated_at
  BEFORE UPDATE ON public.marketplace_listings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_marketplace_listings_updated_at();

-- Updated_at trigger for marketplace_transactions
DROP TRIGGER IF EXISTS trigger_marketplace_transactions_updated_at ON public.marketplace_transactions;
CREATE TRIGGER trigger_marketplace_transactions_updated_at
  BEFORE UPDATE ON public.marketplace_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_marketplace_listings_updated_at();

COMMIT;
