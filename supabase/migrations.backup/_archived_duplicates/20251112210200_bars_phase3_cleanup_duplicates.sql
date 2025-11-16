-- =====================================================
-- PHASE 3: Clean up duplicate bars
-- =====================================================
-- Purpose: Remove duplicate bars keeping the oldest record
-- Safe to run: Only deletes duplicates, preserves one record per unique name

BEGIN;

-- Create temporary table to identify duplicates
CREATE TEMP TABLE bars_to_keep AS
SELECT DISTINCT ON (LOWER(TRIM(name)))
    id
FROM public.bars
ORDER BY LOWER(TRIM(name)), created_at ASC;

-- Delete duplicates (keep oldest record per name)
DELETE FROM public.bars
WHERE id NOT IN (SELECT id FROM bars_to_keep);

-- Report on cleanup
DO $$
DECLARE
    v_deleted_count integer;
    v_remaining_count integer;
BEGIN
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    SELECT COUNT(*) INTO v_remaining_count FROM public.bars;
    
    RAISE NOTICE 'Bars cleanup complete:';
    RAISE NOTICE '- Duplicates removed: %', v_deleted_count;
    RAISE NOTICE '- Total bars remaining: %', v_remaining_count;
END $$;

COMMIT;
