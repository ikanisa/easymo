-- Migration: Clean duplicate bars records
-- Date: $(date +%Y-%m-%d)
-- Description: Remove duplicate bars based on slug, keeping the first occurrence

BEGIN;

-- Create a temporary table with unique bars (keeping the first occurrence by created_at)
CREATE TEMP TABLE unique_bars AS
SELECT DISTINCT ON (slug) *
FROM public.bars
ORDER BY slug, created_at ASC;

-- Delete all records from bars
DELETE FROM public.bars;

-- Insert back only unique records
INSERT INTO public.bars
SELECT * FROM unique_bars;

-- Drop the temporary table
DROP TABLE unique_bars;

COMMIT;
