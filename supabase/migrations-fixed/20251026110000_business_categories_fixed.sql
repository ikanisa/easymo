BEGIN;

-- Drop existing trigger if it exists before recreating
DROP TRIGGER IF EXISTS update_business_categories_updated_at ON public.business_categories;
DROP TRIGGER IF EXISTS set_business_categories_updated_at ON public.business_categories;

-- Ensure update function exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- business_categories table should already exist from earlier migration
-- Just add any missing columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'business_categories' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE public.business_categories ADD COLUMN sort_order INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'business_categories' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.business_categories ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
END $$;

-- Create the trigger (only once)
CREATE TRIGGER update_business_categories_updated_at
  BEFORE UPDATE ON public.business_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_business_categories_parent ON public.business_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_business_categories_slug ON public.business_categories(slug);
CREATE INDEX IF NOT EXISTS idx_business_categories_active ON public.business_categories(is_active);

COMMIT;
