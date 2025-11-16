-- Minimal business_categories table so legacy cleanup migrations can drop it safely.
CREATE TABLE IF NOT EXISTS public.business_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE,
  label TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.set_business_categories_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_business_categories_updated_at ON public.business_categories;
CREATE TRIGGER set_business_categories_updated_at
  BEFORE UPDATE ON public.business_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.set_business_categories_updated_at();
