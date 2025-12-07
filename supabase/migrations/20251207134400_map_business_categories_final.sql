-- Migration: Map Business Categories to buy_sell_categories
-- Date: 2025-12-07
-- Maps Google Maps categories to standardized buy_sell categories

BEGIN;

-- Add columns
ALTER TABLE businesses 
  ADD COLUMN IF NOT EXISTS gm_category TEXT,
  ADD COLUMN IF NOT EXISTS buy_sell_category TEXT,
  ADD COLUMN IF NOT EXISTS buy_sell_category_id UUID REFERENCES buy_sell_categories(id);

-- Preserve original
UPDATE businesses 
SET gm_category = LOWER(TRIM(category))
WHERE gm_category IS NULL AND category IS NOT NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_businesses_gm_category ON businesses(gm_category);
CREATE INDEX IF NOT EXISTS idx_businesses_buy_sell_category_id ON businesses(buy_sell_category_id);

-- Helper function to get category ID by key
CREATE OR REPLACE FUNCTION get_buy_sell_cat_id(cat_key TEXT) 
RETURNS UUID AS $$
  SELECT id FROM buy_sell_categories WHERE key = cat_key LIMIT 1;
$$ LANGUAGE SQL IMMUTABLE;

-- Exact matches
UPDATE businesses SET buy_sell_category = 'Pharmacies', 
  buy_sell_category_id = get_buy_sell_cat_id('Pharmacy')
WHERE buy_sell_category_id IS NULL AND gm_category = 'pharmacy';

UPDATE businesses SET buy_sell_category = 'Salons & Barbers', 
  buy_sell_category_id = get_buy_sell_cat_id('Salon')
WHERE buy_sell_category_id IS NULL 
  AND gm_category IN ('salon', 'barbershop', 'beauty salon', 'beauty_salon', 'spa', 
                      'nail salon', 'nail_salon', 'cosmetics', 'cosmetics shop', 
                      'beauty supply', 'beauty supply store');

UPDATE businesses SET buy_sell_category = 'Hospitals & Clinics', 
  buy_sell_category_id = get_buy_sell_cat_id('Hospital')
WHERE buy_sell_category_id IS NULL 
  AND gm_category IN ('hospital', 'clinic', 'doctor', 'dentist', 'medical center',
                      'physiotherapy', 'veterinary', 'laboratory');

UPDATE businesses SET buy_sell_category = 'Schools & Education', 
  buy_sell_category_id = get_buy_sell_cat_id('School')
WHERE buy_sell_category_id IS NULL 
  AND gm_category IN ('school', 'college', 'university', 'kindergarten', 'tutoring', 
                      'training center', 'library');

UPDATE businesses SET buy_sell_category = 'Hotels & Lodging', 
  buy_sell_category_id = get_buy_sell_cat_id('Hotel')
WHERE buy_sell_category_id IS NULL 
  AND gm_category IN ('hotel', 'lodge', 'motel', 'hostel', 'resort', 'guest house');

UPDATE businesses SET buy_sell_category = 'Restaurants & Cafes', 
  buy_sell_category_id = get_buy_sell_cat_id('Restaurant')
WHERE buy_sell_category_id IS NULL 
  AND gm_category IN ('restaurant', 'cafe', 'bar', 'bakery', 'coffee shop', 'pizza', 
                      'fast food', 'barbecue', 'pub', 'nightclub', 'night club', 
                      'food court', 'ice cream');

UPDATE businesses SET buy_sell_category = 'Electronics', 
  buy_sell_category_id = get_buy_sell_cat_id('Electronics Store')
WHERE buy_sell_category_id IS NULL 
  AND gm_category IN ('electronics store', 'electronics_store', 'phone shop', 
                      'computer store', 'electronics');

UPDATE businesses SET buy_sell_category = 'Fashion & Clothing', 
  buy_sell_category_id = get_buy_sell_cat_id('Clothing Store')
WHERE buy_sell_category_id IS NULL 
  AND gm_category IN ('clothing store', 'clothing_store', 'boutique', 'shoe store', 
                      'tailor', 'fashion');

UPDATE businesses SET buy_sell_category = 'Groceries & Supermarkets', 
  buy_sell_category_id = get_buy_sell_cat_id('Supermarket')
WHERE buy_sell_category_id IS NULL 
  AND gm_category IN ('supermarket', 'grocery store', 'market', 'convenience store', 
                      'shop', 'store');

UPDATE businesses SET buy_sell_category = 'Hardware & Tools', 
  buy_sell_category_id = get_buy_sell_cat_id('Hardware Store')
WHERE buy_sell_category_id IS NULL 
  AND gm_category IN ('hardware store', 'hardware_store', 'hardware');

UPDATE businesses SET buy_sell_category = 'Auto Services & Parts', 
  buy_sell_category_id = get_buy_sell_cat_id('Auto Repair')
WHERE buy_sell_category_id IS NULL 
  AND gm_category IN ('car repair', 'car_repair', 'mechanic', 'car wash', 'car parts', 
                      'auto parts', 'auto spare parts', 'tire shop', 'garage');

UPDATE businesses SET buy_sell_category = 'Banks & Finance', 
  buy_sell_category_id = get_buy_sell_cat_id('Bank')
WHERE buy_sell_category_id IS NULL 
  AND gm_category IN ('bank', 'insurance', 'forex bureau', 'atm', 'money transfer', 
                      'financial advisor', 'accountant', 'accounting');

UPDATE businesses SET buy_sell_category = 'Notaries & Legal', 
  buy_sell_category_id = get_buy_sell_cat_id('Legal Services')
WHERE buy_sell_category_id IS NULL 
  AND gm_category IN ('lawyer', 'law firm', 'legal services');

UPDATE businesses SET buy_sell_category = 'Transport & Logistics', 
  buy_sell_category_id = get_buy_sell_cat_id('Transport')
WHERE buy_sell_category_id IS NULL 
  AND gm_category IN ('car dealer', 'gas station', 'gas_station');

-- Pattern matching (LIKE)
UPDATE businesses SET buy_sell_category = 'Restaurants & Cafes', 
  buy_sell_category_id = get_buy_sell_cat_id('Restaurant')
WHERE buy_sell_category_id IS NULL 
  AND (gm_category LIKE '%bar%' OR gm_category LIKE '%restaurant%' OR gm_category LIKE '%cafe%' 
       OR gm_category LIKE '%bakery%' OR gm_category LIKE '%coffee%' OR gm_category LIKE '%pizza%'
       OR gm_category LIKE '%food%');

UPDATE businesses SET buy_sell_category = 'Salons & Barbers', 
  buy_sell_category_id = get_buy_sell_cat_id('Salon')
WHERE buy_sell_category_id IS NULL 
  AND (gm_category LIKE '%salon%' OR gm_category LIKE '%barber%' OR gm_category LIKE '%beauty%'
       OR gm_category LIKE '%spa%' OR gm_category LIKE '%nail%' OR gm_category LIKE '%cosmetic%');

UPDATE businesses SET buy_sell_category = 'Hospitals & Clinics', 
  buy_sell_category_id = get_buy_sell_cat_id('Hospital')
WHERE buy_sell_category_id IS NULL 
  AND (gm_category LIKE '%hospital%' OR gm_category LIKE '%clinic%' OR gm_category LIKE '%doctor%'
       OR gm_category LIKE '%medical%' OR gm_category LIKE '%health%');

UPDATE businesses SET buy_sell_category = 'Schools & Education', 
  buy_sell_category_id = get_buy_sell_cat_id('School')
WHERE buy_sell_category_id IS NULL 
  AND (gm_category LIKE '%school%' OR gm_category LIKE '%college%' OR gm_category LIKE '%university%'
       OR gm_category LIKE '%kindergarten%' OR gm_category LIKE '%tutor%' OR gm_category LIKE '%training%');

UPDATE businesses SET buy_sell_category = 'Hotels & Lodging', 
  buy_sell_category_id = get_buy_sell_cat_id('Hotel')
WHERE buy_sell_category_id IS NULL 
  AND (gm_category LIKE '%hotel%' OR gm_category LIKE '%lodge%' OR gm_category LIKE '%motel%'
       OR gm_category LIKE '%hostel%' OR gm_category LIKE '%resort%');

UPDATE businesses SET buy_sell_category = 'Electronics', 
  buy_sell_category_id = get_buy_sell_cat_id('Electronics Store')
WHERE buy_sell_category_id IS NULL 
  AND (gm_category LIKE '%electron%' OR gm_category LIKE '%phone%' OR gm_category LIKE '%computer%');

UPDATE businesses SET buy_sell_category = 'Fashion & Clothing', 
  buy_sell_category_id = get_buy_sell_cat_id('Clothing Store')
WHERE buy_sell_category_id IS NULL 
  AND (gm_category LIKE '%cloth%' OR gm_category LIKE '%fashion%' OR gm_category LIKE '%boutique%'
       OR gm_category LIKE '%shoe%' OR gm_category LIKE '%tailor%');

UPDATE businesses SET buy_sell_category = 'Hardware & Tools', 
  buy_sell_category_id = get_buy_sell_cat_id('Hardware Store')
WHERE buy_sell_category_id IS NULL 
  AND (gm_category LIKE '%hardware%' OR gm_category LIKE '%construction%' OR gm_category LIKE '%plumb%'
       OR gm_category LIKE '%electric%' OR gm_category LIKE '%carpenter%');

UPDATE businesses SET buy_sell_category = 'Auto Services & Parts', 
  buy_sell_category_id = get_buy_sell_cat_id('Auto Repair')
WHERE buy_sell_category_id IS NULL 
  AND (gm_category LIKE '%car%' OR gm_category LIKE '%auto%' OR gm_category LIKE '%vehicle%'
       OR gm_category LIKE '%mechanic%' OR gm_category LIKE '%tire%' OR gm_category LIKE '%wash%');

UPDATE businesses SET buy_sell_category = 'Notaries & Legal', 
  buy_sell_category_id = get_buy_sell_cat_id('Legal Services')
WHERE buy_sell_category_id IS NULL 
  AND (gm_category LIKE '%law%' OR gm_category LIKE '%legal%');

UPDATE businesses SET buy_sell_category = 'Groceries & Supermarkets', 
  buy_sell_category_id = get_buy_sell_cat_id('Supermarket')
WHERE buy_sell_category_id IS NULL 
  AND (gm_category LIKE '%shop%' OR gm_category LIKE '%store%' OR gm_category LIKE '%market%'
       OR gm_category LIKE '%furniture%' OR gm_category LIKE '%jewelry%');

COMMENT ON COLUMN businesses.gm_category IS 'Original Google Maps category';
COMMENT ON COLUMN businesses.buy_sell_category IS 'Standardized category';
COMMENT ON COLUMN businesses.buy_sell_category_id IS 'FK to buy_sell_categories';

-- Stats
SELECT buy_sell_category, COUNT(*) as count,
  ROUND(COUNT(*)::numeric / (SELECT COUNT(*) FROM businesses WHERE gm_category IS NOT NULL)::numeric * 100, 1) as pct
FROM businesses WHERE buy_sell_category IS NOT NULL
GROUP BY buy_sell_category ORDER BY count DESC;

SELECT COUNT(*) as total, COUNT(buy_sell_category_id) as mapped,
  ROUND(COUNT(buy_sell_category_id)::numeric / COUNT(*)::numeric * 100, 1) as pct_mapped
FROM businesses WHERE gm_category IS NOT NULL;

COMMIT;
