BEGIN;

-- Function to find nearby properties using PostGIS
-- Returns properties within specified radius sorted by distance
CREATE OR REPLACE FUNCTION public.nearby_properties(
  _lat double precision,
  _lng double precision,
  _radius_km double precision DEFAULT 5.0,
  _limit integer DEFAULT 20,
  _price_min integer DEFAULT NULL,
  _price_max integer DEFAULT NULL,
  _bedrooms integer DEFAULT NULL,
  _property_type text DEFAULT NULL,
  _listing_type text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  location text,
  price integer,
  bedrooms integer,
  bathrooms integer,
  property_type text,
  listing_type text,
  amenities jsonb,
  lat numeric,
  lng numeric,
  distance_km double precision
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.title,
    p.location,
    p.price,
    p.bedrooms,
    p.bathrooms,
    p.property_type,
    p.listing_type,
    p.amenities,
    p.lat,
    p.lng,
    ST_Distance(
      ST_SetSRID(ST_MakePoint(_lng, _lat), 4326)::geography,
      ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography
    ) / 1000.0 AS distance_km
  FROM public.property_listings p
  WHERE 
    p.status = 'active'
    AND p.lat IS NOT NULL
    AND p.lng IS NOT NULL
    AND ST_DWithin(
      ST_SetSRID(ST_MakePoint(_lng, _lat), 4326)::geography,
      ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography,
      _radius_km * 1000 -- Convert km to meters
    )
    AND (_price_min IS NULL OR p.price >= _price_min)
    AND (_price_max IS NULL OR p.price <= _price_max)
    AND (_bedrooms IS NULL OR p.bedrooms >= _bedrooms)
    AND (_property_type IS NULL OR p.property_type = _property_type)
    AND (_listing_type IS NULL OR p.listing_type = _listing_type)
  ORDER BY distance_km
  LIMIT _limit;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.nearby_properties TO service_role, authenticated, anon;

COMMENT ON FUNCTION public.nearby_properties IS 
'Find properties within a radius using GPS coordinates. Returns properties sorted by distance with filters for price, bedrooms, type, and listing type.';

COMMIT;
