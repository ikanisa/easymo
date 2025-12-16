-- Optimize Queries and Add Missing Indexes
-- Created: 2025-12-16
-- Purpose: P1-020 - Add missing indexes and optimize query performance

BEGIN;

-- =====================================================
-- ADD MISSING INDEXES FOR QUERY OPTIMIZATION
-- =====================================================

-- Index for trips table - frequently queried columns
CREATE INDEX IF NOT EXISTS idx_trips_user_id_status 
  ON trips(user_id, status) 
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_trips_status_expires_at 
  ON trips(status, expires_at) 
  WHERE status = 'open' AND expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trips_role_vehicle_type 
  ON trips(role, vehicle_type) 
  WHERE status = 'open';

-- Index for profiles table - phone number lookups
CREATE INDEX IF NOT EXISTS idx_profiles_phone_number 
  ON profiles(phone_number) 
  WHERE phone_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_wa_id 
  ON profiles(wa_id) 
  WHERE wa_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_user_id_language 
  ON profiles(user_id, language);

-- Index for user_state table - state lookups
CREATE INDEX IF NOT EXISTS idx_user_state_user_id_key 
  ON user_state(user_id, key) 
  WHERE key IS NOT NULL;

-- Index for saved_locations table
CREATE INDEX IF NOT EXISTS idx_saved_locations_user_id 
  ON saved_locations(user_id);

CREATE INDEX IF NOT EXISTS idx_saved_locations_user_id_label 
  ON saved_locations(user_id, label);

-- Index for location_cache table
CREATE INDEX IF NOT EXISTS idx_location_cache_user_id_expires_at 
  ON location_cache(user_id, expires_at) 
  WHERE expires_at IS NOT NULL;

-- Index for businesses table - location-based queries
CREATE INDEX IF NOT EXISTS idx_businesses_lat_lng 
  ON businesses(lat, lng) 
  WHERE lat IS NOT NULL AND lng IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_businesses_category_active 
  ON businesses(buy_sell_category_id, active) 
  WHERE active = true;

-- Index for marketplace_conversations - phone lookups
CREATE INDEX IF NOT EXISTS idx_marketplace_conversations_phone_updated_at 
  ON marketplace_conversations(phone, updated_at DESC);

-- Index for marketplace_listings - seller queries
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_seller_phone_status 
  ON marketplace_listings(seller_phone, status) 
  WHERE status = 'active';

-- Index for marketplace_matches - buyer/seller lookups
CREATE INDEX IF NOT EXISTS idx_marketplace_matches_buyer_phone 
  ON marketplace_matches(buyer_phone) 
  WHERE buyer_phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_marketplace_matches_seller_phone 
  ON marketplace_matches(seller_phone) 
  WHERE seller_phone IS NOT NULL;

-- Index for agent_user_memory - user phone lookups
CREATE INDEX IF NOT EXISTS idx_agent_user_memory_user_phone_updated_at 
  ON agent_user_memory(user_phone, updated_at DESC);

-- =====================================================
-- ANALYZE TABLES FOR QUERY OPTIMIZER
-- =====================================================

ANALYZE trips;
ANALYZE profiles;
ANALYZE user_state;
ANALYZE saved_locations;
ANALYZE location_cache;
ANALYZE businesses;
ANALYZE marketplace_conversations;
ANALYZE marketplace_listings;
ANALYZE marketplace_matches;
ANALYZE agent_user_memory;

COMMIT;

