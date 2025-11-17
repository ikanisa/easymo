BEGIN;

-- Fix trigger function to use maps_url or location_url instead of deprecated catalog_url
CREATE OR REPLACE FUNCTION public.business_update_location_from_url()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  coords RECORD;
  url TEXT;
BEGIN
  url := COALESCE(NEW.maps_url, NEW.location_url);
  IF url IS NOT NULL AND url != '' THEN
    SELECT * INTO coords FROM public.extract_coordinates_from_google_maps_url(url);
    IF coords.lat IS NOT NULL THEN
      NEW.latitude := coords.lat;
      NEW.longitude := coords.lng;
      -- Also update the PostGIS location column when available
      BEGIN
        NEW.location := ST_SetSRID(ST_MakePoint(coords.lng, coords.lat), 4326)::geography;
      EXCEPTION WHEN undefined_function THEN
        -- PostGIS not available; skip
        NULL;
      END;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;

