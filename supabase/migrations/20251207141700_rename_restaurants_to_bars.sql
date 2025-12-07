-- Migration: Rename Restaurants & Cafes to Bars & Restaurants
-- Date: 2025-12-07
-- Purpose: Update category name to better reflect the business types included

BEGIN;

-- Update buy_sell_categories table
UPDATE buy_sell_categories 
SET 
  name = 'Bars & Restaurants',
  updated_at = now()
WHERE key = 'Restaurant';

-- Update businesses table to reflect new name
UPDATE businesses 
SET buy_sell_category = 'Bars & Restaurants'
WHERE buy_sell_category = 'Restaurants & Cafes';

-- Verification
SELECT 
  'Category renamed successfully' as status,
  COUNT(*) as affected_businesses
FROM businesses
WHERE buy_sell_category = 'Bars & Restaurants';

COMMIT;
