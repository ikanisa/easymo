BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='businesses' AND column_name='tags'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS businesses_tags_gin ON public.businesses USING gin ((tags));';
  END IF;
EXCEPTION WHEN others THEN
  -- ignore if index already exists or column not suitable
  NULL;
END$$;

CREATE INDEX IF NOT EXISTS businesses_category_idx ON public.businesses USING btree (category);
CREATE INDEX IF NOT EXISTS businesses_region_idx ON public.businesses USING btree (region);

COMMIT;

