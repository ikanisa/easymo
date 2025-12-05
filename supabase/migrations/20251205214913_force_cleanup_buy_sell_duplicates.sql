-- Force cleanup of ALL Buy & Sell duplicates
-- This migration will run a hard delete and recreate

BEGIN;

-- Log what we have before
DO $$
DECLARE
  items_before TEXT;
BEGIN
  SELECT string_agg(key || ' (active: ' || is_active || ')', ', ')
  INTO items_before
  FROM whatsapp_home_menu_items
  WHERE key LIKE '%buy%' OR key LIKE '%sell%' OR key LIKE '%broker%' OR key LIKE '%marketplace%';
  
  RAISE NOTICE 'BEFORE cleanup: %', COALESCE(items_before, 'none');
END $$;

-- DELETE ALL Buy & Sell related entries (no exceptions)
DELETE FROM whatsapp_home_menu_items
WHERE key IN (
  'business_broker_agent',
  'buy_and_sell_agent', 
  'buy_sell_agent',
  'marketplace_agent',
  'broker_agent',
  'general_broker'
);

-- Also delete any key containing 'buy', 'sell', 'broker', or 'marketplace'
DELETE FROM whatsapp_home_menu_items
WHERE key LIKE '%buy%' 
   OR key LIKE '%sell%' 
   OR key LIKE '%broker%' 
   OR key LIKE '%marketplace%';

-- Now insert EXACTLY ONE entry
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
  5,
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
);

-- Verify final state
DO $$
DECLARE
  buy_sell_count INTEGER;
  items_after TEXT;
BEGIN
  SELECT COUNT(*) INTO buy_sell_count
  FROM whatsapp_home_menu_items
  WHERE key = 'business_broker_agent';
  
  SELECT string_agg(key || ' (active: ' || is_active || ')', ', ')
  INTO items_after
  FROM whatsapp_home_menu_items
  WHERE key LIKE '%buy%' OR key LIKE '%sell%' OR key LIKE '%broker%' OR key LIKE '%marketplace%';
  
  RAISE NOTICE 'AFTER cleanup: %', COALESCE(items_after, 'none');
  RAISE NOTICE 'Buy & Sell entries: %', buy_sell_count;
  
  IF buy_sell_count != 1 THEN
    RAISE EXCEPTION 'Expected exactly 1 Buy & Sell entry, found %', buy_sell_count;
  END IF;
END $$;

COMMIT;
