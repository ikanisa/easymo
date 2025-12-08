BEGIN;

-- =====================================================
-- CONSOLIDATE RIDES MENU - November 21, 2025
-- =====================================================
-- Consolidates Nearby Drivers, Nearby Passengers, and Schedule Trip
-- into a single "Rides" menu item with submenu
-- =====================================================

-- Deactivate the individual ride menu items
UPDATE public.whatsapp_home_menu_items
SET is_active = false, updated_at = NOW()
WHERE key IN ('nearby_drivers', 'nearby_passengers', 'schedule_trip');

-- Add new consolidated "Rides" menu item
INSERT INTO public.whatsapp_home_menu_items (name, key, is_active, display_order, icon, active_countries)
VALUES
  ('Rides', 'rides', true, 1, '🚗', '{RW,UG,KE,TZ,BI,CD}')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active,
  display_order = EXCLUDED.display_order,
  icon = EXCLUDED.icon,
  active_countries = EXCLUDED.active_countries,
  updated_at = NOW();

-- Adjust display_order for other items to make room
UPDATE public.whatsapp_home_menu_items
SET display_order = display_order + 1, updated_at = NOW()
WHERE display_order >= 1 AND key NOT IN ('nearby_drivers', 'nearby_passengers', 'schedule_trip', 'rides');

-- Reload schema
NOTIFY pgrst, 'reload schema';

COMMIT;
