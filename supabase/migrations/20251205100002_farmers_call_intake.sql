-- ============================================================================
-- Farmers Call Intake Schema
-- Structured capture for farmer/buyer produce-related calls
-- ============================================================================

BEGIN;

-- Farmers call intake table
CREATE TABLE IF NOT EXISTS farmers_call_intakes (
  call_id UUID PRIMARY KEY REFERENCES calls(id) ON DELETE CASCADE,
  side TEXT NOT NULL CHECK (side IN ('farmer','buyer')),
  
  -- Produce details
  produce_type TEXT NOT NULL,           -- e.g. 'tomatoes', 'irish_potatoes', 'maize'
  variety TEXT,                         -- e.g. 'Kinigi', 'Roma', 'Cherry'
  
  -- Quantity
  quantity NUMERIC,                     -- Number amount
  unit TEXT,                            -- 'kg','ton','sack','crate','piece'
  
  -- Timing (for farmers: when produce ready, for buyers: delivery window)
  expected_harvest_date DATE,           -- For farmers
  delivery_window_start DATE,           -- For buyers
  delivery_window_end DATE,             -- For buyers
  
  -- Location
  location_country TEXT DEFAULT 'Rwanda',
  location_district TEXT,
  location_sector TEXT,
  location_cell TEXT,
  farm_coordinates GEOGRAPHY(POINT, 4326),  -- GPS if available
  
  -- Pricing
  min_price NUMERIC,                    -- Price per unit
  max_price NUMERIC,
  currency TEXT DEFAULT 'RWF',
  
  -- Quality
  quality_grade TEXT,                   -- A/B/C, Premium/Standard, etc.
  organic BOOLEAN DEFAULT false,
  certifications TEXT[],                -- e.g. 'organic', 'fair_trade'
  
  -- Payment preferences
  payment_preference TEXT CHECK (payment_preference IN ('wallet','cod','bank_transfer','mobile_money')),
  
  -- Notes
  notes TEXT,
  
  -- Metadata
  extracted_from_summary BOOLEAN DEFAULT false,
  confidence_score NUMERIC(4,3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_farmers_call_intakes_side ON farmers_call_intakes(side);
CREATE INDEX IF NOT EXISTS idx_farmers_call_intakes_produce ON farmers_call_intakes(produce_type);
CREATE INDEX IF NOT EXISTS idx_farmers_call_intakes_location ON farmers_call_intakes(location_district, location_sector);
CREATE INDEX IF NOT EXISTS idx_farmers_call_intakes_harvest ON farmers_call_intakes(expected_harvest_date) WHERE side = 'farmer';
CREATE INDEX IF NOT EXISTS idx_farmers_call_intakes_delivery ON farmers_call_intakes(delivery_window_start, delivery_window_end) WHERE side = 'buyer';

-- Farmers matches table
CREATE TABLE IF NOT EXISTS farmers_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- The intake that triggered matching
  intake_call_id UUID NOT NULL REFERENCES farmers_call_intakes(call_id) ON DELETE CASCADE,
  
  -- The matched party
  matched_intake_call_id UUID REFERENCES farmers_call_intakes(call_id),
  matched_listing_id UUID,              -- Reference to existing produce_listings if applicable
  
  -- Match details
  farmer_intake_id UUID REFERENCES farmers_call_intakes(call_id),
  buyer_intake_id UUID REFERENCES farmers_call_intakes(call_id),
  
  -- Scoring
  match_score NUMERIC(5,4) NOT NULL,    -- 0.0000 to 1.0000
  match_reasons JSONB DEFAULT '[]'::jsonb,
  
  -- Matched terms
  agreed_quantity NUMERIC,
  agreed_unit TEXT,
  agreed_price NUMERIC,
  agreed_delivery_date DATE,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'notified', 'negotiating', 'confirmed', 'rejected', 'expired', 'completed')),
  notified_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '3 days')
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_farmers_matches_intake ON farmers_matches(intake_call_id);
CREATE INDEX IF NOT EXISTS idx_farmers_matches_farmer ON farmers_matches(farmer_intake_id);
CREATE INDEX IF NOT EXISTS idx_farmers_matches_buyer ON farmers_matches(buyer_intake_id);
CREATE INDEX IF NOT EXISTS idx_farmers_matches_status ON farmers_matches(status);
CREATE INDEX IF NOT EXISTS idx_farmers_matches_score ON farmers_matches(match_score DESC);

-- Comments
COMMENT ON TABLE farmers_call_intakes IS 'Structured produce data from farmer/buyer calls';
COMMENT ON COLUMN farmers_call_intakes.side IS 'Whether caller is a farmer (supply) or buyer (demand)';
COMMENT ON COLUMN farmers_call_intakes.produce_type IS 'Type of produce (normalized name)';
COMMENT ON COLUMN farmers_call_intakes.variety IS 'Specific variety of the produce';

COMMENT ON TABLE farmers_matches IS 'Matches between farmer supply and buyer demand';
COMMENT ON COLUMN farmers_matches.match_score IS 'Computed compatibility score';
COMMENT ON COLUMN farmers_matches.agreed_price IS 'Final negotiated price if confirmed';

-- Enable RLS
ALTER TABLE farmers_call_intakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE farmers_matches ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Service role can manage farmers intakes"
  ON farmers_call_intakes FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Users can view their own farmer intakes"
  ON farmers_call_intakes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM calls WHERE calls.id = farmers_call_intakes.call_id AND calls.user_id = auth.uid()
  ));

CREATE POLICY "Service role can manage farmers matches"
  ON farmers_matches FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Users can view their own farmer matches"
  ON farmers_matches FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM farmers_call_intakes fci
    JOIN calls c ON c.id = fci.call_id
    WHERE fci.call_id = farmers_matches.intake_call_id AND c.user_id = auth.uid()
  ));

COMMIT;
