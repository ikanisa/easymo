-- ============================================================================
-- LOCATION STANDARDIZATION - COMPLETE IMPLEMENTATION
-- ============================================================================
-- Date: 2025-12-11
-- Purpose: Implement all recommendations from LOCATION_AUDIT_REPORT.md
--
-- Changes:
-- 1. Migrate property_listings to PostGIS geography pattern
-- 2. Standardize column names to lat/lng across all tables
-- 3. Add location cache support for all domains
-- 4. Create unified location functions
-- 5. Add comprehensive spatial indexes
--
-- ADDITIVE ONLY - No data loss, all changes are backwards compatible
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: PROPERTY LISTINGS - MIGRATE TO POSTGIS PATTERN
-- ============================================================================

-- Add PostGIS geography column to property_listings
ALTER TABLE IF EXISTS property_listings
  ADD COLUMN IF NOT EXISTS location_geog GEOGRAPHY(Point, 4326);

-- Create trigger to auto-sync geography from lat/lng
CREATE OR REPLACE FUNCTION sync_property_location_geography()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location_geog = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  ELSE
    NEW.location_geog = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_property_location_geography ON property_listings;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'property_listings') THEN
    EXECUTE 'CREATE TRIGGER trigger_property_location_geography
    BEFORE INSERT OR UPDATE OF latitude, longitude ON property_listings
    FOR EACH ROW
    EXECUTE FUNCTION sync_property_location_geography()';
  END IF;
END $$;

-- Backfill existing property locations
UPDATE property_listings
SET location_geog = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE latitude IS NOT NULL 
  AND longitude IS NOT NULL 
  AND location_geog IS NULL;

-- Add spatial index for property_listings
CREATE INDEX IF NOT EXISTS idx_property_listings_location_geog 
  ON property_listings USING GIST(location_geog)
  WHERE location_geog IS NOT NULL;

-- Add coordinate validation constraint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'property_listings') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'property_listings_valid_coordinates'
    ) THEN
      ALTER TABLE property_listings
        ADD CONSTRAINT property_listings_valid_coordinates CHECK (
          (latitude IS NULL OR latitude BETWEEN -90 AND 90)
          AND (longitude IS NULL OR longitude BETWEEN -180 AND 180)
        );
    END IF;
  END IF;
END $$;

COMMENT ON COLUMN property_listings.latitude IS 
  'Latitude coordinate (WGS84). Auto-synced to location_geog geography column.';

COMMENT ON COLUMN property_listings.longitude IS 
  'Longitude coordinate (WGS84). Auto-synced to location_geog geography column.';

COMMENT ON COLUMN property_listings.location_geog IS 
  'PostGIS geography point. Auto-populated from latitude/longitude. Use for spatial queries.';

-- ============================================================================
-- PART 2: IMPROVED PROPERTY SEARCH WITH POSTGIS
-- ============================================================================

DROP FUNCTION IF EXISTS search_properties_unified_v2;

CREATE OR REPLACE FUNCTION search_properties_unified_v2(
  p_location TEXT DEFAULT NULL,
  p_lat DOUBLE PRECISION DEFAULT NULL,
  p_lng DOUBLE PRECISION DEFAULT NULL,
  p_radius_km INTEGER DEFAULT 10,
  p_price_min NUMERIC DEFAULT NULL,
  p_price_max NUMERIC DEFAULT NULL,
  p_bedrooms INTEGER DEFAULT NULL,
  p_property_type TEXT DEFAULT NULL,
  p_listing_type TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
) 
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  location TEXT,
  price_amount NUMERIC,
  bedrooms INTEGER,
  bathrooms INTEGER,
  property_type TEXT,
  listing_type TEXT,
  amenities TEXT[],
  distance_km DOUBLE PRECISION,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION
) 
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_search_point GEOGRAPHY;
BEGIN
  -- Check if table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'property_listings'
  ) THEN
    RETURN;
  END IF;

  -- Create search point if coordinates provided
  IF p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
    v_search_point := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;
  END IF;

  RETURN QUERY
  SELECT 
    pl.id,
    pl.title,
    pl.description,
    pl.location,
    pl.price_amount,
    pl.bedrooms,
    pl.bathrooms,
    pl.property_type,
    pl.listing_type,
    pl.amenities,
    -- Calculate distance using PostGIS if available, fallback to Haversine
    CASE 
      WHEN v_search_point IS NOT NULL AND pl.location_geog IS NOT NULL
      THEN (ST_Distance(pl.location_geog, v_search_point) / 1000.0)::DOUBLE PRECISION
      WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL 
        AND pl.latitude IS NOT NULL AND pl.longitude IS NOT NULL
      THEN (
        6371 * acos(
          cos(radians(p_lat)) * 
          cos(radians(pl.latitude)) * 
          cos(radians(pl.longitude) - radians(p_lng)) + 
          sin(radians(p_lat)) * 
          sin(radians(pl.latitude))
        )
      )::DOUBLE PRECISION
      ELSE NULL
    END as distance_km,
    pl.latitude::DOUBLE PRECISION,
    pl.longitude::DOUBLE PRECISION
  FROM property_listings pl
  WHERE 
    -- Only show available properties if column exists
    (NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'property_listings' AND column_name = 'is_available')
     OR pl.is_available = TRUE)
    
    -- Text location filter
    AND (p_location IS NULL OR pl.location ILIKE '%' || p_location || '%')
    
    -- Price filters
    AND (p_price_min IS NULL OR pl.price_amount >= p_price_min)
    AND (p_price_max IS NULL OR pl.price_amount <= p_price_max)
    
    -- Property filters
    AND (p_bedrooms IS NULL OR pl.bedrooms = p_bedrooms)
    AND (p_property_type IS NULL OR pl.property_type = p_property_type)
    AND (p_listing_type IS NULL OR pl.listing_type = p_listing_type)
    
    -- Distance filter using PostGIS if available
    AND (
      v_search_point IS NULL 
      OR pl.location_geog IS NULL
      OR ST_DWithin(pl.location_geog, v_search_point, p_radius_km * 1000)
    )
  ORDER BY 
    distance_km ASC NULLS LAST,
    pl.created_at DESC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION search_properties_unified_v2 IS 
  'Enhanced property search with PostGIS support. Falls back to Haversine if geography not available.';

-- ============================================================================
-- PART 3: STANDARDIZE COLUMN NAMES - CREATE ALIASES/VIEWS
-- ============================================================================

-- For driver_status: Map old current_lat/current_lng to new lat/lng
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'driver_status' AND column_name = 'current_lat'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'driver_status' AND column_name = 'lat'
  ) THEN
    -- Add new standardized columns
    ALTER TABLE driver_status
      ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
    
    -- Copy data from old columns
    UPDATE driver_status
    SET lat = current_lat, lng = current_lng
    WHERE lat IS NULL AND current_lat IS NOT NULL;
    
    -- Keep both columns for backwards compatibility
    COMMENT ON COLUMN driver_status.current_lat IS 
      'DEPRECATED: Use lat column. Kept for backwards compatibility.';
    COMMENT ON COLUMN driver_status.current_lng IS 
      'DEPRECATED: Use lng column. Kept for backwards compatibility.';
  END IF;
END $$;

-- ============================================================================
-- PART 4: LOCATION CACHE - ADD CONTEXT COLUMNS FOR ALL DOMAINS
-- ============================================================================

-- Ensure recent_locations table supports all domains
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'recent_locations') THEN
    -- Add index on context for faster domain-specific lookups
    CREATE INDEX IF NOT EXISTS idx_recent_locations_user_context 
      ON app.recent_locations(user_id, context) WHERE expires_at > NOW();
    
    -- Add index on source
    CREATE INDEX IF NOT EXISTS idx_recent_locations_source 
      ON app.recent_locations(source);
    
    -- Add partial index for active locations only
    CREATE INDEX IF NOT EXISTS idx_recent_locations_active 
      ON app.recent_locations(user_id, expires_at) 
      WHERE expires_at > NOW();
  END IF;
END $$;

-- ============================================================================
-- PART 5: CREATE UNIFIED LOCATION HELPER FUNCTIONS
-- ============================================================================

-- Function to get user's most recent location for a context
CREATE OR REPLACE FUNCTION get_recent_location(
  p_user_id UUID,
  p_context TEXT DEFAULT 'general',
  p_max_age_minutes INTEGER DEFAULT 60
)
RETURNS TABLE (
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  address TEXT,
  source TEXT,
  cached_at TIMESTAMPTZ,
  age_minutes INTEGER
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rl.lat,
    rl.lng,
    rl.address,
    rl.source,
    rl.created_at as cached_at,
    EXTRACT(EPOCH FROM (NOW() - rl.created_at))::INTEGER / 60 as age_minutes
  FROM app.recent_locations rl
  WHERE rl.user_id = p_user_id
    AND rl.context = p_context
    AND rl.expires_at > NOW()
    AND EXTRACT(EPOCH FROM (NOW() - rl.created_at)) / 60 <= p_max_age_minutes
  ORDER BY rl.created_at DESC
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION get_recent_location IS 
  'Get user''s most recent cached location for a specific context (mobility, jobs, real_estate, etc.)';

-- Function to cache a location
CREATE OR REPLACE FUNCTION cache_user_location(
  p_user_id UUID,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_address TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'user_input',
  p_context TEXT DEFAULT 'general',
  p_ttl_hours INTEGER DEFAULT 24
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_location_id UUID;
BEGIN
  -- Validate coordinates
  IF p_lat < -90 OR p_lat > 90 THEN
    RAISE EXCEPTION 'Invalid latitude: %. Must be between -90 and 90.', p_lat;
  END IF;
  
  IF p_lng < -180 OR p_lng > 180 THEN
    RAISE EXCEPTION 'Invalid longitude: %. Must be between -180 and 180.', p_lng;
  END IF;

  -- Insert new location cache entry
  INSERT INTO app.recent_locations (
    user_id,
    lat,
    lng,
    address,
    source,
    context,
    expires_at
  ) VALUES (
    p_user_id,
    p_lat,
    p_lng,
    p_address,
    p_source,
    p_context,
    NOW() + (p_ttl_hours || ' hours')::INTERVAL
  )
  RETURNING id INTO v_location_id;

  RETURN v_location_id;
END;
$$;

COMMENT ON FUNCTION cache_user_location IS 
  'Cache a user location with TTL. Use for all domains: mobility, jobs, real_estate, marketplace, etc.';

-- ============================================================================
-- PART 6: UNIVERSAL PROXIMITY SEARCH FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION find_nearby_items(
  p_table_name TEXT,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_radius_km DOUBLE PRECISION DEFAULT 10.0,
  p_limit INTEGER DEFAULT 20,
  p_where_clause TEXT DEFAULT NULL
)
RETURNS TABLE (
  item_data JSONB,
  distance_km DOUBLE PRECISION
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_search_point GEOGRAPHY;
  v_query TEXT;
  v_geog_column TEXT;
  v_lat_column TEXT;
  v_lng_column TEXT;
BEGIN
  -- Create search point
  v_search_point := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;
  
  -- Detect geography column name (try common patterns)
  SELECT column_name INTO v_geog_column
  FROM information_schema.columns
  WHERE table_name = p_table_name
    AND udt_name = 'geography'
  LIMIT 1;
  
  -- Detect lat/lng columns
  SELECT column_name INTO v_lat_column
  FROM information_schema.columns
  WHERE table_name = p_table_name
    AND column_name IN ('lat', 'latitude', 'pickup_lat')
  LIMIT 1;
  
  SELECT column_name INTO v_lng_column
  FROM information_schema.columns
  WHERE table_name = p_table_name
    AND column_name IN ('lng', 'longitude', 'pickup_lng')
  LIMIT 1;
  
  -- Build query based on available columns
  IF v_geog_column IS NOT NULL THEN
    -- Use PostGIS geography column
    v_query := format(
      'SELECT row_to_json(t.*)::JSONB, 
              (ST_Distance(%I, $1) / 1000.0)::DOUBLE PRECISION
       FROM %I t
       WHERE ST_DWithin(%I, $1, $2)
       %s
       ORDER BY ST_Distance(%I, $1) ASC
       LIMIT $3',
      v_geog_column, p_table_name, v_geog_column,
      COALESCE('AND ' || p_where_clause, ''),
      v_geog_column
    );
  ELSIF v_lat_column IS NOT NULL AND v_lng_column IS NOT NULL THEN
    -- Fallback to Haversine formula
    v_query := format(
      'SELECT row_to_json(t.*)::JSONB,
              (6371 * acos(
                cos(radians($1)) * cos(radians(%I)) * 
                cos(radians(%I) - radians($2)) + 
                sin(radians($1)) * sin(radians(%I))
              ))::DOUBLE PRECISION
       FROM %I t
       WHERE %I IS NOT NULL AND %I IS NOT NULL
       %s
       HAVING (6371 * acos(
                cos(radians($1)) * cos(radians(%I)) * 
                cos(radians(%I) - radians($2)) + 
                sin(radians($1)) * sin(radians(%I))
              )) <= $2
       ORDER BY distance_km ASC
       LIMIT $3',
      v_lat_column, v_lng_column, v_lat_column, p_table_name,
      v_lat_column, v_lng_column,
      COALESCE('AND ' || p_where_clause, ''),
      v_lat_column, v_lng_column, v_lat_column
    );
  ELSE
    RAISE EXCEPTION 'Table % has no recognizable location columns', p_table_name;
  END IF;
  
  -- Execute dynamic query
  IF v_geog_column IS NOT NULL THEN
    RETURN QUERY EXECUTE v_query 
      USING v_search_point, p_radius_km * 1000, p_limit;
  ELSE
    RETURN QUERY EXECUTE v_query 
      USING p_lat, p_lng, p_radius_km, p_limit;
  END IF;
END;
$$;

COMMENT ON FUNCTION find_nearby_items IS 
  'Universal proximity search function. Works with any table that has location columns. Auto-detects PostGIS or lat/lng columns.';

-- ============================================================================
-- PART 7: ADD COMPREHENSIVE DOCUMENTATION
-- ============================================================================

COMMENT ON EXTENSION postgis IS 
  'PostGIS spatial database extension. Used for efficient location-based queries across all domains.';

-- Document the standard pattern
DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Location Standardization Complete';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Standard Pattern for New Tables:';
  RAISE NOTICE '  - Use lat/lng columns (DOUBLE PRECISION)';
  RAISE NOTICE '  - Add location_geog GEOGRAPHY(Point, 4326)';
  RAISE NOTICE '  - Create auto-sync trigger';
  RAISE NOTICE '  - Add GIST spatial index';
  RAISE NOTICE '  - Add coordinate validation constraint';
  RAISE NOTICE '';
  RAISE NOTICE 'Location Cache:';
  RAISE NOTICE '  - Use cache_user_location() to store';
  RAISE NOTICE '  - Use get_recent_location() to retrieve';
  RAISE NOTICE '  - Supports all contexts: mobility, jobs, real_estate, etc.';
  RAISE NOTICE '';
  RAISE NOTICE 'Search Functions:';
  RAISE NOTICE '  - search_properties_unified_v2() - Real estate';
  RAISE NOTICE '  - search_businesses_ai() - Businesses';
  RAISE NOTICE '  - match_drivers_for_trip_v2() - Mobility';
  RAISE NOTICE '  - find_nearby_items() - Universal proximity search';
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
END $$;

COMMIT;
