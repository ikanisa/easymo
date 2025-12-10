-- Add emoji icon to Buy and Sell menu item name
-- The name should include the icon for display consistency

BEGIN;

UPDATE public.whatsapp_home_menu_items
SET 
  name = '🛒 Buy and Sell',
  updated_at = NOW()
WHERE key = 'business_broker_agent';

-- Verify
DO $$
DECLARE
  updated_name TEXT;
BEGIN
  SELECT name INTO updated_name
  FROM whatsapp_home_menu_items
  WHERE key = 'business_broker_agent';
  
  RAISE NOTICE 'Buy & Sell menu name updated to: %', updated_name;
END $$;

COMMIT;
