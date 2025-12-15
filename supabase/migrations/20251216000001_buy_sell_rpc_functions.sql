-- Buy & Sell AI Agent - Required RPC Functions
-- Created: 2025-12-16
-- Purpose: Create RPC functions for business search and matching

-- =====================================================
-- SEARCH BUSINESSES NEARBY
-- =====================================================
CREATE OR REPLACE FUNCTION search_businesses_nearby(
  search_term TEXT,
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION,
  radius_km INTEGER DEFAULT 10,
  result_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  category TEXT,
  address TEXT,
  phone_number TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  distance_km DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.name,
    b.category,
    b.address,
    b.phone_number,
    b.lat,
    b.lng,
    (earth_distance(ll_to_earth(user_lat, user_lng), ll_to_earth(b.lat, b.lng)) / 1000)::DOUBLE PRECISION AS distance_km
  FROM businesses b
  WHERE 
    b.status = 'active'
    AND b.lat IS NOT NULL
    AND b.lng IS NOT NULL
    AND (
      search_term IS NULL OR
      search_term = '' OR
      b.name ILIKE '%' || search_term || '%' OR
      b.category ILIKE '%' || search_term || '%' OR
      b.description ILIKE '%' || search_term || '%'
    )
    AND earth_distance(ll_to_earth(user_lat, user_lng), ll_to_earth(b.lat, b.lng)) <= (radius_km * 1000)
  ORDER BY distance_km ASC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FIND MATCHING MARKETPLACE BUYERS
-- =====================================================
CREATE OR REPLACE FUNCTION find_matching_marketplace_buyers(
  p_listing_id UUID
)
RETURNS TABLE (
  buyer_phone TEXT,
  distance_km DOUBLE PRECISION,
  match_score DOUBLE PRECISION
) AS $$
DECLARE
  v_listing marketplace_listings%ROWTYPE;
BEGIN
  -- Get listing details
  SELECT * INTO v_listing
  FROM marketplace_listings
  WHERE id = p_listing_id AND status = 'active';
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Find nearby buyers who have shown interest in similar products
  RETURN QUERY
  SELECT DISTINCT
    mc.phone AS buyer_phone,
    CASE 
      WHEN v_listing.lat IS NOT NULL AND v_listing.lng IS NOT NULL AND mc.location IS NOT NULL THEN
        (earth_distance(
          ll_to_earth((mc.location->>'lat')::DOUBLE PRECISION, (mc.location->>'lng')::DOUBLE PRECISION),
          ll_to_earth(v_listing.lat, v_listing.lng)
        ) / 1000)::DOUBLE PRECISION
      ELSE NULL
    END AS distance_km,
    0.5::DOUBLE PRECISION AS match_score -- Basic match score, can be enhanced
  FROM marketplace_conversations mc
  WHERE 
    mc.flow_type = 'buying'
    AND mc.collected_data->>'product_name' ILIKE '%' || COALESCE(v_listing.product_name, v_listing.title, '') || '%'
    AND mc.location IS NOT NULL
    AND v_listing.lat IS NOT NULL
    AND v_listing.lng IS NOT NULL
  ORDER BY distance_km ASC NULLS LAST
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- UPSERT AGENT USER MEMORY
-- =====================================================
CREATE OR REPLACE FUNCTION upsert_agent_user_memory(
  p_user_phone TEXT,
  p_memory_type TEXT,
  p_key TEXT,
  p_value JSONB,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO agent_user_memory (user_phone, memory_type, key, value, expires_at, updated_at)
  VALUES (p_user_phone, p_memory_type, p_key, p_value, p_expires_at, NOW())
  ON CONFLICT (user_phone, memory_type, key)
  DO UPDATE SET
    value = p_value,
    expires_at = p_expires_at,
    updated_at = NOW()
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- GET USER MEMORIES
-- =====================================================
CREATE OR REPLACE FUNCTION get_user_memories(
  p_user_phone TEXT,
  p_memory_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  key TEXT,
  value JSONB,
  expires_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    aum.key,
    aum.value,
    aum.expires_at
  FROM agent_user_memory aum
  WHERE 
    aum.user_phone = p_user_phone
    AND (p_memory_type IS NULL OR aum.memory_type = p_memory_type)
    AND (aum.expires_at IS NULL OR aum.expires_at > NOW())
  ORDER BY aum.updated_at DESC;
END;
$$ LANGUAGE plpgsql;

