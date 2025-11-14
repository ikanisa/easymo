BEGIN;

-- Migration: Add Profile Menu Item to WhatsApp Home Menu
-- Date: 2025-11-12
-- Description: Adds the Profile hub menu item to the WhatsApp home menu

-- Insert Profile menu item if it doesn't exist
INSERT INTO public.whatsapp_home_menu_items (name, key, is_active, active_countries, display_order, icon)
VALUES
  ('Profile', 'profile', true, ARRAY['RW', 'UG', 'KE', 'TZ', 'BI', 'CD'], 13, '👤')
ON CONFLICT (key) DO UPDATE
  SET name = EXCLUDED.name,
      is_active = EXCLUDED.is_active,
      active_countries = EXCLUDED.active_countries,
      display_order = EXCLUDED.display_order,
      icon = EXCLUDED.icon,
      updated_at = timezone('utc', now());

-- Add comment explaining the Profile menu
COMMENT ON COLUMN public.whatsapp_home_menu_items.key IS 
  'Unique key for menu item. "profile" key opens the Profile hub with vehicles, businesses, tokens, and settings.';

COMMIT;
