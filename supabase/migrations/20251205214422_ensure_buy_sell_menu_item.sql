-- Ensure proper Buy & Sell menu item exists
-- Remove any duplicates and create/update the canonical entry

BEGIN;

-- First, remove ALL Buy & Sell related entries
DELETE FROM whatsapp_home_menu_items
WHERE key IN ('business_broker_agent', 'buy_and_sell_agent', 'buy_sell_agent', 'marketplace_agent', 'broker_agent');

-- Insert the single canonical Buy & Sell entry
INSERT INTO whatsapp_home_menu_items (
  key,
  name,
  icon,
  is_active,
  active_countries,
  display_order,
  country_specific_names,
  created_at,
  updated_at
)
VALUES (
  'business_broker_agent',
  'Buy & Sell',
  '🛒',
  true,
  ARRAY['RW', 'BI', 'TZ', 'CD', 'ZM', 'TG', 'MT']::text[],
  5, -- Display order (adjust as needed)
  jsonb_build_object(
    'RW', jsonb_build_object('name', '🛒 Kugura & Kugurisha', 'description', 'Find businesses & services near you'),
    'MT', jsonb_build_object('name', '🛒 Buy & Sell', 'description', 'Find businesses & services near you'),
    'BI', jsonb_build_object('name', '🛒 Acheter & Vendre', 'description', 'Trouvez entreprises et services'),
    'TZ', jsonb_build_object('name', '🛒 Nunua & Uza', 'description', 'Pata biashara karibu nawe'),
    'CD', jsonb_build_object('name', '🛒 Acheter & Vendre', 'description', 'Trouvez entreprises près de vous'),
    'ZM', jsonb_build_object('name', '🛒 Buy & Sell', 'description', 'Find businesses near you'),
    'TG', jsonb_build_object('name', '🛒 Acheter & Vendre', 'description', 'Trouvez entreprises')
  ),
  NOW(),
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  is_active = EXCLUDED.is_active,
  active_countries = EXCLUDED.active_countries,
  country_specific_names = EXCLUDED.country_specific_names,
  updated_at = NOW();

-- Verify final state
DO $$
DECLARE
  final_count INTEGER;
  total_menu_items INTEGER;
BEGIN
  SELECT COUNT(*) INTO final_count
  FROM whatsapp_home_menu_items
  WHERE key = 'business_broker_agent' AND is_active = true;
  
  SELECT COUNT(*) INTO total_menu_items
  FROM whatsapp_home_menu_items
  WHERE is_active = true;
  
  RAISE NOTICE 'Buy & Sell entries: % | Total active menu items: %', final_count, total_menu_items;
END $$;

COMMIT;
