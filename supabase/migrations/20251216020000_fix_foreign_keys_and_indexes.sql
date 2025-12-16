-- Fix Foreign Keys and Indexes
-- Created: 2025-12-16
-- Purpose: Add missing foreign key constraints and indexes for performance

BEGIN;

-- =====================================================
-- ADD FOREIGN KEY CONSTRAINTS
-- =====================================================

-- Marketplace conversations should reference whatsapp_users
-- Note: Using phone number matching since marketplace_conversations uses phone as PK
DO $$
BEGIN
  -- Check if foreign key doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_marketplace_conversations_phone'
  ) THEN
    -- Add foreign key constraint
    ALTER TABLE marketplace_conversations
    ADD CONSTRAINT fk_marketplace_conversations_phone
    FOREIGN KEY (phone) REFERENCES whatsapp_users(phone) ON DELETE CASCADE;
  END IF;
END $$;

-- Marketplace listings seller_phone should reference whatsapp_users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_marketplace_listings_seller_phone'
  ) THEN
    ALTER TABLE marketplace_listings
    ADD CONSTRAINT fk_marketplace_listings_seller_phone
    FOREIGN KEY (seller_phone) REFERENCES whatsapp_users(phone) ON DELETE SET NULL;
  END IF;
END $$;

-- Marketplace matches buyer_phone should reference whatsapp_users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_marketplace_matches_buyer_phone'
  ) THEN
    ALTER TABLE marketplace_matches
    ADD CONSTRAINT fk_marketplace_matches_buyer_phone
    FOREIGN KEY (buyer_phone) REFERENCES whatsapp_users(phone) ON DELETE CASCADE;
  END IF;
END $$;

-- Marketplace matches seller_phone should reference whatsapp_users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_marketplace_matches_seller_phone'
  ) THEN
    ALTER TABLE marketplace_matches
    ADD CONSTRAINT fk_marketplace_matches_seller_phone
    FOREIGN KEY (seller_phone) REFERENCES whatsapp_users(phone) ON DELETE CASCADE;
  END IF;
END $$;

-- Agent outreach sessions user_phone should reference whatsapp_users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_agent_outreach_sessions_user_phone'
  ) THEN
    ALTER TABLE agent_outreach_sessions
    ADD CONSTRAINT fk_agent_outreach_sessions_user_phone
    FOREIGN KEY (user_phone) REFERENCES whatsapp_users(phone) ON DELETE CASCADE;
  END IF;
END $$;

-- Agent user memory user_phone should reference whatsapp_users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_agent_user_memory_user_phone'
  ) THEN
    ALTER TABLE agent_user_memory
    ADD CONSTRAINT fk_agent_user_memory_user_phone
    FOREIGN KEY (user_phone) REFERENCES whatsapp_users(phone) ON DELETE CASCADE;
  END IF;
END $$;

-- =====================================================
-- ADD MISSING INDEXES
-- =====================================================

-- Index on trips.phone for frequent queries
CREATE INDEX IF NOT EXISTS idx_trips_phone 
  ON trips(phone) 
  WHERE phone IS NOT NULL;

-- Index on trips.status and expires_at for cleanup queries
CREATE INDEX IF NOT EXISTS idx_trips_status_expires_at 
  ON trips(status, expires_at) 
  WHERE status = 'open';

-- Index on marketplace_listings.seller_phone (if not exists)
-- Note: Already exists from migration, but ensure it's there
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_seller_phone 
  ON marketplace_listings(seller_phone);

-- Index on marketplace_listings.status for filtering
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_status 
  ON marketplace_listings(status);

-- Index on marketplace_listings.created_at for sorting
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_created_at 
  ON marketplace_listings(created_at DESC);

-- Index on marketplace_matches for buyer lookups
CREATE INDEX IF NOT EXISTS idx_marketplace_matches_buyer_phone 
  ON marketplace_matches(buyer_phone);

-- Index on marketplace_matches for seller lookups
CREATE INDEX IF NOT EXISTS idx_marketplace_matches_seller_phone 
  ON marketplace_matches(seller_phone);

-- Index on marketplace_matches.status for filtering
CREATE INDEX IF NOT EXISTS idx_marketplace_matches_status 
  ON marketplace_matches(status);

-- Index on agent_outreach_sessions for user lookups
CREATE INDEX IF NOT EXISTS idx_agent_outreach_sessions_user_phone 
  ON agent_outreach_sessions(user_phone);

-- Index on agent_outreach_sessions.status for filtering
CREATE INDEX IF NOT EXISTS idx_agent_outreach_sessions_status 
  ON agent_outreach_sessions(status);

-- Index on agent_vendor_messages for session lookups
CREATE INDEX IF NOT EXISTS idx_agent_vendor_messages_session_id 
  ON agent_vendor_messages(session_id);

-- Index on agent_vendor_messages for vendor lookups
CREATE INDEX IF NOT EXISTS idx_agent_vendor_messages_vendor_phone 
  ON agent_vendor_messages(vendor_phone);

-- Index on agent_vendor_messages.response_status for filtering
CREATE INDEX IF NOT EXISTS idx_agent_vendor_messages_response_status 
  ON agent_vendor_messages(response_status);

-- Index on agent_user_memory for user lookups
CREATE INDEX IF NOT EXISTS idx_agent_user_memory_user_phone 
  ON agent_user_memory(user_phone);

-- Index on agent_user_memory for type and key lookups
CREATE INDEX IF NOT EXISTS idx_agent_user_memory_type_key 
  ON agent_user_memory(memory_type, key);

-- Index on agent_user_memory.expires_at for cleanup
CREATE INDEX IF NOT EXISTS idx_agent_user_memory_expires_at 
  ON agent_user_memory(expires_at) 
  WHERE expires_at IS NOT NULL;

-- Index on marketplace_conversations.updated_at for cleanup
CREATE INDEX IF NOT EXISTS idx_marketplace_conversations_updated_at 
  ON marketplace_conversations(updated_at);

-- Composite index on trips for common queries (role + status + location)
CREATE INDEX IF NOT EXISTS idx_trips_role_status_location 
  ON trips(role, status, pickup_lat, pickup_lng) 
  WHERE status = 'open';

-- Index on trips.scheduled_for for scheduled trip queries
CREATE INDEX IF NOT EXISTS idx_trips_scheduled_for 
  ON trips(scheduled_for) 
  WHERE scheduled_for IS NOT NULL;

COMMIT;

