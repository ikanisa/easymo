-- Add emoji icon to Buy and Sell menu item name
-- The name should include the icon for display consistency
-- NOTE: Only English/French - NO Kinyarwanda per README.md rules

BEGIN;

UPDATE public.whatsapp_home_menu_items
SET 
  name = '🛒 Buy and Sell',
  country_specific_names = jsonb_build_object(
    'MT', jsonb_build_object('name', '🛒 Buy & Sell', 'description', 'Find businesses & services near you'),
    'BI', jsonb_build_object('name', '🛒 Acheter & Vendre', 'description', 'Trouvez entreprises et services'),
    'TZ', jsonb_build_object('name', '🛒 Buy & Sell', 'description', 'Find businesses near you'),
    'CD', jsonb_build_object('name', '🛒 Acheter & Vendre', 'description', 'Trouvez entreprises près de vous'),
    'ZM', jsonb_build_object('name', '🛒 Buy & Sell', 'description', 'Find businesses near you'),
    'TG', jsonb_build_object('name', '🛒 Acheter & Vendre', 'description', 'Trouvez entreprises')
  ),
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
  
  RAISE NOTICE 'Buy & Sell menu name updated to: % (RW removed - English only)', updated_name;
END $$;

COMMIT;
