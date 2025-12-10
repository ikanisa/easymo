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

-- Migrate existing data from various price columns to price_amount
UPDATE property_listings 
SET price_amount = COALESCE(price_amount, price_monthly, price, monthly_rent)
WHERE price_amount IS NULL AND EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_name = 'property_listings'
);

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
    pl.is_available = TRUE
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
    CREATE INDEX IF NOT EXISTS idx_property_listings_price_amount 
      ON property_listings(price_amount) WHERE is_available = TRUE;
    
    CREATE INDEX IF NOT EXISTS idx_property_listings_available 
      ON property_listings(is_available);
  END IF;
END $$;

COMMIT;
