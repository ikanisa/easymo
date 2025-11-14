-- Migration: Fix business table and populate categories
-- Works with existing service_categories table

BEGIN;

-- ============================================
-- STEP 1: Add missing column to service_categories
-- ============================================

ALTER TABLE public.service_categories 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Update categories to latest values
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
-- STEP 2: Check for businesses table and merge if exists
-- ============================================

DO $$
DECLARE
  businesses_exists BOOLEAN;
BEGIN
  -- Check if businesses table exists
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'businesses'
  ) INTO businesses_exists;
  
  IF businesses_exists THEN
    RAISE NOTICE 'Found businesses table, merging data...';
    
    -- Merge unique records from businesses into business
    INSERT INTO public.business (
      id, name, phone, location, created_at, updated_at
    )
    SELECT 
      COALESCE(b.id, gen_random_uuid()),
      b.name,
      b.phone,
      b.location,
      COALESCE(b.created_at, now()),
      COALESCE(b.updated_at, now())
    FROM public.businesses b
    WHERE b.phone IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.business WHERE business.phone = b.phone
    )
    ON CONFLICT (id) DO NOTHING;
    
    RAISE NOTICE 'Merge complete';
  ELSE
    RAISE NOTICE 'No businesses table found, skipping merge';
  END IF;
END $$;

-- ============================================
-- STEP 3: Fix business table columns
-- ============================================

-- Add new columns
ALTER TABLE public.business ADD COLUMN IF NOT EXISTS tag TEXT;
ALTER TABLE public.business ADD COLUMN IF NOT EXISTS category_name TEXT;
ALTER TABLE public.business ADD COLUMN IF NOT EXISTS category_uuid UUID;
ALTER TABLE public.business ADD COLUMN IF NOT EXISTS maps_url TEXT;
ALTER TABLE public.business ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.business ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Add foreign key if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_business_category_uuid'
    AND table_name = 'business'
  ) THEN
    ALTER TABLE public.business 
    ADD CONSTRAINT fk_business_category_uuid 
    FOREIGN KEY (category_uuid) REFERENCES public.service_categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================
-- STEP 4: Migrate existing data
-- ============================================

-- Migrate category_id to tag if it looks like a slug
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'business' 
    AND column_name = 'category_id'
  ) THEN
    UPDATE public.business 
    SET tag = CASE
      -- If category_id is numeric, try to map it
      WHEN category_id ~ '^\d+$' THEN NULL
      -- If it looks like a slug, use it
      WHEN category_id ~ '^[a-z_]+$' THEN category_id
      ELSE category_id
    END
    WHERE category_id IS NOT NULL 
    AND tag IS NULL;
    
    RAISE NOTICE 'Migrated category_id to tag';
  END IF;
END $$;

-- Migrate url to maps_url
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
    WHERE url IS NOT NULL 
    AND url != ''
    AND maps_url IS NULL;
    
    RAISE NOTICE 'Migrated url to maps_url';
  END IF;
END $$;

-- ============================================
-- STEP 5: Map tags to categories
-- ============================================

-- Direct tag mapping
UPDATE public.business b
SET 
  category_uuid = sc.id,
  category_name = sc.label
FROM public.service_categories sc
WHERE b.tag = sc.key
AND b.category_uuid IS NULL;

-- Map bar/restaurant variants
UPDATE public.business b
SET 
  category_uuid = sc.id,
  category_name = sc.label
FROM public.service_categories sc
WHERE sc.key = 'bars_restaurants'
AND (
  b.tag IN ('bar', 'restaurant', 'bars', 'restaurants', 'bar_restaurant', 'bars_restaurants')
  OR b.tag ILIKE '%bar%'
  OR b.tag ILIKE '%restaurant%'
)
AND b.category_uuid IS NULL;

-- Map pharmacy variants
UPDATE public.business b
SET 
  category_uuid = sc.id,
  category_name = sc.label
FROM public.service_categories sc
WHERE sc.key = 'pharmacies'
AND (b.tag ILIKE '%pharm%' OR b.name ILIKE '%pharm%')
AND b.category_uuid IS NULL;

-- Map quincaillerie variants
UPDATE public.business b
SET 
  category_uuid = sc.id,
  category_name = sc.label
FROM public.service_categories sc
WHERE sc.key = 'quincailleries'
AND (b.tag ILIKE '%quinca%' OR b.name ILIKE '%quinca%' OR b.name ILIKE '%hardware%')
AND b.category_uuid IS NULL;

-- Map property rentals
UPDATE public.business b
SET 
  category_uuid = sc.id,
  category_name = sc.label
FROM public.service_categories sc
WHERE sc.key = 'property_rentals'
AND (
  b.tag ILIKE '%rental%' 
  OR b.tag ILIKE '%property%'
  OR b.name ILIKE '%rental%'
  OR b.name ILIKE '%property%'
  OR b.name ILIKE '%estate%'
)
AND b.category_uuid IS NULL;

-- Default uncategorized to shops_services
UPDATE public.business b
SET 
  category_uuid = sc.id,
  category_name = sc.label
FROM public.service_categories sc
WHERE sc.key = 'shops_services'
AND b.category_uuid IS NULL;

-- ============================================
-- STEP 6: Create indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_business_category_uuid ON public.business(category_uuid);
CREATE INDEX IF NOT EXISTS idx_business_tag ON public.business(tag);
CREATE INDEX IF NOT EXISTS idx_business_phone ON public.business(phone);
CREATE INDEX IF NOT EXISTS idx_business_location ON public.business USING gin(to_tsvector('english', location));

-- Spatial index for coordinates
CREATE INDEX IF NOT EXISTS idx_business_coordinates 
ON public.business(latitude, longitude) 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- ============================================
-- STEP 7: Add triggers
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
-- STEP 8: Summary
-- ============================================

DO $$
DECLARE
  total_businesses INTEGER;
  categorized_businesses INTEGER;
  uncategorized_businesses INTEGER;
  with_maps_url INTEGER;
  with_coordinates INTEGER;
  category_counts TEXT;
BEGIN
  SELECT COUNT(*) INTO total_businesses FROM public.business;
  SELECT COUNT(*) INTO categorized_businesses FROM public.business WHERE category_uuid IS NOT NULL;
  SELECT COUNT(*) INTO uncategorized_businesses FROM public.business WHERE category_uuid IS NULL;
  SELECT COUNT(*) INTO with_maps_url FROM public.business WHERE maps_url IS NOT NULL;
  SELECT COUNT(*) INTO with_coordinates FROM public.business WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
  
  -- Get category distribution
  SELECT string_agg(
    format('%s: %s', sc.label, COUNT(b.id)),
    E'\n           '
  )
  INTO category_counts
  FROM public.service_categories sc
  LEFT JOIN public.business b ON b.category_uuid = sc.id
  WHERE sc.is_active = true
  GROUP BY sc.label, sc.sort_order
  ORDER BY sc.sort_order;
  
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Business Tables Cleanup Complete';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Total businesses: %', total_businesses;
  RAISE NOTICE 'Categorized: % (%.1f%%)', categorized_businesses, 
    (categorized_businesses::float / NULLIF(total_businesses, 0) * 100);
  RAISE NOTICE 'Uncategorized: %', uncategorized_businesses;
  RAISE NOTICE 'With Google Maps URL: %', with_maps_url;
  RAISE NOTICE 'With coordinates: %', with_coordinates;
  RAISE NOTICE '-------------------------------------------';
  RAISE NOTICE 'Category Distribution:';
  RAISE NOTICE '%', category_counts;
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Next step: Run extract_coordinates.py';
  RAISE NOTICE '===========================================';
END $$;

COMMIT;
