-- Migration: Add country codes to phone numbers
-- Normalize all phone numbers to start with country code based on country column
-- Rwanda: +250, Malta: +356

BEGIN;

-- ============================================
-- STEP 1: Add country codes to business.owner_whatsapp
-- ============================================

DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- Rwanda: Add +250 to numbers that don't start with + or 250
  UPDATE public.business 
  SET owner_whatsapp = '+250' || owner_whatsapp
  WHERE country = 'Rwanda'
  AND owner_whatsapp IS NOT NULL
  AND owner_whatsapp ~ '^[0-9]'
  AND NOT owner_whatsapp LIKE '+%'
  AND NOT owner_whatsapp LIKE '250%';
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Added +250 to % numbers in business table', updated_count;
  
  -- Rwanda: Fix numbers starting with 250 but missing +
  UPDATE public.business 
  SET owner_whatsapp = '+' || owner_whatsapp
  WHERE country = 'Rwanda'
  AND owner_whatsapp IS NOT NULL
  AND owner_whatsapp LIKE '250%'
  AND NOT owner_whatsapp LIKE '+%';
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Added + prefix to % numbers in business table', updated_count;
END $$;

-- ============================================
-- STEP 2: Add country codes to bars.whatsapp_number
-- ============================================

DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- Rwanda: Add +250 to numbers that don't start with + or 250
  UPDATE public.bars 
  SET whatsapp_number = '+250' || whatsapp_number
  WHERE country IN ('Rwanda', 'RW')
  AND whatsapp_number IS NOT NULL
  AND whatsapp_number ~ '^[0-9]'
  AND NOT whatsapp_number LIKE '+%'
  AND NOT whatsapp_number LIKE '250%';
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Added +250 to % numbers in bars table (Rwanda)', updated_count;
  
  -- Rwanda: Fix numbers starting with 250 but missing +
  UPDATE public.bars 
  SET whatsapp_number = '+' || whatsapp_number
  WHERE country IN ('Rwanda', 'RW')
  AND whatsapp_number IS NOT NULL
  AND whatsapp_number LIKE '250%'
  AND NOT whatsapp_number LIKE '+%';
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Added + prefix to % numbers in bars table (Rwanda)', updated_count;
  
  -- Malta: Add +356 to numbers that don't start with + or 356
  UPDATE public.bars 
  SET whatsapp_number = '+356' || whatsapp_number
  WHERE country IN ('Malta', 'Malта')
  AND whatsapp_number IS NOT NULL
  AND whatsapp_number ~ '^[0-9]'
  AND NOT whatsapp_number LIKE '+%'
  AND NOT whatsapp_number LIKE '356%';
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Added +356 to % numbers in bars table (Malta)', updated_count;
  
  -- Malta: Fix numbers starting with 356 but missing +
  UPDATE public.bars 
  SET whatsapp_number = '+' || whatsapp_number
  WHERE country IN ('Malta', 'Malта')
  AND whatsapp_number IS NOT NULL
  AND whatsapp_number LIKE '356%'
  AND NOT whatsapp_number LIKE '+%';
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Added + prefix to % numbers in bars table (Malta)', updated_count;
END $$;

-- ============================================
-- STEP 3: Fix country name typo (Malта → Malta)
-- ============================================

UPDATE public.bars 
SET country = 'Malta'
WHERE country = 'Malта';

-- ============================================
-- STEP 4: Summary
-- ============================================

DO $$
DECLARE
  business_with_codes INTEGER := 0;
  bars_with_codes INTEGER := 0;
  business_rwanda INTEGER := 0;
  bars_rwanda INTEGER := 0;
  bars_malta INTEGER := 0;
BEGIN
  -- Count phone numbers with country codes
  SELECT COUNT(*) INTO business_with_codes 
  FROM public.business 
  WHERE owner_whatsapp LIKE '+%';
  
  SELECT COUNT(*) INTO bars_with_codes 
  FROM public.bars 
  WHERE whatsapp_number LIKE '+%';
  
  -- Count by country
  SELECT COUNT(*) INTO business_rwanda
  FROM public.business 
  WHERE country = 'Rwanda' AND owner_whatsapp LIKE '+250%';
  
  SELECT COUNT(*) INTO bars_rwanda
  FROM public.bars 
  WHERE country IN ('Rwanda', 'RW') AND whatsapp_number LIKE '+250%';
  
  SELECT COUNT(*) INTO bars_malta
  FROM public.bars 
  WHERE country = 'Malta' AND whatsapp_number LIKE '+356%';
  
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Country Code Normalization Complete';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Business: % with country codes', business_with_codes;
  RAISE NOTICE '  - Rwanda (+250): %', business_rwanda;
  RAISE NOTICE 'Bars: % with country codes', bars_with_codes;
  RAISE NOTICE '  - Rwanda (+250): %', bars_rwanda;
  RAISE NOTICE '  - Malta (+356): %', bars_malta;
  RAISE NOTICE '===========================================';
END $$;

COMMIT;
