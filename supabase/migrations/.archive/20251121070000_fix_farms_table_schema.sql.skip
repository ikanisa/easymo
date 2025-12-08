BEGIN;

-- =====================================================
-- FIX FARMS TABLE SCHEMA - November 21, 2025
-- =====================================================
-- Adds missing columns expected by farmer agent code
-- Error: "column farms.farm_name does not exist"
-- =====================================================

-- Add farm_name column (code expects this instead of just 'name')
ALTER TABLE public.farms ADD COLUMN IF NOT EXISTS farm_name text;

-- Populate farm_name from existing name column
UPDATE public.farms SET farm_name = name WHERE farm_name IS NULL;

-- Make farm_name NOT NULL
ALTER TABLE public.farms ALTER COLUMN farm_name SET NOT NULL;

-- Add missing farmer-specific columns that the AI agent expects
ALTER TABLE public.farms ADD COLUMN IF NOT EXISTS district text;
ALTER TABLE public.farms ADD COLUMN IF NOT EXISTS sector text;
ALTER TABLE public.farms ADD COLUMN IF NOT EXISTS hectares numeric(10,2);
ALTER TABLE public.farms ADD COLUMN IF NOT EXISTS commodities text[];
ALTER TABLE public.farms ADD COLUMN IF NOT EXISTS certifications text[];
ALTER TABLE public.farms ADD COLUMN IF NOT EXISTS irrigation boolean DEFAULT false;

-- Create index on farm_name for faster lookups
CREATE INDEX IF NOT EXISTS idx_farms_farm_name ON public.farms(farm_name);

-- Reload schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;
