BEGIN;

-- Get nearby properties function for property search
CREATE OR REPLACE FUNCTION get_nearby_properties(
  p_lat NUMERIC,
  p_lng NUMERIC,
  p_listing_type TEXT,
  p_bedrooms INTEGER DEFAULT NULL,
  p_max_price NUMERIC DEFAULT NULL,
  p_currency TEXT DEFAULT 'RWF',
  p_property_type TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 10,
  p_radius_km NUMERIC DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  property_type TEXT,
  listing_type TEXT,
  bedrooms NUMERIC,
  bathrooms NUMERIC,
  price NUMERIC,
  currency TEXT,
  location TEXT,
  lat NUMERIC,
  lng NUMERIC,
  contact_info JSONB,
  description TEXT,
  amenities TEXT[],
  photos TEXT[],
  distance_km NUMERIC,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pl.id,
    pl.title,
    pl.property_type,
    pl.listing_type,
    pl.bedrooms,
    pl.bathrooms,
    pl.price,
    pl.currency,
    pl.location,
    pl.lat,
    pl.lng,
    pl.contact_info,
    pl.description,
    pl.amenities,
    pl.photos,
    CASE 
      WHEN pl.lat IS NOT NULL AND pl.lng IS NOT NULL THEN
        ROUND(
          (6371 * acos(
            cos(radians(p_lat)) * cos(radians(pl.lat)) * 
            cos(radians(pl.lng) - radians(p_lng)) + 
            sin(radians(p_lat)) * sin(radians(pl.lat))
          ))::numeric,
          2
        )
      ELSE NULL
    END AS distance_km,
    pl.created_at
  FROM property_listings pl
  WHERE pl.status = 'active'
    AND pl.listing_type = p_listing_type
    AND (p_bedrooms IS NULL OR pl.bedrooms = p_bedrooms)
    AND (p_max_price IS NULL OR pl.price <= p_max_price)
    AND (p_property_type IS NULL OR pl.property_type = p_property_type)
    AND (
      pl.lat IS NULL 
      OR pl.lng IS NULL 
      OR (
        6371 * acos(
          cos(radians(p_lat)) * cos(radians(pl.lat)) * 
          cos(radians(pl.lng) - radians(p_lng)) + 
          sin(radians(p_lat)) * sin(radians(pl.lat))
        ) <= p_radius_km
      )
    )
  ORDER BY 
    CASE WHEN pl.lat IS NOT NULL AND pl.lng IS NOT NULL THEN
      6371 * acos(
        cos(radians(p_lat)) * cos(radians(pl.lat)) * 
        cos(radians(pl.lng) - radians(p_lng)) + 
        sin(radians(p_lat)) * sin(radians(pl.lat))
      )
    ELSE 999999
    END,
    pl.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_nearby_properties TO service_role;
GRANT EXECUTE ON FUNCTION get_nearby_properties TO authenticated;

COMMENT ON FUNCTION get_nearby_properties IS 'Finds nearby properties within a radius with optional filters for bedrooms, price, and type';

COMMIT;
