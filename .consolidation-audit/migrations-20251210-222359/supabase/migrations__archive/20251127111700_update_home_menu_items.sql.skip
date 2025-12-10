BEGIN;

-- Update existing whatsapp_home_menu_items rows with new names and descriptions
-- Uses key column to identify rows
-- Safe to run multiple times (idempotent updates only)

-- 1. Waiter Agent -> Bar & Restaurants
UPDATE public.whatsapp_home_menu_items
SET 
  name = '🍽️ Bar & Restaurants',
  description = 'Order, chat & pay from your seat — instant service, smart recommendations',
  updated_at = NOW()
WHERE key = 'waiter_agent';

-- 2. Rides Agent -> Rides & Delivery
UPDATE public.whatsapp_home_menu_items
SET 
  name = '🚕 Rides & Delivery',
  description = 'Nearby drivers & passengers — ride-share, fast pick-ups, cheaper trips',
  updated_at = NOW()
WHERE key = 'rides_agent';

-- 3. Jobs Agent -> Jobs & Gigs
UPDATE public.whatsapp_home_menu_items
SET 
  name = '👔 Jobs & Gigs',
  description = 'Post or get jobs — 1-hour gigs to full-time, chat & get hired fast',
  updated_at = NOW()
WHERE key = 'jobs_agent';

-- 4. Business Broker Agent -> Buy & Sell
UPDATE public.whatsapp_home_menu_items
SET 
  name = '🧱 Buy & Sell',
  description = 'List anything & get nearby buyers — discover businesses, products & services',
  updated_at = NOW()
WHERE key = 'business_broker_agent';

-- 5. Real Estate Agent -> Property Rentals
UPDATE public.whatsapp_home_menu_items
SET 
  name = '🏠 Property Rentals',
  description = 'Tell the agent what you want — get a verified top-5 shortlist instantly',
  updated_at = NOW()
WHERE key = 'real_estate_agent';

-- 6. Farmer Agent -> Farmers Market
UPDATE public.whatsapp_home_menu_items
SET 
  name = '🌱 Farmers Market',
  description = 'Farmers & consumers connect directly — better prices, no middlemen',
  updated_at = NOW()
WHERE key = 'farmer_agent';

-- 7. Insurance Agent -> Insurance & Protection
UPDATE public.whatsapp_home_menu_items
SET 
  name = '🛡️ Insurance & Protection',
  description = 'Buy or renew insurance & submit claims — all on WhatsApp',
  updated_at = NOW()
WHERE key = 'insurance_agent';

-- 8. Sales Agent -> Help Center
UPDATE public.whatsapp_home_menu_items
SET 
  name = '🆘 Help Center',
  description = 'Instant assistance — issues solved quickly',
  updated_at = NOW()
WHERE key = 'sales_agent';

-- 9. Profile -> My Account
UPDATE public.whatsapp_home_menu_items
SET 
  name = '👤 My Account',
  description = 'MoMo QR, businesses, vehicles, wallet, tokens & saved places',
  updated_at = NOW()
WHERE key = 'profile';

COMMIT;
