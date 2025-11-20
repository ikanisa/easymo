BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_tenant_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims jsonb;
  candidate text;
BEGIN
  claims := auth.jwt();
  candidate := COALESCE(
    NULLIF(claims ->> 'tenant_id', ''),
    NULLIF(claims ->> 'tenantId', ''),
    NULLIF((claims -> 'app_metadata') ->> 'tenant_id', ''),
    NULLIF((claims -> 'app_metadata') ->> 'tenantId', '')
  );
  IF candidate IS NULL THEN
    RETURN NULL;
  END IF;
  BEGIN
    RETURN candidate::uuid;
  EXCEPTION
    WHEN others THEN
      RETURN NULL;
  END;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles'
  ) THEN
    CREATE TABLE public.profiles (
      user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
      display_name text,
      whatsapp_e164 text UNIQUE,
      locale text NOT NULL DEFAULT 'en',
      role text NOT NULL DEFAULT 'buyer',
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
      updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
    );
  END IF;
END $$;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp_e164 text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'en';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'buyer';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT timezone('utc', now());
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone('utc', now());

CREATE UNIQUE INDEX IF NOT EXISTS profiles_whatsapp_e164_idx
  ON public.profiles (whatsapp_e164)
  WHERE whatsapp_e164 IS NOT NULL;

DROP TRIGGER IF EXISTS set_updated_at_on_profiles ON public.profiles;
CREATE TRIGGER set_updated_at_on_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_self_select'
  ) THEN
    CREATE POLICY "profiles_self_select" ON public.profiles
      FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_self_update'
  ) THEN
    CREATE POLICY "profiles_self_update" ON public.profiles
      FOR UPDATE TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_service_all'
  ) THEN
    CREATE POLICY "profiles_service_all" ON public.profiles
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.farms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  owner_profile_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  region text,
  location jsonb NOT NULL DEFAULT '{}'::jsonb,
  acreage numeric(18,2),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS public.produce_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  display_name text NOT NULL,
  category text NOT NULL,
  unit_type text NOT NULL DEFAULT 'kg',
  default_currency text NOT NULL DEFAULT 'RWF',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.produce_catalog_translations (
  produce_id uuid NOT NULL REFERENCES public.produce_catalog (id) ON DELETE CASCADE,
  locale text NOT NULL,
  display_name text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (produce_id, locale)
);

CREATE TABLE IF NOT EXISTS public.produce_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  farm_id uuid NOT NULL REFERENCES public.farms (id) ON DELETE CASCADE,
  produce_id uuid NOT NULL REFERENCES public.produce_catalog (id) ON DELETE RESTRICT,
  title text,
  description text,
  quantity numeric(18,4) NOT NULL CHECK (quantity > 0),
  unit_type text NOT NULL,
  price_per_unit numeric(18,4) NOT NULL CHECK (price_per_unit >= 0),
  currency text NOT NULL DEFAULT 'RWF',
  harvest_date date,
  status text NOT NULL CHECK (status IN ('draft','active','paused','sold','archived')) DEFAULT 'draft',
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  buyer_profile_id uuid REFERENCES public.profiles (user_id) ON DELETE SET NULL,
  search_embedding vector(1536),
  search_document tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'B')
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.produce_buyers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  profile_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  contact_channels text[] NOT NULL DEFAULT ARRAY[]::text[],
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (tenant_id, profile_id)
);

CREATE TABLE IF NOT EXISTS public.produce_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  buyer_profile_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  listing_id uuid REFERENCES public.produce_listings (id) ON DELETE SET NULL,
  produce_id uuid REFERENCES public.produce_catalog (id) ON DELETE SET NULL,
  quantity numeric(18,4) NOT NULL CHECK (quantity > 0),
  unit_type text NOT NULL,
  currency text NOT NULL DEFAULT 'RWF',
  ceiling_total numeric(18,4) CHECK (ceiling_total IS NULL OR ceiling_total >= 0),
  status text NOT NULL CHECK (status IN ('pending','matched','confirmed','fulfilled','cancelled','expired')) DEFAULT 'pending',
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.produce_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  order_id uuid NOT NULL REFERENCES public.produce_orders (id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.produce_listings (id) ON DELETE CASCADE,
  score numeric(6,5) CHECK (score IS NULL OR (score >= 0 AND score <= 1)),
  status text NOT NULL CHECK (status IN ('suggested','accepted','rejected','expired')) DEFAULT 'suggested',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.produce_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  order_id uuid NOT NULL REFERENCES public.produce_orders (id) ON DELETE CASCADE,
  payer_profile_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE RESTRICT,
  amount numeric(18,4) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'RWF',
  provider text,
  provider_ref text,
  status text NOT NULL CHECK (status IN ('initiated','confirmed','failed','refunded')) DEFAULT 'initiated',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

DROP TRIGGER IF EXISTS set_updated_at_on_farms ON public.farms;
CREATE TRIGGER set_updated_at_on_farms
  BEFORE UPDATE ON public.farms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_on_catalog ON public.produce_catalog;
CREATE TRIGGER set_updated_at_on_catalog
  BEFORE UPDATE ON public.produce_catalog
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_on_catalog_translations ON public.produce_catalog_translations;
CREATE TRIGGER set_updated_at_on_catalog_translations
  BEFORE UPDATE ON public.produce_catalog_translations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_on_listings ON public.produce_listings;
CREATE TRIGGER set_updated_at_on_listings
  BEFORE UPDATE ON public.produce_listings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_on_buyers ON public.produce_buyers;
CREATE TRIGGER set_updated_at_on_buyers
  BEFORE UPDATE ON public.produce_buyers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_on_orders ON public.produce_orders;
CREATE TRIGGER set_updated_at_on_orders
  BEFORE UPDATE ON public.produce_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_on_payments ON public.produce_payments;
CREATE TRIGGER set_updated_at_on_payments
  BEFORE UPDATE ON public.produce_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS farms_owner_idx ON public.farms (owner_profile_id);
CREATE INDEX IF NOT EXISTS farms_tenant_idx ON public.farms (tenant_id);
CREATE INDEX IF NOT EXISTS produce_catalog_category_idx ON public.produce_catalog (category);

-- Add tenant_id column if it doesn't exist
ALTER TABLE public.produce_listings ADD COLUMN IF NOT EXISTS tenant_id uuid;

CREATE INDEX IF NOT EXISTS produce_listings_farm_status_idx ON public.produce_listings (tenant_id, farm_id, status);
CREATE INDEX IF NOT EXISTS produce_listings_produce_idx ON public.produce_listings (produce_id);
CREATE INDEX IF NOT EXISTS produce_listings_search_document_idx ON public.produce_listings USING GIN (search_document);
CREATE INDEX IF NOT EXISTS produce_listings_tags_idx ON public.produce_listings USING GIN (tags);
CREATE INDEX IF NOT EXISTS produce_listings_embedding_ivfflat
  ON public.produce_listings USING ivfflat (search_embedding vector_cosine_ops)
  WITH (lists = 100);
CREATE INDEX IF NOT EXISTS produce_buyers_profile_idx ON public.produce_buyers (profile_id);
CREATE INDEX IF NOT EXISTS produce_orders_status_idx ON public.produce_orders (tenant_id, status);
CREATE INDEX IF NOT EXISTS produce_matches_order_idx ON public.produce_matches (order_id);
CREATE UNIQUE INDEX IF NOT EXISTS produce_matches_unique_order_listing ON public.produce_matches (order_id, listing_id);
CREATE INDEX IF NOT EXISTS produce_payments_order_idx ON public.produce_payments (order_id);

ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produce_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produce_catalog_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produce_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produce_buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produce_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produce_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produce_payments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'farms' AND policyname = 'farms_tenant_manage'
  ) THEN
    CREATE POLICY "farms_tenant_manage" ON public.farms
      FOR ALL TO authenticated
      USING (tenant_id = public.request_tenant_id())
      WITH CHECK (tenant_id = public.request_tenant_id());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'farms' AND policyname = 'farms_service_all'
  ) THEN
    CREATE POLICY "farms_service_all" ON public.farms
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'produce_catalog' AND policyname = 'produce_catalog_read'
  ) THEN
    CREATE POLICY "produce_catalog_read" ON public.produce_catalog
      FOR SELECT TO authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'produce_catalog' AND policyname = 'produce_catalog_service_all'
  ) THEN
    CREATE POLICY "produce_catalog_service_all" ON public.produce_catalog
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'produce_catalog_translations' AND policyname = 'produce_catalog_translations_read'
  ) THEN
    CREATE POLICY "produce_catalog_translations_read" ON public.produce_catalog_translations
      FOR SELECT TO authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'produce_catalog_translations' AND policyname = 'produce_catalog_translations_service_all'
  ) THEN
    CREATE POLICY "produce_catalog_translations_service_all" ON public.produce_catalog_translations
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'produce_listings' AND policyname = 'produce_listings_tenant_manage'
  ) THEN
    CREATE POLICY "produce_listings_tenant_manage" ON public.produce_listings
      FOR ALL TO authenticated
      USING (tenant_id = public.request_tenant_id())
      WITH CHECK (tenant_id = public.request_tenant_id());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'produce_listings' AND policyname = 'produce_listings_service_all'
  ) THEN
    CREATE POLICY "produce_listings_service_all" ON public.produce_listings
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'produce_buyers' AND policyname = 'produce_buyers_tenant_manage'
  ) THEN
    CREATE POLICY "produce_buyers_tenant_manage" ON public.produce_buyers
      FOR ALL TO authenticated
      USING (tenant_id = public.request_tenant_id())
      WITH CHECK (tenant_id = public.request_tenant_id());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'produce_buyers' AND policyname = 'produce_buyers_service_all'
  ) THEN
    CREATE POLICY "produce_buyers_service_all" ON public.produce_buyers
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'produce_orders' AND policyname = 'produce_orders_tenant_manage'
  ) THEN
    CREATE POLICY "produce_orders_tenant_manage" ON public.produce_orders
      FOR ALL TO authenticated
      USING (tenant_id = public.request_tenant_id())
      WITH CHECK (tenant_id = public.request_tenant_id());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'produce_orders' AND policyname = 'produce_orders_service_all'
  ) THEN
    CREATE POLICY "produce_orders_service_all" ON public.produce_orders
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'produce_matches' AND policyname = 'produce_matches_tenant_manage'
  ) THEN
    CREATE POLICY "produce_matches_tenant_manage" ON public.produce_matches
      FOR ALL TO authenticated
      USING (tenant_id = public.request_tenant_id())
      WITH CHECK (tenant_id = public.request_tenant_id());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'produce_matches' AND policyname = 'produce_matches_service_all'
  ) THEN
    CREATE POLICY "produce_matches_service_all" ON public.produce_matches
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'produce_payments' AND policyname = 'produce_payments_tenant_manage'
  ) THEN
    CREATE POLICY "produce_payments_tenant_manage" ON public.produce_payments
      FOR ALL TO authenticated
      USING (tenant_id = public.request_tenant_id())
      WITH CHECK (tenant_id = public.request_tenant_id());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'produce_payments' AND policyname = 'produce_payments_service_all'
  ) THEN
    CREATE POLICY "produce_payments_service_all" ON public.produce_payments
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

COMMIT;
