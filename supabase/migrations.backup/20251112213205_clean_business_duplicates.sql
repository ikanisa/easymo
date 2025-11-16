-- Migration: Clean duplicate business records
-- Date: $(date +%Y-%m-%d)
-- Description: Remove duplicate businesses based on name and location_text, keeping the first occurrence

BEGIN;

-- Create a temporary table with unique businesses (keeping the first occurrence by created_at)
CREATE TEMP TABLE unique_businesses AS
SELECT DISTINCT ON (name, COALESCE(location_text, '')) *
FROM public.business
ORDER BY name, COALESCE(location_text, ''), created_at ASC;

-- Delete all records from business
DELETE FROM public.business;

-- Insert back only unique records
INSERT INTO public.business
SELECT * FROM unique_businesses;

-- Drop the temporary table
DROP TABLE unique_businesses;

COMMIT;
