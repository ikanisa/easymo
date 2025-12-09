-- =====================================================================
-- ENHANCE BUSINESS TABLE FOR AI-POWERED SEARCH
-- =====================================================================
-- Adds missing columns to the business table to enable:
-- - Natural language search ("I need a computer", "print shop nearby")
-- - Full-text search with relevance ranking
-- - Geospatial search (find businesses within X km)
-- - Tag-based filtering (tags, services, products arrays)
-- - Rich metadata for AI context
-- - Operating hours and ratings
--
-- This migration is NON-BREAKING:
-- - All new columns are nullable or have defaults
-- - Existing data remains unchanged
-- - Indexes are added for performance
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. ADD MISSING GEOSPATIAL COLUMNS
-- =====================================================================

-- Add latitude and longitude if they don't exist
ALTER TABLE public.business 
  ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Add PostGIS geography column for efficient spatial queries
ALTER TABLE public.business 
  ADD COLUMN IF NOT EXISTS location GEOGRAPHY(Point, 4326);

-- Create trigger to auto-populate geography from lat/lng
CREATE OR REPLACE FUNCTION update_business_location_geography()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  ELSE
    NEW.location = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_business_location_geography ON public.business;
CREATE TRIGGER trigger_business_location_geography
BEFORE INSERT OR UPDATE OF latitude, longitude ON public.business
FOR EACH ROW
EXECUTE FUNCTION update_business_location_geography();

-- Backfill existing location data if location_text contains coordinates
-- (This is a best-effort migration - manual geocoding may be needed for some records)

-- =====================================================================
-- 2. ADD DESCRIPTIVE COLUMNS
-- =====================================================================

ALTER TABLE public.business
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT;

-- Copy location_text to address if address is null
UPDATE public.business
SET address = location_text
WHERE address IS NULL AND location_text IS NOT NULL;

-- =====================================================================
-- 3. ADD AI SEARCH COLUMNS
-- =====================================================================

-- Tags: Quick categorical tags (e.g., ['pharmacy', 'medical', '24-hour'])
ALTER TABLE public.business
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Services: Services offered (e.g., ['printing', 'copying', 'binding', 'laminating'])
ALTER TABLE public.business
  ADD COLUMN IF NOT EXISTS services TEXT[] DEFAULT '{}';

-- Products: Products or brands carried (e.g., ['HP', 'Dell', 'Canon', 'Epson'])
ALTER TABLE public.business
  ADD COLUMN IF NOT EXISTS products TEXT[] DEFAULT '{}';

-- Keywords: Searchable keywords (e.g., ['computer', 'laptop', 'repair', 'accessories'])
ALTER TABLE public.business
  ADD COLUMN IF NOT EXISTS keywords TEXT[] DEFAULT '{}';

-- AI Metadata: Rich structured data for AI context
ALTER TABLE public.business
  ADD COLUMN IF NOT EXISTS ai_metadata JSONB DEFAULT '{}'::jsonb;

-- =====================================================================
-- 4. ADD BUSINESS OPERATIONS COLUMNS
-- =====================================================================

-- Operating hours: JSONB structure
-- Example: {"monday": {"open": "08:00", "close": "18:00"}, "tuesday": {...}}
ALTER TABLE public.business
  ADD COLUMN IF NOT EXISTS operating_hours JSONB;

-- Rating and reviews
ALTER TABLE public.business
  ADD COLUMN IF NOT EXISTS rating DECIMAL(2, 1) DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;

-- Verification status
ALTER TABLE public.business
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;

-- Status (if not already exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'business' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE public.business 
      ADD COLUMN status TEXT DEFAULT 'active';
  END IF;
END $$;

-- =====================================================================
-- 5. ADD FULL-TEXT SEARCH COLUMN
-- =====================================================================

-- Search vector for full-text search
ALTER TABLE public.business
  ADD COLUMN IF NOT EXISTS search_vector TSVECTOR;

-- Function to update search vector
CREATE OR REPLACE FUNCTION update_business_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := 
    -- Name gets highest weight (A)
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    -- Description and category get medium weight (B)
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.category_name, '')), 'B') ||
    -- Tags and keywords get medium weight (B)
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.keywords, ' '), '')), 'B') ||
    -- Services and products get lower weight (C)
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.services, ' '), '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.products, ' '), '')), 'C') ||
    -- Address gets lowest weight (D)
    setweight(to_tsvector('english', COALESCE(NEW.address, '')), 'D');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_business_search_vector ON public.business;
CREATE TRIGGER trigger_business_search_vector
BEFORE INSERT OR UPDATE ON public.business
FOR EACH ROW
EXECUTE FUNCTION update_business_search_vector();

-- =====================================================================
-- 6. CREATE INDEXES FOR PERFORMANCE
-- =====================================================================

-- GIN indexes for array columns (fast array overlap queries)
CREATE INDEX IF NOT EXISTS idx_business_tags 
ON public.business USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_business_services 
ON public.business USING GIN(services);

CREATE INDEX IF NOT EXISTS idx_business_products 
ON public.business USING GIN(products);

CREATE INDEX IF NOT EXISTS idx_business_keywords 
ON public.business USING GIN(keywords);

-- GIN index for JSONB metadata
CREATE INDEX IF NOT EXISTS idx_business_ai_metadata 
ON public.business USING GIN(ai_metadata);

-- GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_business_search_vector 
ON public.business USING GIN(search_vector);

-- GiST index for geography (spatial queries)
CREATE INDEX IF NOT EXISTS idx_business_location 
ON public.business USING GIST(location);

-- B-tree indexes for common filters
CREATE INDEX IF NOT EXISTS idx_business_rating 
ON public.business(rating DESC) 
WHERE rating IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_business_is_verified 
ON public.business(is_verified) 
WHERE is_verified = true;

CREATE INDEX IF NOT EXISTS idx_business_status 
ON public.business(status) 
WHERE status = 'active';

-- Composite index for common query pattern: active businesses with location
CREATE INDEX IF NOT EXISTS idx_business_active_with_location 
ON public.business(is_active, country) 
WHERE is_active = true AND location IS NOT NULL;

-- =====================================================================
-- 7. SEED INITIAL TAGS AND KEYWORDS FROM EXISTING DATA
-- =====================================================================

-- Auto-populate tags based on category_name
UPDATE public.business
SET tags = CASE
  WHEN category_name ILIKE '%pharmacy%' OR category_name ILIKE '%pharmacie%' THEN 
    ARRAY['pharmacy', 'medicine', 'health', 'medical']
  WHEN category_name ILIKE '%quincaillerie%' OR category_name ILIKE '%hardware%' THEN 
    ARRAY['hardware', 'tools', 'construction', 'building', 'materials']
  WHEN category_name ILIKE '%bar%' OR category_name ILIKE '%restaurant%' THEN 
    ARRAY['bar', 'restaurant', 'food', 'drinks', 'dining']
  WHEN category_name ILIKE '%salon%' OR category_name ILIKE '%beauty%' THEN 
    ARRAY['salon', 'beauty', 'hair', 'cosmetics']
  WHEN category_name ILIKE '%shop%' OR category_name ILIKE '%store%' THEN 
    ARRAY['shop', 'store', 'retail']
  WHEN category_name ILIKE '%market%' THEN 
    ARRAY['market', 'marketplace', 'shopping']
  WHEN category_name ILIKE '%boutique%' THEN 
    ARRAY['boutique', 'fashion', 'clothing']
  WHEN category_name ILIKE '%electronics%' OR category_name ILIKE '%computer%' THEN 
    ARRAY['electronics', 'computers', 'technology']
  ELSE 
    ARRAY[]::TEXT[]
END
WHERE tags = '{}' OR tags IS NULL;

-- Auto-populate keywords based on category
UPDATE public.business
SET keywords = CASE
  WHEN category_name ILIKE '%pharmacy%' THEN 
    ARRAY['panadol', 'paracetamol', 'medicine', 'drugs', 'prescription', 'vitamins', 'first aid']
  WHEN category_name ILIKE '%quincaillerie%' THEN 
    ARRAY['cement', 'paint', 'hammer', 'nails', 'screws', 'plumbing', 'electrical', 'wire']
  WHEN category_name ILIKE '%electronics%' THEN 
    ARRAY['computer', 'laptop', 'phone', 'tablet', 'charger', 'accessories', 'repair']
  ELSE 
    ARRAY[]::TEXT[]
END
WHERE keywords = '{}' OR keywords IS NULL;

-- Update search vectors for all existing records will happen automatically via trigger
-- on next insert/update. For immediate backfill, do it manually after migration if needed.

-- =====================================================================
-- 8. ADD CONSTRAINTS
-- =====================================================================

-- Ensure rating is between 0 and 5
ALTER TABLE public.business
  DROP CONSTRAINT IF EXISTS business_rating_check;

ALTER TABLE public.business
  ADD CONSTRAINT business_rating_check 
  CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5.0));

-- Ensure review_count is non-negative
ALTER TABLE public.business
  DROP CONSTRAINT IF EXISTS business_review_count_check;

ALTER TABLE public.business
  ADD CONSTRAINT business_review_count_check 
  CHECK (review_count IS NULL OR review_count >= 0);

-- =====================================================================
-- 9. ADD COMMENTS
-- =====================================================================

COMMENT ON COLUMN public.business.latitude IS 
'Latitude coordinate (WGS84). Auto-synced to location geography column.';

COMMENT ON COLUMN public.business.longitude IS 
'Longitude coordinate (WGS84). Auto-synced to location geography column.';

COMMENT ON COLUMN public.business.location IS 
'PostGIS geography point. Auto-populated from latitude/longitude. Use for spatial queries.';

COMMENT ON COLUMN public.business.tags IS 
'Categorical tags for quick filtering (e.g., [pharmacy, medical, 24-hour])';

COMMENT ON COLUMN public.business.services IS 
'Services offered (e.g., [printing, copying, binding])';

COMMENT ON COLUMN public.business.products IS 
'Products or brands carried (e.g., [HP, Dell, Canon])';

COMMENT ON COLUMN public.business.keywords IS 
'Searchable keywords for AI matching (e.g., [computer, laptop, repair])';

COMMENT ON COLUMN public.business.ai_metadata IS 
'Rich structured metadata for AI context. Store specialties, certifications, payment methods, etc.';

COMMENT ON COLUMN public.business.operating_hours IS 
'Business hours in JSONB format: {"monday": {"open": "08:00", "close": "18:00"}, ...}';

COMMENT ON COLUMN public.business.rating IS 
'Average rating (0.0 to 5.0)';

COMMENT ON COLUMN public.business.review_count IS 
'Total number of reviews';

COMMENT ON COLUMN public.business.is_verified IS 
'Whether business has been verified by admin';

COMMENT ON COLUMN public.business.search_vector IS 
'Full-text search vector. Auto-populated from name, description, tags, keywords, etc.';

COMMIT;
