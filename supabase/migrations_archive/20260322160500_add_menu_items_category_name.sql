BEGIN;

-- Ensure public.menu_items has a textual category_name column alongside category_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'menu_items' AND column_name = 'category_name'
  ) THEN
    ALTER TABLE public.menu_items
      ADD COLUMN category_name TEXT;
  END IF;
END $$;

-- Helpful index for filtering by category_name when present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'menu_items' AND indexname = 'idx_menu_items_category_name'
  ) THEN
    BEGIN
      CREATE INDEX idx_menu_items_category_name ON public.menu_items(category_name);
    EXCEPTION WHEN undefined_column THEN
      -- Column might not exist on some environments; skip
      NULL;
    END;
  END IF;
END $$;

COMMENT ON COLUMN public.menu_items.category_name IS 'Display name of the menu category (no separate categories table).';

COMMIT;

