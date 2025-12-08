-- Migration: Intelligent Business Category Mapping
-- Date: 2025-12-07
-- Purpose: Map Google Maps categories to buy_sell_categories
--
-- Strategy:
-- 1. Add new columns: gm_category, buy_sell_category, buy_sell_category_id
-- 2. Preserve original category as gm_category
-- 3. Map to buy_sell_categories using intelligent pattern matching
-- 4. Handle variations, plurals, and related terms

BEGIN;

-- ============================================================================
-- STEP 1: Add New Columns
-- ============================================================================

ALTER TABLE businesses 
  ADD COLUMN IF NOT EXISTS gm_category TEXT,
  ADD COLUMN IF NOT EXISTS buy_sell_category TEXT,
  ADD COLUMN IF NOT EXISTS buy_sell_category_id UUID REFERENCES buy_sell_categories(id);

-- Preserve original Google Maps category
UPDATE businesses 
SET gm_category = LOWER(TRIM(category))
WHERE gm_category IS NULL AND category IS NOT NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_businesses_gm_category ON businesses(gm_category);
CREATE INDEX IF NOT EXISTS idx_businesses_buy_sell_category_id ON businesses(buy_sell_category_id);
CREATE INDEX IF NOT EXISTS idx_businesses_buy_sell_category ON businesses(buy_sell_category);

-- ============================================================================
-- STEP 2: Intelligent Category Mappings
-- ============================================================================

-- Category: Bars & Restaurants (bars, restaurants, cafes, bakeries, fast food)
UPDATE businesses b
SET 
  buy_sell_category = 'Bars & Restaurants',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE name = 'Bars & Restaurants' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND (
    gm_category SIMILAR TO '%(bar|restaurant|cafe|bakery|coffee|pizza|fast[ _]?food|barbecue|pub|night[ _]?club|food[ _]?court|ice[ _]?cream)%'
    OR gm_category IN ('bar', 'restaurant', 'cafe', 'bakery', 'coffee shop', 'pizza', 
                       'fast food', 'barbecue', 'pub', 'nightclub', 'night club', 
                       'food court', 'ice cream')
  );

-- Category: Salons & Barbers (beauty salons, barbershops, spas, nail salons)
UPDATE businesses b
SET 
  buy_sell_category = 'Salons & Barbers',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE name = 'Salons & Barbers' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND (
    gm_category SIMILAR TO '%(salon|barber|beauty|spa|nail|hair|cosmetic)%'
    OR gm_category IN ('salon', 'barbershop', 'beauty salon', 'spa', 'nail salon', 
                       'beauty supply', 'beauty supply store', 'cosmetics', 'cosmetics shop')
  );

-- Category: Pharmacies (pharmacies only - very specific)
UPDATE businesses b
SET 
  buy_sell_category = 'Pharmacies',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE name = 'Pharmacies' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND gm_category SIMILAR TO '%(pharmac|drug[ _]?store)%';

-- Category: Hospitals & Clinics (hospitals, clinics, doctors, dentists)
UPDATE businesses b
SET 
  buy_sell_category = 'Hospitals & Clinics',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE name = 'Hospitals & Clinics' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND (
    gm_category SIMILAR TO '%(hospital|clinic|doctor|dentist|medical|health|physiotherapy|veterinary|laboratory)%'
    OR gm_category IN ('hospital', 'clinic', 'doctor', 'dentist', 'medical center', 
                       'physiotherapy', 'veterinary', 'laboratory')
  );

-- Category: Schools & Education (schools, colleges, universities, tutoring)
UPDATE businesses b
SET 
  buy_sell_category = 'Schools & Education',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE name = 'Schools & Education' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND (
    gm_category SIMILAR TO '%(school|college|university|kindergarten|tutor|training|education|library)%'
    OR gm_category IN ('school', 'college', 'university', 'kindergarten', 'tutoring', 
                       'training center', 'library')
  );

-- Category: Hotels & Lodging (hotels, lodges, hostels, resorts)
UPDATE businesses b
SET 
  buy_sell_category = 'Hotels & Lodging',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE name = 'Hotels & Lodging' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND (
    gm_category SIMILAR TO '%(hotel|lodge|motel|hostel|resort|guest[ _]?house)%'
    OR gm_category IN ('hotel', 'lodge', 'motel', 'hostel', 'resort', 'guest house')
  );

-- Category: Electronics (electronics stores, phone shops, computer stores)
UPDATE businesses b
SET 
  buy_sell_category = 'Electronics',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE name = 'Electronics' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND (
    gm_category SIMILAR TO '%(electron|phone[ _]?shop|computer|tech)%'
    OR gm_category IN ('electronics store', 'phone shop', 'computer store', 'electronics')
  );

-- Category: Fashion & Clothing (clothing stores, boutiques)
UPDATE businesses b
SET 
  buy_sell_category = 'Fashion & Clothing',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE name = 'Fashion & Clothing' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND (
    gm_category SIMILAR TO '%(cloth|fashion|boutique|shoe|tailor|apparel)%'
    OR gm_category IN ('clothing store', 'boutique', 'shoe store', 'tailor', 'fashion')
  );

-- Category: Groceries & Supermarkets (supermarkets, grocery stores, markets)
UPDATE businesses b
SET 
  buy_sell_category = 'Groceries & Supermarkets',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE name = 'Groceries & Supermarkets' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND (
    gm_category SIMILAR TO '%(supermarket|grocery|market|convenience[ _]?store|shop(?!ping))%'
    OR gm_category IN ('supermarket', 'grocery store', 'market', 'convenience store', 
                       'shop', 'store')
  );

-- Category: Hardware & Tools (hardware stores)
UPDATE businesses b
SET 
  buy_sell_category = 'Hardware & Tools',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE name = 'Hardware & Tools' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND (
    gm_category SIMILAR TO '%(hardware|tool|construct|plumb|electric|paint|carpenter)%'
    OR gm_category IN ('hardware store', 'hardware', 'construction', 'plumber', 
                       'electrician', 'painter', 'carpenter')
  );

-- Category: Auto & Transport (car dealers, repair, parts, wash, gas stations)
UPDATE businesses b
SET 
  buy_sell_category = 'Auto & Transport',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE name = 'Transport & Logistics' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND (
    gm_category SIMILAR TO '%(car|auto|vehicle|mechanic|repair|tire|gas[ _]?station|wash)%'
    OR gm_category IN ('car dealer', 'car repair', 'car parts', 'car wash', 'mechanic', 
                       'auto spare parts', 'auto parts', 'tire shop', 'gas station', 'garage')
  );

-- Category: Professional Services (lawyers, accountants, consultants, real estate)
UPDATE businesses b
SET 
  buy_sell_category = 'Notaries & Legal',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE name = 'Notaries & Legal' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND (
    gm_category SIMILAR TO '%(law|notary|legal|advocate)%'
    OR gm_category IN ('lawyer', 'law firm', 'legal services')
  );

-- Category: Financial Services (banks, insurance, money transfer, forex)
UPDATE businesses b
SET 
  buy_sell_category = 'Banking & Finance',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE name = 'Banking & Finance' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND (
    gm_category SIMILAR TO '%(bank|insurance|financ|money[ _]?transfer|forex|atm|account)%'
    OR gm_category IN ('bank', 'insurance', 'money transfer', 'forex bureau', 'atm', 
                       'financial advisor', 'accountant', 'accounting')
  );

-- Category: Real Estate
UPDATE businesses b
SET 
  buy_sell_category = 'Real Estate',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE name = 'Real Estate' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND (
    gm_category SIMILAR TO '%(real[ _]?estate|property)%'
    OR gm_category IN ('real estate', 'real estate agency')
  );

-- Category: Home Services (laundry, dry cleaning, repair)
UPDATE businesses b
SET 
  buy_sell_category = 'Home Services',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE name = 'Salons & Barbers' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND (
    gm_category SIMILAR TO '%(laundry|dry[ _]?clean|repair[ _]?shop)%'
    OR gm_category IN ('laundry', 'dry cleaning', 'repair shop')
  );

-- Category: Shopping & Retail (general shops, malls, jewelry, bookstores)
UPDATE businesses b
SET 
  buy_sell_category = 'Shopping & Retail',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE name = 'Groceries & Supermarkets' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND (
    gm_category SIMILAR TO '%(shopping[ _]?mall|mall|jewelry|optical|bookstore|furniture)%'
    OR gm_category IN ('shopping mall', 'mall', 'jewelry store', 'optical store', 
                       'bookstore', 'furniture store', 'furniture')
  );

-- Category: Media & Advertising
UPDATE businesses b
SET 
  buy_sell_category = 'Media & Advertising',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE name = 'Groceries & Supermarkets' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND (
    gm_category SIMILAR TO '%(advertis|print|media|market)%'
    OR gm_category IN ('advertising', 'printing', 'marketing')
  );

-- Category: Health & Fitness
UPDATE businesses b
SET 
  buy_sell_category = 'Health & Fitness',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE name = 'Hospitals & Clinics' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND (
    gm_category SIMILAR TO '%(gym|fitness|sport)%'
    OR gm_category IN ('gym', 'fitness')
  );

-- Category: Consultants & Engineers
UPDATE businesses b
SET 
  buy_sell_category = 'Professional Services',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE name = 'Notaries & Legal' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND (
    gm_category SIMILAR TO '%(consult|engineer|architect)%'
    OR gm_category IN ('consultant', 'engineer', 'architect')
  );

-- ============================================================================
-- STEP 3: Add COMMENT to explain the mapping
-- ============================================================================

COMMENT ON COLUMN businesses.gm_category IS 'Original Google Maps category (preserved for reference)';
COMMENT ON COLUMN businesses.buy_sell_category IS 'Standardized buy/sell category name for display';
COMMENT ON COLUMN businesses.buy_sell_category_id IS 'Foreign key to buy_sell_categories table';

-- ============================================================================
-- STEP 4: Verification Queries
-- ============================================================================

-- Show mapping distribution
SELECT 
  buy_sell_category,
  COUNT(*) as business_count,
  COUNT(DISTINCT gm_category) as gm_categories_mapped,
  ROUND(COUNT(*)::numeric / (SELECT COUNT(*) FROM businesses)::numeric * 100, 2) as percentage
FROM businesses
WHERE buy_sell_category IS NOT NULL
GROUP BY buy_sell_category
ORDER BY business_count DESC;

-- Show unmapped categories (need manual review)
SELECT 
  gm_category,
  COUNT(*) as count
FROM businesses
WHERE buy_sell_category_id IS NULL
  AND gm_category IS NOT NULL
GROUP BY gm_category
ORDER BY count DESC;

-- Overall statistics
SELECT 
  COUNT(*) as total_businesses,
  COUNT(buy_sell_category_id) as mapped_businesses,
  COUNT(*) - COUNT(buy_sell_category_id) as unmapped_businesses,
  ROUND(COUNT(buy_sell_category_id)::numeric / COUNT(*)::numeric * 100, 2) as mapping_percentage
FROM businesses;

COMMIT;
