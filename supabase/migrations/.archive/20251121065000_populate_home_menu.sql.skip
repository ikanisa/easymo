BEGIN;

-- =====================================================
-- POPULATE HOME MENU - November 21, 2025
-- =====================================================
-- Populates whatsapp_home_menu_items with all menu items
-- Includes mobility, property, jobs, farmer, broker, wallet features
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

-- Populate comprehensive home menu items with all features
INSERT INTO public.whatsapp_home_menu_items (name, key, is_active, display_order, icon, active_countries)
VALUES
  -- Mobility features
  ('Nearby Drivers', 'nearby_drivers', true, 1, '🚖', '{RW,UG,KE,TZ,BI,CD}'),
  ('Nearby Passengers', 'nearby_passengers', true, 2, '🧍', '{RW,UG,KE,TZ,BI,CD}'),
  ('Schedule Trip', 'schedule_trip', true, 3, '🚦', '{RW,UG,KE,TZ,BI,CD}'),
  
  -- Property & Real Estate
  ('Property Rentals', 'property_rentals', true, 4, '🏠', '{RW,UG,KE,TZ,BI,CD}'),
  
  -- Jobs & Employment
  ('Jobs & Gigs', 'jobs_gigs', true, 5, '💼', '{RW,UG,KE,TZ,BI,CD}'),
  
  -- Agricultural Marketplace
  ('Farmer Agent', 'farmer_agent', true, 6, '🌾', '{RW,UG,KE,TZ,BI,CD}'),
  
  -- General Services Broker
  ('General Broker', 'general_broker', true, 7, '🤝', '{RW,UG,KE,TZ,BI,CD}'),
  
  -- Insurance
  ('Insurance Agent', 'insurance_agent', true, 8, '🛡️', '{RW}'),
  ('Motor Insurance', 'motor_insurance', true, 9, '🛡️', '{RW}'),
  
  -- Local Services
  ('Nearby Pharmacies', 'nearby_pharmacies', true, 10, '💊', '{RW,UG,KE,TZ,BI,CD}'),
  ('Quincailleries', 'quincailleries', true, 11, '🔧', '{RW,UG,KE,TZ,BI,CD}'),
  ('Shops & Services', 'shops_services', true, 12, '🏪', '{RW,UG,KE,TZ,BI,CD}'),
  ('Bars & Restaurants', 'bars_restaurants', true, 13, '🍽️', '{RW,UG,KE,TZ,BI,CD}'),
  ('Notary Services', 'notary_services', true, 14, '📜', '{RW}'),
  
  -- User Profile & Assets
  ('My Profile & Assets', 'profile_assets', true, 15, '👤', '{RW,UG,KE,TZ,BI,CD}'),
  
  -- Wallet & Payments
  ('MOMO QR Code', 'momo_qr', true, 16, '📱', '{RW}'),
  ('Token Transfer', 'token_transfer', true, 17, '💰', '{RW,UG,KE,TZ,BI,CD}'),
  
  -- Support
  ('Customer Support', 'customer_support', true, 18, '💬', '{RW,UG,KE,TZ,BI,CD}')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active,
  display_order = EXCLUDED.display_order,
  icon = EXCLUDED.icon,
  active_countries = EXCLUDED.active_countries,
  updated_at = NOW();

-- Add locale column to farm_synonyms if missing
ALTER TABLE IF EXISTS public.farm_synonyms ADD COLUMN IF NOT EXISTS locale text DEFAULT 'en';

-- Reload schema
NOTIFY pgrst, 'reload schema';

COMMIT;
