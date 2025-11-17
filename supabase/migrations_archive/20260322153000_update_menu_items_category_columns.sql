BEGIN;

-- Add category_name and category_id columns to public.menu_items
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'menu_items' AND column_name = 'category'
  ) THEN
    EXECUTE 'ALTER TABLE public.menu_items RENAME COLUMN category TO category_name';
  END IF;
END $$;

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS category_id UUID,
  ADD COLUMN IF NOT EXISTS currency TEXT;

-- Helpful indexes (guard existence of target columns)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'menu_items' AND column_name = 'category_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON public.menu_items(category_id)';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'menu_items' AND column_name = 'category_name'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_menu_items_category_name ON public.menu_items(category_name)';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'menu_items' AND column_name = 'category_id'
  ) THEN
    EXECUTE format('COMMENT ON COLUMN public.menu_items.category_id IS %L', 'Static UUID representing menu category (no separate table required)');
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'menu_items' AND column_name = 'category_name'
  ) THEN
    EXECUTE format('COMMENT ON COLUMN public.menu_items.category_name IS %L', 'Display name of the menu category');
  END IF;
END $$;

COMMIT;
