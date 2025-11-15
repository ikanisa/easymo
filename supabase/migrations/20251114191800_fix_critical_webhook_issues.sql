-- Fix Critical WhatsApp Webhook Issues
-- 1. Remove duplicate "support" menu item (keep customer_support)
-- 2. Fix MOMO QR title to be shorter
-- 3. Ensure proper country filtering

-- Remove the duplicate "support" entry, keep "customer_support"
DELETE FROM whatsapp_home_menu_items 
WHERE key = 'support';

-- Update display orders to be sequential without gaps
UPDATE whatsapp_home_menu_items SET display_order = 1 WHERE key = 'profile';
UPDATE whatsapp_home_menu_items SET display_order = 2 WHERE key = 'nearby_drivers';
UPDATE whatsapp_home_menu_items SET display_order = 3 WHERE key = 'nearby_passengers';
UPDATE whatsapp_home_menu_items SET display_order = 4 WHERE key = 'schedule_trip';
UPDATE whatsapp_home_menu_items SET display_order = 5 WHERE key = 'motor_insurance';
UPDATE whatsapp_home_menu_items SET display_order = 6 WHERE key = 'nearby_pharmacies';
UPDATE whatsapp_home_menu_items SET display_order = 7 WHERE key = 'bars_restaurants';
UPDATE whatsapp_home_menu_items SET display_order = 8 WHERE key = 'shops_services';
UPDATE whatsapp_home_menu_items SET display_order = 9 WHERE key = 'momo_qr';
UPDATE whatsapp_home_menu_items SET display_order = 10 WHERE key = 'property_rentals';
UPDATE whatsapp_home_menu_items SET display_order = 11 WHERE key = 'quincailleries';
UPDATE whatsapp_home_menu_items SET display_order = 12 WHERE key = 'notary_services';
UPDATE whatsapp_home_menu_items SET display_order = 13 WHERE key = 'customer_support';

-- Update MOMO QR name to be shorter (max 24 chars for WhatsApp)
UPDATE whatsapp_home_menu_items 
SET name = 'MOMO QR & Tokens'
WHERE key = 'momo_qr';

-- Ensure all items have proper country assignments (RW only for now)
UPDATE whatsapp_home_menu_items
SET active_countries = ARRAY['RW']
WHERE active_countries = ARRAY[]::text[] OR active_countries IS NULL;

-- Add Malta (MT) support for property rentals
UPDATE whatsapp_home_menu_items
SET active_countries = ARRAY['RW', 'MT']
WHERE key = 'property_rentals';
