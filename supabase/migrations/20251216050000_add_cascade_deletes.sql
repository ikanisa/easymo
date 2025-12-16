-- Add Cascade Deletes to Foreign Keys
-- Created: 2025-12-16
-- Purpose: Ensure data integrity with cascade deletes

BEGIN;

-- =====================================================
-- UPDATE FOREIGN KEYS TO USE CASCADE DELETE
-- =====================================================

-- Drop existing foreign keys and recreate with CASCADE
DO $$
BEGIN
  -- marketplace_conversations.phone
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_marketplace_conversations_phone'
  ) THEN
    ALTER TABLE marketplace_conversations
    DROP CONSTRAINT fk_marketplace_conversations_phone;
  END IF;
  
  ALTER TABLE marketplace_conversations
  ADD CONSTRAINT fk_marketplace_conversations_phone
  FOREIGN KEY (phone) REFERENCES whatsapp_users(phone) ON DELETE CASCADE;
END $$;

-- marketplace_listings.seller_phone
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_marketplace_listings_seller_phone'
  ) THEN
    ALTER TABLE marketplace_listings
    DROP CONSTRAINT fk_marketplace_listings_seller_phone;
  END IF;
  
  ALTER TABLE marketplace_listings
  ADD CONSTRAINT fk_marketplace_listings_seller_phone
  FOREIGN KEY (seller_phone) REFERENCES whatsapp_users(phone) ON DELETE SET NULL;
END $$;

-- marketplace_matches.buyer_phone
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_marketplace_matches_buyer_phone'
  ) THEN
    ALTER TABLE marketplace_matches
    DROP CONSTRAINT fk_marketplace_matches_buyer_phone;
  END IF;
  
  ALTER TABLE marketplace_matches
  ADD CONSTRAINT fk_marketplace_matches_buyer_phone
  FOREIGN KEY (buyer_phone) REFERENCES whatsapp_users(phone) ON DELETE CASCADE;
END $$;

-- marketplace_matches.seller_phone
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_marketplace_matches_seller_phone'
  ) THEN
    ALTER TABLE marketplace_matches
    DROP CONSTRAINT fk_marketplace_matches_seller_phone;
  END IF;
  
  ALTER TABLE marketplace_matches
  ADD CONSTRAINT fk_marketplace_matches_seller_phone
  FOREIGN KEY (seller_phone) REFERENCES whatsapp_users(phone) ON DELETE CASCADE;
END $$;

-- agent_outreach_sessions.user_phone
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_agent_outreach_sessions_user_phone'
  ) THEN
    ALTER TABLE agent_outreach_sessions
    DROP CONSTRAINT fk_agent_outreach_sessions_user_phone;
  END IF;
  
  ALTER TABLE agent_outreach_sessions
  ADD CONSTRAINT fk_agent_outreach_sessions_user_phone
  FOREIGN KEY (user_phone) REFERENCES whatsapp_users(phone) ON DELETE CASCADE;
END $$;

-- agent_user_memory.user_phone
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_agent_user_memory_user_phone'
  ) THEN
    ALTER TABLE agent_user_memory
    DROP CONSTRAINT fk_agent_user_memory_user_phone;
  END IF;
  
  ALTER TABLE agent_user_memory
  ADD CONSTRAINT fk_agent_user_memory_user_phone
  FOREIGN KEY (user_phone) REFERENCES whatsapp_users(phone) ON DELETE CASCADE;
END $$;

-- agent_vendor_messages.session_id (if foreign key exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_agent_vendor_messages_session_id'
  ) THEN
    ALTER TABLE agent_vendor_messages
    DROP CONSTRAINT fk_agent_vendor_messages_session_id;
  END IF;
  
  -- Only add if agent_outreach_sessions table exists and has id column
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'agent_outreach_sessions'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'agent_outreach_sessions' AND column_name = 'id'
  ) THEN
    ALTER TABLE agent_vendor_messages
    ADD CONSTRAINT fk_agent_vendor_messages_session_id
    FOREIGN KEY (session_id) REFERENCES agent_outreach_sessions(id) ON DELETE CASCADE;
  END IF;
END $$;

COMMIT;

