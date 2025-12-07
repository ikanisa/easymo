-- FIX ALL REMAINING PHONE NUMBERS IN BUSINESSES TABLE
-- Run this entire script in Supabase SQL Editor

-- ============================================================
-- STEP 1: Remove ALL spaces, dashes, dots, parentheses
-- ============================================================
UPDATE businesses
SET phone = REGEXP_REPLACE(phone, '[^0-9+]', '', 'g')
WHERE phone IS NOT NULL
  AND phone ~ '[^0-9+]';

-- ============================================================
-- STEP 2: Fix numbers starting with 0 (10 digits)
-- Example: 0788150100 -> +250788150100
-- ============================================================
UPDATE businesses
SET phone = '+250' || SUBSTRING(phone FROM 2)
WHERE phone IS NOT NULL
  AND phone ~ '^0[0-9]{9}$'
  AND phone NOT LIKE '+250%';

-- ============================================================
-- STEP 3: Fix 9-digit numbers (add +250)
-- Example: 788150100 -> +250788150100
-- ============================================================
UPDATE businesses
SET phone = '+250' || phone
WHERE phone IS NOT NULL
  AND phone ~ '^[782][0-9]{8}$'
  AND phone NOT LIKE '+250%';

-- ============================================================
-- STEP 4: Fix numbers starting with 250 (add +)
-- Example: 250788150100 -> +250788150100
-- ============================================================
UPDATE businesses
SET phone = '+' || phone
WHERE phone IS NOT NULL
  AND phone ~ '^250[0-9]{9}$'
  AND phone NOT LIKE '+%';

-- ============================================================
-- STEP 5: Populate owner_whatsapp for ALL valid phones
-- ============================================================
UPDATE businesses
SET owner_whatsapp = phone
WHERE phone IS NOT NULL
  AND phone LIKE '+250%'
  AND LENGTH(phone) = 13
  AND phone ~ '^\+250[0-9]{9}$';

-- ============================================================
-- STEP 6: Set invalid phone numbers to NULL
-- ============================================================
UPDATE businesses
SET phone = NULL,
    owner_whatsapp = NULL
WHERE phone IS NOT NULL
  AND (
    LENGTH(phone) != 13
    OR phone NOT LIKE '+250%'
    OR phone !~ '^\+250[0-9]{9}$'
  );

-- ============================================================
-- VERIFICATION
-- ============================================================

-- Count of fixed phone numbers
SELECT 'Phone numbers with +250 prefix' as status,
       COUNT(*) as count
FROM businesses
WHERE phone LIKE '+250%';

-- Count of populated owner_whatsapp
SELECT 'owner_whatsapp populated' as status,
       COUNT(*) as count
FROM businesses
WHERE owner_whatsapp IS NOT NULL;

-- Count still needing fixes
SELECT 'Still NULL owner_whatsapp' as status,
       COUNT(*) as count
FROM businesses
WHERE phone IS NOT NULL
  AND owner_whatsapp IS NULL;

-- Sample of fixed records
SELECT name, phone, owner_whatsapp, city
FROM businesses
WHERE phone IS NOT NULL
ORDER BY id DESC
LIMIT 20;

-- Summary by city
SELECT 
    city,
    COUNT(*) as total,
    COUNT(CASE WHEN phone LIKE '+250%' THEN 1 END) as with_valid_phone,
    COUNT(CASE WHEN owner_whatsapp IS NOT NULL THEN 1 END) as with_whatsapp,
    ROUND(100.0 * COUNT(CASE WHEN phone LIKE '+250%' THEN 1 END) / COUNT(*), 1) as percent_valid
FROM businesses
GROUP BY city
ORDER BY total DESC;
