-- Migration: Add Missing Categories and Complete Business Mapping
-- Date: 2025-12-07
-- Purpose: Add 3 new buy_sell_categories and map remaining 786 unmapped businesses

BEGIN;

-- ============================================================================
-- STEP 1: Add New buy_sell_categories
-- ============================================================================

-- Real Estate & Construction
INSERT INTO buy_sell_categories (
  id, key, name, icon, display_order, is_active, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  'Real Estate & Construction',
  'Real Estate & Construction',
  '🏗️',
  18,
  true,
  now(),
  now()
) ON CONFLICT (key) DO NOTHING;

-- Other Services (General Services)
INSERT INTO buy_sell_categories (
  id, key, name, icon, display_order, is_active, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  'Other Services',
  'Other Services',
  '🔧',
  19,
  true,
  now(),
  now()
) ON CONFLICT (key) DO NOTHING;

-- Accountants & Consultants (Professional Services)
INSERT INTO buy_sell_categories (
  id, key, name, icon, display_order, is_active, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  'Accountants & Consultants',
  'Accountants & Consultants',
  '💼',
  20,
  true,
  now(),
  now()
) ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- STEP 2: Map Night Clubs to Bars & Restaurants
-- ============================================================================

UPDATE businesses 
SET 
  buy_sell_category = 'Restaurants & Cafes',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE key = 'Restaurant' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND gm_category IN ('night_club', 'nightclub', 'night club', 'pub');

-- ============================================================================
-- STEP 3: Map Real Estate & Construction Categories
-- ============================================================================

UPDATE businesses 
SET 
  buy_sell_category = 'Real Estate & Construction',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE key = 'Real Estate & Construction' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND gm_category IN ('real estate', 'real_estate', 'real estate agency', 'real_estate_agency',
                      'painter', 'architect', 'engineer', 'construction', 'plumber', 'electrician');

-- Pattern matching for construction-related
UPDATE businesses 
SET 
  buy_sell_category = 'Real Estate & Construction',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE key = 'Real Estate & Construction' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND (gm_category LIKE '%real%estate%' OR gm_category LIKE '%construct%' 
       OR gm_category LIKE '%architect%' OR gm_category LIKE '%engineer%'
       OR gm_category LIKE '%painter%');

-- ============================================================================
-- STEP 4: Map Other Services Categories
-- ============================================================================

UPDATE businesses 
SET 
  buy_sell_category = 'Other Services',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE key = 'Other Services' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND gm_category IN ('gym', 'fitness', 'cleaning service', 'cleaning_service', 
                      'advertising', 'laundry', 'dry cleaning', 'dry_cleaning',
                      'printing', 'print', 'media');

-- Pattern matching for services
UPDATE businesses 
SET 
  buy_sell_category = 'Other Services',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE key = 'Other Services' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND (gm_category LIKE '%gym%' OR gm_category LIKE '%fitness%' 
       OR gm_category LIKE '%clean%' OR gm_category LIKE '%laundry%'
       OR gm_category LIKE '%advertis%' OR gm_category LIKE '%print%'
       OR gm_category LIKE '%media%');

-- ============================================================================
-- STEP 5: Map Accountants & Consultants
-- ============================================================================

UPDATE businesses 
SET 
  buy_sell_category = 'Accountants & Consultants',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE key = 'Accountants & Consultants' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND gm_category IN ('accountant', 'accounting', 'consultant', 'consultancy',
                      'financial advisor', 'financial_advisor');

-- Pattern matching for professional services
UPDATE businesses 
SET 
  buy_sell_category = 'Accountants & Consultants',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE key = 'Accountants & Consultants' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND (gm_category LIKE '%account%' OR gm_category LIKE '%consult%' 
       OR gm_category LIKE '%advisor%' OR gm_category LIKE '%professional%');

-- ============================================================================
-- STEP 6: Catch any remaining service-related businesses
-- ============================================================================

-- Map remaining repair/service shops to Other Services
UPDATE businesses 
SET 
  buy_sell_category = 'Other Services',
  buy_sell_category_id = (SELECT id FROM buy_sell_categories WHERE key = 'Other Services' LIMIT 1)
WHERE buy_sell_category_id IS NULL
  AND (gm_category LIKE '%service%' OR gm_category LIKE '%repair%shop%');

-- ============================================================================
-- STEP 7: Verification Queries
-- ============================================================================

-- Show new category mappings
SELECT 
  buy_sell_category,
  COUNT(*) as businesses,
  COUNT(DISTINCT gm_category) as gm_categories,
  ROUND(COUNT(*)::numeric / (SELECT COUNT(*) FROM businesses WHERE gm_category IS NOT NULL)::numeric * 100, 1) as pct
FROM businesses
WHERE buy_sell_category IS NOT NULL
  AND buy_sell_category IN ('Real Estate & Construction', 'Other Services', 'Accountants & Consultants', 'Restaurants & Cafes')
GROUP BY buy_sell_category
ORDER BY businesses DESC;

-- Show remaining unmapped (should be very few now)
SELECT 
  gm_category,
  COUNT(*) as count
FROM businesses
WHERE buy_sell_category_id IS NULL AND gm_category IS NOT NULL
GROUP BY gm_category
ORDER BY count DESC
LIMIT 20;

-- Overall final stats
SELECT 
  COUNT(*) as total_businesses,
  COUNT(buy_sell_category_id) as mapped,
  COUNT(*) - COUNT(buy_sell_category_id) as unmapped,
  ROUND(COUNT(buy_sell_category_id)::numeric / COUNT(*)::numeric * 100, 1) as pct_mapped
FROM businesses
WHERE gm_category IS NOT NULL;

-- Show all categories with business counts
SELECT 
  buy_sell_category,
  COUNT(*) as count,
  ROUND(COUNT(*)::numeric / (SELECT COUNT(*) FROM businesses WHERE gm_category IS NOT NULL)::numeric * 100, 1) as pct
FROM businesses
WHERE buy_sell_category IS NOT NULL
GROUP BY buy_sell_category
ORDER BY count DESC;

COMMIT;
