-- Migration: Extract coordinates from Google Maps URLs and clean duplicates
-- Generated: 2025-11-12 20:45:00 UTC

BEGIN;

-- =================================================================
-- PART 1: ADD LAT/LNG COLUMNS TO BARS IF NOT EXISTS
-- =================================================================

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'bars' 
                   AND column_name = 'lat') THEN
        ALTER TABLE public.bars ADD COLUMN lat double precision;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'bars' 
                   AND column_name = 'lng') THEN
        ALTER TABLE public.bars ADD COLUMN lng double precision;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'bars' 
                   AND column_name = 'location') THEN
        ALTER TABLE public.bars ADD COLUMN location geography(POINT, 4326);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'bars' 
                   AND column_name = 'google_maps_url') THEN
        ALTER TABLE public.bars ADD COLUMN google_maps_url text;
    END IF;
END $$;

-- =================================================================
-- PART 2: FUNCTION TO EXTRACT COORDINATES FROM GOOGLE MAPS URL
-- =================================================================

CREATE OR REPLACE FUNCTION public.extract_coordinates_from_maps_url(maps_url text)
RETURNS TABLE(lat double precision, lng double precision) AS $$
DECLARE
    url_pattern text;
    matches text[];
BEGIN
    -- Pattern 1: @lat,lng format
    url_pattern := '@(-?\d+\.?\d*),(-?\d+\.?\d*)';
    matches := regexp_matches(maps_url, url_pattern);
    
    IF array_length(matches, 1) = 2 THEN
        RETURN QUERY SELECT matches[1]::double precision, matches[2]::double precision;
        RETURN;
    END IF;
    
    -- Pattern 2: Plus code format (e.g., 24F3+WVC)
    -- Plus codes need to be geocoded externally, we'll skip for now
    
    -- Pattern 3: query= format with coordinates
    url_pattern := 'query=.*?(-?\d+\.?\d*)[,+].*?(-?\d+\.?\d*)';
    matches := regexp_matches(maps_url, url_pattern);
    
    IF array_length(matches, 1) = 2 THEN
        RETURN QUERY SELECT matches[1]::double precision, matches[2]::double precision;
        RETURN;
    END IF;
    
    -- No coordinates found
    RETURN QUERY SELECT NULL::double precision, NULL::double precision;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =================================================================
-- PART 3: UPDATE FUNCTION FOR BARS TABLE
-- =================================================================

CREATE OR REPLACE FUNCTION public.update_bars_coordinates_from_url()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER := 0;
    bar_record RECORD;
    coords RECORD;
BEGIN
    FOR bar_record IN 
        SELECT id, google_maps_url 
        FROM public.bars 
        WHERE google_maps_url IS NOT NULL 
        AND (lat IS NULL OR lng IS NULL)
    LOOP
        SELECT * INTO coords FROM public.extract_coordinates_from_maps_url(bar_record.google_maps_url);
        
        IF coords.lat IS NOT NULL AND coords.lng IS NOT NULL THEN
            UPDATE public.bars
            SET 
                lat = coords.lat,
                lng = coords.lng,
                location = ST_SetSRID(ST_MakePoint(coords.lng, coords.lat), 4326)::geography
            WHERE id = bar_record.id;
            
            updated_count := updated_count + 1;
        END IF;
    END LOOP;
    
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- =================================================================
-- PART 4: SIMILAR FUNCTION FOR BUSINESS TABLE
-- =================================================================

CREATE OR REPLACE FUNCTION public.update_business_coordinates_from_url()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER := 0;
    business_record RECORD;
    coords RECORD;
BEGIN
    FOR business_record IN 
        SELECT id, catalog_url 
        FROM public.business 
        WHERE catalog_url IS NOT NULL 
        AND (lat IS NULL OR lng IS NULL)
    LOOP
        SELECT * INTO coords FROM public.extract_coordinates_from_maps_url(business_record.catalog_url);
        
        IF coords.lat IS NOT NULL AND coords.lng IS NOT NULL THEN
            UPDATE public.business
            SET 
                lat = coords.lat,
                lng = coords.lng,
                location = ST_SetSRID(ST_MakePoint(coords.lng, coords.lat), 4326)::geography
            WHERE id = business_record.id;
            
            updated_count := updated_count + 1;
        END IF;
    END LOOP;
    
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- =================================================================
-- PART 5: CLEAN DUPLICATES IN BARS TABLE
-- =================================================================

-- Remove duplicate bars keeping the most recent one
WITH duplicates AS (
    SELECT 
        id,
        slug,
        ROW_NUMBER() OVER (PARTITION BY slug ORDER BY created_at DESC, id) as rn
    FROM public.bars
)
DELETE FROM public.bars
WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
);

-- Also check for near-duplicate names in the same city
WITH name_duplicates AS (
    SELECT 
        id,
        name,
        city_area,
        ROW_NUMBER() OVER (
            PARTITION BY LOWER(TRIM(name)), COALESCE(LOWER(city_area), 'unknown') 
            ORDER BY created_at DESC, id
        ) as rn
    FROM public.bars
    WHERE name IS NOT NULL
)
DELETE FROM public.bars
WHERE id IN (
    SELECT id FROM name_duplicates WHERE rn > 1
);

-- =================================================================
-- PART 6: CLEAN DUPLICATES IN BUSINESS TABLE
-- =================================================================

-- Remove duplicate businesses by name and location
WITH business_duplicates AS (
    SELECT 
        id,
        name,
        location_text,
        ROW_NUMBER() OVER (
            PARTITION BY LOWER(TRIM(name)), COALESCE(LOWER(TRIM(location_text)), 'unknown')
            ORDER BY created_at DESC, id
        ) as rn
    FROM public.business
    WHERE name IS NOT NULL
)
DELETE FROM public.business
WHERE id IN (
    SELECT id FROM business_duplicates WHERE rn > 1
);

-- =================================================================
-- PART 7: CREATE INDEXES FOR BETTER PERFORMANCE
-- =================================================================

CREATE INDEX IF NOT EXISTS idx_bars_coordinates ON public.bars(lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_business_coordinates ON public.business(lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- =================================================================
-- PART 8: GRANT PERMISSIONS
-- =================================================================

GRANT EXECUTE ON FUNCTION public.extract_coordinates_from_maps_url(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_bars_coordinates_from_url() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_business_coordinates_from_url() TO service_role;

COMMIT;

-- =================================================================
-- USAGE INSTRUCTIONS:
-- =================================================================
-- After running this migration, execute:
-- SELECT public.update_bars_coordinates_from_url();
-- SELECT public.update_business_coordinates_from_url();
