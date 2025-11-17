BEGIN;

-- 1) Drop view that depends on job_categories_by_country
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname='job_listings_with_country'
  ) THEN
    EXECUTE 'DROP VIEW public.job_listings_with_country';
  END IF;
END $$;

-- 2) Drop country category seeding function if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname='seed_job_categories_for_country'
  ) THEN
    EXECUTE 'DROP FUNCTION public.seed_job_categories_for_country(text)';
  END IF;
END $$;

-- 3) Drop job_categories_by_country table if exists
DROP TABLE IF EXISTS public.job_categories_by_country CASCADE;

-- 4) Drop job_categories table if exists
DROP TABLE IF EXISTS public.job_categories CASCADE;

-- 5) Relax job_listings.category: make nullable and drop category index (we no longer categorize jobs)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='job_listings' AND column_name='category'
  ) THEN
    BEGIN
      EXECUTE 'ALTER TABLE public.job_listings ALTER COLUMN category DROP NOT NULL';
    EXCEPTION WHEN others THEN
      -- ignore if already nullable
      NULL;
    END;
    -- Drop category index if present
    IF EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname='public' AND indexname='job_listings_category_idx'
    ) THEN
      EXECUTE 'DROP INDEX public.job_listings_category_idx';
    END IF;
  END IF;
END $$;

-- 6) Recreate simplified view without categories join
CREATE OR REPLACE VIEW public.job_listings_with_country AS
SELECT 
  jl.*,
  c.name as country_name,
  c.currency_code,
  c.currency_symbol,
  c.flag_emoji
FROM public.job_listings jl
LEFT JOIN public.countries c ON jl.country_code = c.code
WHERE jl.status = 'open'
  AND (jl.expires_at IS NULL OR jl.expires_at > now());

COMMENT ON VIEW public.job_listings_with_country IS 'Job listings with country metadata; categories removed.';

COMMIT;

