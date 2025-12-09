-- =====================================================================
-- CREATE AI-POWERED BUSINESS SEARCH FUNCTION
-- =====================================================================
-- Enables natural language search for businesses with:
-- - Full-text search (name, description, tags, keywords)
-- - Geospatial search (distance-based filtering)
-- - Relevance ranking (combines text match + distance + rating)
-- - Array matching (tags, services, products)
-- - Operating hours check (is business open now?)
--
-- Example queries:
-- - "I need a computer" → Electronics shops with computers/laptops
-- - "print a postcard" → Print shops nearby with printing services
-- - "fix my phone" → Phone repair shops
-- - "pharmacy open now" → Nearby pharmacies that are currently open
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. CREATE MAIN AI SEARCH FUNCTION
-- =====================================================================

CREATE OR REPLACE FUNCTION public.search_businesses_ai(
  p_query TEXT,
  p_lat FLOAT DEFAULT NULL,
  p_lng FLOAT DEFAULT NULL,
  p_radius_km FLOAT DEFAULT 10.0,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  category_name TEXT,
  tags TEXT[],
  services TEXT[],
  products TEXT[],
  address TEXT,
  location_text TEXT,
  phone TEXT,
  owner_whatsapp TEXT,
  latitude DECIMAL,
  longitude DECIMAL,
  rating DECIMAL,
  review_count INT,
  distance_km FLOAT,
  relevance_score FLOAT,
  is_open_now BOOLEAN,
  operating_hours JSONB,
  ai_metadata JSONB
) AS $$
DECLARE
  v_search_query TSQUERY;
  v_current_hour INT;
  v_current_day TEXT;
  v_search_terms TEXT[];
BEGIN
  -- Parse search query for full-text search
  -- Use plainto_tsquery for natural language queries
  v_search_query := plainto_tsquery('english', p_query);
  
  -- Extract individual search terms for array matching
  v_search_terms := string_to_array(LOWER(p_query), ' ');
  
  -- Get current time for "open now" check (Rwanda timezone: Africa/Kigali = UTC+2)
  v_current_hour := EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'Africa/Kigali'));
  v_current_day := LOWER(TO_CHAR(NOW() AT TIME ZONE 'Africa/Kigali', 'Day'));
  v_current_day := TRIM(v_current_day); -- Remove trailing spaces
  
  RETURN QUERY
  SELECT 
    b.id,
    b.name,
    b.description,
    b.category_name,
    b.tags,
    b.services,
    b.products,
    b.address,
    b.location_text,
    b.phone,
    b.owner_whatsapp,
    b.latitude,
    b.longitude,
    b.rating,
    b.review_count,
    
    -- Calculate distance if location provided
    CASE 
      WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL AND b.location IS NOT NULL 
      THEN ST_Distance(
        b.location,
        ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
      ) / 1000.0 -- Convert meters to kilometers
      ELSE NULL
    END::FLOAT AS distance_km,
    
    -- Calculate relevance score (combines multiple signals)
    (
      -- Full-text search rank (0-1 scale, multiplied by 10)
      COALESCE(ts_rank(b.search_vector, v_search_query) * 10, 0) +
      
      -- Exact name match bonus (5 points)
      CASE WHEN LOWER(b.name) ILIKE '%' || LOWER(p_query) || '%' THEN 5 ELSE 0 END +
      
      -- Category match bonus (3 points)
      CASE WHEN LOWER(b.category_name) ILIKE '%' || LOWER(p_query) || '%' THEN 3 ELSE 0 END +
      
      -- Tag overlap bonus (3 points)
      CASE 
        WHEN b.tags && v_search_terms THEN 3 
        ELSE 0 
      END +
      
      -- Service overlap bonus (2 points)
      CASE 
        WHEN b.services && v_search_terms THEN 2 
        ELSE 0 
      END +
      
      -- Product overlap bonus (2 points)
      CASE 
        WHEN b.products && v_search_terms THEN 2 
        ELSE 0 
      END +
      
      -- Keyword overlap bonus (2 points)
      CASE 
        WHEN b.keywords && v_search_terms THEN 2 
        ELSE 0 
      END +
      
      -- Verification bonus (2 points)
      CASE WHEN b.is_verified THEN 2 ELSE 0 END +
      
      -- Rating bonus (0-5 points based on rating)
      COALESCE(b.rating, 0) +
      
      -- Review count bonus (0-2 points, capped)
      LEAST(b.review_count::FLOAT / 10.0, 2.0) +
      
      -- Distance penalty (closer is better)
      -- Subtract 0.1 points per km (max penalty: 5 points at 50km)
      CASE 
        WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL AND b.location IS NOT NULL THEN
          -1 * LEAST(
            ST_Distance(
              b.location,
              ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
            ) / 10000.0, -- Penalty per 10km
            5.0 -- Max penalty
          )
        ELSE 0
      END
    )::FLOAT AS relevance_score,
    
    -- Check if open now (simplified - checks if current hour is within operating hours)
    CASE 
      WHEN b.operating_hours IS NULL THEN NULL
      WHEN b.operating_hours ? v_current_day THEN 
        -- Check if current hour is within open/close hours
        CASE
          WHEN 
            (b.operating_hours->v_current_day->>'open') IS NOT NULL AND
            (b.operating_hours->v_current_day->>'close') IS NOT NULL
          THEN
            v_current_hour BETWEEN 
              SPLIT_PART(b.operating_hours->v_current_day->>'open', ':', 1)::INT AND 
              SPLIT_PART(b.operating_hours->v_current_day->>'close', ':', 1)::INT
          ELSE NULL
        END
      ELSE false -- Day not in operating_hours means closed
    END AS is_open_now,
    
    b.operating_hours,
    b.ai_metadata
    
  FROM public.business b
  WHERE 
    -- Must be active
    b.is_active = true
    
    -- Text search conditions (OR logic - any match is good)
    AND (
      -- Full-text search match
      (b.search_vector IS NOT NULL AND b.search_vector @@ v_search_query)
      
      -- OR array overlap with tags
      OR (b.tags && v_search_terms)
      
      -- OR array overlap with services
      OR (b.services && v_search_terms)
      
      -- OR array overlap with products
      OR (b.products && v_search_terms)
      
      -- OR array overlap with keywords
      OR (b.keywords && v_search_terms)
      
      -- OR name/category ILIKE match
      OR (LOWER(b.name) LIKE '%' || LOWER(p_query) || '%')
      OR (LOWER(b.category_name) LIKE '%' || LOWER(p_query) || '%')
      OR (LOWER(b.description) LIKE '%' || LOWER(p_query) || '%')
    )
    
    -- Location filter (if provided)
    AND (
      p_lat IS NULL OR p_lng IS NULL OR b.location IS NULL
      OR ST_DWithin(
        b.location,
        ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
        p_radius_km * 1000 -- Convert km to meters
      )
    )
    
  -- Sort by relevance first, then distance, then rating
  ORDER BY 
    relevance_score DESC,
    distance_km ASC NULLS LAST,
    b.rating DESC NULLS LAST,
    b.review_count DESC NULLS LAST
    
  LIMIT p_limit;
  
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================================
-- 2. CREATE SIMPLIFIED NEARBY SEARCH (NO TEXT QUERY)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.find_nearby_businesses(
  p_lat FLOAT,
  p_lng FLOAT,
  p_radius_km FLOAT DEFAULT 5.0,
  p_category TEXT DEFAULT NULL,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  category_name TEXT,
  address TEXT,
  phone TEXT,
  rating DECIMAL,
  distance_km FLOAT,
  is_open_now BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.name,
    b.category_name,
    b.address,
    b.phone,
    b.rating,
    (ST_Distance(
      b.location,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    ) / 1000.0)::FLOAT AS distance_km,
    NULL::BOOLEAN AS is_open_now -- Simplified version doesn't check hours
  FROM public.business b
  WHERE 
    b.is_active = true
    AND b.location IS NOT NULL
    AND ST_DWithin(
      b.location,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_km * 1000
    )
    AND (p_category IS NULL OR LOWER(b.category_name) LIKE '%' || LOWER(p_category) || '%')
  ORDER BY 
    distance_km ASC,
    b.rating DESC NULLS LAST
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================================
-- 3. CREATE SEARCH BY TAGS FUNCTION
-- =====================================================================

CREATE OR REPLACE FUNCTION public.search_businesses_by_tags(
  p_tags TEXT[],
  p_lat FLOAT DEFAULT NULL,
  p_lng FLOAT DEFAULT NULL,
  p_radius_km FLOAT DEFAULT 10.0,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  category_name TEXT,
  tags TEXT[],
  services TEXT[],
  address TEXT,
  phone TEXT,
  rating DECIMAL,
  distance_km FLOAT,
  tag_match_count INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.name,
    b.category_name,
    b.tags,
    b.services,
    b.address,
    b.phone,
    b.rating,
    CASE 
      WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL AND b.location IS NOT NULL 
      THEN (ST_Distance(
        b.location,
        ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
      ) / 1000.0)::FLOAT
      ELSE NULL
    END AS distance_km,
    -- Count how many tags match
    (SELECT COUNT(*) FROM unnest(b.tags) tag WHERE tag = ANY(p_tags))::INT AS tag_match_count
  FROM public.business b
  WHERE 
    b.is_active = true
    -- Must have at least one matching tag
    AND b.tags && p_tags
    -- Location filter
    AND (
      p_lat IS NULL OR p_lng IS NULL OR b.location IS NULL
      OR ST_DWithin(
        b.location,
        ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
        p_radius_km * 1000
      )
    )
  ORDER BY 
    tag_match_count DESC,
    distance_km ASC NULLS LAST,
    b.rating DESC NULLS LAST
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================================
-- 4. GRANT PERMISSIONS
-- =====================================================================

-- Revoke existing permissions first (for idempotency)
REVOKE ALL ON FUNCTION public.search_businesses_ai(TEXT, FLOAT, FLOAT, FLOAT, INT) FROM authenticated, anon, service_role;
REVOKE ALL ON FUNCTION public.find_nearby_businesses(FLOAT, FLOAT, FLOAT, TEXT, INT) FROM authenticated, anon, service_role;
REVOKE ALL ON FUNCTION public.search_businesses_by_tags(TEXT[], FLOAT, FLOAT, FLOAT, INT) FROM authenticated, anon, service_role;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.search_businesses_ai(TEXT, FLOAT, FLOAT, FLOAT, INT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.find_nearby_businesses(FLOAT, FLOAT, FLOAT, TEXT, INT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.search_businesses_by_tags(TEXT[], FLOAT, FLOAT, FLOAT, INT) TO authenticated, anon, service_role;

-- =====================================================================
-- 5. ADD COMMENTS
-- =====================================================================

COMMENT ON FUNCTION public.search_businesses_ai IS 
'AI-powered business search with natural language query. Combines full-text search, geospatial filtering, and relevance ranking. Example: search_businesses_ai(''need a computer'', -1.9536, 30.0606, 10, 10)';

COMMENT ON FUNCTION public.find_nearby_businesses IS 
'Simple geospatial search for businesses near a location. Example: find_nearby_businesses(-1.9536, 30.0606, 5, ''pharmacy'', 10)';

COMMENT ON FUNCTION public.search_businesses_by_tags IS 
'Search businesses by tags with optional geospatial filtering. Example: search_businesses_by_tags(ARRAY[''pharmacy'', ''medical''], -1.9536, 30.0606, 10, 10)';

COMMIT;
