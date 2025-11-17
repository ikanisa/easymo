BEGIN;

-- Seed a dummy Test Business (best-effort). If triggers or schema mismatch prevent insert, ignore.
DO $$
BEGIN
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'business'
    ) THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.business WHERE name = 'Test Business'
      ) THEN
        BEGIN
          INSERT INTO public.business (name, location_text, is_active)
          VALUES ('Test Business', 'Test Location', true);
        EXCEPTION WHEN undefined_column THEN
          -- Fallback to minimal insert
          INSERT INTO public.business (name)
          VALUES ('Test Business');
        END;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Ignore any trigger or schema errors to avoid blocking deployment
    NULL;
  END;
END $$;

-- Seed a dummy Test Bars record (for safe testing) if table exists and not present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'bars'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.bars WHERE name = 'Test Bars'
    ) THEN
      BEGIN
        -- Try comprehensive insert first
        INSERT INTO public.bars (name, location_text, country, city_area, currency, slug)
        VALUES ('Test Bars', 'Test Bars Location', 'Rwanda', 'Kigali', 'RWF', 'test-bars');
      EXCEPTION WHEN undefined_column THEN
        BEGIN
          -- Fallback to slug variant
          INSERT INTO public.bars (name, location_text, slug)
          VALUES ('Test Bars', 'Test Bars Location', 'test-bars');
        EXCEPTION WHEN undefined_column THEN
          -- Minimal insert as a last resort
          INSERT INTO public.bars (name, location_text)
          VALUES ('Test Bars', 'Test Bars Location');
        END;
      END;
    END IF;
  END IF;
END $$;

COMMIT;
