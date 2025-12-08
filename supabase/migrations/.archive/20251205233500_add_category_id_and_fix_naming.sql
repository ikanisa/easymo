BEGIN;

-- First, let's check what categories exist in businesses table
-- Add a comment with current categories for reference
COMMENT ON TABLE businesses IS 'Business directory with categories. Current categories: check buy_sell_categories table for official list';

-- Add category_id column to businesses table
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES buy_sell_categories(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_businesses_category_id ON businesses(category_id);

-- Update buy_sell_categories to match actual business categories
-- The key column holds the category value used for matching against businesses.category

-- Now link existing businesses to categories based on their category text field
-- Link businesses to categories based on pattern matching
-- Pharmacy
UPDATE businesses b
SET category_id = c.id
FROM buy_sell_categories c
WHERE c.key = 'pharmacies'
AND b.category_id IS NULL 
AND (b.category ILIKE '%pharma%' OR b.category ILIKE '%drug%' OR b.category ILIKE '%medicine%');

-- Salon
UPDATE businesses b
SET category_id = c.id
FROM buy_sell_categories c
WHERE c.key = 'salons'
AND b.category_id IS NULL 
AND (b.category ILIKE '%salon%' OR b.category ILIKE '%barber%' OR b.category ILIKE '%hair%');

-- Cosmetics
UPDATE businesses b
SET category_id = c.id
FROM buy_sell_categories c
WHERE c.key = 'cosmetics'
AND b.category_id IS NULL 
AND (b.category ILIKE '%cosmetic%' OR b.category ILIKE '%beauty%' OR b.category ILIKE '%makeup%');

-- Notary
UPDATE businesses b
SET category_id = c.id
FROM buy_sell_categories c
WHERE c.key = 'notaries'
AND b.category_id IS NULL 
AND (b.category ILIKE '%notar%' OR b.category ILIKE '%legal%' OR b.category ILIKE '%attorney%');

-- Electronics
UPDATE businesses b
SET category_id = c.id
FROM buy_sell_categories c
WHERE c.key = 'electronics'
AND b.category_id IS NULL 
AND (b.category ILIKE '%electronic%' OR b.category ILIKE '%computer%' OR b.category ILIKE '%phone%' OR b.category ILIKE '%tech%');

-- Hardware
UPDATE businesses b
SET category_id = c.id
FROM buy_sell_categories c
WHERE c.key = 'hardware'
AND b.category_id IS NULL 
AND (b.category ILIKE '%hardware%' OR b.category ILIKE '%tool%' OR b.category ILIKE '%construction%');

-- Grocery
UPDATE businesses b
SET category_id = c.id
FROM buy_sell_categories c
WHERE c.key = 'groceries'
AND b.category_id IS NULL 
AND (b.category ILIKE '%grocer%' OR b.category ILIKE '%supermarket%' OR b.category ILIKE '%food%' OR b.category ILIKE '%market%');

-- Fashion
UPDATE businesses b
SET category_id = c.id
FROM buy_sell_categories c
WHERE c.key = 'fashion'
AND b.category_id IS NULL 
AND (b.category ILIKE '%fashion%' OR b.category ILIKE '%cloth%' OR b.category ILIKE '%apparel%' OR b.category ILIKE '%boutique%');

-- Auto Service
UPDATE businesses b
SET category_id = c.id
FROM buy_sell_categories c
WHERE c.key = 'auto_services'
AND b.category_id IS NULL 
AND (b.category ILIKE '%auto%' OR b.category ILIKE '%car%' OR b.category ILIKE '%mechanic%' OR b.category ILIKE '%garage%');

-- Update the search function to use category_id OR category_value
DROP FUNCTION IF EXISTS public.search_businesses_nearby(double precision, double precision, text, double precision, integer);

CREATE OR REPLACE FUNCTION public.search_businesses_nearby(
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_category_value TEXT,
  p_radius_km DOUBLE PRECISION DEFAULT 10,
  p_limit INTEGER DEFAULT 9
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  category TEXT,
  address TEXT,
  phone TEXT,
  owner_whatsapp TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  distance_km DOUBLE PRECISION
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_category_id UUID;
BEGIN
  -- Get category_id from key
  SELECT c.id INTO v_category_id
  FROM buy_sell_categories c
  WHERE c.key = p_category_value
  LIMIT 1;

  RETURN QUERY
  SELECT
    b.id,
    b.name,
    b.category,
    b.address,
    b.phone,
    b.owner_whatsapp,
    b.latitude,
    b.longitude,
    -- Calculate distance using Haversine formula
    (
      6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(p_latitude)) * 
          cos(radians(b.latitude)) * 
          cos(radians(b.longitude) - radians(p_longitude)) + 
          sin(radians(p_latitude)) * 
          sin(radians(b.latitude))
        ))
      )
    ) AS distance_km
  FROM public.businesses b
  WHERE 
    (b.category_id = v_category_id OR b.category = p_category_value)
    AND b.latitude IS NOT NULL
    AND b.longitude IS NOT NULL
    -- Pre-filter by bounding box (much faster than calculating exact distance)
    AND b.latitude BETWEEN (p_latitude - (p_radius_km / 111.0)) AND (p_latitude + (p_radius_km / 111.0))
    AND b.longitude BETWEEN (p_longitude - (p_radius_km / (111.0 * cos(radians(p_latitude))))) 
                        AND (p_longitude + (p_radius_km / (111.0 * cos(radians(p_latitude)))))
  ORDER BY distance_km ASC
  LIMIT p_limit;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.search_businesses_nearby(double precision, double precision, text, double precision, integer) TO authenticated, anon, service_role;

COMMIT;
