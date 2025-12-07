-- Migration: Complete Category Filtering Implementation
-- Date: 2025-12-07
-- Purpose: Ensure all businesses are mapped and create user-friendly query functions

BEGIN;

-- ============================================================================
-- STEP 1: Map any remaining unmapped businesses
-- ============================================================================

-- Update gm_category for new businesses
UPDATE businesses 
SET gm_category = LOWER(TRIM(category))
WHERE gm_category IS NULL AND category IS NOT NULL;

-- Map hotels
UPDATE businesses 
SET 
  buy_sell_category = 'Hotels & Lodging',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE key = 'Hotel' LIMIT 1)
WHERE buy_sell_category_id IS NULL AND gm_category = 'hotel';

-- Map restaurants/cafes
UPDATE businesses 
SET 
  buy_sell_category = 'Bars & Restaurants',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE key = 'Restaurant' LIMIT 1)
WHERE buy_sell_category_id IS NULL AND gm_category IN ('restaurant', 'cafe');

-- Map entertainment/fitness
UPDATE businesses 
SET 
  buy_sell_category = 'Other Services',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE key = 'Other Services' LIMIT 1)
WHERE buy_sell_category_id IS NULL 
  AND gm_category IN ('sports club', 'fitness center', 'cinema', 'theater');

-- ============================================================================
-- STEP 2: Create optimized RPC functions for category filtering
-- ============================================================================

-- Get all active categories with business counts
CREATE OR REPLACE FUNCTION get_buy_sell_categories(
  p_country TEXT DEFAULT 'RW'
)
RETURNS TABLE (
  id UUID,
  key TEXT,
  name TEXT,
  icon TEXT,
  display_order INTEGER,
  business_count BIGINT
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.key,
    c.name,
    c.icon,
    c.display_order,
    COUNT(b.id) as business_count
  FROM buy_sell_categories c
  LEFT JOIN businesses b ON b.buy_sell_category_id = c.id 
    AND b.country = p_country
  WHERE c.is_active = true
  GROUP BY c.id, c.key, c.name, c.icon, c.display_order
  HAVING COUNT(b.id) > 0
  ORDER BY c.display_order;
END;
$$;

-- Get businesses by category
CREATE OR REPLACE FUNCTION get_businesses_by_category_key(
  p_category_key TEXT,
  p_city TEXT DEFAULT NULL,
  p_country TEXT DEFAULT 'RW',
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  category TEXT,
  address TEXT,
  city TEXT,
  country TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  lat NUMERIC,
  lng NUMERIC,
  rating NUMERIC,
  review_count INTEGER
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.name,
    b.description,
    b.buy_sell_category as category,
    b.address,
    b.city,
    b.country,
    b.phone,
    b.email,
    b.website,
    b.lat,
    b.lng,
    b.rating,
    b.review_count
  FROM businesses b
  INNER JOIN buy_sell_categories c ON b.buy_sell_category_id = c.id
  WHERE c.key = p_category_key
    AND (p_city IS NULL OR b.city = p_city)
    AND (p_country IS NULL OR b.country = p_country)
  ORDER BY 
    b.rating DESC NULLS LAST,
    b.review_count DESC NULLS LAST,
    b.name ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Search businesses across all categories
CREATE OR REPLACE FUNCTION search_businesses(
  p_search_text TEXT,
  p_category_key TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_country TEXT DEFAULT 'RW',
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  category TEXT,
  address TEXT,
  city TEXT,
  phone TEXT,
  lat NUMERIC,
  lng NUMERIC,
  rating NUMERIC
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.name,
    b.buy_sell_category as category,
    b.address,
    b.city,
    b.phone,
    b.lat,
    b.lng,
    b.rating
  FROM businesses b
  LEFT JOIN buy_sell_categories c ON b.buy_sell_category_id = c.id
  WHERE 
    (p_search_text IS NULL OR 
     b.name ILIKE '%' || p_search_text || '%' OR
     b.description ILIKE '%' || p_search_text || '%' OR
     b.address ILIKE '%' || p_search_text || '%')
    AND (p_category_key IS NULL OR c.key = p_category_key)
    AND (p_city IS NULL OR b.city = p_city)
    AND (p_country IS NULL OR b.country = p_country)
  ORDER BY 
    b.rating DESC NULLS LAST,
    b.name ASC
  LIMIT p_limit;
END;
$$;

-- ============================================================================
-- STEP 3: Create materialized view for fast category lookups (optional)
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_category_business_counts AS
SELECT 
  c.id as category_id,
  c.key,
  c.name,
  c.icon,
  c.display_order,
  b.country,
  COUNT(b.id) as business_count
FROM buy_sell_categories c
LEFT JOIN businesses b ON b.buy_sell_category_id = c.id
WHERE c.is_active = true
GROUP BY c.id, c.key, c.name, c.icon, c.display_order, b.country;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_category_counts_unique 
  ON mv_category_business_counts(category_id, COALESCE(country, 'GLOBAL'));

CREATE INDEX IF NOT EXISTS idx_mv_category_counts_country 
  ON mv_category_business_counts(country);

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_category_counts()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_category_business_counts;
END;
$$;

-- ============================================================================
-- STEP 4: Add helpful comments
-- ============================================================================

COMMENT ON FUNCTION get_buy_sell_categories IS 'Get all active categories with business counts for a specific country';
COMMENT ON FUNCTION get_businesses_by_category_key IS 'Get paginated businesses for a specific category';
COMMENT ON FUNCTION search_businesses IS 'Search businesses across all or specific categories';
COMMENT ON FUNCTION refresh_category_counts IS 'Refresh the materialized view for category counts';

-- ============================================================================
-- STEP 5: Verification
-- ============================================================================

-- Show final mapping stats
SELECT 
  'Total businesses:' as metric,
  COUNT(*) as value
FROM businesses
WHERE category IS NOT NULL
UNION ALL
SELECT 
  'Mapped businesses:',
  COUNT(*)
FROM businesses
WHERE buy_sell_category_id IS NOT NULL
UNION ALL
SELECT 
  'Unmapped businesses:',
  COUNT(*)
FROM businesses
WHERE buy_sell_category_id IS NULL AND category IS NOT NULL;

-- Test functions
SELECT '=== Test: Get categories with counts ===' as test;
SELECT * FROM get_buy_sell_categories('RW') LIMIT 5;

SELECT '=== Test: Get businesses by category ===' as test;
SELECT name, city, rating FROM get_businesses_by_category_key('Restaurant', NULL, 'RW', 5);

SELECT '=== Test: Search businesses ===' as test;
SELECT name, category, city FROM search_businesses('hotel', NULL, NULL, 'RW', 5);

COMMIT;

-- Refresh materialized view after commit
SELECT refresh_category_counts();
