-- Migration: Clean up duplicate bars
-- Date: 2025-11-13
-- Description: Remove duplicate bars based on slug, keeping the most recent

BEGIN;

-- Create a temporary table with the IDs to keep (most recent for each slug)
CREATE TEMP TABLE bars_to_keep AS
SELECT DISTINCT ON (slug) id
FROM public.bars
ORDER BY slug, created_at DESC;

-- Delete duplicates (keeping the ones in bars_to_keep)
DELETE FROM public.bars
WHERE id NOT IN (SELECT id FROM bars_to_keep);

-- Verify results
DO $$
DECLARE
  v_duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) - COUNT(DISTINCT slug)
  INTO v_duplicate_count
  FROM public.bars;
  
  IF v_duplicate_count > 0 THEN
    RAISE WARNING 'Still have % duplicates remaining', v_duplicate_count;
  ELSE
    RAISE NOTICE 'Successfully removed all duplicates. Total bars: %', (SELECT COUNT(*) FROM public.bars);
  END IF;
END $$;

COMMIT;
