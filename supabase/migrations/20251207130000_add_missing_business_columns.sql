-- ============================================================================
-- Add missing columns to business table
-- Issue: wa-webhook-profile queries tag and bar_id columns that don't exist
-- ============================================================================

BEGIN;

-- Add tag column for business categorization
ALTER TABLE public.business ADD COLUMN IF NOT EXISTS tag TEXT;

-- Add bar_id column for linking to restaurant_menu_items
-- This allows a business to have an associated "bar" identity for menu management
ALTER TABLE public.business ADD COLUMN IF NOT EXISTS bar_id UUID;

-- Create index for bar_id lookups (used in menu management)
CREATE INDEX IF NOT EXISTS idx_business_bar_id 
  ON public.business(bar_id) 
  WHERE bar_id IS NOT NULL;

-- Create index for tag-based filtering
CREATE INDEX IF NOT EXISTS idx_business_tag 
  ON public.business(tag) 
  WHERE tag IS NOT NULL;

-- Add category_name column if it doesn't exist (referenced in the code)
ALTER TABLE public.business ADD COLUMN IF NOT EXISTS category_name TEXT;

-- Create index for category_name lookups
CREATE INDEX IF NOT EXISTS idx_business_category_name 
  ON public.business(category_name) 
  WHERE category_name IS NOT NULL;

-- For existing businesses that are bars/restaurants, set bar_id = id
-- This makes them self-referencing for menu purposes
UPDATE public.business 
SET bar_id = id 
WHERE bar_id IS NULL 
  AND (
    category_name ILIKE '%bar%' 
    OR category_name ILIKE '%restaurant%'
    OR category_name ILIKE '%cafe%'
    OR tag ILIKE '%bar%'
    OR tag ILIKE '%restaurant%'
  );

COMMENT ON COLUMN public.business.tag IS 'Business category tag/slug for filtering (e.g., restaurant, pharmacy, salon)';
COMMENT ON COLUMN public.business.bar_id IS 'UUID linking to bar/restaurant identity for menu management. Often self-referencing (bar_id = id).';
COMMENT ON COLUMN public.business.category_name IS 'Human-readable category name for the business (e.g., Bar & Restaurant, Pharmacy, Salon)';

COMMIT;
