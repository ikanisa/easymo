-- Transaction wrapper for production safety
BEGIN;

-- Function to search businesses nearby using PostGIS
CREATE OR REPLACE FUNCTION public.search_businesses_nearby(
  p_category TEXT,
  p_lat DECIMAL,
  p_lng DECIMAL,
  p_radius_meters INTEGER DEFAULT 5000,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  category TEXT,
  address TEXT,
  phone TEXT,
  rating DECIMAL,
  lat DECIMAL,
  lng DECIMAL,
  dist_meters FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.name,
    b.category,
    b.address,
    b.phone,
    b.rating,
    b.lat,
    b.lng,
    ST_Distance(
      b.location,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    ) AS dist_meters
  FROM
    public.business_directory b
  WHERE
    (p_category IS NULL OR b.category ILIKE '%' || p_category || '%')
    AND ST_DWithin(
      b.location,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_meters
    )
  ORDER BY
    dist_meters ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
