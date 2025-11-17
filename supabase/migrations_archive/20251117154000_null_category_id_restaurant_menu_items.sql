BEGIN;

-- Ensure category_id is nullable in all environments (older schemas may have NOT NULL)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'restaurant_menu_items'
      AND column_name = 'category_id'
      AND is_nullable = 'NO'
  ) THEN
    EXECUTE 'ALTER TABLE public.restaurant_menu_items ALTER COLUMN category_id DROP NOT NULL';
  END IF;
END $$;

-- Clear category_id content to avoid mismatches with deprecated categories
UPDATE public.restaurant_menu_items
SET category_id = NULL
WHERE category_id IS NOT NULL;

COMMIT;

