-- Real Estate Domain - Database Standardization
-- Migration: Standardize property column names and add unified search function
-- Date: 2025-12-10
-- Phase: 4/5 of Real Estate consolidation

BEGIN;

-- ============================================================================
-- PART 1: Standardize Column Names
-- ============================================================================

-- Add standardized price_amount column if it doesn't exist
ALTER TABLE IF EXISTS property_listings 
  ADD COLUMN IF NOT EXISTS price_amount NUMERIC(12,2);

-- Migrate existing data from available price columns to price_amount
-- Only update if the source columns exist
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'property_listings') THEN
    -- Try to migrate from price_monthly if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'property_listings' AND column_name = 'price_monthly') THEN
      UPDATE property_listings SET price_amount = price_monthly WHERE price_amount IS NULL AND price_monthly IS NOT NULL;
    END IF;
    
    -- Try to migrate from price if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'property_listings' AND column_name = 'price') THEN
      UPDATE property_listings SET price_amount = price WHERE price_amount IS NULL AND price IS NOT NULL;
    END IF;
    
    -- Try to migrate from monthly_rent if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'property_listings' AND column_name = 'monthly_rent') THEN
      UPDATE property_listings SET price_amount = monthly_rent WHERE price_amount IS NULL AND monthly_rent IS NOT NULL;
    END IF;
  END IF;
END $$;

-- Add comment for clarity
COMMENT ON COLUMN property_listings.price_amount IS 
  'Standardized price column (monthly rent or total price depending on listing_type)';

-- ============================================================================
-- PART 2: Create Unified Search Function
-- ============================================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS search_properties_unified;

-- Create comprehensive search function
CREATE OR REPLACE FUNCTION search_properties_unified(
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
  distance_km DOUBLE PRECISION
) 
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- Check if table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'property_listings'
  ) THEN
    RETURN;
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
    -- Calculate distance if coordinates provided
    CASE 
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
    END as distance_km
  FROM property_listings pl
  WHERE 
    -- Only filter by is_available if column exists
    (NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'property_listings' AND column_name = 'is_available')
     OR pl.is_available = TRUE)
    AND (p_location IS NULL OR pl.location ILIKE '%' || p_location || '%')
    AND (p_price_min IS NULL OR pl.price_amount >= p_price_min)
    AND (p_price_max IS NULL OR pl.price_amount <= p_price_max)
    AND (p_bedrooms IS NULL OR pl.bedrooms = p_bedrooms)
    AND (p_property_type IS NULL OR pl.property_type = p_property_type)
    AND (p_listing_type IS NULL OR pl.listing_type = p_listing_type)
  ORDER BY 
    distance_km ASC NULLS LAST,
    pl.created_at DESC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION search_properties_unified IS 
  'Unified property search with spatial and text search. Created during Real Estate consolidation.';

-- ============================================================================
-- PART 3: Create Indexes for Performance (if table exists)
-- ============================================================================

DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'property_listings') THEN
    -- Create index on price_amount if column exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'property_listings' AND column_name = 'price_amount') THEN
      -- Check if is_available column exists for filtered index
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'property_listings' AND column_name = 'is_available') THEN
        CREATE INDEX IF NOT EXISTS idx_property_listings_price_amount 
          ON property_listings(price_amount) WHERE is_available = TRUE;
        
        CREATE INDEX IF NOT EXISTS idx_property_listings_available 
          ON property_listings(is_available);
      ELSE
        -- Create simple index without filter if is_available doesn't exist
        CREATE INDEX IF NOT EXISTS idx_property_listings_price_amount 
          ON property_listings(price_amount);
      END IF;
    END IF;
  END IF;
END $$;

COMMIT;
