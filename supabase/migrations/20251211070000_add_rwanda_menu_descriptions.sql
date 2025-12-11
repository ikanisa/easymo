-- Add Rwanda (RW) descriptions to Buy & Sell menu items
-- Both items were missing RW in country_specific_names JSONB
-- Issue: Rwanda users don't see helpful descriptions for menu items

BEGIN;

-- 1. Update Buy and Sell Categories - Add RW
UPDATE public.whatsapp_home_menu_items
SET country_specific_names = country_specific_names || 
  jsonb_build_object(
    'RW', jsonb_build_object(
      'name', 'Kugura & Kugurisha',
      'description', 'Hitamo icyiciro, ubone amashobuzi hafi yawe'
    )
  ),
  updated_at = NOW()
WHERE key = 'buy_sell_categories';

-- 2. Update Chat with Agent - Add RW
UPDATE public.whatsapp_home_menu_items
SET country_specific_names = country_specific_names || 
  jsonb_build_object(
    'RW', jsonb_build_object(
      'name', 'Ganira na Agent',
      'description', 'Shakisha ukoresheje AI'
    )
  ),
  updated_at = NOW()
WHERE key = 'business_broker_agent';

-- Verify updates
DO $$
DECLARE
  v_categories_has_rw BOOLEAN;
  v_broker_has_rw BOOLEAN;
  v_categories_desc TEXT;
  v_broker_desc TEXT;
BEGIN
  -- Check if RW now exists in buy_sell_categories
  SELECT 
    country_specific_names ? 'RW',
    country_specific_names->'RW'->>'description'
  INTO v_categories_has_rw, v_categories_desc
  FROM whatsapp_home_menu_items
  WHERE key = 'buy_sell_categories';
  
  -- Check if RW now exists in business_broker_agent
  SELECT 
    country_specific_names ? 'RW',
    country_specific_names->'RW'->>'description'
  INTO v_broker_has_rw, v_broker_desc
  FROM whatsapp_home_menu_items
  WHERE key = 'business_broker_agent';
  
  IF v_categories_has_rw AND v_broker_has_rw THEN
    RAISE NOTICE '✅ Rwanda (RW) descriptions added successfully';
    RAISE NOTICE '  - Buy & Sell: %', v_categories_desc;
    RAISE NOTICE '  - Chat Agent: %', v_broker_desc;
  ELSE
    RAISE WARNING '❌ Failed to add Rwanda descriptions. Categories: %, Broker: %', 
      v_categories_has_rw, v_broker_has_rw;
  END IF;
END $$;

-- Show final state for all menu items
SELECT 
  key,
  name as default_name,
  country_specific_names->'RW'->>'name' as rwanda_name,
  country_specific_names->'RW'->>'description' as rwanda_description,
  is_active
FROM whatsapp_home_menu_items
WHERE key IN ('buy_sell_categories', 'business_broker_agent')
ORDER BY display_order;

COMMIT;
