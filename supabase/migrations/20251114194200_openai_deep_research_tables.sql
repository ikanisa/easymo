-- =====================================================
-- OpenAI Deep Research - Database Schema
-- =====================================================
BEGIN;

-- Research Sessions Table
CREATE TABLE IF NOT EXISTS research_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  properties_found INT DEFAULT 0,
  properties_inserted INT DEFAULT 0,
  properties_failed INT DEFAULT 0,
  properties_duplicate INT DEFAULT 0,
  duration_ms INT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Researched Properties Table
CREATE TABLE IF NOT EXISTS researched_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  research_session_id UUID REFERENCES research_sessions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  property_type TEXT NOT NULL,
  bedrooms INT NOT NULL DEFAULT 1,
  bathrooms INT NOT NULL DEFAULT 1,
  price NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  rental_type TEXT NOT NULL CHECK (rental_type IN ('short_term', 'long_term')),
  location GEOGRAPHY(POINT),
  location_address TEXT,
  location_city TEXT,
  location_country TEXT,
  amenities TEXT[] DEFAULT '{}',
  description TEXT,
  source TEXT NOT NULL, -- Source of the property (Econfary API, SerpAPI, OpenAI Deep Research)
  source_url TEXT, -- URL to original listing
  contact_info TEXT NOT NULL, -- Required: WhatsApp/phone number with country code
  available_from DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'rented', 'unavailable')),
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_contact CHECK (contact_info IS NOT NULL AND length(contact_info) >= 10)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_research_sessions_status ON research_sessions(status);
CREATE INDEX IF NOT EXISTS idx_research_sessions_started_at ON research_sessions(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_researched_properties_session ON researched_properties(research_session_id);
CREATE INDEX IF NOT EXISTS idx_researched_properties_location ON researched_properties USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_researched_properties_rental_type ON researched_properties(rental_type);
CREATE INDEX IF NOT EXISTS idx_researched_properties_price ON researched_properties(price);
CREATE INDEX IF NOT EXISTS idx_researched_properties_bedrooms ON researched_properties(bedrooms);
CREATE INDEX IF NOT EXISTS idx_researched_properties_status ON researched_properties(status);
CREATE INDEX IF NOT EXISTS idx_researched_properties_country ON researched_properties(location_country);
CREATE INDEX IF NOT EXISTS idx_researched_properties_city ON researched_properties(location_city);
CREATE INDEX IF NOT EXISTS idx_researched_properties_contact ON researched_properties(contact_info); -- For contact lookups
CREATE INDEX IF NOT EXISTS idx_researched_properties_source ON researched_properties(source); -- For source filtering

-- RLS Policies
ALTER TABLE research_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE researched_properties ENABLE ROW LEVEL SECURITY;

-- Public read access for researched properties
DROP POLICY IF EXISTS researched_properties_public_read ON researched_properties;
CREATE POLICY researched_properties_public_read ON researched_properties
  FOR SELECT USING (status = 'active');

-- Admin-only write access
DROP POLICY IF EXISTS research_sessions_admin_all ON research_sessions;
CREATE POLICY research_sessions_admin_all ON research_sessions
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS researched_properties_admin_all ON researched_properties;
CREATE POLICY researched_properties_admin_all ON researched_properties
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Function to search researched properties
CREATE OR REPLACE FUNCTION search_researched_properties(
  p_latitude FLOAT,
  p_longitude FLOAT,
  p_radius_km FLOAT DEFAULT 10,
  p_rental_type TEXT DEFAULT NULL,
  p_bedrooms INT DEFAULT NULL,
  p_min_budget NUMERIC DEFAULT 0,
  p_max_budget NUMERIC DEFAULT 999999999
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  property_type TEXT,
  bedrooms INT,
  bathrooms INT,
  price NUMERIC,
  currency TEXT,
  rental_type TEXT,
  location_address TEXT,
  location_city TEXT,
  location_country TEXT,
  amenities TEXT[],
  description TEXT,
  source TEXT,
  contact_info TEXT,
  available_from DATE,
  distance FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    rp.id,
    rp.title,
    rp.property_type,
    rp.bedrooms,
    rp.bathrooms,
    rp.price,
    rp.currency,
    rp.rental_type,
    rp.location_address,
    rp.location_city,
    rp.location_country,
    rp.amenities,
    rp.description,
    rp.source,
    rp.contact_info,
    rp.available_from,
    ST_Distance(
      rp.location::geography,
      ST_MakePoint(p_longitude, p_latitude)::geography
    ) / 1000.0 AS distance
  FROM researched_properties rp
  WHERE
    rp.status = 'active'
    AND (p_rental_type IS NULL OR rp.rental_type = p_rental_type)
    AND (p_bedrooms IS NULL OR rp.bedrooms >= p_bedrooms)
    AND rp.price BETWEEN p_min_budget AND p_max_budget
    AND rp.location IS NOT NULL
    AND ST_DWithin(
      rp.location::geography,
      ST_MakePoint(p_longitude, p_latitude)::geography,
      p_radius_km * 1000
    )
  ORDER BY distance ASC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql STABLE;

COMMIT;
