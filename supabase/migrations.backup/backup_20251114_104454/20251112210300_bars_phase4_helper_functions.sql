-- =====================================================
-- PHASE 4: Helper functions for bars management
-- =====================================================
-- Purpose: Create utility functions for working with bars data

BEGIN;

-- Function to extract lat/lng from Google Maps URLs
-- Note: This is a placeholder - actual extraction would need to be done via external service
CREATE OR REPLACE FUNCTION public.extract_latlng_from_google_url(google_url text)
RETURNS TABLE(lat double precision, lng double precision) AS $$
BEGIN
    -- This is a placeholder function
    -- In production, you would:
    -- 1. Parse the Google Maps URL
    -- 2. Extract coordinates from the URL pattern
    -- 3. Or use Google Maps Geocoding API
    
    -- For now, return NULL values
    RETURN QUERY SELECT NULL::double precision, NULL::double precision;
END;
$$ LANGUAGE plpgsql;

-- Function to update bar location from lat/lng
CREATE OR REPLACE FUNCTION public.update_bar_location()
RETURNS TRIGGER AS $$
BEGIN
    -- When lat/lng are updated, update the PostGIS location
    IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
        NEW.location := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update location when lat/lng changes
DROP TRIGGER IF EXISTS update_bar_location_trigger ON public.bars;
CREATE TRIGGER update_bar_location_trigger
    BEFORE INSERT OR UPDATE OF lat, lng ON public.bars
    FOR EACH ROW
    EXECUTE FUNCTION public.update_bar_location();

-- Function to find nearby bars
CREATE OR REPLACE FUNCTION public.find_nearby_bars(
    p_lat double precision,
    p_lng double precision,
    p_radius_km double precision DEFAULT 5.0,
    p_limit integer DEFAULT 20
)
RETURNS TABLE (
    id uuid,
    name text,
    slug text,
    location_text text,
    distance_meters numeric,
    country text,
    city_area text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.id,
        b.name,
        b.slug,
        b.location_text,
        ST_Distance(
            b.location,
            ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
        )::numeric AS distance_meters,
        b.country,
        b.city_area
    FROM public.bars b
    WHERE b.is_active = true
        AND b.location IS NOT NULL
        AND ST_DWithin(
            b.location,
            ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
            p_radius_km * 1000
        )
    ORDER BY b.location <-> ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get bars by country
CREATE OR REPLACE FUNCTION public.get_bars_by_country(
    p_country text,
    p_limit integer DEFAULT 50
)
RETURNS TABLE (
    id uuid,
    name text,
    slug text,
    location_text text,
    city_area text,
    currency text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.id,
        b.name,
        b.slug,
        b.location_text,
        b.city_area,
        b.currency
    FROM public.bars b
    WHERE b.is_active = true
        AND LOWER(b.country) = LOWER(p_country)
    ORDER BY b.name
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.find_nearby_bars(double precision, double precision, double precision, integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_bars_by_country(text, integer) TO authenticated, anon;

-- Add comments
COMMENT ON FUNCTION public.find_nearby_bars IS 'Find bars within a specified radius of a lat/lng point';
COMMENT ON FUNCTION public.get_bars_by_country IS 'Get all active bars in a specific country';

COMMIT;
