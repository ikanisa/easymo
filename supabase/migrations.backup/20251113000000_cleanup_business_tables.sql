-- Migration: Cleanup and merge business/businesses tables
-- This migration fixes the conflicting business tables and prepares for category integration

BEGIN;

-- ============================================
-- STEP 1: Create service_categories table
-- ============================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  icon_emoji TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_service_categories_key ON public.service_categories(key);
CREATE INDEX IF NOT EXISTS idx_service_categories_active ON public.service_categories(is_active) WHERE is_active = true;

-- Insert categories
INSERT INTO public.service_categories (key, label, description, icon_emoji, sort_order)
VALUES
  ('pharmacies', 'Pharmacies', 'Medical pharmacies and drugstores', '💊', 10),
  ('quincailleries', 'Quincailleries', 'Hardware stores and building materials', '🔧', 20),
  ('shops_services', 'Shops & Services', 'General shops and service providers', '🏬', 30),
  ('property_rentals', 'Property Rentals', 'Houses, apartments, and rental properties', '🏡', 40),
  ('notary_services', 'Notary Services', 'Legal notary and documentation services', '📜', 50),
  ('bars_restaurants', 'Bars & Restaurants', 'Dining, bars, and food establishments', '🍽️', 60)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  icon_emoji = EXCLUDED.icon_emoji,
  sort_order = EXCLUDED.sort_order,
  is_active = true,
  updated_at = now();

-- ============================================
-- STEP 2: Backup existing business table
-- ============================================

-- Create backup of current business table
CREATE TABLE IF NOT EXISTS public.business_backup AS 
SELECT * FROM public.business;

-- ============================================
-- STEP 3: Check if businesses table exists and merge
-- ============================================

DO $$
BEGIN
  -- Check if businesses table exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'businesses') THEN
    -- Merge data from businesses into business (if not already present)
    INSERT INTO public.business (
      id, name, phone, location, created_at, updated_at
    )
    SELECT 
      COALESCE(id, gen_random_uuid()),
      name,
      phone,
      location,
      COALESCE(created_at, now()),
      COALESCE(updated_at, now())
    FROM public.businesses
    WHERE NOT EXISTS (
      SELECT 1 FROM public.business WHERE business.phone = businesses.phone
    );
    
    RAISE NOTICE 'Merged data from businesses table into business table';
  END IF;
END $$;

-- ============================================
-- STEP 4: Fix business table columns
-- ============================================

-- Add new columns if they don't exist
ALTER TABLE public.business ADD COLUMN IF NOT EXISTS tag TEXT;
ALTER TABLE public.business ADD COLUMN IF NOT EXISTS category_name TEXT;
ALTER TABLE public.business ADD COLUMN IF NOT EXISTS category_uuid UUID REFERENCES public.service_categories(id);
ALTER TABLE public.business ADD COLUMN IF NOT EXISTS maps_url TEXT;
ALTER TABLE public.business ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.business ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Migrate existing category_id data to tag column (if category_id exists and contains text)
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'business' 
    AND column_name = 'category_id'
  ) THEN
    -- Copy category_id content to tag if it looks like a slug
    UPDATE public.business 
    SET tag = category_id::TEXT
    WHERE category_id IS NOT NULL 
    AND tag IS NULL
    AND category_id::TEXT ~ '^[a-z_]+$';
    
    RAISE NOTICE 'Migrated category_id values to tag column';
  END IF;
END $$;

-- Migrate url column to maps_url
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'business' 
    AND column_name = 'url'
  ) THEN
    UPDATE public.business 
    SET maps_url = url
    WHERE url IS NOT NULL AND maps_url IS NULL;
    
    RAISE NOTICE 'Migrated url values to maps_url column';
  END IF;
END $$;

-- ============================================
-- STEP 5: Map tags to category UUIDs
-- ============================================

-- Update category_uuid and category_name based on tag
UPDATE public.business b
SET 
  category_uuid = sc.id,
  category_name = sc.label
FROM public.service_categories sc
WHERE b.tag = sc.key
AND b.category_uuid IS NULL;

-- For bars_restaurants tag specifically
UPDATE public.business b
SET 
  category_uuid = sc.id,
  category_name = sc.label
FROM public.service_categories sc
WHERE (
  b.tag IN ('bar', 'restaurant', 'bars', 'restaurants', 'bar_restaurant')
  OR b.tag ILIKE '%bar%'
  OR b.tag ILIKE '%restaurant%'
)
AND sc.key = 'bars_restaurants'
AND b.category_uuid IS NULL;

-- ============================================
-- STEP 6: Create indexes for performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_business_category_uuid ON public.business(category_uuid);
CREATE INDEX IF NOT EXISTS idx_business_tag ON public.business(tag);
CREATE INDEX IF NOT EXISTS idx_business_phone ON public.business(phone);
CREATE INDEX IF NOT EXISTS idx_business_location ON public.business(location);

-- Create spatial index if lat/lng are populated
CREATE INDEX IF NOT EXISTS idx_business_coordinates 
ON public.business(latitude, longitude) 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- ============================================
-- STEP 7: Add updated_at trigger
-- ============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_business_updated_at ON public.business;
CREATE TRIGGER update_business_updated_at
  BEFORE UPDATE ON public.business
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_service_categories_updated_at ON public.service_categories;
CREATE TRIGGER update_service_categories_updated_at
  BEFORE UPDATE ON public.service_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- STEP 8: Enable RLS
-- ============================================

ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;

-- Allow public read access to categories
DROP POLICY IF EXISTS "Public read access to service categories" ON public.service_categories;
CREATE POLICY "Public read access to service categories"
  ON public.service_categories
  FOR SELECT
  TO public
  USING (is_active = true);

-- ============================================
-- STEP 9: Create helper function to get categories
-- ============================================

CREATE OR REPLACE FUNCTION public.get_active_service_categories()
RETURNS TABLE (
  id UUID,
  key TEXT,
  label TEXT,
  description TEXT,
  icon_emoji TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sc.id,
    sc.key,
    sc.label,
    sc.description,
    sc.icon_emoji
  FROM public.service_categories sc
  WHERE sc.is_active = true
  ORDER BY sc.sort_order;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- Summary
-- ============================================

DO $$
DECLARE
  total_businesses INTEGER;
  categorized_businesses INTEGER;
  uncategorized_businesses INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_businesses FROM public.business;
  SELECT COUNT(*) INTO categorized_businesses FROM public.business WHERE category_uuid IS NOT NULL;
  SELECT COUNT(*) INTO uncategorized_businesses FROM public.business WHERE category_uuid IS NULL;
  
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Business Tables Cleanup Complete';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Total businesses: %', total_businesses;
  RAISE NOTICE 'Categorized: %', categorized_businesses;
  RAISE NOTICE 'Uncategorized: %', uncategorized_businesses;
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Service categories table: ✓ Created';
  RAISE NOTICE 'Business table columns: ✓ Fixed';
  RAISE NOTICE 'Indexes: ✓ Created';
  RAISE NOTICE 'RLS policies: ✓ Enabled';
  RAISE NOTICE '===========================================';
END $$;

COMMIT;
