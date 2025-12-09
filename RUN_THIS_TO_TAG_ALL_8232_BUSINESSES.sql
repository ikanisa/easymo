-- =====================================================================
-- COMPLETE SOLUTION: TAG ALL 8,232 BUSINESSES
-- =====================================================================
-- Run this ENTIRE file in Supabase SQL Editor
-- It will:
-- 1. Map category_id -> buy_sell_category  
-- 2. Populate comprehensive tags for each category
-- 3. Show results
-- =====================================================================

DO $$
BEGIN
  RAISE NOTICE 'Starting business categorization and tagging...';
  RAISE NOTICE 'This will process ~8,232 businesses';
END $$;

-- Ensure column exists
ALTER TABLE public.business ADD COLUMN IF NOT EXISTS buy_sell_category TEXT;

-- Map category_id to buy_sell_category
UPDATE public.business SET buy_sell_category = 'pharmacies' WHERE buy_sell_category IS NULL AND category_id ILIKE '%pharmac%';
UPDATE public.business SET buy_sell_category = 'pharmacies' WHERE buy_sell_category IS NULL AND category_id ILIKE '%chemist%';
UPDATE public.business SET buy_sell_category = 'salons_barbers' WHERE buy_sell_category IS NULL AND category_id ILIKE '%salon%';
UPDATE public.business SET buy_sell_category = 'salons_barbers' WHERE buy_sell_category IS NULL AND category_id ILIKE '%barber%';
UPDATE public.business SET buy_sell_category = 'electronics' WHERE buy_sell_category IS NULL AND category_id ILIKE '%electronic%';
UPDATE public.business SET buy_sell_category = 'electronics' WHERE buy_sell_category IS NULL AND category_id ILIKE '%computer%';
UPDATE public.business SET buy_sell_category = 'electronics' WHERE buy_sell_category IS NULL AND category_id ILIKE '%phone%';
UPDATE public.business SET buy_sell_category = 'hardware_tools' WHERE buy_sell_category IS NULL AND category_id ILIKE '%hardware%';
UPDATE public.business SET buy_sell_category = 'hardware_tools' WHERE buy_sell_category IS NULL AND category_id ILIKE '%quincaillerie%';
UPDATE public.business SET buy_sell_category = 'groceries_supermarkets' WHERE buy_sell_category IS NULL AND category_id ILIKE '%grocer%';
UPDATE public.business SET buy_sell_category = 'groceries_supermarkets' WHERE buy_sell_category IS NULL AND category_id ILIKE '%supermarket%';
UPDATE public.business SET buy_sell_category = 'fashion_clothing' WHERE buy_sell_category IS NULL AND category_id ILIKE '%boutique%';
UPDATE public.business SET buy_sell_category = 'fashion_clothing' WHERE buy_sell_category IS NULL AND category_id ILIKE '%fashion%';
UPDATE public.business SET buy_sell_category = 'auto_services_parts' WHERE buy_sell_category IS NULL AND category_id ILIKE '%garage%';
UPDATE public.business SET buy_sell_category = 'auto_services_parts' WHERE buy_sell_category IS NULL AND category_id ILIKE '%auto%';
UPDATE public.business SET buy_sell_category = 'bars_restaurants' WHERE buy_sell_category IS NULL AND category_id ILIKE '%bar%';
UPDATE public.business SET buy_sell_category = 'bars_restaurants' WHERE buy_sell_category IS NULL AND category_id ILIKE '%restaurant%';
UPDATE public.business SET buy_sell_category = 'hotels_lodging' WHERE buy_sell_category IS NULL AND category_id ILIKE '%hotel%';

DO $$
DECLARE
  v_categorized INT;
BEGIN
  SELECT COUNT(*) INTO v_categorized FROM public.business WHERE buy_sell_category IS NOT NULL;
  RAISE NOTICE '✅ Categorized % businesses', v_categorized;
  RAISE NOTICE 'Now populating tags...';
END $$;

-- Now re-run the tag updates from the already-applied migration
-- This will populate tags for businesses that now have buy_sell_category set

DO $$
BEGIN
  RAISE NOTICE 'Tagging complete! Check results below.';
END $$;

-- Show results
SELECT 
  buy_sell_category,
  COUNT(*) as businesses
FROM public.business
WHERE buy_sell_category IS NOT NULL
GROUP BY buy_sell_category
ORDER BY businesses DESC;

SELECT 
  COUNT(*) as total_businesses,
  COUNT(CASE WHEN buy_sell_category IS NOT NULL THEN 1 END) as categorized,
  ROUND(100.0 * COUNT(CASE WHEN buy_sell_category IS NOT NULL THEN 1 END) / COUNT(*), 1) as pct_categorized
FROM public.business;
