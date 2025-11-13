-- Extract coordinates from Google Maps URLs and update bars table
-- This script handles common Google Maps URL formats

BEGIN;

-- Create temporary function to extract coordinates
CREATE OR REPLACE FUNCTION extract_coords_from_url(url TEXT) 
RETURNS TABLE(lat DOUBLE PRECISION, lng DOUBLE PRECISION) AS $$
DECLARE
  coord_match TEXT;
BEGIN
  IF url IS NULL THEN
    RETURN;
  END IF;

  -- Try format: /@Lat,Lng
  coord_match := (regexp_matches(url, '@(-?\d+\.?\d*),(-?\d+\.?\d*)'))[1];
  IF coord_match IS NOT NULL THEN
    lat := (regexp_matches(url, '@(-?\d+\.?\d*),(-?\d+\.?\d*)'))[1]::DOUBLE PRECISION;
    lng := (regexp_matches(url, '@(-?\d+\.?\d*),(-?\d+\.?\d*)'))[2]::DOUBLE PRECISION;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Try format: query=...Lat,Lng
  coord_match := (regexp_matches(url, 'query=[^&]*?(-?\d+\.?\d*),?\s*(-?\d+\.?\d*)'))[1];
  IF coord_match IS NOT NULL THEN
    lat := (regexp_matches(url, 'query=[^&]*?(-?\d+\.?\d*),?\s*(-?\d+\.?\d*)'))[1]::DOUBLE PRECISION;
    lng := (regexp_matches(url, 'query=[^&]*?(-?\d+\.?\d*),?\s*(-?\d+\.?\d*)'))[2]::DOUBLE PRECISION;
    RETURN NEXT;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update bars with extracted coordinates
UPDATE public.bars b
SET 
  lat = coords.lat,
  lng = coords.lng,
  updated_at = NOW()
FROM (
  SELECT 
    id,
    (extract_coords_from_url(google_maps_url)).lat as lat,
    (extract_coords_from_url(google_maps_url)).lng as lng
  FROM public.bars
  WHERE google_maps_url IS NOT NULL
    AND lat IS NULL
) coords
WHERE b.id = coords.id
  AND coords.lat IS NOT NULL
  AND coords.lng IS NOT NULL
  -- Validate coordinates are in reasonable range for Rwanda/Malta
  AND (
    (coords.lat BETWEEN -3 AND -1 AND coords.lng BETWEEN 28 AND 31) OR  -- Rwanda
    (coords.lat BETWEEN 35.8 AND 36.1 AND coords.lng BETWEEN 14.2 AND 14.6)  -- Malta
  );

-- Show results
SELECT 
  COUNT(*) FILTER (WHERE lat IS NOT NULL AND lng IS NOT NULL) as with_coords,
  COUNT(*) FILTER (WHERE lat IS NULL) as without_coords,
  COUNT(*) as total
FROM public.bars;

-- Drop temporary function
DROP FUNCTION IF EXISTS extract_coords_from_url(TEXT);

COMMIT;
