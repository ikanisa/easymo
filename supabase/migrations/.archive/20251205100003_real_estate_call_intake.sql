-- ============================================================================
-- Real Estate Call Intake Schema
-- Structured capture for property-related calls (buyers, tenants, owners, landlords)
-- ============================================================================

BEGIN;

-- Real estate call intake table
CREATE TABLE IF NOT EXISTS real_estate_call_intakes (
  call_id UUID PRIMARY KEY REFERENCES calls(id) ON DELETE CASCADE,
  side TEXT NOT NULL CHECK (side IN ('buyer','tenant','owner','landlord')),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('buy','rent')),
  
  -- Property details
  property_type TEXT,                 -- 'apartment','house','plot','commercial','warehouse','office'
  bedrooms INTEGER,
  bathrooms INTEGER,
  
  -- Amenities
  parking BOOLEAN,
  parking_spots INTEGER,
  furnished BOOLEAN,
  furnished_level TEXT,               -- 'fully','partially','unfurnished'
  
  -- Size
  size_sqm NUMERIC,
  plot_size_sqm NUMERIC,
  
  -- Location
  location_country TEXT DEFAULT 'Rwanda',
  location_city TEXT,
  location_district TEXT,
  location_sector TEXT,
  location_street TEXT,
  preferred_neighborhoods TEXT[],     -- For seekers: desired areas
  
  -- Budget
  budget_min NUMERIC,
  budget_max NUMERIC,
  currency TEXT DEFAULT 'RWF',
  payment_frequency TEXT CHECK (payment_frequency IN ('monthly','quarterly','yearly','one_time')),
  
  -- Timing
  move_in_date DATE,
  stay_duration_months INTEGER,       -- For rentals
  urgency TEXT CHECK (urgency IN ('immediate','flexible','within_month','within_3_months')),
  
  -- Requirements
  must_haves TEXT[],                  -- Non-negotiable features
  nice_to_haves TEXT[],               -- Preferred but optional
  deal_breakers TEXT[],               -- Absolute no-gos
  
  -- For owners/landlords listing
  listing_title TEXT,
  listing_price NUMERIC,
  available_from DATE,
  
  -- Notes
  notes TEXT,
  
  -- Metadata
  extracted_from_summary BOOLEAN DEFAULT false,
  confidence_score NUMERIC(4,3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_real_estate_intakes_side ON real_estate_call_intakes(side);
CREATE INDEX IF NOT EXISTS idx_real_estate_intakes_transaction ON real_estate_call_intakes(transaction_type);
CREATE INDEX IF NOT EXISTS idx_real_estate_intakes_property ON real_estate_call_intakes(property_type);
CREATE INDEX IF NOT EXISTS idx_real_estate_intakes_location ON real_estate_call_intakes(location_district, location_sector);
CREATE INDEX IF NOT EXISTS idx_real_estate_intakes_budget ON real_estate_call_intakes(budget_min, budget_max);
CREATE INDEX IF NOT EXISTS idx_real_estate_intakes_bedrooms ON real_estate_call_intakes(bedrooms) WHERE bedrooms IS NOT NULL;

-- Real estate matches table
CREATE TABLE IF NOT EXISTS real_estate_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- The intake that triggered matching
  intake_call_id UUID NOT NULL REFERENCES real_estate_call_intakes(call_id) ON DELETE CASCADE,
  
  -- The matched party
  matched_intake_call_id UUID REFERENCES real_estate_call_intakes(call_id),
  matched_listing_id UUID,              -- Reference to existing property_listings
  
  -- Match sides (seeker <-> lister)
  seeker_intake_id UUID REFERENCES real_estate_call_intakes(call_id),
  lister_intake_id UUID REFERENCES real_estate_call_intakes(call_id),
  
  -- Scoring
  match_score NUMERIC(5,4) NOT NULL,
  match_reasons JSONB DEFAULT '[]'::jsonb,
  
  -- Property details (denormalized for notifications)
  property_summary TEXT,
  property_location TEXT,
  property_price NUMERIC,
  
  -- Deep search results (if from external API)
  external_source TEXT,                 -- 'exa', 'tavily', 'internal'
  external_listing_url TEXT,
  external_listing_data JSONB,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'notified', 'viewing_scheduled', 'viewed', 'interested', 'rejected', 'expired')),
  viewing_scheduled_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  notified_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '14 days')
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_real_estate_matches_intake ON real_estate_matches(intake_call_id);
CREATE INDEX IF NOT EXISTS idx_real_estate_matches_seeker ON real_estate_matches(seeker_intake_id);
CREATE INDEX IF NOT EXISTS idx_real_estate_matches_lister ON real_estate_matches(lister_intake_id);
CREATE INDEX IF NOT EXISTS idx_real_estate_matches_status ON real_estate_matches(status);
CREATE INDEX IF NOT EXISTS idx_real_estate_matches_score ON real_estate_matches(match_score DESC);
CREATE INDEX IF NOT EXISTS idx_real_estate_matches_external ON real_estate_matches(external_source) WHERE external_source IS NOT NULL;

-- Comments
COMMENT ON TABLE real_estate_call_intakes IS 'Structured property requirements from calls';
COMMENT ON COLUMN real_estate_call_intakes.side IS 'Caller role: buyer/tenant (seeking) or owner/landlord (listing)';
COMMENT ON COLUMN real_estate_call_intakes.must_haves IS 'Non-negotiable property features';
COMMENT ON COLUMN real_estate_call_intakes.preferred_neighborhoods IS 'Desired areas for property seekers';

COMMENT ON TABLE real_estate_matches IS 'Property matches from internal listings or external search';
COMMENT ON COLUMN real_estate_matches.external_source IS 'Source of match: exa, tavily, or internal database';
COMMENT ON COLUMN real_estate_matches.external_listing_data IS 'Raw data from external property APIs';

-- Enable RLS
ALTER TABLE real_estate_call_intakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_estate_matches ENABLE ROW LEVEL SECURITY;

-- RLS policies
DROP POLICY IF EXISTS "Service role can manage real estate intakes" ON real_estate_call_intakes;
CREATE POLICY "Service role can manage real estate intakes"
  ON real_estate_call_intakes FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Users can view their own real estate intakes" ON real_estate_call_intakes;
CREATE POLICY "Users can view their own real estate intakes"
  ON real_estate_call_intakes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM calls WHERE calls.id = real_estate_call_intakes.call_id AND calls.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Service role can manage real estate matches" ON real_estate_matches;
CREATE POLICY "Service role can manage real estate matches"
  ON real_estate_matches FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Users can view their own real estate matches" ON real_estate_matches;
CREATE POLICY "Users can view their own real estate matches"
  ON real_estate_matches FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM real_estate_call_intakes rei
    JOIN calls c ON c.id = rei.call_id
    WHERE rei.call_id = real_estate_matches.intake_call_id AND c.user_id = auth.uid()
  ));

COMMIT;
