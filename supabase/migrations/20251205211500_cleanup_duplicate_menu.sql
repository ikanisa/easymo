-- =====================================================================
-- CLEANUP DUPLICATE MENU ITEMS
-- =====================================================================

BEGIN;

-- 1. Remove duplicate entries for Marketplace/Buy & Sell
DELETE FROM public.whatsapp_home_menu_items 
WHERE key IN ('buy_and_sell', 'marketplace');

-- 2. Insert the single correct entry
INSERT INTO public.whatsapp_home_menu_items (
  key, 
  name, 
  icon, 
  description, 
  is_active, 
  display_order, 
  created_at
)
VALUES (
  'buy_and_sell', 
  'Buy & Sell', 
  '🛍️', 
  'Marketplace for Goods & Services', 
  true, 
  2, 
  now()
);

COMMIT;
