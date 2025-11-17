BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Speed up partial name and address searches on bars
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='bars' AND column_name='name'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_bars_name_trgm ON public.bars USING gin (name gin_trgm_ops)';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='bars' AND column_name='location_text'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_bars_location_text_trgm ON public.bars USING gin (location_text gin_trgm_ops)';
  END IF;
END $$;

COMMIT;

