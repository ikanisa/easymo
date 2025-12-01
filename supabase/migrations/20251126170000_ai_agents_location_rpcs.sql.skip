BEGIN;

-- =====================================================
-- AI Agents Location Integration RPCs
-- Created: 2025-11-26
-- Purpose: GPS-based search for AI agents
-- =====================================================

-- 1. Search nearby agricultural marketplace items
-- Used by: farmer_agent
CREATE OR REPLACE FUNCTION search_nearby_agricultural_marketplace(
  _lat FLOAT,
  _lng FLOAT,
  _radius_km FLOAT DEFAULT 50,
  _category TEXT DEFAULT NULL,
  _product TEXT DEFAULT NULL,
  _limit INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  category TEXT,
  price NUMERIC,
  unit TEXT,
  location TEXT,
  seller_contact TEXT,
  lat FLOAT,
  lng FLOAT,
  distance_km FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    am.id,
    am.title,
    am.category,
    am.price,
    am.unit,
    am.location,
    am.seller_contact,
    am.lat,
    am.lng,
    ST_Distance(
      ST_MakePoint(_lng, _lat)::geography,
      ST_MakePoint(am.lng, am.lat)::geography
    ) / 1000.0 AS distance_km
  FROM agricultural_marketplace am
  WHERE 
    am.available = true
    AND (_category IS NULL OR am.category = _category)
    AND (_product IS NULL OR am.title ILIKE '%' || _product || '%')
    AND ST_DWithin(
      ST_MakePoint(_lng, _lat)::geography,
      ST_MakePoint(am.lng, am.lat)::geography,
      _radius_km * 1000
    )
  ORDER BY distance_km ASC
  LIMIT _limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- 2. Search nearby agricultural services
-- Used by: farmer_agent
CREATE OR REPLACE FUNCTION search_nearby_agricultural_services(
  _lat FLOAT,
  _lng FLOAT,
  _radius_km FLOAT DEFAULT 50,
  _service_type TEXT DEFAULT NULL,
  _limit INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  service_name TEXT,
  service_type TEXT,
  provider_name TEXT,
  location TEXT,
  contact TEXT,
  price_range TEXT,
  lat FLOAT,
  lng FLOAT,
  distance_km FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ags.id,
    ags.service_name,
    ags.service_type,
    ags.provider_name,
    ags.location,
    ags.contact,
    ags.price_range,
    ags.lat,
    ags.lng,
    ST_Distance(
      ST_MakePoint(_lng, _lat)::geography,
      ST_MakePoint(ags.lng, ags.lat)::geography
    ) / 1000.0 AS distance_km
  FROM agricultural_services ags
  WHERE 
    (_service_type IS NULL OR ags.service_type = _service_type)
    AND ST_DWithin(
      ST_MakePoint(_lng, _lat)::geography,
      ST_MakePoint(ags.lng, ags.lat)::geography,
      _radius_km * 1000
    )
  ORDER BY distance_km ASC
  LIMIT _limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Search nearby businesses
-- Used by: business_broker_agent
CREATE OR REPLACE FUNCTION search_nearby_businesses(
  _lat FLOAT,
  _lng FLOAT,
  _radius_km FLOAT DEFAULT 50,
  _category TEXT DEFAULT NULL,
  _query TEXT DEFAULT NULL,
  _limit INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  category TEXT,
  city TEXT,
  address TEXT,
  phone TEXT,
  rating NUMERIC,
  lat FLOAT,
  lng FLOAT,
  distance_km FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bd.id,
    bd.name,
    bd.category,
    bd.city,
    bd.address,
    bd.phone,
    bd.rating,
    bd.lat,
    bd.lng,
    ST_Distance(
      ST_MakePoint(_lng, _lat)::geography,
      ST_MakePoint(bd.lng, bd.lat)::geography
    ) / 1000.0 AS distance_km
  FROM business_directory bd
  WHERE 
    (_category IS NULL OR bd.category ILIKE '%' || _category || '%')
    AND (_query IS NULL OR bd.name ILIKE '%' || _query || '%' OR bd.category ILIKE '%' || _query || '%')
    AND ST_DWithin(
      ST_MakePoint(_lng, _lat)::geography,
      ST_MakePoint(bd.lng, bd.lat)::geography,
      _radius_km * 1000
    )
  ORDER BY distance_km ASC
  LIMIT _limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- 4. Search nearby restaurants
-- Used by: waiter_agent
CREATE OR REPLACE FUNCTION search_nearby_restaurants(
  _lat FLOAT,
  _lng FLOAT,
  _radius_km FLOAT DEFAULT 10,
  _cuisine TEXT DEFAULT NULL,
  _limit INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  cuisine TEXT,
  location TEXT,
  phone TEXT,
  rating NUMERIC,
  lat FLOAT,
  lng FLOAT,
  distance_km FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.name,
    r.cuisine,
    r.location,
    r.phone,
    r.rating,
    r.lat,
    r.lng,
    ST_Distance(
      ST_MakePoint(_lng, _lat)::geography,
      ST_MakePoint(r.lng, r.lat)::geography
    ) / 1000.0 AS distance_km
  FROM restaurants r
  WHERE 
    r.active = true
    AND (_cuisine IS NULL OR r.cuisine ILIKE '%' || _cuisine || '%')
    AND ST_DWithin(
      ST_MakePoint(_lng, _lat)::geography,
      ST_MakePoint(r.lng, r.lat)::geography,
      _radius_km * 1000
    )
  ORDER BY distance_km ASC
  LIMIT _limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add comments for documentation
COMMENT ON FUNCTION search_nearby_agricultural_marketplace IS 'GPS-based search for agricultural marketplace items (farmer_agent)';
COMMENT ON FUNCTION search_nearby_agricultural_services IS 'GPS-based search for agricultural services (farmer_agent)';
COMMENT ON FUNCTION search_nearby_businesses IS 'GPS-based search for businesses (business_broker_agent)';
COMMENT ON FUNCTION search_nearby_restaurants IS 'GPS-based search for restaurants (waiter_agent)';

COMMIT;
