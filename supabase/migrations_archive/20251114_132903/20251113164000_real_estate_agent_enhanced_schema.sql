-- Real Estate AI Agent Enhanced Schema
-- Phase 1: Additional tables for comprehensive property management
-- Migration: 20251113164000_real_estate_agent_enhanced_schema.sql

BEGIN;

-- ============================================================================
-- ENHANCED LISTINGS TABLE
-- Extends the basic properties table with additional fields for
-- external sources, owner outreach tracking, and advanced metadata
-- ============================================================================

CREATE TABLE IF NOT EXISTS listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Core Property Information
  title TEXT NOT NULL,
  description TEXT,
  property_type TEXT NOT NULL CHECK (property_type IN ('apartment', 'house', 'studio', 'villa', 'condo', 'room')),
  bedrooms INTEGER NOT NULL CHECK (bedrooms >= 0),
  bathrooms NUMERIC(3,1) CHECK (bathrooms >= 0),
  furnished BOOLEAN DEFAULT false,
  amenities TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Pricing
  price_amount NUMERIC(12,2) NOT NULL CHECK (price_amount > 0),
  price_currency TEXT NOT NULL DEFAULT 'RWF',
  price_unit TEXT NOT NULL DEFAULT 'per_month' CHECK (price_unit IN ('per_day', 'per_night', 'per_month', 'per_year')),
  
  -- Location
  address TEXT NOT NULL,
  city TEXT,
  country TEXT NOT NULL DEFAULT 'RW',
  geo GEOGRAPHY(POINT, 4326),
  
  -- Media
  photos JSONB DEFAULT '[]'::JSONB,
  
  -- Source tracking
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'airbnb', 'booking', 'import', 'api')),
  external_ref TEXT,
  
  -- Owner information
  owner_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  owner_contact JSONB, -- {phone, email, whatsapp, preferred_method}
  
  -- Availability
  availability JSONB DEFAULT '{}'::JSONB, -- {available_from, available_to, blocked_dates, minimum_stay, maximum_stay}
  
  -- Status
  active BOOLEAN DEFAULT true,
  verified BOOLEAN DEFAULT false,
  
  -- Metadata
  views_count INTEGER DEFAULT 0,
  inquiries_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT listings_unique_external_ref UNIQUE NULLS NOT DISTINCT (source, external_ref)
);

-- Indexes for listings
CREATE INDEX IF NOT EXISTS idx_listings_org_id ON listings(org_id);
CREATE INDEX IF NOT EXISTS idx_listings_geo ON listings USING GIST(geo);
CREATE INDEX IF NOT EXISTS idx_listings_property_type ON listings(property_type);
CREATE INDEX IF NOT EXISTS idx_listings_bedrooms ON listings(bedrooms);
CREATE INDEX IF NOT EXISTS idx_listings_price ON listings(price_amount);
CREATE INDEX IF NOT EXISTS idx_listings_active ON listings(active);
CREATE INDEX IF NOT EXISTS idx_listings_source ON listings(source);
CREATE INDEX IF NOT EXISTS idx_listings_owner ON listings(owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_listings_created_at ON listings(created_at DESC);

-- Full-text search on listings
CREATE INDEX IF NOT EXISTS idx_listings_search ON listings USING GIN (
  to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(description, '') || ' ' || COALESCE(address, ''))
);

-- ============================================================================
-- PROPERTY REQUESTS TABLE
-- Structured storage of user property search requirements
-- ============================================================================

CREATE TABLE IF NOT EXISTS property_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  user_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Request metadata
  language TEXT NOT NULL DEFAULT 'en',
  stay_kind TEXT NOT NULL CHECK (stay_kind IN ('short_term', 'long_term')),
  
  -- Budget
  budget_min NUMERIC(12,2),
  budget_max NUMERIC(12,2),
  currency TEXT NOT NULL DEFAULT 'RWF',
  
  -- Dates (for short-term)
  start_date DATE,
  end_date DATE,
  lease_months INTEGER, -- for long-term rentals
  
  -- Location preferences
  preferred_areas TEXT[] DEFAULT ARRAY[]::TEXT[],
  preferred_cities TEXT[] DEFAULT ARRAY[]::TEXT[],
  max_distance_km NUMERIC(6,2),
  center_point GEOGRAPHY(POINT, 4326),
  
  -- Property preferences
  property_types TEXT[] DEFAULT ARRAY[]::TEXT[],
  bedrooms_min INTEGER,
  bedrooms_max INTEGER,
  furnished BOOLEAN,
  special_requirements TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Request status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'searching', 'shortlisted', 'selected', 'completed', 'cancelled', 'expired')),
  
  -- AI processing metadata
  ai_summary TEXT,
  ai_processed_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

-- Indexes for property_requests
CREATE INDEX IF NOT EXISTS idx_property_requests_org_id ON property_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_property_requests_conversation ON property_requests(conversation_id);
CREATE INDEX IF NOT EXISTS idx_property_requests_user ON property_requests(user_profile_id);
CREATE INDEX IF NOT EXISTS idx_property_requests_status ON property_requests(status);
CREATE INDEX IF NOT EXISTS idx_property_requests_created_at ON property_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_property_requests_center_point ON property_requests USING GIST(center_point);

-- ============================================================================
-- SHORTLISTS TABLE
-- AI-curated Top-5 property recommendations with rationale
-- ============================================================================

CREATE TABLE IF NOT EXISTS shortlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES property_requests(id) ON DELETE CASCADE,
  
  -- Shortlist items (Top 5 with AI rationale)
  items JSONB NOT NULL DEFAULT '[]'::JSONB,
  -- Structure: [{listing_id, rank, match_score, pros, cons, ai_explanation}, ...]
  
  -- AI generation metadata
  algorithm_version TEXT DEFAULT 'v1',
  generation_time_ms INTEGER,
  
  -- User interaction
  viewed_at TIMESTAMPTZ,
  selections JSONB DEFAULT '[]'::JSONB, -- [{listing_id, selected_at, action}]
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for shortlists
CREATE INDEX IF NOT EXISTS idx_shortlists_request ON shortlists(request_id);
CREATE INDEX IF NOT EXISTS idx_shortlists_created_at ON shortlists(created_at DESC);

-- ============================================================================
-- OWNER OUTREACH TABLE
-- Track communication with property owners (WhatsApp, Voice, SMS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS owner_outreach (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES property_requests(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  owner_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Communication channel
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'voice', 'sms', 'email')),
  
  -- Outreach status
  last_status TEXT NOT NULL DEFAULT 'pending' CHECK (
    last_status IN ('pending', 'sent', 'delivered', 'read', 'replied', 'interested', 'not_interested', 'unavailable', 'error')
  ),
  
  -- Negotiation tracking
  negotiation JSONB DEFAULT '{}'::JSONB,
  -- Structure: {initial_price, counter_offer, final_price, terms, notes}
  
  -- Conversation transcript
  transcript JSONB DEFAULT '[]'::JSONB,
  -- Structure: [{timestamp, direction, message, metadata}]
  
  -- Communication metadata
  message_id TEXT, -- External message ID (WhatsApp, Twilio, etc.)
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  
  -- Error tracking
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for owner_outreach
CREATE INDEX IF NOT EXISTS idx_owner_outreach_request ON owner_outreach(request_id);
CREATE INDEX IF NOT EXISTS idx_owner_outreach_listing ON owner_outreach(listing_id);
CREATE INDEX IF NOT EXISTS idx_owner_outreach_owner ON owner_outreach(owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_owner_outreach_channel ON owner_outreach(channel);
CREATE INDEX IF NOT EXISTS idx_owner_outreach_status ON owner_outreach(last_status);
CREATE INDEX IF NOT EXISTS idx_owner_outreach_created_at ON owner_outreach(created_at DESC);

-- ============================================================================
-- ANALYTICS EVENTS EXTENSION
-- Add property-specific event tracking
-- ============================================================================

-- Extend existing analytics_events table if it exists
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'analytics_events') THEN
    -- Add property-specific event types
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_analytics_events_property_request 
             ON analytics_events((event_data->>''request_id'')) 
             WHERE event_type LIKE ''property%''';
    
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_analytics_events_property_listing 
             ON analytics_events((event_data->>''listing_id'')) 
             WHERE event_type LIKE ''property%''';
  END IF;
END $$;

-- ============================================================================
-- RLS POLICIES
-- Secure data access with multi-tenant isolation
-- ============================================================================

-- Listings policies
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_read_listings"
  ON listings FOR SELECT
  USING (
    org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid())
    OR active = true -- Public listings visible to all
  );

CREATE POLICY "org_admins_write_listings"
  ON listings FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'owner')
    )
  );

-- Property requests policies
ALTER TABLE property_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_requests"
  ON property_requests FOR SELECT
  USING (
    user_profile_id = auth.uid()
    OR org_id IN (
      SELECT org_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'owner', 'support')
    )
  );

CREATE POLICY "users_create_own_requests"
  ON property_requests FOR INSERT
  WITH CHECK (user_profile_id = auth.uid());

CREATE POLICY "users_update_own_requests"
  ON property_requests FOR UPDATE
  USING (user_profile_id = auth.uid());

-- Shortlists policies
ALTER TABLE shortlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_shortlists"
  ON shortlists FOR SELECT
  USING (
    request_id IN (
      SELECT id FROM property_requests WHERE user_profile_id = auth.uid()
    )
    OR request_id IN (
      SELECT pr.id FROM property_requests pr
      JOIN profiles p ON p.org_id = pr.org_id
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'owner', 'support')
    )
  );

CREATE POLICY "system_create_shortlists"
  ON shortlists FOR INSERT
  WITH CHECK (true); -- System/service role creates shortlists

-- Owner outreach policies
ALTER TABLE owner_outreach ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners_read_own_outreach"
  ON owner_outreach FOR SELECT
  USING (
    owner_profile_id = auth.uid()
    OR request_id IN (
      SELECT id FROM property_requests WHERE user_profile_id = auth.uid()
    )
    OR listing_id IN (
      SELECT id FROM listings 
      WHERE org_id IN (
        SELECT org_id FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'owner', 'support')
      )
    )
  );

CREATE POLICY "system_write_outreach"
  ON owner_outreach FOR ALL
  USING (true); -- System/service role manages outreach

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_listings_updated_at
  BEFORE UPDATE ON listings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_property_requests_updated_at
  BEFORE UPDATE ON property_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_owner_outreach_updated_at
  BEFORE UPDATE ON owner_outreach
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to search listings with advanced filters
CREATE OR REPLACE FUNCTION search_listings(
  p_org_id UUID DEFAULT NULL,
  p_center_point GEOGRAPHY DEFAULT NULL,
  p_radius_km NUMERIC DEFAULT 10,
  p_property_types TEXT[] DEFAULT NULL,
  p_bedrooms_min INTEGER DEFAULT NULL,
  p_bedrooms_max INTEGER DEFAULT NULL,
  p_price_min NUMERIC DEFAULT NULL,
  p_price_max NUMERIC DEFAULT NULL,
  p_currency TEXT DEFAULT 'RWF',
  p_furnished BOOLEAN DEFAULT NULL,
  p_amenities TEXT[] DEFAULT NULL,
  p_search_text TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  property_type TEXT,
  bedrooms INTEGER,
  bathrooms NUMERIC,
  price_amount NUMERIC,
  price_currency TEXT,
  address TEXT,
  city TEXT,
  photos JSONB,
  amenities TEXT[],
  distance_km NUMERIC,
  match_score INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id,
    l.title,
    l.description,
    l.property_type,
    l.bedrooms,
    l.bathrooms,
    l.price_amount,
    l.price_currency,
    l.address,
    l.city,
    l.photos,
    l.amenities,
    CASE 
      WHEN p_center_point IS NOT NULL THEN 
        ST_Distance(l.geo, p_center_point) / 1000.0
      ELSE NULL
    END AS distance_km,
    100 AS match_score -- TODO: Implement proper scoring algorithm
  FROM listings l
  WHERE 
    l.active = true
    AND (p_org_id IS NULL OR l.org_id = p_org_id)
    AND (p_center_point IS NULL OR ST_DWithin(l.geo, p_center_point, p_radius_km * 1000))
    AND (p_property_types IS NULL OR l.property_type = ANY(p_property_types))
    AND (p_bedrooms_min IS NULL OR l.bedrooms >= p_bedrooms_min)
    AND (p_bedrooms_max IS NULL OR l.bedrooms <= p_bedrooms_max)
    AND (p_price_min IS NULL OR (l.price_amount >= p_price_min AND l.price_currency = p_currency))
    AND (p_price_max IS NULL OR (l.price_amount <= p_price_max AND l.price_currency = p_currency))
    AND (p_furnished IS NULL OR l.furnished = p_furnished)
    AND (p_amenities IS NULL OR l.amenities @> p_amenities)
    AND (p_search_text IS NULL OR 
         to_tsvector('english', COALESCE(l.title, '') || ' ' || COALESCE(l.description, '') || ' ' || COALESCE(l.address, ''))
         @@ plainto_tsquery('english', p_search_text))
  ORDER BY
    CASE WHEN p_center_point IS NOT NULL THEN ST_Distance(l.geo, p_center_point) ELSE 0 END
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION search_listings TO authenticated;

COMMIT;
