-- Cleanup duplicate Buy & Sell entries in whatsapp_home_menu_items
-- Keep only one: business_broker_agent (the canonical one)

BEGIN;

-- First, let's see what we have
DO $$
DECLARE
  buy_sell_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO buy_sell_count
  FROM whatsapp_home_menu_items
  WHERE key IN ('business_broker_agent', 'buy_and_sell_agent', 'buy_sell_agent');
  
  RAISE NOTICE 'Found % Buy & Sell related entries', buy_sell_count;
END $$;

-- Delete duplicate entries, keep only business_broker_agent
DELETE FROM whatsapp_home_menu_items
WHERE key IN ('buy_and_sell_agent', 'buy_sell_agent');

-- Ensure business_broker_agent has the correct configuration
UPDATE whatsapp_home_menu_items
SET 
  name = 'Buy & Sell',
  icon = '🛒',
  active_countries = ARRAY['RW', 'BI', 'TZ', 'CD', 'ZM', 'TG', 'MT']::text[],
  is_active = true,
  country_specific_names = jsonb_build_object(
    'RW', jsonb_build_object('name', '🛒 Kugura & Kugurisha', 'description', 'Find businesses & services near you'),
    'MT', jsonb_build_object('name', '🛒 Buy & Sell', 'description', 'Find businesses & services near you'),
    'BI', jsonb_build_object('name', '🛒 Acheter & Vendre', 'description', 'Trouvez entreprises et services'),
    'TZ', jsonb_build_object('name', '🛒 Nunua & Uza', 'description', 'Pata biashara karibu nawe'),
    'CD', jsonb_build_object('name', '🛒 Acheter & Vendre', 'description', 'Trouvez entreprises près de vous'),
    'ZM', jsonb_build_object('name', '🛒 Buy & Sell', 'description', 'Find businesses near you'),
    'TG', jsonb_build_object('name', '�� Acheter & Vendre', 'description', 'Trouvez entreprises')
  )
WHERE key = 'business_broker_agent';

-- Log final count
DO $$
DECLARE
  final_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO final_count
  FROM whatsapp_home_menu_items
  WHERE key = 'business_broker_agent' AND is_active = true;
  
  RAISE NOTICE 'Cleanup complete. Buy & Sell entries remaining: %', final_count;
END $$;

COMMIT;
