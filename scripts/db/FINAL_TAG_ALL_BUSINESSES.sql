-- =====================================================================
-- POPULATE ALL 8,232+ BUSINESS TAGS
-- =====================================================================
-- Copy this entire file and run in Supabase SQL Editor
-- =====================================================================

BEGIN;

-- Ensure column exists
ALTER TABLE public.business ADD COLUMN IF NOT EXISTS buy_sell_category TEXT;
CREATE INDEX IF NOT EXISTS idx_business_buy_sell_category ON public.business(buy_sell_category);

-- ===================================================================== 
-- STEP 1: Map category_id to buy_sell_category
-- =====================================================================

UPDATE public.business SET buy_sell_category = 'pharmacies'
WHERE buy_sell_category IS NULL AND category_id IS NOT NULL 
  AND (category_id ILIKE '%pharmac%' OR category_id ILIKE '%chemist%' OR category_id ILIKE '%drugstore%');

UPDATE public.business SET buy_sell_category = 'salons_barbers'
WHERE buy_sell_category IS NULL AND category_id IS NOT NULL
  AND (category_id ILIKE '%salon%' OR category_id ILIKE '%barber%' OR category_id ILIKE '%coiffeur%' OR category_id ILIKE '%beauty%' OR category_id ILIKE '%hair%');

UPDATE public.business SET buy_sell_category = 'electronics'
WHERE buy_sell_category IS NULL AND category_id IS NOT NULL
  AND (category_id ILIKE '%electronic%' OR category_id ILIKE '%computer%' OR category_id ILIKE '%phone%' OR category_id ILIKE '%tech%' OR category_id ILIKE '%gadget%');

UPDATE public.business SET buy_sell_category = 'hardware_tools'
WHERE buy_sell_category IS NULL AND category_id IS NOT NULL
  AND (category_id ILIKE '%hardware%' OR category_id ILIKE '%quincaillerie%' OR category_id ILIKE '%construction%' OR category_id ILIKE '%building%' OR category_id ILIKE '%tool%');

UPDATE public.business SET buy_sell_category = 'groceries_supermarkets'
WHERE buy_sell_category IS NULL AND category_id IS NOT NULL
  AND (category_id ILIKE '%grocer%' OR category_id ILIKE '%supermarket%' OR category_id ILIKE '%market%' OR category_id ILIKE '%food%store%');

UPDATE public.business SET buy_sell_category = 'fashion_clothing'
WHERE buy_sell_category IS NULL AND category_id IS NOT NULL
  AND (category_id ILIKE '%boutique%' OR category_id ILIKE '%fashion%' OR category_id ILIKE '%clothing%' OR category_id ILIKE '%clothes%' OR category_id ILIKE '%tailor%');

UPDATE public.business SET buy_sell_category = 'auto_services_parts'
WHERE buy_sell_category IS NULL AND category_id IS NOT NULL
  AND (category_id ILIKE '%garage%' OR category_id ILIKE '%auto%' OR category_id ILIKE '%car%' OR category_id ILIKE '%mechanic%' OR category_id ILIKE '%vehicle%');

UPDATE public.business SET buy_sell_category = 'notaries_legal'
WHERE buy_sell_category IS NULL AND category_id IS NOT NULL
  AND (category_id ILIKE '%notary%' OR category_id ILIKE '%notaire%' OR category_id ILIKE '%legal%' OR category_id ILIKE '%lawyer%' OR category_id ILIKE '%attorney%' OR category_id ILIKE '%law%firm%');

UPDATE public.business SET buy_sell_category = 'accountants_consultants'
WHERE buy_sell_category IS NULL AND category_id IS NOT NULL
  AND (category_id ILIKE '%accountant%' OR category_id ILIKE '%accounting%' OR category_id ILIKE '%consultant%' OR category_id ILIKE '%consulting%' OR category_id ILIKE '%audit%');

UPDATE public.business SET buy_sell_category = 'banks_finance'
WHERE buy_sell_category IS NULL AND category_id IS NOT NULL
  AND (category_id ILIKE '%bank%' OR category_id ILIKE '%finance%' OR category_id ILIKE '%sacco%' OR category_id ILIKE '%microfinance%' OR category_id ILIKE '%mfi%');

UPDATE public.business SET buy_sell_category = 'bars_restaurants'
WHERE buy_sell_category IS NULL AND category_id IS NOT NULL
  AND (category_id ILIKE '%bar%' OR category_id ILIKE '%restaurant%' OR category_id ILIKE '%cafe%' OR category_id ILIKE '%pub%' OR category_id ILIKE '%lounge%' OR category_id ILIKE '%food%');

UPDATE public.business SET buy_sell_category = 'hospitals_clinics'
WHERE buy_sell_category IS NULL AND category_id IS NOT NULL
  AND (category_id ILIKE '%hospital%' OR category_id ILIKE '%clinic%' OR category_id ILIKE '%health%center%' OR category_id ILIKE '%medical%' OR category_id ILIKE '%doctor%');

UPDATE public.business SET buy_sell_category = 'hotels_lodging'
WHERE buy_sell_category IS NULL AND category_id IS NOT NULL
  AND (category_id ILIKE '%hotel%' OR category_id ILIKE '%lodge%' OR category_id ILIKE '%guest%house%' OR category_id ILIKE '%guesthouse%' OR category_id ILIKE '%hostel%' OR category_id ILIKE '%accommodation%');

UPDATE public.business SET buy_sell_category = 'real_estate_construction'
WHERE buy_sell_category IS NULL AND category_id IS NOT NULL
  AND (category_id ILIKE '%real%estate%' OR category_id ILIKE '%property%' OR category_id ILIKE '%contractor%' OR category_id ILIKE '%architect%');

UPDATE public.business SET buy_sell_category = 'schools_education'
WHERE buy_sell_category IS NULL AND category_id IS NOT NULL
  AND (category_id ILIKE '%school%' OR category_id ILIKE '%education%' OR category_id ILIKE '%university%' OR category_id ILIKE '%college%' OR category_id ILIKE '%training%');

UPDATE public.business SET buy_sell_category = 'transport_logistics'
WHERE buy_sell_category IS NULL AND category_id IS NOT NULL
  AND (category_id ILIKE '%transport%' OR category_id ILIKE '%taxi%' OR category_id ILIKE '%logistics%' OR category_id ILIKE '%delivery%' OR category_id ILIKE '%courier%');

UPDATE public.business SET buy_sell_category = 'other_services'
WHERE buy_sell_category IS NULL AND category_id IS NOT NULL
  AND (category_id ILIKE '%service%' OR category_id ILIKE '%cleaning%' OR category_id ILIKE '%repair%' OR category_id ILIKE '%printing%' OR category_id ILIKE '%event%' OR category_id ILIKE '%photography%');

RAISE NOTICE '✅ Step 1 Complete: Mapped category_id to buy_sell_category';

-- Now the tag population from the migration will run automatically 
-- because the migration file was already applied!

COMMIT;

-- =====================================================================
-- RESULTS
-- =====================================================================
SELECT 
  buy_sell_category,
  COUNT(*) as count
FROM public.business  
WHERE buy_sell_category IS NOT NULL
GROUP BY buy_sell_category
ORDER BY count DESC;

SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN buy_sell_category IS NOT NULL THEN 1 END) as categorized,
  ROUND(100.0 * COUNT(CASE WHEN buy_sell_category IS NOT NULL THEN 1 END) / COUNT(*), 1) as pct_categorized
FROM public.business;
