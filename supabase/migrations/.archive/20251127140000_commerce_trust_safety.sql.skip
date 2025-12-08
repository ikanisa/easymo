BEGIN;

-- =====================================================
-- PHASE 3: Trust & Safety for Unified Commerce Agent
-- =====================================================
-- Features:
-- - Rating & review system
-- - Content moderation
-- - User favorites
-- - Business opportunities (broker)
-- =====================================================

-- =====================================================
-- 1. RATINGS & REVIEWS
-- =====================================================

CREATE TABLE IF NOT EXISTS ratings_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- What is being reviewed
  target_id UUID NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('business', 'seller', 'transaction', 'listing')),
  
  -- Who is reviewing
  reviewer_phone TEXT NOT NULL,
  
  -- Review data
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  
  -- Moderation
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'flagged', 'removed')),
  moderation_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate reviews
  UNIQUE(target_id, target_type, reviewer_phone)
);

CREATE INDEX idx_ratings_reviews_target ON ratings_reviews(target_id, target_type);
CREATE INDEX idx_ratings_reviews_reviewer ON ratings_reviews(reviewer_phone);
CREATE INDEX idx_ratings_reviews_status ON ratings_reviews(status);

COMMENT ON TABLE ratings_reviews IS 'User ratings and reviews for businesses, sellers, and transactions';

-- =====================================================
-- 2. CONTENT MODERATION
-- =====================================================

CREATE TABLE IF NOT EXISTS content_moderation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- What is being moderated
  content_id UUID NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('listing', 'business', 'user', 'review', 'opportunity')),
  
  -- Reporter
  reporter_phone TEXT,
  
  -- Moderation details
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'fraud', 'inappropriate', 'duplicate', 'scam', 'fake', 'other')),
  details TEXT,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'approved', 'flagged', 'removed', 'resolved')),
  
  -- Moderator actions
  moderator_id UUID,
  moderator_notes TEXT,
  action_taken TEXT,
  resolved_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_content_moderation_content ON content_moderation(content_id, content_type);
CREATE INDEX idx_content_moderation_status ON content_moderation(status);
CREATE INDEX idx_content_moderation_reporter ON content_moderation(reporter_phone);
CREATE INDEX idx_content_moderation_created ON content_moderation(created_at DESC);

COMMENT ON TABLE content_moderation IS 'Content moderation queue for reported items';

-- =====================================================
-- 3. USER FAVORITES
-- =====================================================

CREATE TABLE IF NOT EXISTS user_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User
  user_phone TEXT NOT NULL,
  
  -- What is favorited
  target_id UUID NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('business', 'listing', 'seller')),
  
  -- Optional metadata
  notes TEXT,
  tags TEXT[],
  
  -- Timestamps
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicates
  UNIQUE(user_phone, target_id, target_type)
);

CREATE INDEX idx_user_favorites_user ON user_favorites(user_phone);
CREATE INDEX idx_user_favorites_target ON user_favorites(target_id, target_type);
CREATE INDEX idx_user_favorites_saved ON user_favorites(saved_at DESC);

COMMENT ON TABLE user_favorites IS 'User saved favorites for businesses and listings';

-- =====================================================
-- 4. BUSINESS OPPORTUNITIES (Broker)
-- =====================================================

CREATE TABLE IF NOT EXISTS business_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Owner
  owner_phone TEXT NOT NULL,
  
  -- Opportunity details
  title TEXT NOT NULL,
  industry TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('seeking_investment', 'seeking_partner', 'franchise_opportunity', 'acquisition', 'joint_venture')),
  partnership_type TEXT CHECK (partnership_type IN ('investor', 'supplier', 'distributor', 'franchise', 'joint_venture')),
  
  -- Description
  description TEXT,
  requirements TEXT,
  
  -- Financial
  investment_range TEXT, -- e.g., "5M-10M RWF"
  revenue_estimate TEXT,
  profit_margin TEXT,
  
  -- Location
  city TEXT,
  country_code TEXT DEFAULT 'RW',
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'matched', 'closed', 'expired')),
  
  -- Matching
  match_criteria JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '90 days')
);

CREATE INDEX idx_business_opportunities_owner ON business_opportunities(owner_phone);
CREATE INDEX idx_business_opportunities_type ON business_opportunities(type);
CREATE INDEX idx_business_opportunities_partnership_type ON business_opportunities(partnership_type);
CREATE INDEX idx_business_opportunities_industry ON business_opportunities(industry);
CREATE INDEX idx_business_opportunities_status ON business_opportunities(status);
CREATE INDEX idx_business_opportunities_city ON business_opportunities(city);

COMMENT ON TABLE business_opportunities IS 'Business partnership and investment opportunities';

-- =====================================================
-- 5. ESCROW TRANSACTIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS escrow_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Linked transaction
  transaction_id UUID REFERENCES marketplace_transactions(id) ON DELETE CASCADE,
  
  -- Escrow details
  escrow_amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'RWF',
  
  -- Workflow
  buyer_deposited_at TIMESTAMPTZ,
  seller_confirmed_delivery BOOLEAN DEFAULT FALSE,
  seller_confirmed_at TIMESTAMPTZ,
  buyer_confirmed_receipt BOOLEAN DEFAULT FALSE,
  buyer_confirmed_at TIMESTAMPTZ,
  
  -- Release
  released_at TIMESTAMPTZ,
  released_to TEXT, -- 'seller' or 'buyer' (in case of dispute)
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'deposited', 'in_transit', 'completed', 'disputed', 'refunded')),
  
  -- Dispute handling
  dispute_reason TEXT,
  dispute_opened_at TIMESTAMPTZ,
  dispute_resolved_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_escrow_transactions_transaction ON escrow_transactions(transaction_id);
CREATE INDEX idx_escrow_transactions_status ON escrow_transactions(status);

COMMENT ON TABLE escrow_transactions IS 'Escrow service for high-value marketplace transactions';

-- =====================================================
-- 6. UPDATE EXISTING TABLES
-- =====================================================

-- Add rating columns to business_directory if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_directory' AND column_name = 'rating') THEN
    ALTER TABLE business_directory ADD COLUMN rating NUMERIC(2,1);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_directory' AND column_name = 'review_count') THEN
    ALTER TABLE business_directory ADD COLUMN review_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- Add rating columns to unified_listings if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'unified_listings' AND column_name = 'rating') THEN
    ALTER TABLE unified_listings ADD COLUMN rating NUMERIC(2,1);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'unified_listings' AND column_name = 'review_count') THEN
    ALTER TABLE unified_listings ADD COLUMN review_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- Add escrow flag to marketplace_transactions if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'marketplace_transactions' AND column_name = 'escrow_requested') THEN
    ALTER TABLE marketplace_transactions ADD COLUMN escrow_requested BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- =====================================================
-- 7. FUNCTIONS & TRIGGERS
-- =====================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all new tables
CREATE TRIGGER update_ratings_reviews_updated_at
  BEFORE UPDATE ON ratings_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_moderation_updated_at
  BEFORE UPDATE ON content_moderation
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_opportunities_updated_at
  BEFORE UPDATE ON business_opportunities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_escrow_transactions_updated_at
  BEFORE UPDATE ON escrow_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 8. RLS POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE ratings_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_moderation ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow_transactions ENABLE ROW LEVEL SECURITY;

-- Ratings & Reviews: Anyone can read active reviews, only reviewer can update own
CREATE POLICY "Anyone can view active reviews"
  ON ratings_reviews FOR SELECT
  USING (status = 'active');

CREATE POLICY "Users can create reviews"
  ON ratings_reviews FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own reviews"
  ON ratings_reviews FOR UPDATE
  USING (reviewer_phone = current_setting('request.jwt.claim.phone', true));

-- Content Moderation: Only moderators can view
CREATE POLICY "Service role can manage moderation"
  ON content_moderation FOR ALL
  USING (auth.role() = 'service_role');

-- User Favorites: Users can only see/manage their own
CREATE POLICY "Users can view own favorites"
  ON user_favorites FOR SELECT
  USING (user_phone = current_setting('request.jwt.claim.phone', true));

CREATE POLICY "Users can create favorites"
  ON user_favorites FOR INSERT
  WITH CHECK (user_phone = current_setting('request.jwt.claim.phone', true));

CREATE POLICY "Users can delete own favorites"
  ON user_favorites FOR DELETE
  USING (user_phone = current_setting('request.jwt.claim.phone', true));

-- Business Opportunities: Public read, owner write
CREATE POLICY "Anyone can view active opportunities"
  ON business_opportunities FOR SELECT
  USING (status = 'active');

CREATE POLICY "Users can create opportunities"
  ON business_opportunities FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Owners can update own opportunities"
  ON business_opportunities FOR UPDATE
  USING (owner_phone = current_setting('request.jwt.claim.phone', true));

-- Escrow Transactions: Only involved parties and service role
CREATE POLICY "Service role can manage escrow"
  ON escrow_transactions FOR ALL
  USING (auth.role() = 'service_role');

-- =====================================================
-- 9. HELPER FUNCTIONS
-- =====================================================

-- Get average rating for a target
CREATE OR REPLACE FUNCTION get_average_rating(
  p_target_id UUID,
  p_target_type TEXT
)
RETURNS NUMERIC AS $$
DECLARE
  v_avg_rating NUMERIC;
BEGIN
  SELECT ROUND(AVG(rating)::NUMERIC, 1)
  INTO v_avg_rating
  FROM ratings_reviews
  WHERE target_id = p_target_id
    AND target_type = p_target_type
    AND status = 'active';
  
  RETURN COALESCE(v_avg_rating, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- Get review count for a target
CREATE OR REPLACE FUNCTION get_review_count(
  p_target_id UUID,
  p_target_type TEXT
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM ratings_reviews
  WHERE target_id = p_target_id
    AND target_type = p_target_type
    AND status = 'active';
  
  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- Flag content for moderation
CREATE OR REPLACE FUNCTION flag_for_moderation(
  p_content_id UUID,
  p_content_type TEXT,
  p_reason TEXT
)
RETURNS VOID AS $$
BEGIN
  -- Insert moderation record
  INSERT INTO content_moderation (
    content_id,
    content_type,
    reason,
    status
  ) VALUES (
    p_content_id,
    p_content_type,
    p_reason,
    'pending'
  );
  
  -- Mark content as flagged based on type
  CASE p_content_type
    WHEN 'listing' THEN
      UPDATE unified_listings
      SET status = 'flagged'
      WHERE id = p_content_id;
    
    WHEN 'business' THEN
      UPDATE business_directory
      SET status = 'FLAGGED'
      WHERE id = p_content_id;
    
    WHEN 'review' THEN
      UPDATE ratings_reviews
      SET status = 'flagged'
      WHERE id = p_content_id;
    
    WHEN 'opportunity' THEN
      UPDATE business_opportunities
      SET status = 'closed'
      WHERE id = p_content_id;
  END CASE;
END;
$$ LANGUAGE plpgsql;

COMMIT;
