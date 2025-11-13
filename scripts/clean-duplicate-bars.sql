-- Script to remove duplicate bars (keeping the earliest created one)
-- Generated: 2025-11-12

BEGIN;

-- Identify and delete duplicate bars, keeping only the first occurrence by created_at
WITH duplicates AS (
  SELECT 
    id,
    name,
    ROW_NUMBER() OVER (PARTITION BY name ORDER BY created_at ASC, id ASC) as rn
  FROM public.bars
)
DELETE FROM public.bars
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Show remaining duplicates (should be empty)
SELECT name, COUNT(*) as count
FROM public.bars
GROUP BY name
HAVING COUNT(*) > 1;

COMMIT;
