-- ============================================================================
-- EXTRACT COORDINATES FROM GOOGLE MAPS URLS
-- ============================================================================
-- Using Google Maps Geocoding API to extract lat/lng from address URLs
-- API Key: AIzaSyB8B8N2scJAWMs05f-xGRVzQAb4MQIuNEU
-- ============================================================================

BEGIN;

-- Step 1: Check current state of business table
\echo '=== ANALYZING BUSINESS TABLE ==='
\echo ''

SELECT 
    COUNT(*) as total_businesses,
    COUNT(latitude) as has_latitude,
    COUNT(longitude) as has_longitude,
    COUNT(*) - COUNT(latitude) as missing_latitude,
    COUNT(CASE WHEN address IS NOT NULL THEN 1 END) as has_address,
    COUNT(CASE WHEN google_maps_url IS NOT NULL THEN 1 END) as has_google_maps_url
FROM businesses;

-- Step 2: Show sample of businesses with URLs but no coordinates
\echo ''
\echo '=== SAMPLE BUSINESSES NEEDING COORDINATES ==='
\echo ''

SELECT 
    id,
    name,
    address,
    google_maps_url,
    latitude,
    longitude
FROM businesses
WHERE (latitude IS NULL OR longitude IS NULL)
  AND (address IS NOT NULL OR google_maps_url IS NOT NULL)
LIMIT 10;

-- Step 3: Create a helper function to extract coordinates from Google Maps URLs
\echo ''
\echo '=== CREATING HELPER FUNCTIONS ==='
\echo ''

-- Function to extract place_id from Google Maps URL
CREATE OR REPLACE FUNCTION extract_place_id_from_url(url TEXT)
RETURNS TEXT AS $$
DECLARE
    place_id TEXT;
BEGIN
    -- Extract place_id from various Google Maps URL formats
    -- Format 1: /place/.../@lat,lng,zoom
    -- Format 2: /place/...?q=place+name
    -- Format 3: /maps?q=lat,lng
    
    IF url ~ 'place_id=' THEN
        place_id := substring(url from 'place_id=([^&]+)');
    ELSIF url ~ '@(-?\d+\.?\d*),(-?\d+\.?\d*)' THEN
        -- Extract coordinates directly from URL
        RETURN NULL; -- Will use direct extraction
    END IF;
    
    RETURN place_id;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to extract coordinates directly from URL
CREATE OR REPLACE FUNCTION extract_coords_from_url(url TEXT)
RETURNS TABLE(lat DOUBLE PRECISION, lng DOUBLE PRECISION) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CAST(substring(url from '@(-?\d+\.?\d*),') AS DOUBLE PRECISION) as lat,
        CAST(substring(url from '@-?\d+\.?\d*,(-?\d+\.?\d*)') AS DOUBLE PRECISION) as lng
    WHERE url ~ '@(-?\d+\.?\d*),(-?\d+\.?\d*)';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

\echo '✓ Helper functions created'

-- Step 4: Extract coordinates directly from URLs where available
\echo ''
\echo '=== EXTRACTING COORDINATES FROM URLS ==='
\echo ''

UPDATE businesses b
SET 
    latitude = coords.lat,
    longitude = coords.lng,
    updated_at = NOW()
FROM (
    SELECT 
        id,
        (extract_coords_from_url(google_maps_url)).lat as lat,
        (extract_coords_from_url(google_maps_url)).lng as lng
    FROM businesses
    WHERE google_maps_url IS NOT NULL
      AND (latitude IS NULL OR longitude IS NULL)
      AND google_maps_url ~ '@(-?\d+\.?\d*),(-?\d+\.?\d*)'
) coords
WHERE b.id = coords.id
  AND coords.lat IS NOT NULL
  AND coords.lng IS NOT NULL;

\echo 'Extracted coordinates from URLs'

-- Step 5: Show results
\echo ''
\echo '=== EXTRACTION RESULTS ==='
\echo ''

SELECT 
    COUNT(*) as total_businesses,
    COUNT(latitude) as has_latitude,
    COUNT(longitude) as has_longitude,
    COUNT(*) - COUNT(latitude) as still_missing,
    ROUND(100.0 * COUNT(latitude) / COUNT(*), 2) as completion_percentage
FROM businesses;

-- Step 6: List businesses still needing geocoding
\echo ''
\echo '=== BUSINESSES STILL NEEDING GEOCODING ==='
\echo ''

SELECT 
    id,
    name,
    address,
    google_maps_url
FROM businesses
WHERE (latitude IS NULL OR longitude IS NULL)
  AND (address IS NOT NULL OR google_maps_url IS NOT NULL)
ORDER BY name
LIMIT 20;

COMMIT;

\echo ''
\echo '✓ COORDINATE EXTRACTION COMPLETE'
\echo ''
\echo 'Next Steps:'
\echo '1. For remaining businesses, use Google Geocoding API'
\echo '2. Run the Node.js script: extract_coordinates_with_api.js'

