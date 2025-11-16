BEGIN;

-- =====================================================================
-- Add tag_id column to business table with foreign key constraint
-- =====================================================================
-- This ensures all tags in business table come from business_tags table
-- The tag column (text) will be kept for backward compatibility but
-- tag_id will be the source of truth

-- Step 1: Add tag_id column to business table
ALTER TABLE public.business 
ADD COLUMN IF NOT EXISTS tag_id uuid REFERENCES public.business_tags(id) ON DELETE SET NULL;

-- Step 2: Create index on tag_id for performance
CREATE INDEX IF NOT EXISTS idx_business_tag_id ON public.business(tag_id);

-- Step 3: Populate tag_id from existing tag names
UPDATE public.business b
SET tag_id = bt.id
FROM public.business_tags bt
WHERE b.tag = bt.name
  AND b.tag_id IS NULL;

-- Step 4: Create function to sync tag from tag_id
CREATE OR REPLACE FUNCTION sync_business_tag_from_tag_id()
RETURNS TRIGGER AS $$
BEGIN
  -- When tag_id is set, automatically update tag field
  IF NEW.tag_id IS NOT NULL THEN
    SELECT name INTO NEW.tag
    FROM public.business_tags
    WHERE id = NEW.tag_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create trigger to keep tag field in sync with tag_id
DROP TRIGGER IF EXISTS trigger_sync_business_tag ON public.business;
CREATE TRIGGER trigger_sync_business_tag
BEFORE INSERT OR UPDATE OF tag_id ON public.business
FOR EACH ROW
EXECUTE FUNCTION sync_business_tag_from_tag_id();

-- Step 6: Create function to validate tag updates (ensure they come from business_tags)
CREATE OR REPLACE FUNCTION validate_business_tag()
RETURNS TRIGGER AS $$
BEGIN
  -- If tag is being set directly (not via tag_id), validate it exists
  IF NEW.tag IS NOT NULL AND (NEW.tag_id IS NULL OR OLD.tag IS DISTINCT FROM NEW.tag) THEN
    -- Find matching tag_id
    SELECT id INTO NEW.tag_id
    FROM public.business_tags
    WHERE name = NEW.tag AND is_active = true;
    
    -- If no matching tag found, reject the update
    IF NEW.tag_id IS NULL THEN
      RAISE EXCEPTION 'Invalid tag "%". Tag must exist in business_tags table.', NEW.tag;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create trigger to validate tag updates
DROP TRIGGER IF EXISTS trigger_validate_business_tag ON public.business;
CREATE TRIGGER trigger_validate_business_tag
BEFORE INSERT OR UPDATE OF tag ON public.business
FOR EACH ROW
EXECUTE FUNCTION validate_business_tag();

-- Step 8: Add comment for documentation
COMMENT ON COLUMN public.business.tag_id IS 'Foreign key to business_tags.id - source of truth for business tags';
COMMENT ON COLUMN public.business.tag IS 'Tag name (automatically synced from tag_id) - kept for backward compatibility';

SELECT 'Added tag_id column with foreign key constraint. All tags must now come from business_tags table.' as status;

COMMIT;
