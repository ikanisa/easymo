BEGIN;

-- =====================================================
-- POPULATE HOME MENU - November 21, 2025
-- =====================================================
-- Populates whatsapp_home_menu_items with default items
-- Excludes admin items as per user requirement
-- =====================================================

-- Add unique constraint if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'whatsapp_home_menu_items_key_unique'
  ) THEN
    ALTER TABLE public.whatsapp_home_menu_items 
    ADD CONSTRAINT whatsapp_home_menu_items_key_unique UNIQUE (key);
  END IF;
END $$;

-- Populate home menu items (NO ADMIN ITEMS)
INSERT INTO public.whatsapp_home_menu_items (name, key, is_active, display_order, icon, active_countries)
VALUES
  ('Property Rentals', 'property_rentals', true, 1, '🏠', '{RW,UG,KE,TZ,BF}'),
  ('Jobs & Gigs', 'jobs_gigs', true, 2, '💼', '{RW,UG,KE,TZ,BF}'),
  ('Farmer Agent', 'farmer_agent', true, 3, '🌾', '{RW,UG,KE,TZ,BF}'),
  ('General Broker', 'general_broker', true, 4, '🤝', '{RW,UG,KE,TZ,BF}'),
  ('Insurance Agent', 'insurance_agent', true, 5, '🛡️', '{RW,UG,KE,TZ,BF}'),
  ('My Profile & Assets', 'profile_assets', true, 6, '👤', '{RW,UG,KE,TZ,BF}'),
  ('Token Transfer', 'token_transfer', true, 7, '💰', '{RW,UG,KE,TZ,BF}')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active,
  display_order = EXCLUDED.display_order,
  icon = EXCLUDED.icon,
  active_countries = EXCLUDED.active_countries;

-- Add locale column to farm_synonyms if missing
ALTER TABLE IF EXISTS public.farm_synonyms ADD COLUMN IF NOT EXISTS locale text DEFAULT 'en';

-- Reload schema
NOTIFY pgrst, 'reload schema';

COMMIT;
