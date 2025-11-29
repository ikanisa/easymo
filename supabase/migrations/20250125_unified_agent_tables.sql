-- Transaction wrapper for production safety
BEGIN;

-- Unified AI Agent Microservices Database Schema
-- Migration: 20250125_unified_agent_tables.sql
-- 
-- Creates unified tables for all AI agent domains:
-- - marketplace, jobs, property, farmer, waiter, insurance, rides, sales, business_broker, support

-- =====================================================
-- UNIFIED SESSIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS unified_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_phone TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES profiles(user_id),
  
  -- Current agent context
  current_agent TEXT NOT NULL DEFAULT 'support',
  
  -- Flow management
  active_flow TEXT,
  flow_step TEXT,
  collected_data JSONB DEFAULT '{}',
  
  -- Conversation history
  conversation_history JSONB DEFAULT '[]',
  
  -- Location context
  location JSONB, -- { lat, lng, text }
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired')),
  last_message_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT now() + INTERVAL '24 hours'
);

CREATE INDEX idx_unified_sessions_user_phone ON unified_sessions(user_phone);
CREATE INDEX idx_unified_sessions_status ON unified_sessions(status);
CREATE INDEX idx_unified_sessions_expires_at ON unified_sessions(expires_at);
CREATE INDEX idx_unified_sessions_current_agent ON unified_sessions(current_agent);

-- =====================================================
-- UNIFIED LISTINGS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS unified_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_phone TEXT NOT NULL,
  owner_user_id UUID REFERENCES profiles(user_id),
  
  -- Listing type
  domain TEXT NOT NULL CHECK (domain IN ('marketplace', 'jobs', 'property', 'farmer')),
  listing_type TEXT NOT NULL CHECK (listing_type IN ('product', 'service', 'job', 'rental', 'produce')),
  
  -- Common fields
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  
  -- Pricing
  price NUMERIC,
  price_max NUMERIC, -- For salary ranges
  currency TEXT DEFAULT 'RWF',
  price_unit TEXT, -- 'item', 'hour', 'day', 'month', 'kg'
  
  -- Location
  location_text TEXT,
  lat NUMERIC,
  lng NUMERIC,
  
  -- Domain-specific data
  attributes JSONB DEFAULT '{}',
  /*
    For jobs: { job_type, requirements, experience_years, skills }
    For property: { bedrooms, bathrooms, amenities, property_type }
    For marketplace: { condition, brand, quantity }
    For farmer: { unit, quantity, harvest_date }
  */
  
  -- Media
  images TEXT[],
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'sold', 'rented', 'expired')),
  source_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX idx_unified_listings_domain ON unified_listings(domain);
CREATE INDEX idx_unified_listings_listing_type ON unified_listings(listing_type);
CREATE INDEX idx_unified_listings_owner_phone ON unified_listings(owner_phone);
CREATE INDEX idx_unified_listings_status ON unified_listings(status);
CREATE INDEX idx_unified_listings_category ON unified_listings(category);
CREATE INDEX idx_unified_listings_location ON unified_listings USING gist(ll_to_earth(lat, lng)) WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- =====================================================
-- UNIFIED APPLICATIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS unified_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES unified_listings(id) ON DELETE CASCADE,
  applicant_phone TEXT NOT NULL,
  applicant_user_id UUID REFERENCES profiles(user_id),
  
  -- Application type
  domain TEXT NOT NULL CHECK (domain IN ('jobs', 'property', 'marketplace')),
  
  -- Common fields
  message TEXT,
  
  -- Domain-specific
  attributes JSONB DEFAULT '{}',
  /*
    For jobs: { resume_path, cover_letter, skills }
    For property: { move_in_date, duration }
    For marketplace: { offer_price, quantity }
  */
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_unified_applications_listing_id ON unified_applications(listing_id);
CREATE INDEX idx_unified_applications_applicant_phone ON unified_applications(applicant_phone);
CREATE INDEX idx_unified_applications_domain ON unified_applications(domain);
CREATE INDEX idx_unified_applications_status ON unified_applications(status);

-- =====================================================
-- UNIFIED MATCHES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS unified_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES unified_listings(id) ON DELETE CASCADE,
  seeker_phone TEXT NOT NULL,
  owner_phone TEXT NOT NULL,
  
  domain TEXT NOT NULL,
  distance_km NUMERIC,
  match_score NUMERIC,
  
  status TEXT DEFAULT 'suggested' CHECK (status IN ('suggested', 'contacted', 'accepted', 'rejected')),
  seeker_notified_at TIMESTAMPTZ,
  owner_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_unified_matches_listing_id ON unified_matches(listing_id);
CREATE INDEX idx_unified_matches_seeker_phone ON unified_matches(seeker_phone);
CREATE INDEX idx_unified_matches_owner_phone ON unified_matches(owner_phone);
CREATE INDEX idx_unified_matches_domain ON unified_matches(domain);
CREATE INDEX idx_unified_matches_status ON unified_matches(status);

-- =====================================================
-- UNIFIED AGENT EVENTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS unified_agent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id TEXT NOT NULL,
  user_phone TEXT,
  agent_type TEXT,
  intent_type TEXT,
  flow_name TEXT,
  payload JSONB,
  response_text TEXT,
  tool_calls JSONB,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_unified_agent_events_correlation_id ON unified_agent_events(correlation_id);
CREATE INDEX idx_unified_agent_events_user_phone ON unified_agent_events(user_phone);
CREATE INDEX idx_unified_agent_events_agent_type ON unified_agent_events(agent_type);
CREATE INDEX idx_unified_agent_events_created_at ON unified_agent_events(created_at);

-- =====================================================
-- AI AGENT CONFIGS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS ai_agent_configs (
  agent_type TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL,
  keywords TEXT[],
  tools TEXT[],
  enabled BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed initial agent configurations
INSERT INTO ai_agent_configs (agent_type, name, description, system_prompt, keywords, enabled, priority) VALUES
  ('support', 'Support Agent', 'General help and navigation', 'You are a helpful support agent', ARRAY['help', 'support', 'question'], true, 0),
  ('jobs', 'Jobs Agent', 'Job search and posting', 'You are a jobs agent', ARRAY['job', 'work', 'employ'], true, 5),
  ('property', 'Property Agent', 'Real estate rentals', 'You are a property agent', ARRAY['property', 'house', 'rent'], true, 5),
  ('marketplace', 'Marketplace Agent', 'Buy and sell products', 'You are a marketplace agent', ARRAY['buy', 'sell', 'product'], true, 5),
  ('farmer', 'Farmer Agent', 'Agricultural produce', 'You are a farmer agent', ARRAY['farm', 'produce', 'crop'], true, 5),
  ('waiter', 'Waiter Agent', 'Restaurant and food', 'You are a waiter agent', ARRAY['menu', 'food', 'order'], true, 5),
  ('insurance', 'Insurance Agent', 'Motor insurance', 'You are an insurance agent', ARRAY['insurance', 'certificate', 'policy'], true, 8),
  ('rides', 'Rides Agent', 'Transport and rides', 'You are a rides agent', ARRAY['ride', 'driver', 'transport'], true, 10),
  ('sales', 'Sales Agent', 'Sales management', 'You are a sales agent', ARRAY['sales', 'customer', 'deal'], true, 3),
  ('business_broker', 'Business Broker', 'Business opportunities', 'You are a business broker', ARRAY['business', 'investment', 'partner'], true, 3)
ON CONFLICT (agent_type) DO NOTHING;

-- =====================================================
-- BACKWARD COMPATIBLE VIEWS
-- =====================================================

-- Drop existing tables if they exist (they'll be replaced by views)
DROP TABLE IF EXISTS marketplace_listings CASCADE;
DROP TABLE IF EXISTS jobs CASCADE;
DROP TABLE IF EXISTS properties CASCADE;
DROP TABLE IF EXISTS job_applications CASCADE;
DROP TABLE IF EXISTS property_inquiries CASCADE;

-- Marketplace listings view
CREATE OR REPLACE VIEW marketplace_listings AS
SELECT 
  id,
  owner_phone AS seller_phone,
  title,
  description,
  price,
  currency,
  location_text,
  lat,
  lng,
  attributes->>'condition' AS condition,
  images,
  status,
  created_at
FROM unified_listings
WHERE domain = 'marketplace';

-- Jobs view
CREATE OR REPLACE VIEW jobs AS
SELECT 
  id,
  owner_phone AS posted_by,
  title,
  description,
  category,
  price AS pay_min,
  price_max AS pay_max,
  currency,
  location_text AS location,
  attributes->>'requirements' AS requirements,
  status,
  created_at
FROM unified_listings
WHERE domain = 'jobs';

-- Properties view
CREATE OR REPLACE VIEW properties AS
SELECT 
  id,
  owner_phone AS landlord_phone,
  title,
  description,
  price AS monthly_rent,
  currency,
  price_unit,
  location_text AS location,
  lat,
  lng,
  attributes->>'property_type' AS property_type,
  (attributes->>'bedrooms')::int AS bedrooms,
  (attributes->>'bathrooms')::int AS bathrooms,
  images,
  status,
  created_at
FROM unified_listings
WHERE domain = 'property';

-- Job applications view
CREATE OR REPLACE VIEW job_applications AS
SELECT 
  id,
  listing_id AS job_id,
  applicant_phone AS seeker_phone,
  message AS cover_letter,
  status,
  created_at AS applied_at
FROM unified_applications
WHERE domain = 'jobs';

-- Property inquiries view
CREATE OR REPLACE VIEW property_inquiries AS
SELECT 
  id,
  listing_id AS property_id,
  applicant_phone AS tenant_phone,
  message AS inquiry_message,
  status,
  created_at
FROM unified_applications
WHERE domain = 'property';

COMMENT ON TABLE unified_sessions IS 'Unified session management for all AI agents';
COMMENT ON TABLE unified_listings IS 'Polymorphic listings table for all domains (marketplace, jobs, property, farmer)';
COMMENT ON TABLE unified_applications IS 'Applications and inquiries across all domains';
COMMENT ON TABLE unified_matches IS 'Buyer-seller, job-applicant, tenant-property matches';
COMMENT ON TABLE unified_agent_events IS 'Observability and analytics for agent interactions';
COMMENT ON TABLE ai_agent_configs IS 'Database-driven agent configurations';

COMMIT;
