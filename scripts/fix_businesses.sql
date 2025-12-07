-- FIX BUSINESSES DATABASE - SQL SCRIPT
-- Run this in Supabase SQL Editor

-- ============================================================
-- STEP 1: Fix phone numbers with spaces/dashes
-- ============================================================

-- Remove spaces, dashes, parentheses from phone numbers
UPDATE businesses
SET phone = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '(', ''), ')', ''), '.', '')
WHERE phone IS NOT NULL
  AND (phone LIKE '% %' OR phone LIKE '%-%' OR phone LIKE '%(%' OR phone LIKE '%.%');

-- ============================================================
-- STEP 2: Add +250 prefix to numbers without it
-- ============================================================

-- Numbers starting with 0 (remove 0, add +250)
UPDATE businesses
SET phone = '+250' || SUBSTRING(phone FROM 2)
WHERE phone IS NOT NULL
  AND phone ~ '^0[0-9]{9}$'
  AND phone NOT LIKE '+250%';

-- Numbers starting with 7, 8, or 2 (add +250)
UPDATE businesses
SET phone = '+250' || phone
WHERE phone IS NOT NULL
  AND phone ~ '^[782][0-9]{8}$'
  AND phone NOT LIKE '+250%';

-- Numbers starting with 250 (add +)
UPDATE businesses
SET phone = '+' || phone
WHERE phone IS NOT NULL
  AND phone ~ '^250[0-9]{9}$'
  AND phone NOT LIKE '+250%';

-- ============================================================
-- STEP 3: Populate owner_whatsapp from phone
-- ============================================================

UPDATE businesses
SET owner_whatsapp = phone
WHERE phone IS NOT NULL
  AND phone LIKE '+250%'
  AND LENGTH(phone) = 13
  AND (owner_whatsapp IS NULL OR owner_whatsapp = '');

-- ============================================================
-- STEP 4: Set invalid phone numbers to NULL
-- ============================================================

UPDATE businesses
SET phone = NULL
WHERE phone IS NOT NULL
  AND (
    LENGTH(phone) != 13
    OR phone NOT LIKE '+250%'
    OR phone !~ '^\+250[0-9]{9}$'
  );

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Count businesses with valid phone numbers
SELECT 
    'Valid phones' as check_type,
    COUNT(*) as count 
FROM businesses 
WHERE phone LIKE '+250%' AND LENGTH(phone) = 13;

-- Count businesses with owner_whatsapp
SELECT 
    'Has owner_whatsapp' as check_type,
    COUNT(*) as count 
FROM businesses 
WHERE owner_whatsapp IS NOT NULL;

-- Count businesses with coordinates
SELECT 
    'Has coordinates' as check_type,
    COUNT(*) as count 
FROM businesses 
WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- Count businesses missing coordinates
SELECT 
    'Missing coordinates' as check_type,
    COUNT(*) as count 
FROM businesses 
WHERE (lat IS NULL OR lng IS NULL) AND address IS NOT NULL;

-- Sample of fixed phone numbers
SELECT 
    name,
    phone,
    owner_whatsapp,
    city
FROM businesses
WHERE phone LIKE '+250%'
LIMIT 10;

-- ============================================================
-- SUMMARY
-- ============================================================

SELECT 
    city,
    COUNT(*) as total_businesses,
    COUNT(CASE WHEN phone LIKE '+250%' THEN 1 END) as with_phone,
    COUNT(CASE WHEN owner_whatsapp IS NOT NULL THEN 1 END) as with_whatsapp,
    COUNT(CASE WHEN lat IS NOT NULL THEN 1 END) as with_coordinates
FROM businesses
GROUP BY city
ORDER BY total_businesses DESC;
