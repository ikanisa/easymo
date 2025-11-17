BEGIN;

-- Add Malta (MT) and Canada (CA) to active countries for selected home menu items
-- Keys: bars_restaurants, property_rentals, jobs
UPDATE whatsapp_home_menu_items SET
  is_active = true,
  active_countries = (
    SELECT ARRAY(
      SELECT DISTINCT unnest(coalesce(active_countries, ARRAY[]::text[]) || ARRAY['MT','CA'])
    )
  ),
  updated_at = now()
WHERE key IN ('bars_restaurants','property_rentals','jobs');

-- Hide specific profile submenu items outside Africa
-- For Malta (Europe) and Canada (North America), do not display MOMO QR and Vehicles
-- We drive this via region_restrictions = ARRAY['africa'] so they only show in African countries
ALTER TABLE whatsapp_profile_menu_items
  ADD COLUMN IF NOT EXISTS region_restrictions TEXT[] DEFAULT NULL;

UPDATE whatsapp_profile_menu_items
SET region_restrictions = ARRAY['africa']::text[], updated_at = now()
WHERE key IN ('momo_qr','my_vehicles');

COMMIT;

