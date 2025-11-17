BEGIN;

-- Ensure the legacy column is renamed only if it still exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'restaurant_menu_items'
      AND column_name = 'category'
  ) THEN
    EXECUTE 'ALTER TABLE public.restaurant_menu_items RENAME COLUMN category TO category_name';
  END IF;
END $$;

-- Keep the supporting index in sync, but only when present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'restaurant_menu_items'
      AND indexname = 'idx_restaurant_menu_items_category'
  ) THEN
    EXECUTE 'ALTER INDEX idx_restaurant_menu_items_category RENAME TO idx_restaurant_menu_items_category_name';
  END IF;
END $$;

-- Add the category_id column if it has not been created yet.
ALTER TABLE public.restaurant_menu_items
  ADD COLUMN IF NOT EXISTS category_id UUID;

CREATE INDEX IF NOT EXISTS idx_restaurant_menu_items_category_id
  ON public.restaurant_menu_items(category_id);

COMMENT ON COLUMN public.restaurant_menu_items.category_id IS 'Static UUID representing the menu category (no lookup table required).';
COMMENT ON COLUMN public.restaurant_menu_items.category_name IS 'Display name for the menu category.';

COMMIT;
