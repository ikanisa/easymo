-- Migration: Intelligent Business Category Mapping (Simplified & Robust)
-- Date: 2025-12-07
-- Purpose: Map Google Maps categories to buy_sell_categories
--
-- This uses simple pattern matching instead of complex regex for reliability

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
-- STEP 2: Category Mappings (Exact Matches First)
-- ============================================================================

-- Bars & Restaurants - Exact matches
UPDATE businesses b
SET 
  buy_sell_category = 'Bars & Restaurants',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE google_maps_category = 'Restaurant' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND gm_category IN ('bar', 'restaurant', 'cafe', 'bakery', 'coffee shop', 'pizza', 
                      'fast food', 'barbecue', 'pub', 'nightclub', 'night club', 
                      'food court', 'ice cream', 'night_club', 'fast_food');

-- Salons & Barbers - Exact matches
UPDATE businesses b
SET 
  buy_sell_category = 'Salons & Barbers',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE google_maps_category = 'Salon' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND gm_category IN ('salon', 'barbershop', 'beauty salon', 'beauty_salon', 'spa', 'nail salon', 
                      'nail_salon', 'beauty supply', 'beauty supply store', 'beauty_supply_store',
                      'cosmetics', 'cosmetics shop', 'cosmetics_shop');

-- Pharmacies - Exact matches
UPDATE businesses b
SET 
  buy_sell_category = 'Pharmacies',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE google_maps_category = 'Pharmacy' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND gm_category IN ('pharmacy', 'drug store', 'drug_store');

-- Hospitals & Clinics - Exact matches
UPDATE businesses b
SET 
  buy_sell_category = 'Hospitals & Clinics',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE google_maps_category = 'Hospital' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND gm_category IN ('hospital', 'clinic', 'doctor', 'dentist', 'medical center', 'medical_center',
                      'physiotherapy', 'veterinary', 'laboratory');

-- Schools & Education - Exact matches
UPDATE businesses b
SET 
  buy_sell_category = 'Schools & Education',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE google_maps_category = 'School' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND gm_category IN ('school', 'college', 'university', 'kindergarten', 'tutoring', 
                      'training center', 'training_center', 'library');

-- Hotels & Lodging - Exact matches
UPDATE businesses b
SET 
  buy_sell_category = 'Hotels & Lodging',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE google_maps_category = 'Hotel' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND gm_category IN ('hotel', 'lodge', 'motel', 'hostel', 'resort', 'guest house', 'guest_house');

-- Electronics - Exact matches
UPDATE businesses b
SET 
  buy_sell_category = 'Electronics',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE google_maps_category = 'Electronics Store' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND gm_category IN ('electronics store', 'electronics_store', 'phone shop', 'phone_shop', 
                      'computer store', 'computer_store', 'electronics');

-- Fashion & Clothing - Exact matches
UPDATE businesses b
SET 
  buy_sell_category = 'Fashion & Clothing',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE google_maps_category = 'Clothing Store' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND gm_category IN ('clothing store', 'clothing_store', 'boutique', 'shoe store', 'shoe_store',
                      'tailor', 'fashion');

-- Groceries & Supermarkets - Exact matches
UPDATE businesses b
SET 
  buy_sell_category = 'Groceries & Supermarkets',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE google_maps_category = 'Supermarket' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND gm_category IN ('supermarket', 'grocery store', 'grocery_store', 'market', 
                      'convenience store', 'convenience_store', 'shop', 'store');

-- Hardware & Tools - Exact matches
UPDATE businesses b
SET 
  buy_sell_category = 'Hardware & Tools',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE google_maps_category = 'Hardware Store' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND gm_category IN ('hardware store', 'hardware_store', 'hardware');

-- ============================================================================
-- STEP 3: Pattern Matching for Remaining Categories
-- ============================================================================

-- Bars & Restaurants - Pattern matching
UPDATE businesses b
SET 
  buy_sell_category = 'Bars & Restaurants',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE google_maps_category = 'Restaurant' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND (gm_category LIKE '%bar%' OR gm_category LIKE '%restaurant%' OR gm_category LIKE '%cafe%' 
       OR gm_category LIKE '%bakery%' OR gm_category LIKE '%coffee%' OR gm_category LIKE '%pizza%'
       OR gm_category LIKE '%food%' OR gm_category LIKE '%grill%' OR gm_category LIKE '%dine%');

-- Salons & Barbers - Pattern matching
UPDATE businesses b
SET 
  buy_sell_category = 'Salons & Barbers',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE google_maps_category = 'Salon' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND (gm_category LIKE '%salon%' OR gm_category LIKE '%barber%' OR gm_category LIKE '%beauty%'
       OR gm_category LIKE '%spa%' OR gm_category LIKE '%nail%' OR gm_category LIKE '%hair%'
       OR gm_category LIKE '%cosmetic%');

-- Healthcare - Pattern matching
UPDATE businesses b
SET 
  buy_sell_category = 'Hospitals & Clinics',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE google_maps_category = 'Hospital' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND (gm_category LIKE '%hospital%' OR gm_category LIKE '%clinic%' OR gm_category LIKE '%doctor%'
       OR gm_category LIKE '%medical%' OR gm_category LIKE '%health%' OR gm_category LIKE '%dentist%'
       OR gm_category LIKE '%physiotherapy%' OR gm_category LIKE '%veterinary%');

-- Education - Pattern matching
UPDATE businesses b
SET 
  buy_sell_category = 'Schools & Education',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE google_maps_category = 'School' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND (gm_category LIKE '%school%' OR gm_category LIKE '%college%' OR gm_category LIKE '%university%'
       OR gm_category LIKE '%kindergarten%' OR gm_category LIKE '%tutor%' OR gm_category LIKE '%training%'
       OR gm_category LIKE '%education%');

-- Lodging - Pattern matching
UPDATE businesses b
SET 
  buy_sell_category = 'Hotels & Lodging',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE google_maps_category = 'Hotel' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND (gm_category LIKE '%hotel%' OR gm_category LIKE '%lodge%' OR gm_category LIKE '%motel%'
       OR gm_category LIKE '%hostel%' OR gm_category LIKE '%resort%' OR gm_category LIKE '%guest%');

-- Tech & Electronics - Pattern matching
UPDATE businesses b
SET 
  buy_sell_category = 'Electronics',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE google_maps_category = 'Electronics Store' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND (gm_category LIKE '%electron%' OR gm_category LIKE '%phone%' OR gm_category LIKE '%computer%'
       OR gm_category LIKE '%tech%');

-- Fashion - Pattern matching
UPDATE businesses b
SET 
  buy_sell_category = 'Fashion & Clothing',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE google_maps_category = 'Clothing Store' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND (gm_category LIKE '%cloth%' OR gm_category LIKE '%fashion%' OR gm_category LIKE '%boutique%'
       OR gm_category LIKE '%shoe%' OR gm_category LIKE '%tailor%');

-- Construction & Tools - Pattern matching
UPDATE businesses b
SET 
  buy_sell_category = 'Hardware & Tools',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE google_maps_category = 'Hardware Store' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND (gm_category LIKE '%hardware%' OR gm_category LIKE '%construction%' OR gm_category LIKE '%tool%'
       OR gm_category LIKE '%plumb%' OR gm_category LIKE '%electric%' OR gm_category LIKE '%paint%'
       OR gm_category LIKE '%carpenter%');

-- Transport & Logistics - Pattern matching
UPDATE businesses b
SET 
  buy_sell_category = 'Transport & Logistics',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE google_maps_category = 'Transport' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND (gm_category LIKE '%car%' OR gm_category LIKE '%auto%' OR gm_category LIKE '%vehicle%'
       OR gm_category LIKE '%mechanic%' OR gm_category LIKE '%repair%' OR gm_category LIKE '%tire%'
       OR gm_category LIKE '%gas%station%' OR gm_category LIKE '%wash%' OR gm_category LIKE '%garage%');

-- Legal Services - Pattern matching
UPDATE businesses b
SET 
  buy_sell_category = 'Notaries & Legal',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE google_maps_category = 'Legal Services' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND (gm_category LIKE '%law%' OR gm_category LIKE '%legal%' OR gm_category LIKE '%notary%'
       OR gm_category LIKE '%advocate%');

-- Finance - Pattern matching (using a buy_sell category that exists)
UPDATE businesses b
SET 
  buy_sell_category = 'Banking & Finance',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE name LIKE '%Notaries%' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND (gm_category LIKE '%bank%' OR gm_category LIKE '%insurance%' OR gm_category LIKE '%financ%'
       OR gm_category LIKE '%money%' OR gm_category LIKE '%forex%' OR gm_category LIKE '%atm%'
       OR gm_category LIKE '%account%');

-- Real Estate - Pattern matching
UPDATE businesses b
SET 
  buy_sell_category = 'Real Estate',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE name LIKE '%Notaries%' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND (gm_category LIKE '%real%estate%' OR gm_category LIKE '%property%');

-- Services - Pattern matching (laundry, cleaning, etc.)
UPDATE businesses b
SET 
  buy_sell_category = 'Home Services',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE google_maps_category = 'Salon' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND (gm_category LIKE '%laundry%' OR gm_category LIKE '%clean%' OR gm_category LIKE '%repair%shop%');

-- Professional Services
UPDATE businesses b
SET 
  buy_sell_category = 'Professional Services',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE google_maps_category = 'Legal Services' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND (gm_category LIKE '%consult%' OR gm_category LIKE '%engineer%' OR gm_category LIKE '%architect%');

-- Retail & Shopping
UPDATE businesses b
SET 
  buy_sell_category = 'Shopping & Retail',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE google_maps_category = 'Supermarket' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND (gm_category LIKE '%shopping%' OR gm_category LIKE '%mall%' OR gm_category LIKE '%jewelry%'
       OR gm_category LIKE '%optical%' OR gm_category LIKE '%book%' OR gm_category LIKE '%furniture%');

-- Media & Advertising
UPDATE businesses b
SET 
  buy_sell_category = 'Media & Advertising',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE google_maps_category = 'Supermarket' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND (gm_category LIKE '%advertis%' OR gm_category LIKE '%print%' OR gm_category LIKE '%media%');

-- Fitness
UPDATE businesses b
SET 
  buy_sell_category = 'Health & Fitness',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE google_maps_category = 'Hospital' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND (gm_category LIKE '%gym%' OR gm_category LIKE '%fitness%' OR gm_category LIKE '%sport%');

-- ============================================================================
-- STEP 4: Add Comments
-- ============================================================================

COMMENT ON COLUMN businesses.gm_category IS 'Original Google Maps category (preserved)';
COMMENT ON COLUMN businesses.buy_sell_category IS 'Standardized category name';
COMMENT ON COLUMN businesses.buy_sell_category_id IS 'FK to buy_sell_categories';

-- ============================================================================
-- STEP 5: Verification
-- ============================================================================

-- Mapping distribution
SELECT 
  buy_sell_category,
  COUNT(*) as businesses,
  COUNT(DISTINCT gm_category) as gm_categories,
  ROUND(COUNT(*)::numeric / (SELECT COUNT(*) FROM businesses WHERE gm_category IS NOT NULL)::numeric * 100, 1) as pct
FROM businesses
WHERE buy_sell_category IS NOT NULL
GROUP BY buy_sell_category
ORDER BY businesses DESC;

-- Unmapped categories
SELECT 
  gm_category,
  COUNT(*) as count
FROM businesses
WHERE buy_sell_category_id IS NULL AND gm_category IS NOT NULL
GROUP BY gm_category
ORDER BY count DESC
LIMIT 20;

-- Overall stats
SELECT 
  COUNT(*) as total,
  COUNT(buy_sell_category_id) as mapped,
  COUNT(*) - COUNT(buy_sell_category_id) as unmapped,
  ROUND(COUNT(buy_sell_category_id)::numeric / COUNT(*)::numeric * 100, 1) as pct_mapped
FROM businesses
WHERE gm_category IS NOT NULL;

COMMIT;
