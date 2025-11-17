BEGIN;

-- Ensure column exists for country-specific names
ALTER TABLE whatsapp_home_menu_items
  ADD COLUMN IF NOT EXISTS country_specific_names JSONB DEFAULT '{}'::jsonb;

-- Localize Bars & Restaurants for Malta and Canada
UPDATE whatsapp_home_menu_items
SET country_specific_names = coalesce(country_specific_names, '{}'::jsonb)
  || jsonb_build_object('MT', jsonb_build_object(
       'name','Bars & Restaurants',
       'description','Discover nearby bars and restaurants.'
     ))
  || jsonb_build_object('CA', jsonb_build_object(
       'name','Bars & Restaurants',
       'description','Discover nearby bars and restaurants.'
     )),
    updated_at = now()
WHERE key = 'bars_restaurants';

-- Localize Property Rentals for Malta and Canada
UPDATE whatsapp_home_menu_items
SET country_specific_names = coalesce(country_specific_names, '{}'::jsonb)
  || jsonb_build_object('MT', jsonb_build_object(
       'name','Property Rentals',
       'description','Find or list rental properties.'
     ))
  || jsonb_build_object('CA', jsonb_build_object(
       'name','Property Rentals',
       'description','Find or list rental properties.'
     )),
    updated_at = now()
WHERE key = 'property_rentals';

-- Localize Jobs for Malta and Canada
UPDATE whatsapp_home_menu_items
SET country_specific_names = coalesce(country_specific_names, '{}'::jsonb)
  || jsonb_build_object('MT', jsonb_build_object(
       'name','Jobs',
       'description','Find work or post a job.'
     ))
  || jsonb_build_object('CA', jsonb_build_object(
       'name','Jobs',
       'description','Find work or post a job.'
     )),
    updated_at = now()
WHERE key = 'jobs';

COMMIT;

