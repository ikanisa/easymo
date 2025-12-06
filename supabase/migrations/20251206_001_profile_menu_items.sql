-- Migration: 20251206_001_profile_menu_items.sql
-- Dynamic profile menu items with visibility conditions

BEGIN;

-- Dynamic profile menu items with visibility conditions
CREATE TABLE IF NOT EXISTS public.profile_menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_key TEXT NOT NULL UNIQUE,
  display_order INTEGER NOT NULL DEFAULT 100,
  icon TEXT NOT NULL DEFAULT '📋',
  title_key TEXT NOT NULL,
  description_key TEXT NOT NULL,
  action_type TEXT NOT NULL DEFAULT 'route',
  action_target TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  active_countries TEXT[] DEFAULT ARRAY['RW', 'BI', 'TZ', 'CD', 'ZM', 'MT'],
  requires_business_category TEXT[],
  visibility_conditions JSONB DEFAULT '{}',
  translations JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_profile_menu_items_active ON profile_menu_items(is_active);
CREATE INDEX IF NOT EXISTS idx_profile_menu_items_order ON profile_menu_items(display_order);

-- Seed data
INSERT INTO profile_menu_items (item_key, display_order, icon, title_key, description_key, action_type, action_target, translations) VALUES
('edit_profile', 10, '✏️', 'profile.menu.edit.title', 'profile.menu.edit.description', 'route', 'EDIT_PROFILE',
 '{"en": {"title": "Edit Profile", "description": "Update name, language & settings"}, "rw": {"title": "Hindura Umwirondoro", "description": "Hindura izina, ururimi n''igenamiterere"}}'::jsonb),
('wallet_tokens', 20, '💎', 'profile.menu.wallet.title', 'profile.menu.wallet.description', 'route', 'WALLET_HOME',
 '{"en": {"title": "Wallet & Tokens", "description": "View balance, transfer, redeem rewards"}, "rw": {"title": "Agasanduku & Tokens", "description": "Reba amafaranga, ohereza, uhembwe"}}'::jsonb),
('invite_earn', 25, '🎁', 'profile.menu.invite.title', 'profile.menu.invite.description', 'route', 'WALLET_EARN',
 '{"en": {"title": "Invite & Earn", "description": "Share your referral link"}, "rw": {"title": "Tumira & Ubone", "description": "Sangira link yawe"}}'::jsonb),
('my_businesses', 30, '🏪', 'profile.menu.businesses.title', 'profile.menu.businesses.description', 'route', 'MY_BUSINESSES',
 '{"en": {"title": "My Businesses", "description": "Manage your business listings"}, "rw": {"title": "Ubucuruzi Bwanjye", "description": "Gucunga ubucuruzi bwawe"}}'::jsonb),
('my_bars_restaurants', 35, '🍽️', 'profile.menu.bars_restaurants.title', 'profile.menu.bars_restaurants.description', 'route', 'MY_BARS_RESTAURANTS',
 '{"en": {"title": "My Bars & Restaurants", "description": "Manage menus, orders & payments"}, "rw": {"title": "Amabari & Resitora", "description": "Gucunga menu, order n''ubwishyu"}}'::jsonb),
('my_jobs', 40, '💼', 'profile.menu.jobs.title', 'profile.menu.jobs.description', 'route', 'MY_JOBS',
 '{"en": {"title": "My Jobs", "description": "Manage your job postings"}, "rw": {"title": "Akazi Kanjye", "description": "Gucunga akazi watangaje"}}'::jsonb),
('my_properties', 50, '🏠', 'profile.menu.properties.title', 'profile.menu.properties.description', 'route', 'MY_PROPERTIES',
 '{"en": {"title": "My Properties", "description": "Manage your property listings"}, "rw": {"title": "Imitungo Yanjye", "description": "Gucunga imitungo yawe"}}'::jsonb),
('my_vehicles', 60, '🚗', 'profile.menu.vehicles.title', 'profile.menu.vehicles.description', 'route', 'MY_VEHICLES',
 '{"en": {"title": "My Vehicles", "description": "Manage your registered vehicles"}, "rw": {"title": "Imodoka Zanjye", "description": "Gucunga imodoka zawe"}}'::jsonb),
('saved_locations', 70, '📍', 'profile.menu.locations.title', 'profile.menu.locations.description', 'route', 'SAVED_LOCATIONS',
 '{"en": {"title": "Saved Locations", "description": "Your favorite places"}, "rw": {"title": "Ahantu Nabitse", "description": "Ahantu ukunda"}}'::jsonb),
('settings', 80, '⚙️', 'profile.menu.settings.title', 'profile.menu.settings.description', 'route', 'SETTINGS',
 '{"en": {"title": "Settings", "description": "Privacy, notifications & more"}, "rw": {"title": "Igenamiterere", "description": "Ibanga, kumenyeshwa n''ibindi"}}'::jsonb)
ON CONFLICT (item_key) DO NOTHING;

-- Set "My Bars & Restaurants" visibility condition
UPDATE profile_menu_items 
SET requires_business_category = ARRAY['bar', 'restaurant', 'bar_restaurant', 'bar & restaurant', 'cafe', 'pub', 'lounge', 'nightclub'],
    visibility_conditions = '{"has_bar_restaurant": true}'::jsonb
WHERE item_key = 'my_bars_restaurants';

COMMIT;
