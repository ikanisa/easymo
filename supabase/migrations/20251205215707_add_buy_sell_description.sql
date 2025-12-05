-- Add description to Buy & Sell menu item

BEGIN;

-- Update Buy & Sell with description
UPDATE whatsapp_home_menu_items
SET 
  description = 'Find local businesses, shops & services near you',
  updated_at = NOW()
WHERE key = 'business_broker_agent';

-- Verify description is set
DO $$
DECLARE
  current_description TEXT;
BEGIN
  SELECT description INTO current_description
  FROM whatsapp_home_menu_items
  WHERE key = 'business_broker_agent';
  
  RAISE NOTICE 'Buy & Sell description: "%"', current_description;
  
  IF current_description IS NULL OR current_description = '' THEN
    RAISE EXCEPTION 'Description is still empty for Buy & Sell!';
  END IF;
END $$;

COMMIT;
