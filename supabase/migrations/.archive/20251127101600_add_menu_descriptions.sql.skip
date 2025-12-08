BEGIN;

-- Add description column to whatsapp_home_menu_items
ALTER TABLE public.whatsapp_home_menu_items 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Update menu items with emojis and descriptions
-- WhatsApp interactive list limits: title max 24 chars, description max 72 chars

-- 1. Waiter AI
UPDATE public.whatsapp_home_menu_items
SET 
  name = '🍽️ Waiter AI',
  description = 'Order food, book tables, get restaurant recommendations'
WHERE key = 'waiter_agent';

-- 2. Rides AI
UPDATE public.whatsapp_home_menu_items
SET 
  name = '🚗 Rides & Delivery',
  description = 'Request rides, deliveries, track trips, manage bookings'
WHERE key = 'rides_agent';

-- 3. Jobs AI
UPDATE public.whatsapp_home_menu_items
SET 
  name = '💼 Jobs & Careers',
  description = 'Find jobs, post openings, hire talent, career support'
WHERE key = 'jobs_agent';

-- 4. Insurance AI
UPDATE public.whatsapp_home_menu_items
SET 
  name = '🛡️ Insurance',
  description = 'Buy coverage, manage policies, file claims, get quotes'
WHERE key = 'insurance_agent';

-- 5. Property AI
UPDATE public.whatsapp_home_menu_items
SET 
  name = '🏠 Property Rentals',
  description = 'Find rentals, list properties, manage leases'
WHERE key = 'property_agent';

-- 6. Marketplace AI
UPDATE public.whatsapp_home_menu_items
SET 
  name = '🛒 Marketplace',
  description = 'Buy & sell items, browse products, manage listings'
WHERE key = 'marketplace_agent';

-- 7. Business Broker AI
UPDATE public.whatsapp_home_menu_items
SET 
  name = '🏢 Business Broker',
  description = 'Buy/sell businesses, get valuations, find opportunities'
WHERE key = 'business_broker_agent';

-- 8. General Broker AI
UPDATE public.whatsapp_home_menu_items
SET 
  name = '🤝 General Services',
  description = 'Brokers, agents, services, professional help'
WHERE key = 'general_broker_agent';

-- 9. Farmer AI
UPDATE public.whatsapp_home_menu_items
SET 
  name = '🌾 Farmer Support',
  description = 'Crop advice, market prices, weather, farming tips'
WHERE key = 'farmer_agent';

-- 10. Wallet & Profile
UPDATE public.whatsapp_home_menu_items
SET 
  name = '💎 Wallet & Profile',
  description = 'Manage tokens, send money, update profile, settings'
WHERE key = 'wallet';

COMMIT;
