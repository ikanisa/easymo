-- =====================================================================
-- BUSINESSES TABLE CLEANUP - FINAL VERIFICATION
-- =====================================================================
-- Run this to verify all data is properly filled
-- =====================================================================

-- Check current status
SELECT 
  '=== DATA QUALITY REPORT ===' as report;

SELECT 
  COUNT(*) as total_businesses,
  COUNT(buy_sell_category) as has_category,
  COUNT(owner_whatsapp) as has_whatsapp,
  COUNT(phone) as has_phone,
  COUNT(CASE WHEN lat IS NOT NULL AND lng IS NOT NULL THEN 1 END) as has_coordinates,
  COUNT(CASE WHEN tags IS NOT NULL AND array_length(tags, 1) > 0 THEN 1 END) as has_tags,
  ROUND(100.0 * COUNT(buy_sell_category) / COUNT(*), 1) as pct_categorized,
  ROUND(100.0 * COUNT(owner_whatsapp) / COUNT(*), 1) as pct_has_whatsapp,
  ROUND(100.0 * COUNT(CASE WHEN lat IS NOT NULL AND lng IS NOT NULL THEN 1 END) / COUNT(*), 1) as pct_geocoded,
  ROUND(100.0 * COUNT(CASE WHEN tags IS NOT NULL AND array_length(tags, 1) > 0 THEN 1 END) / COUNT(*), 1) as pct_tagged
FROM businesses;

-- Category distribution
SELECT 
  '=== CATEGORY DISTRIBUTION ===' as report;

SELECT 
  buy_sell_category,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM businesses), 1) as percentage
FROM businesses
GROUP BY buy_sell_category
ORDER BY count DESC;

-- Businesses still missing data
SELECT 
  '=== MISSING DATA ===' as report;

SELECT 
  COUNT(*) as missing_category
FROM businesses
WHERE buy_sell_category IS NULL;

SELECT 
  COUNT(*) as missing_whatsapp
FROM businesses
WHERE owner_whatsapp IS NULL;

SELECT 
  COUNT(*) as missing_coordinates,
  array_agg(country ORDER BY country) as countries
FROM businesses
WHERE (lat IS NULL OR lng IS NULL)
GROUP BY country
ORDER BY COUNT(*) DESC
LIMIT 10;
