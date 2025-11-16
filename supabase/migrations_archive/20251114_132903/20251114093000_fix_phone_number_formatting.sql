-- Migration: Fix phone number formatting and rename to whatsapp_number
-- 1. Rename phone_number to whatsapp_number in bars table
-- 2. Remove spaces from all phone numbers in bars
-- 3. Remove spaces from owner_whatsapp in business table

BEGIN;

-- ============================================
-- STEP 1: Rename phone_number to whatsapp_number in bars table
-- ============================================

DO $$
BEGIN
  -- Check if phone_number column exists in bars table
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'bars' 
    AND column_name = 'phone_number'
  ) THEN
    -- Rename the column
    ALTER TABLE public.bars 
      RENAME COLUMN phone_number TO whatsapp_number;
    
    RAISE NOTICE 'Renamed bars.phone_number to whatsapp_number';
  END IF;
END $$;

-- Create index for whatsapp number lookups
CREATE INDEX IF NOT EXISTS idx_bars_whatsapp_number
  ON public.bars(whatsapp_number)
  WHERE whatsapp_number IS NOT NULL;

-- ============================================
-- STEP 2: Remove spaces from phone numbers in bars table
-- ============================================

DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- Remove all spaces from whatsapp_number
  UPDATE public.bars 
  SET whatsapp_number = REPLACE(whatsapp_number, ' ', '')
  WHERE whatsapp_number IS NOT NULL 
  AND whatsapp_number LIKE '% %';
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % phone numbers in bars table', updated_count;
END $$;

-- ============================================
-- STEP 3: Remove spaces from owner_whatsapp in business table
-- ============================================

DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'business' 
    AND column_name = 'owner_whatsapp'
  ) THEN
    -- Remove all spaces from owner_whatsapp
    UPDATE public.business 
    SET owner_whatsapp = REPLACE(owner_whatsapp, ' ', '')
    WHERE owner_whatsapp IS NOT NULL 
    AND owner_whatsapp LIKE '% %';
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % owner_whatsapp numbers in business table', updated_count;
  END IF;
END $$;

-- ============================================
-- STEP 4: Summary
-- ============================================

DO $$
DECLARE
  bars_count INTEGER := 0;
  business_owner_count INTEGER := 0;
BEGIN
  -- Count whatsapp numbers in each table
  SELECT COUNT(*) INTO bars_count FROM public.bars WHERE whatsapp_number IS NOT NULL;
  SELECT COUNT(*) INTO business_owner_count FROM public.business WHERE owner_whatsapp IS NOT NULL;
  
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Phone Number Formatting Migration Complete';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Bars with whatsapp_number: %', bars_count;
  RAISE NOTICE 'Business with owner_whatsapp: %', business_owner_count;
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'All phone numbers now formatted without spaces';
  RAISE NOTICE 'bars.phone_number renamed to whatsapp_number';
  RAISE NOTICE '===========================================';
END $$;

COMMIT;
