-- Add RLS Policies and Cleanup Jobs
-- Created: 2025-12-16
-- Purpose: Add missing RLS policies and create cleanup jobs for conversation history

BEGIN;

-- =====================================================
-- ADD RLS POLICIES FOR MARKETPLACE TABLES
-- =====================================================

-- Enable RLS on marketplace_conversations
ALTER TABLE marketplace_conversations ENABLE ROW LEVEL SECURITY;

-- Service role has full access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'marketplace_conversations'
      AND policyname = 'service_role_all_marketplace_conversations'
  ) THEN
    CREATE POLICY "service_role_all_marketplace_conversations" 
      ON marketplace_conversations
      TO service_role 
      USING (true) 
      WITH CHECK (true);
  END IF;
END $$;

-- Users can only read their own conversations (if authenticated via phone)
-- Note: This is a placeholder - actual implementation depends on auth setup
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'marketplace_conversations'
      AND policyname = 'users_read_own_conversations'
  ) THEN
    CREATE POLICY "users_read_own_conversations" 
      ON marketplace_conversations
      FOR SELECT 
      TO authenticated
      USING (phone = (SELECT phone FROM auth.users WHERE id = auth.uid()));
  END IF;
END $$;

-- Enable RLS on marketplace_listings
ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'marketplace_listings'
      AND policyname = 'service_role_all_marketplace_listings'
  ) THEN
    CREATE POLICY "service_role_all_marketplace_listings" 
      ON marketplace_listings
      TO service_role 
      USING (true) 
      WITH CHECK (true);
  END IF;
END $$;

-- Users can read all active listings, but only modify their own
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'marketplace_listings'
      AND policyname = 'users_read_active_listings'
  ) THEN
    CREATE POLICY "users_read_active_listings" 
      ON marketplace_listings
      FOR SELECT 
      TO authenticated
      USING (status = 'active');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'marketplace_listings'
      AND policyname = 'users_modify_own_listings'
  ) THEN
    CREATE POLICY "users_modify_own_listings" 
      ON marketplace_listings
      FOR ALL 
      TO authenticated
      USING (seller_phone = (SELECT phone FROM auth.users WHERE id = auth.uid()))
      WITH CHECK (seller_phone = (SELECT phone FROM auth.users WHERE id = auth.uid()));
  END IF;
END $$;

-- Enable RLS on marketplace_matches
ALTER TABLE marketplace_matches ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'marketplace_matches'
      AND policyname = 'service_role_all_marketplace_matches'
  ) THEN
    CREATE POLICY "service_role_all_marketplace_matches" 
      ON marketplace_matches
      TO service_role 
      USING (true) 
      WITH CHECK (true);
  END IF;
END $$;

-- Users can read matches where they are buyer or seller
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'marketplace_matches'
      AND policyname = 'users_read_own_matches'
  ) THEN
    CREATE POLICY "users_read_own_matches" 
      ON marketplace_matches
      FOR SELECT 
      TO authenticated
      USING (
        buyer_phone = (SELECT phone FROM auth.users WHERE id = auth.uid()) OR
        seller_phone = (SELECT phone FROM auth.users WHERE id = auth.uid())
      );
  END IF;
END $$;

-- Enable RLS on agent_outreach_sessions
ALTER TABLE agent_outreach_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'agent_outreach_sessions'
      AND policyname = 'service_role_all_agent_outreach_sessions'
  ) THEN
    CREATE POLICY "service_role_all_agent_outreach_sessions" 
      ON agent_outreach_sessions
      TO service_role 
      USING (true) 
      WITH CHECK (true);
  END IF;
END $$;

-- Users can read their own outreach sessions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'agent_outreach_sessions'
      AND policyname = 'users_read_own_outreach_sessions'
  ) THEN
    CREATE POLICY "users_read_own_outreach_sessions" 
      ON agent_outreach_sessions
      FOR SELECT 
      TO authenticated
      USING (user_phone = (SELECT phone FROM auth.users WHERE id = auth.uid()));
  END IF;
END $$;

-- Enable RLS on agent_vendor_messages
ALTER TABLE agent_vendor_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'agent_vendor_messages'
      AND policyname = 'service_role_all_agent_vendor_messages'
  ) THEN
    CREATE POLICY "service_role_all_agent_vendor_messages" 
      ON agent_vendor_messages
      TO service_role 
      USING (true) 
      WITH CHECK (true);
  END IF;
END $$;

-- Enable RLS on agent_user_memory
ALTER TABLE agent_user_memory ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'agent_user_memory'
      AND policyname = 'service_role_all_agent_user_memory'
  ) THEN
    CREATE POLICY "service_role_all_agent_user_memory" 
      ON agent_user_memory
      TO service_role 
      USING (true) 
      WITH CHECK (true);
  END IF;
END $$;

-- Users can read their own memory
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'agent_user_memory'
      AND policyname = 'users_read_own_memory'
  ) THEN
    CREATE POLICY "users_read_own_memory" 
      ON agent_user_memory
      FOR SELECT 
      TO authenticated
      USING (user_phone = (SELECT phone FROM auth.users WHERE id = auth.uid()));
  END IF;
END $$;

-- =====================================================
-- CREATE CLEANUP FUNCTION FOR CONVERSATION HISTORY
-- =====================================================

-- Function to cleanup old conversation history entries
CREATE OR REPLACE FUNCTION cleanup_old_conversation_history()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  max_history_size INTEGER := 20; -- Keep last 20 messages
  cleanup_count INTEGER;
BEGIN
  -- Cleanup conversation history that exceeds max_history_size
  WITH conversations_to_clean AS (
    SELECT 
      phone,
      conversation_history,
      jsonb_array_length(conversation_history) as history_length
    FROM marketplace_conversations
    WHERE conversation_history IS NOT NULL
      AND jsonb_typeof(conversation_history) = 'array'
      AND jsonb_array_length(conversation_history) > max_history_size
  )
  UPDATE marketplace_conversations mc
  SET 
    conversation_history = (
      SELECT jsonb_agg(msg)
      FROM (
        SELECT msg
        FROM jsonb_array_elements(mc.conversation_history) msg
        ORDER BY (msg->>'timestamp')::bigint DESC NULLS LAST
        LIMIT max_history_size
      ) recent_msgs
    ),
    updated_at = NOW()
  FROM conversations_to_clean ctc
  WHERE mc.phone = ctc.phone;
  
  GET DIAGNOSTICS cleanup_count = ROW_COUNT;
  
  -- Log cleanup (if logging table exists)
  IF cleanup_count > 0 THEN
    RAISE NOTICE 'Cleaned up conversation history for % conversations', cleanup_count;
  END IF;
END;
$$;

-- Function to cleanup expired agent user memory
CREATE OR REPLACE FUNCTION cleanup_expired_agent_memory()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cleanup_count INTEGER;
BEGIN
  DELETE FROM agent_user_memory
  WHERE expires_at IS NOT NULL
    AND expires_at < NOW();
  
  GET DIAGNOSTICS cleanup_count = ROW_COUNT;
  
  IF cleanup_count > 0 THEN
    RAISE NOTICE 'Cleaned up % expired memory entries', cleanup_count;
  END IF;
END;
$$;

-- Function to cleanup expired marketplace conversations (P2-004 fix)
CREATE OR REPLACE FUNCTION cleanup_expired_marketplace_conversations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cleanup_count INTEGER;
BEGIN
  DELETE FROM marketplace_conversations
  WHERE expires_at IS NOT NULL
    AND expires_at < NOW();
  
  GET DIAGNOSTICS cleanup_count = ROW_COUNT;
  
  IF cleanup_count > 0 THEN
    RAISE NOTICE 'Cleaned up % expired marketplace conversations', cleanup_count;
  END IF;
END;
$$;

-- =====================================================
-- CREATE PHONE NUMBER NORMALIZATION FUNCTION
-- =====================================================

-- Function to normalize phone numbers to E.164 format
CREATE OR REPLACE FUNCTION normalize_phone_number(phone_input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized TEXT;
BEGIN
  -- Remove all non-digit characters except leading +
  normalized := regexp_replace(phone_input, '[^0-9+]', '', 'g');
  
  -- If starts with +, keep it; otherwise add +250 for Rwanda numbers
  IF normalized ~ '^\+' THEN
    -- Already has country code
    RETURN normalized;
  ELSIF normalized ~ '^250' THEN
    -- Has country code without +
    RETURN '+' || normalized;
  ELSIF normalized ~ '^0' THEN
    -- Local format (078...), replace 0 with +250
    RETURN '+250' || substring(normalized from 2);
  ELSIF length(normalized) = 9 THEN
    -- 9 digits, assume Rwanda and add +250
    RETURN '+250' || normalized;
  ELSE
    -- Return as-is if format is unclear
    RETURN phone_input;
  END IF;
END;
$$;

-- =====================================================
-- ADD COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON FUNCTION cleanup_old_conversation_history IS 'Cleans up conversation history to keep only the last 20 messages per conversation';
COMMENT ON FUNCTION cleanup_expired_agent_memory IS 'Removes expired agent user memory entries';
COMMENT ON FUNCTION cleanup_expired_marketplace_conversations IS 'Removes expired marketplace conversations (older than expires_at)';
COMMENT ON FUNCTION normalize_phone_number IS 'Normalizes phone numbers to E.164 format (+250XXXXXXXXX)';

COMMIT;
