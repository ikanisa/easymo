-- Add Phone Number Normalization and Indexes
-- Created: 2025-12-16
-- Purpose: Normalize existing phone numbers and add indexes for performance

BEGIN;

-- =====================================================
-- NORMALIZE EXISTING PHONE NUMBERS
-- =====================================================

-- Normalize phone numbers in whatsapp_users table
UPDATE whatsapp_users
SET phone = normalize_phone_number(phone)
WHERE phone IS NOT NULL
  AND phone != normalize_phone_number(phone);

-- Normalize phone numbers in marketplace_conversations
UPDATE marketplace_conversations
SET phone = normalize_phone_number(phone)
WHERE phone IS NOT NULL
  AND phone != normalize_phone_number(phone);

-- Normalize phone numbers in marketplace_listings
UPDATE marketplace_listings
SET seller_phone = normalize_phone_number(seller_phone)
WHERE seller_phone IS NOT NULL
  AND seller_phone != normalize_phone_number(seller_phone);

-- Normalize phone numbers in marketplace_matches
UPDATE marketplace_matches
SET buyer_phone = normalize_phone_number(buyer_phone),
    seller_phone = normalize_phone_number(seller_phone)
WHERE buyer_phone IS NOT NULL OR seller_phone IS NOT NULL;

-- Normalize phone numbers in agent_outreach_sessions
UPDATE agent_outreach_sessions
SET user_phone = normalize_phone_number(user_phone)
WHERE user_phone IS NOT NULL
  AND user_phone != normalize_phone_number(user_phone);

-- Normalize phone numbers in agent_vendor_messages
UPDATE agent_vendor_messages
SET vendor_phone = normalize_phone_number(vendor_phone)
WHERE vendor_phone IS NOT NULL
  AND vendor_phone != normalize_phone_number(vendor_phone);

-- Normalize phone numbers in agent_user_memory
UPDATE agent_user_memory
SET user_phone = normalize_phone_number(user_phone)
WHERE user_phone IS NOT NULL
  AND user_phone != normalize_phone_number(user_phone);

-- =====================================================
-- ADD TRIGGERS FOR AUTOMATIC NORMALIZATION
-- =====================================================

-- Trigger function to normalize phone numbers on insert/update
CREATE OR REPLACE FUNCTION normalize_phone_on_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Normalize phone fields based on table
  IF TG_TABLE_NAME = 'whatsapp_users' AND NEW.phone IS NOT NULL THEN
    NEW.phone := normalize_phone_number(NEW.phone);
  ELSIF TG_TABLE_NAME = 'marketplace_conversations' AND NEW.phone IS NOT NULL THEN
    NEW.phone := normalize_phone_number(NEW.phone);
  ELSIF TG_TABLE_NAME = 'marketplace_listings' AND NEW.seller_phone IS NOT NULL THEN
    NEW.seller_phone := normalize_phone_number(NEW.seller_phone);
  ELSIF TG_TABLE_NAME = 'marketplace_matches' THEN
    IF NEW.buyer_phone IS NOT NULL THEN
      NEW.buyer_phone := normalize_phone_number(NEW.buyer_phone);
    END IF;
    IF NEW.seller_phone IS NOT NULL THEN
      NEW.seller_phone := normalize_phone_number(NEW.seller_phone);
    END IF;
  ELSIF TG_TABLE_NAME = 'agent_outreach_sessions' AND NEW.user_phone IS NOT NULL THEN
    NEW.user_phone := normalize_phone_number(NEW.user_phone);
  ELSIF TG_TABLE_NAME = 'agent_vendor_messages' AND NEW.vendor_phone IS NOT NULL THEN
    NEW.vendor_phone := normalize_phone_number(NEW.vendor_phone);
  ELSIF TG_TABLE_NAME = 'agent_user_memory' AND NEW.user_phone IS NOT NULL THEN
    NEW.user_phone := normalize_phone_number(NEW.user_phone);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers for automatic normalization
CREATE TRIGGER normalize_whatsapp_users_phone
  BEFORE INSERT OR UPDATE ON whatsapp_users
  FOR EACH ROW
  EXECUTE FUNCTION normalize_phone_on_change();

CREATE TRIGGER normalize_marketplace_conversations_phone
  BEFORE INSERT OR UPDATE ON marketplace_conversations
  FOR EACH ROW
  EXECUTE FUNCTION normalize_phone_on_change();

CREATE TRIGGER normalize_marketplace_listings_phone
  BEFORE INSERT OR UPDATE ON marketplace_listings
  FOR EACH ROW
  EXECUTE FUNCTION normalize_phone_on_change();

CREATE TRIGGER normalize_marketplace_matches_phone
  BEFORE INSERT OR UPDATE ON marketplace_matches
  FOR EACH ROW
  EXECUTE FUNCTION normalize_phone_on_change();

CREATE TRIGGER normalize_agent_outreach_sessions_phone
  BEFORE INSERT OR UPDATE ON agent_outreach_sessions
  FOR EACH ROW
  EXECUTE FUNCTION normalize_phone_on_change();

CREATE TRIGGER normalize_agent_vendor_messages_phone
  BEFORE INSERT OR UPDATE ON agent_vendor_messages
  FOR EACH ROW
  EXECUTE FUNCTION normalize_phone_on_change();

CREATE TRIGGER normalize_agent_user_memory_phone
  BEFORE INSERT OR UPDATE ON agent_user_memory
  FOR EACH ROW
  EXECUTE FUNCTION normalize_phone_on_change();

COMMIT;

