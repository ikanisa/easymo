-- Add emoji icon to Buy & Sell menu item
-- Ensure it displays consistently with other menu items

BEGIN;

-- Update Buy & Sell with proper emoji icon
UPDATE whatsapp_home_menu_items
SET 
  icon = '🛒',
  name = '🛒 Buy & Sell',
  country_specific_names = jsonb_build_object(
    'RW', jsonb_build_object('name', '🛒 Kugura & Kugurisha', 'description', 'Find businesses & services near you'),
    'MT', jsonb_build_object('name', '🛒 Buy & Sell', 'description', 'Find businesses & services near you'),
    'BI', jsonb_build_object('name', '🛒 Acheter & Vendre', 'description', 'Trouvez entreprises et services'),
    'TZ', jsonb_build_object('name', '🛒 Nunua & Uza', 'description', 'Pata biashara karibu nawe'),
    'CD', jsonb_build_object('name', '🛒 Acheter & Vendre', 'description', 'Trouvez entreprises près de vous'),
    'ZM', jsonb_build_object('name', '🛒 Buy & Sell', 'description', 'Find businesses near you'),
    'TG', jsonb_build_object('name', '🛒 Acheter & Vendre', 'description', 'Trouvez entreprises')
  ),
  updated_at = NOW()
WHERE key = 'business_broker_agent';

-- Verify the icon is set
DO $$
DECLARE
  current_icon TEXT;
  current_name TEXT;
BEGIN
  SELECT icon, name INTO current_icon, current_name
  FROM whatsapp_home_menu_items
  WHERE key = 'business_broker_agent';
  
  RAISE NOTICE 'Buy & Sell icon: "%" | name: "%"', current_icon, current_name;
  
  IF current_icon IS NULL OR current_icon = '' THEN
    RAISE EXCEPTION 'Icon is still empty for Buy & Sell!';
  END IF;
END $$;

COMMIT;
