-- Add missing columns to farm_synonyms table
-- Fixes: column farm_synonyms_1.locale does not exist

BEGIN;

-- Add locale and category columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'farm_synonyms' 
    AND column_name = 'locale'
  ) THEN
    ALTER TABLE public.farm_synonyms ADD COLUMN locale text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'farm_synonyms' 
    AND column_name = 'category'
  ) THEN
    ALTER TABLE public.farm_synonyms ADD COLUMN category text;
  END IF;
END $$;

-- Ensure phrase column is NOT NULL (if it has data)
DO $$
BEGIN
  -- Only set NOT NULL if there are no NULL values
  IF NOT EXISTS (SELECT 1 FROM public.farm_synonyms WHERE phrase IS NULL) THEN
    ALTER TABLE public.farm_synonyms ALTER COLUMN phrase SET NOT NULL;
  END IF;
END $$;

COMMIT;
