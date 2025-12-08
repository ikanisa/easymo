BEGIN;

-- =====================================================
-- FIX PRODUCE_LISTINGS TABLE SCHEMA
-- =====================================================
-- Ensures produce_listings has all required columns
-- before attempting to create indexes
-- =====================================================

-- Add missing columns if they don't exist
ALTER TABLE public.produce_listings 
  ADD COLUMN IF NOT EXISTS tenant_id uuid,
  ADD COLUMN IF NOT EXISTS farm_id uuid;

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'produce_listings_farm_id_fkey'
  ) THEN
    ALTER TABLE public.produce_listings 
      ADD CONSTRAINT produce_listings_farm_id_fkey 
      FOREIGN KEY (farm_id) REFERENCES public.farms (id) ON DELETE CASCADE;
  END IF;
END $$;

-- Now create the indexes that were failing
CREATE INDEX IF NOT EXISTS produce_listings_farm_status_idx 
  ON public.produce_listings (tenant_id, farm_id, status);

CREATE INDEX IF NOT EXISTS produce_listings_tenant_idx 
  ON public.produce_listings (tenant_id);

COMMIT;
