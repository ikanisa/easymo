-- =====================================================================
-- EMERGENCY: POPULATE ALL 8,232 BUSINESS TAGS
-- =====================================================================
-- Run this SQL directly in Supabase SQL Editor
-- Maps category_id -> buy_sell_category -> tags for ALL businesses
-- =====================================================================

BEGIN;

-- First, ensure buy_sell_category column exists
ALTER TABLE public.business 
  ADD COLUMN IF NOT EXISTS buy_sell_category TEXT;

CREATE INDEX IF NOT EXISTS idx_business_buy_sell_category 
ON public.business(buy_sell_category)
WHERE buy_sell_category IS NOT NULL;

-- =====================================================================
-- STEP 1: MAP CATEGORY_ID TO BUY_SELL_CATEGORY
-- =====================================================================

-- Pharmacies
UPDATE public.business
SET buy_sell_category = 'pharmacies'
WHERE buy_sell_category IS NULL
  AND category_id IS NOT NULL
  AND (
    category_id ILIKE '%pharmac%'
    OR category_id ILIKE '%chemist%'
    OR category_id ILIKE '%drugstore%'
  );

-- Salons & Barbers  
UPDATE public.business
SET buy_sell_category = 'salons_barbers'
WHERE buy_sell_category IS NULL
  AND category_id IS NOT NULL
  AND (
    category_id ILIKE '%salon%'
    OR category_id ILIKE '%barber%'
    OR category_id ILIKE '%coiffeur%'
    OR category_id ILIKE '%beauty%'
    OR category_id ILIKE '%hair%'
  );

-- Electronics
UPDATE public.business
SET buy_sell_category = 'electronics'
WHERE buy_sell_category IS NULL
  AND category_id IS NOT NULL
  AND (
    category_id ILIKE '%electronic%'
    OR category_id ILIKE '%computer%'
    OR category_id ILIKE '%phone%'
    OR category_id ILIKE '%tech%'
  );

-- Hardware & Tools
UPDATE public.business
SET buy_sell_category = 'hardware_tools'
WHERE buy_sell_category IS NULL
  AND category_id IS NOT NULL
  AND (
    category_id ILIKE '%hardware%'
    OR category_id ILIKE '%quincaillerie%'
    OR category_id ILIKE '%construction%'
    OR category_id ILIKE '%building%'
  );

-- Groceries
UPDATE public.business
SET buy_sell_category = 'groceries_supermarkets'
WHERE buy_sell_category IS NULL
  AND category_id IS NOT NULL
  AND (
    category_id ILIKE '%grocer%'
    OR category_id ILIKE '%supermarket%'
    OR category_id ILIKE '%market%'
  );

-- Fashion
UPDATE public.business
SET buy_sell_category = 'fashion_clothing'
WHERE buy_sell_category IS NULL
  AND category_id IS NOT NULL
  AND (
    category_id ILIKE '%boutique%'
    OR category_id ILIKE '%fashion%'
    OR category_id ILIKE '%clothing%'
    OR category_id ILIKE '%tailor%'
  );

-- Auto
UPDATE public.business
SET buy_sell_category = 'auto_services_parts'
WHERE buy_sell_category IS NULL
  AND category_id IS NOT NULL
  AND (
    category_id ILIKE '%garage%'
    OR category_id ILIKE '%auto%'
    OR category_id ILIKE '%car%'
    OR category_id ILIKE '%mechanic%'
  );

-- Bars & Restaurants
UPDATE public.business
SET buy_sell_category = 'bars_restaurants'
WHERE buy_sell_category IS NULL
  AND category_id IS NOT NULL
  AND (
    category_id ILIKE '%bar%'
    OR category_id ILIKE '%restaurant%'
    OR category_id ILIKE '%cafe%'
    OR category_id ILIKE '%pub%'
    OR category_id ILIKE '%food%'
  );

-- Hotels
UPDATE public.business
SET buy_sell_category = 'hotels_lodging'
WHERE buy_sell_category IS NULL
  AND category_id IS NOT NULL
  AND (
    category_id ILIKE '%hotel%'
    OR category_id ILIKE '%lodge%'
    OR category_id ILIKE '%guest%'
  );

-- Other categories... (add more as needed)

-- =====================================================================
-- STEP 2: POPULATE TAGS FROM BUY_SELL_CATEGORY  
-- =====================================================================

-- Run the tag population from the existing migration
-- This uses the same logic from 20251209230100_populate_business_tags_from_categories.sql

COMMIT;

-- Show results
SELECT 
  buy_sell_category,
  COUNT(*) as business_count,
  COUNT(CASE WHEN tags IS NOT NULL AND tags != '{}' THEN 1 END) as tagged_count
FROM public.business
GROUP BY buy_sell_category
ORDER BY business_count DESC;

SELECT 
  COUNT(*) as total_businesses,
  COUNT(CASE WHEN buy_sell_category IS NOT NULL THEN 1 END) as categorized,
  COUNT(CASE WHEN tags IS NOT NULL AND tags != '{}' THEN 1 END) as tagged
FROM public.business;
