-- Migration: Map Remaining Unmapped Businesses
-- Date: 2025-12-07
-- Purpose: Map businesses that were added after initial mapping and fix NULL gm_category

BEGIN;

-- ============================================================================
-- STEP 1: Populate missing gm_category from category column
-- ============================================================================

UPDATE businesses 
SET gm_category = LOWER(TRIM(category))
WHERE gm_category IS NULL AND category IS NOT NULL;

-- ============================================================================
-- STEP 2: Map remaining businesses
-- ============================================================================

-- Hotels
UPDATE businesses 
SET 
  buy_sell_category = 'Hotels & Lodging',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE key = 'Hotel' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND (gm_category = 'hotel' OR category = 'hotel');

-- Restaurants, Cafes
UPDATE businesses 
SET 
  buy_sell_category = 'Bars & Restaurants',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE key = 'Restaurant' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND (gm_category IN ('restaurant', 'cafe') OR category IN ('restaurant', 'cafe'));

-- Sports clubs, Fitness centers -> Other Services
UPDATE businesses 
SET 
  buy_sell_category = 'Other Services',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE key = 'Other Services' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND (gm_category IN ('sports club', 'fitness center', 'cinema', 'theater') 
       OR category IN ('sports club', 'fitness center', 'cinema', 'theater'));

-- Catch any remaining with pattern matching
UPDATE businesses 
SET 
  buy_sell_category = 'Bars & Restaurants',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE key = 'Restaurant' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND (gm_category LIKE '%restaurant%' OR gm_category LIKE '%cafe%' 
       OR gm_category LIKE '%bar%' OR gm_category LIKE '%food%');

UPDATE businesses 
SET 
  buy_sell_category = 'Hotels & Lodging',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE key = 'Hotel' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND (gm_category LIKE '%hotel%' OR gm_category LIKE '%lodge%' 
       OR gm_category LIKE '%motel%' OR gm_category LIKE '%hostel%');

UPDATE businesses 
SET 
  buy_sell_category = 'Other Services',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE key = 'Other Services' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND (gm_category LIKE '%sport%' OR gm_category LIKE '%fitness%' 
       OR gm_category LIKE '%gym%' OR gm_category LIKE '%cinema%' 
       OR gm_category LIKE '%theater%' OR gm_category LIKE '%entertainment%');

-- ============================================================================
-- STEP 3: Create RLS policies for proper access control
-- ============================================================================

-- Enable RLS on businesses table if not already enabled
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Businesses are viewable by everyone" ON businesses;
DROP POLICY IF EXISTS "Enable read access for all users" ON businesses;

-- Create comprehensive read policy
DROP POLICY IF EXISTS "Enable read access for all users" ON public.businesses;
CREATE POLICY "Enable read access for all users" ON businesses
  FOR SELECT
  USING (true);

-- ============================================================================
-- STEP 4: Create indexes for efficient category filtering
-- ============================================================================

-- These were created before, but ensure they exist
CREATE INDEX IF NOT EXISTS idx_businesses_buy_sell_category_id ON businesses(buy_sell_category_id);
CREATE INDEX IF NOT EXISTS idx_businesses_buy_sell_category ON businesses(buy_sell_category);
CREATE INDEX IF NOT EXISTS idx_businesses_gm_category ON businesses(gm_category);
CREATE INDEX IF NOT EXISTS idx_businesses_city_category ON businesses(city, buy_sell_category_id);
CREATE INDEX IF NOT EXISTS idx_businesses_country_category ON businesses(country, buy_sell_category_id);

-- ============================================================================
-- STEP 5: Create helper function for filtering businesses
-- ============================================================================

CREATE OR REPLACE FUNCTION get_businesses_by_category(
  category_key TEXT,
  search_city TEXT DEFAULT NULL,
  search_country TEXT DEFAULT 'RW',
  limit_count INTEGER DEFAULT 20
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
) AS $$
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
  INNER JOIN buy_sell_categories c ON b.buy_sell_category_id = c.id
  WHERE c.key = category_key
    AND (search_city IS NULL OR b.city = search_city)
    AND (search_country IS NULL OR b.country = search_country)
    AND b.lat IS NOT NULL
    AND b.lng IS NOT NULL
  ORDER BY b.rating DESC NULLS LAST, b.name ASC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_businesses_by_category TO anon, authenticated;

-- ============================================================================
-- STEP 6: Create function to get all categories with counts
-- ============================================================================

CREATE OR REPLACE FUNCTION get_categories_with_counts(
  search_country TEXT DEFAULT 'RW'
)
RETURNS TABLE (
  id UUID,
  key TEXT,
  name TEXT,
  icon TEXT,
  business_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.key,
    c.name,
    c.icon,
    COUNT(b.id) as business_count
  FROM buy_sell_categories c
  LEFT JOIN businesses b ON b.buy_sell_category_id = c.id 
    AND (search_country IS NULL OR b.country = search_country)
  WHERE c.is_active = true
  GROUP BY c.id, c.key, c.name, c.icon, c.display_order
  HAVING COUNT(b.id) > 0
  ORDER BY c.display_order;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_categories_with_counts TO anon, authenticated;

-- ============================================================================
-- STEP 7: Verification
-- ============================================================================

-- Check unmapped businesses
SELECT 
  'Unmapped businesses:' as status,
  COUNT(*) as count
FROM businesses
WHERE buy_sell_category_id IS NULL AND category IS NOT NULL;

-- Show category distribution
SELECT 
  buy_sell_category,
  COUNT(*) as count
FROM businesses
WHERE buy_sell_category_id IS NOT NULL
GROUP BY buy_sell_category
ORDER BY count DESC
LIMIT 10;

-- Test the new functions
SELECT * FROM get_categories_with_counts('RW');

COMMIT;
