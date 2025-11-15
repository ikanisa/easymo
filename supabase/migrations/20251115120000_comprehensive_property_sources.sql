-- =====================================================
-- COMPREHENSIVE PROPERTY SOURCES FOR MALTA & RWANDA
-- =====================================================
-- Configures extensive property scraping from ALL major platforms
-- =====================================================

BEGIN;

-- Create property_sources table (similar to job_sources)
CREATE TABLE IF NOT EXISTS property_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('openai_deep_research', 'serpapi', 'econfary_api', 'custom_api')),
  base_url text,
  config jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add source reference to researched_properties
ALTER TABLE researched_properties
  ADD COLUMN IF NOT EXISTS property_source_id uuid REFERENCES property_sources(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS property_hash text,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz DEFAULT now();

-- Create unique index for deduplication
CREATE UNIQUE INDEX IF NOT EXISTS researched_properties_hash_uniq 
  ON researched_properties(property_hash) 
  WHERE property_hash IS NOT NULL;

-- =====================================================
-- MALTA PROPERTY SOURCES (Comprehensive Coverage)
-- =====================================================

-- Malta: Property.com.mt (Leading Portal)
INSERT INTO property_sources (name, source_type, base_url, config, is_active) VALUES
('Property.com.mt', 'openai_deep_research', 'https://www.property.com.mt', 
'{
  "queries": [
    {"country": "Malta", "city": "Valletta", "query": "site:property.com.mt rental apartments Valletta", "rental_type": "long_term"},
    {"country": "Malta", "city": "Sliema", "query": "site:property.com.mt rent Sliema apartments", "rental_type": "long_term"},
    {"country": "Malta", "city": "St. Julian''s", "query": "site:property.com.mt rental St Julians", "rental_type": "long_term"}
  ],
  "target": "malta",
  "priority": "high"
}'::jsonb, true);

-- Malta: Frank Salt Real Estate
INSERT INTO property_sources (name, source_type, base_url, config, is_active) VALUES
('Frank Salt Malta', 'openai_deep_research', 'https://www.franksalt.com.mt', 
'{
  "queries": [
    {"country": "Malta", "query": "site:franksalt.com.mt properties to let Malta", "rental_type": "long_term"},
    {"country": "Malta", "query": "site:franksalt.com.mt apartments for rent Malta contact", "rental_type": "long_term"}
  ],
  "target": "malta"
}'::jsonb, true);

-- Malta: QuentinBali (Major Agency)
INSERT INTO property_sources (name, source_type, base_url, config, is_active) VALUES
('QuentinBali Malta', 'openai_deep_research', 'https://www.quentinbali.com', 
'{
  "queries": [
    {"country": "Malta", "query": "site:quentinbali.com rental properties Malta"}
  ]
}'::jsonb, true);

-- Malta: Remax Malta
INSERT INTO property_sources (name, source_type, base_url, config, is_active) VALUES
('Remax Malta', 'openai_deep_research', 'https://www.remax-malta.com', 
'{
  "queries": [
    {"country": "Malta", "query": "site:remax-malta.com properties to let rent"}
  ]
}'::jsonb, true);

-- Malta: Simon Estates
INSERT INTO property_sources (name, source_type, base_url, config, is_active) VALUES
('Simon Estates Malta', 'openai_deep_research', 'https://www.simonestates.com', 
'{
  "queries": [
    {"country": "Malta", "query": "site:simonestates.com rental properties Malta"}
  ]
}'::jsonb, true);

-- Malta: Airbnb (Short-term)
INSERT INTO property_sources (name, source_type, base_url, config, is_active) VALUES
('Airbnb Malta', 'serpapi', 'https://www.airbnb.com', 
'{
  "queries": [
    {"country": "Malta", "query": "site:airbnb.com Malta rentals apartments", "rental_type": "short_term", "num_results": 30},
    {"country": "Malta", "query": "site:airbnb.com Valletta Sliema apartments", "rental_type": "short_term", "num_results": 20}
  ]
}'::jsonb, true);

-- Malta: Booking.com (Short-term)
INSERT INTO property_sources (name, source_type, base_url, config, is_active) VALUES
('Booking.com Malta', 'serpapi', 'https://www.booking.com', 
'{
  "queries": [
    {"country": "Malta", "query": "site:booking.com Malta apartments long stay", "rental_type": "short_term"}
  ]
}'::jsonb, true);

-- Malta: Malta Park (Classifieds)
INSERT INTO property_sources (name, source_type, base_url, config, is_active) VALUES
('Malta Park Classifieds', 'openai_deep_research', 'https://www.maltapark.com', 
'{
  "queries": [
    {"country": "Malta", "query": "site:maltapark.com property rent apartments houses"}
  ]
}'::jsonb, true);

-- Malta: ThinkProperty
INSERT INTO property_sources (name, source_type, base_url, config, is_active) VALUES
('ThinkProperty Malta', 'openai_deep_research', 'https://www.thinkproperty.com.mt', 
'{
  "queries": [
    {"country": "Malta", "query": "site:thinkproperty.com.mt rent apartments"}
  ]
}'::jsonb, true);

-- Malta: Chris Borda Estate Agents
INSERT INTO property_sources (name, source_type, base_url, config, is_active) VALUES
('Chris Borda Malta', 'openai_deep_research', 'https://www.chrisborda.com', 
'{
  "queries": [
    {"country": "Malta", "query": "site:chrisborda.com properties to let"}
  ]
}'::jsonb, true);

-- Malta: Dhalia Real Estate
INSERT INTO property_sources (name, source_type, base_url, config, is_active) VALUES
('Dhalia Real Estate Malta', 'openai_deep_research', 'https://www.dhalia.com.mt', 
'{
  "queries": [
    {"country": "Malta", "query": "site:dhalia.com.mt rent apartments contact phone"}
  ]
}'::jsonb, true);

-- Malta: Perry Estate Agents
INSERT INTO property_sources (name, source_type, base_url, config, is_active) VALUES
('Perry Estate Malta', 'openai_deep_research', 'https://www.perry.com.mt', 
'{
  "queries": [
    {"country": "Malta", "query": "site:perry.com.mt rental properties WhatsApp"}
  ]
}'::jsonb, true);

-- Malta: Zanzi Homes
INSERT INTO property_sources (name, source_type, base_url, config, is_active) VALUES
('Zanzi Homes Malta', 'openai_deep_research', 'https://www.zanzihomes.com', 
'{
  "queries": [
    {"country": "Malta", "query": "site:zanzihomes.com Malta properties rent"}
  ]
}'::jsonb, true);

-- Malta: E&S Group
INSERT INTO property_sources (name, source_type, base_url, config, is_active) VALUES
('E&S Group Malta', 'openai_deep_research', 'https://www.esgroup.com.mt', 
'{
  "queries": [
    {"country": "Malta", "query": "site:esgroup.com.mt rental properties contact"}
  ]
}'::jsonb, true);

-- Malta: Century 21 Malta
INSERT INTO property_sources (name, source_type, base_url, config, is_active) VALUES
('Century 21 Malta', 'openai_deep_search', 'https://www.century21.com.mt', 
'{
  "queries": [
    {"country": "Malta", "query": "site:century21.com.mt properties to let Malta"}
  ]
}'::jsonb, true);

-- =====================================================
-- RWANDA PROPERTY SOURCES (Comprehensive Coverage)
-- =====================================================

-- Rwanda: House.co.rw (Major Portal)
INSERT INTO property_sources (name, source_type, base_url, config, is_active) VALUES
('House.co.rw', 'openai_deep_research', 'https://house.co.rw', 
'{
  "queries": [
    {"country": "Rwanda", "city": "Kigali", "query": "site:house.co.rw rent Kigali apartments houses", "rental_type": "long_term"},
    {"country": "Rwanda", "query": "site:house.co.rw rental properties Rwanda contact", "rental_type": "long_term"}
  ],
  "target": "rwanda",
  "priority": "high"
}'::jsonb, true);

-- Rwanda: RealEstate.co.rw
INSERT INTO property_sources (name, source_type, base_url, config, is_active) VALUES
('RealEstate.co.rw', 'openai_deep_research', 'https://realestate.co.rw', 
'{
  "queries": [
    {"country": "Rwanda", "city": "Kigali", "query": "site:realestate.co.rw Kigali rent apartments"}
  ],
  "target": "rwanda"
}'::jsonb, true);

-- Rwanda: Booking.com (Hotels/Short-term)
INSERT INTO property_sources (name, source_type, base_url, config, is_active) VALUES
('Booking.com Rwanda', 'serpapi', 'https://www.booking.com', 
'{
  "queries": [
    {"country": "Rwanda", "query": "site:booking.com Kigali apartments long stay", "rental_type": "short_term"}
  ]
}'::jsonb, true);

-- Rwanda: Airbnb
INSERT INTO property_sources (name, source_type, base_url, config, is_active) VALUES
('Airbnb Rwanda', 'serpapi', 'https://www.airbnb.com', 
'{
  "queries": [
    {"country": "Rwanda", "query": "site:airbnb.com Kigali Rwanda apartments houses", "rental_type": "short_term", "num_results": 30}
  ]
}'::jsonb, true);

-- Rwanda: IremboHouse (Local Platform)
INSERT INTO property_sources (name, source_type, base_url, config, is_active) VALUES
('IremboHouse Rwanda', 'openai_deep_research', NULL, 
'{
  "queries": [
    {"country": "Rwanda", "query": "IremboHouse Kigali rental properties contact phone"}
  ]
}'::jsonb, true);

-- Rwanda: New Times Classifieds
INSERT INTO property_sources (name, source_type, base_url, config, is_active) VALUES
('New Times Property Classifieds', 'openai_deep_research', 'https://newtimes.co.rw', 
'{
  "queries": [
    {"country": "Rwanda", "query": "site:newtimes.co.rw property rent Kigali apartments"}
  ]
}'::jsonb, true);

-- Rwanda: Click.rw (Classifieds)
INSERT INTO property_sources (name, source_type, base_url, config, is_active) VALUES
('Click.rw Classifieds', 'openai_deep_research', 'https://click.rw', 
'{
  "queries": [
    {"country": "Rwanda", "query": "site:click.rw houses apartments rent Kigali"}
  ]
}'::jsonb, true);

-- Rwanda: Property Pro Rwanda
INSERT INTO property_sources (name, source_type, base_url, config, is_active) VALUES
('Property Pro Rwanda', 'openai_deep_research', NULL, 
'{
  "queries": [
    {"country": "Rwanda", "city": "Kigali", "query": "Property Pro Rwanda rentals Kigali phone contact"}
  ]
}'::jsonb, true);

-- Rwanda: Kigali Properties (Generic Search)
INSERT INTO property_sources (name, source_type, base_url, config, is_active) VALUES
('Kigali Properties General', 'openai_deep_research', NULL, 
'{
  "queries": [
    {"country": "Rwanda", "city": "Kigali", "query": "Kigali apartments for rent WhatsApp contact", "rental_type": "long_term"},
    {"country": "Rwanda", "city": "Kigali", "query": "Kigali houses to let phone number", "rental_type": "long_term"},
    {"country": "Rwanda", "query": "Rwanda property rental agents contact details"}
  ],
  "target": "rwanda",
  "focus": "contact_discovery"
}'::jsonb, true);

-- Rwanda: Rwanda Housing Authority
INSERT INTO property_sources (name, source_type, base_url, config, is_active) VALUES
('Rwanda Housing Authority', 'openai_deep_research', NULL, 
'{
  "queries": [
    {"country": "Rwanda", "query": "Rwanda Housing Authority rental properties contact"}
  ]
}'::jsonb, true);

-- Rwanda: Rwandan Real Estate Agents (Aggregated)
INSERT INTO property_sources (name, source_type, base_url, config, is_active) VALUES
('Rwanda Real Estate Agents', 'openai_deep_search', NULL, 
'{
  "queries": [
    {"country": "Rwanda", "city": "Kigali", "query": "Kigali real estate agents rental properties phone contact", "num_results": 30},
    {"country": "Rwanda", "query": "Rwanda property management companies contact WhatsApp", "num_results": 20}
  ]
}'::jsonb, true);

-- Rwanda: Kigali Expat Housing
INSERT INTO property_sources (name, source_type, base_url, config, is_active) VALUES
('Kigali Expat Housing', 'openai_deep_research', NULL, 
'{
  "queries": [
    {"country": "Rwanda", "city": "Kigali", "query": "expat housing Kigali apartments furnished contact"}
  ]
}'::jsonb, true);

-- Rwanda: Facebook Marketplace (via Search)
INSERT INTO property_sources (name, source_type, base_url, config, is_active) VALUES
('Facebook Marketplace Rwanda', 'serpapi', NULL, 
'{
  "queries": [
    {"country": "Rwanda", "query": "site:facebook.com Kigali apartments for rent contact", "num_results": 20}
  ]
}'::jsonb, true);

-- =====================================================
-- AGGREGATOR & API SOURCES
-- =====================================================

-- Econfary API (Multi-country)
INSERT INTO property_sources (name, source_type, base_url, config, is_active) VALUES
('Econfary API', 'econfary_api', 'https://api.econfary.com', 
'{
  "countries": ["Malta", "Rwanda"],
  "rental_types": ["short_term", "long_term"],
  "min_contact_required": true
}'::jsonb, true);

-- Google Search Aggregator (Malta)
INSERT INTO property_sources (name, source_type, base_url, config, is_active) VALUES
('Google Properties Malta', 'serpapi', NULL, 
'{
  "queries": [
    {"country": "Malta", "query": "rental apartments Malta contact phone", "num_results": 30},
    {"country": "Malta", "query": "houses to let Malta WhatsApp", "num_results": 30},
    {"country": "Malta", "query": "property agents Malta contact number", "num_results": 20}
  ]
}'::jsonb, true);

-- Google Search Aggregator (Rwanda)
INSERT INTO property_sources (name, source_type, base_url, config, is_active) VALUES
('Google Properties Rwanda', 'serpapi', NULL, 
'{
  "queries": [
    {"country": "Rwanda", "query": "Kigali rental apartments contact phone number", "num_results": 30},
    {"country": "Rwanda", "query": "Rwanda houses for rent WhatsApp", "num_results": 30}
  ]
}'::jsonb, true);

-- =====================================================
-- AUTOMATED SCHEDULING (pg_cron)
-- =====================================================

-- Schedule daily property sync at 3 AM UTC (1 hour after jobs)
SELECT cron.schedule(
  'daily-property-sources-sync',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/openai-deep-research',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
    ),
    body := jsonb_build_object(
      'action', 'sync_all',
      'scheduled', true,
      'timestamp', now()
    )
  );
  $$
);

COMMIT;
