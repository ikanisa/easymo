-- Migrate phone numbers to owner_whatsapp and clean up formatting
-- Remove spaces between digits

BEGIN;

-- Update owner_whatsapp from phone column, removing all spaces
UPDATE public.businesses
SET owner_whatsapp = REPLACE(phone, ' ', '')
WHERE phone IS NOT NULL 
  AND phone != ''
  AND (owner_whatsapp IS NULL OR owner_whatsapp = '');

-- Also clean up existing owner_whatsapp values that have spaces
UPDATE public.businesses
SET owner_whatsapp = REPLACE(owner_whatsapp, ' ', '')
WHERE owner_whatsapp IS NOT NULL 
  AND owner_whatsapp LIKE '% %';

-- Clean up phone column to remove spaces as well
UPDATE public.businesses
SET phone = REPLACE(phone, ' ', '')
WHERE phone IS NOT NULL 
  AND phone LIKE '% %';

-- Log the migration
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM public.businesses
  WHERE owner_whatsapp IS NOT NULL AND owner_whatsapp != '';
  
  RAISE NOTICE 'Migrated phone numbers: % businesses now have owner_whatsapp', updated_count;
END $$;

COMMIT;
