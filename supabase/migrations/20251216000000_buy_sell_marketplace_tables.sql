-- Buy & Sell AI Agent - Required Database Tables
-- Created: 2025-12-16
-- Purpose: Create tables for marketplace conversations, listings, matches, and agent outreach

-- =====================================================
-- MARKETPLACE CONVERSATIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS marketplace_conversations (
  phone TEXT PRIMARY KEY,
  flow_type TEXT,
  flow_step TEXT,
  collected_data JSONB DEFAULT '{}',
  conversation_history JSONB DEFAULT '[]',
  last_ai_response TEXT,
  current_listing_id UUID,
  current_intent_id UUID,
  location JSONB, -- { lat: number, lng: number }
  selected_category TEXT,
  search_results JSONB DEFAULT '[]',
  pending_vendor_outreach JSONB,
  current_inquiry_id UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days' -- Auto-expire old conversations (P2-004 fix)
);

CREATE INDEX IF NOT EXISTS idx_marketplace_conversations_updated_at 
  ON marketplace_conversations(updated_at);

-- Index on expires_at for cleanup queries (P2-004 fix)
CREATE INDEX IF NOT EXISTS idx_marketplace_conversations_expires_at 
  ON marketplace_conversations(expires_at) 
  WHERE expires_at IS NOT NULL;

-- =====================================================
-- MARKETPLACE LISTINGS
-- =====================================================
CREATE TABLE IF NOT EXISTS marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_phone TEXT NOT NULL,
  listing_type TEXT DEFAULT 'product',
  title TEXT NOT NULL,
  product_name TEXT,
  description TEXT,
  price NUMERIC,
  location_text TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  attributes JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_listings_seller_phone 
  ON marketplace_listings(seller_phone);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_status 
  ON marketplace_listings(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_location 
  ON marketplace_listings USING GIST (ll_to_earth(lat, lng));

-- =====================================================
-- MARKETPLACE MATCHES
-- =====================================================
CREATE TABLE IF NOT EXISTS marketplace_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  buyer_phone TEXT NOT NULL,
  seller_phone TEXT NOT NULL,
  distance_km DOUBLE PRECISION,
  match_score DOUBLE PRECISION,
  status TEXT DEFAULT 'suggested',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_matches_listing_id 
  ON marketplace_matches(listing_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_matches_buyer_phone 
  ON marketplace_matches(buyer_phone);
CREATE INDEX IF NOT EXISTS idx_marketplace_matches_status 
  ON marketplace_matches(status);

-- =====================================================
-- AGENT OUTREACH SESSIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS agent_outreach_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_phone TEXT NOT NULL,
  request_summary TEXT NOT NULL,
  request_type TEXT NOT NULL, -- 'product' | 'service' | 'medicine'
  business_ids UUID[] NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending' | 'completed' | 'failed'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_outreach_sessions_user_phone 
  ON agent_outreach_sessions(user_phone);
CREATE INDEX IF NOT EXISTS idx_agent_outreach_sessions_status 
  ON agent_outreach_sessions(status);

-- =====================================================
-- AGENT VENDOR MESSAGES
-- =====================================================
CREATE TABLE IF NOT EXISTS agent_vendor_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES agent_outreach_sessions(id) ON DELETE CASCADE,
  vendor_phone TEXT NOT NULL,
  business_id UUID,
  message_sent TEXT NOT NULL,
  response_status TEXT DEFAULT 'pending', -- 'pending' | 'responded' | 'no_response'
  vendor_response TEXT,
  response_received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_vendor_messages_session_id 
  ON agent_vendor_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_vendor_messages_vendor_phone 
  ON agent_vendor_messages(vendor_phone);
CREATE INDEX IF NOT EXISTS idx_agent_vendor_messages_response_status 
  ON agent_vendor_messages(response_status);

-- =====================================================
-- AGENT USER MEMORY
-- =====================================================
CREATE TABLE IF NOT EXISTS agent_user_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_phone TEXT NOT NULL,
  memory_type TEXT NOT NULL, -- 'preference' | 'history' | 'context'
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_phone, memory_type, key)
);

CREATE INDEX IF NOT EXISTS idx_agent_user_memory_user_phone 
  ON agent_user_memory(user_phone);
CREATE INDEX IF NOT EXISTS idx_agent_user_memory_type_key 
  ON agent_user_memory(memory_type, key);
CREATE INDEX IF NOT EXISTS idx_agent_user_memory_expires_at 
  ON agent_user_memory(expires_at) WHERE expires_at IS NOT NULL;

