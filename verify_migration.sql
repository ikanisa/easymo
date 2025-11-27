-- Verify profile_menu_items table exists
SELECT 
  'profile_menu_items table' as check,
  COUNT(*) as item_count
FROM profile_menu_items;

-- Verify function exists
SELECT 
  'get_profile_menu_items function' as check,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'get_profile_menu_items'
  AND n.nspname = 'public';

-- Show sample menu items
SELECT 
  item_key,
  title_en,
  available_countries,
  enabled
FROM profile_menu_items
ORDER BY display_order
LIMIT 5;
