-- Restore Buy & Sell menu item to whatsapp_home_menu_items
-- This was working previously but got removed. Restoring the single row.

BEGIN;

-- Insert or update the business_broker_agent menu item (Buy & Sell)
INSERT INTO public.whatsapp_home_menu_items (
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
  'Buy and Sell',
  '🛒',
  true,
  ARRAY['RW', 'BI', 'TZ', 'CD', 'ZM', 'TG', 'MT']::text[],
  4,
  jsonb_build_object(
    'RW', jsonb_build_object('name', 'Kugura & Kugurisha', 'description', 'Find businesses & services near you'),
    'MT', jsonb_build_object('name', 'Buy & Sell', 'description', 'Find businesses & services near you'),
    'BI', jsonb_build_object('name', 'Acheter & Vendre', 'description', 'Trouvez entreprises et services'),
    'TZ', jsonb_build_object('name', 'Nunua & Uza', 'description', 'Pata biashara karibu nawe'),
    'CD', jsonb_build_object('name', 'Acheter & Vendre', 'description', 'Trouvez entreprises près de vous'),
    'ZM', jsonb_build_object('name', 'Buy & Sell', 'description', 'Find businesses near you'),
    'TG', jsonb_build_object('name', 'Acheter & Vendre', 'description', 'Trouvez entreprises')
  ),
  NOW(),
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  is_active = EXCLUDED.is_active,
  active_countries = EXCLUDED.active_countries,
  display_order = EXCLUDED.display_order,
  country_specific_names = EXCLUDED.country_specific_names,
  updated_at = NOW();

-- Verify
DO $$
DECLARE
  menu_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO menu_count
  FROM whatsapp_home_menu_items
  WHERE key = 'business_broker_agent' AND is_active = true;
  
  RAISE NOTICE 'Buy & Sell menu item restored. Active count: %', menu_count;
END $$;

COMMIT;
