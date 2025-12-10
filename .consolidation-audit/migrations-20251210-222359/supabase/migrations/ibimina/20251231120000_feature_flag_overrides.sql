-- Feature flag override matrix with country and partner scope

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'feature_flags'
  ) THEN
    CREATE TABLE public.feature_flags (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key TEXT NOT NULL,
      is_enabled BOOLEAN NOT NULL DEFAULT false,
      country_id UUID REFERENCES public.countries(id) ON DELETE CASCADE,
      org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
      updated_by UUID REFERENCES auth.users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now()),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now()),
      scope_fingerprint TEXT GENERATED ALWAYS AS (
        CASE
          WHEN org_id IS NOT NULL THEN 'org:' || org_id::text
          WHEN country_id IS NOT NULL THEN 'country:' || country_id::text
          ELSE 'global'
        END
      ) STORED
    );
  END IF;
END $$;

ALTER TABLE public.feature_flags
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'feature_flags_pkey'
      AND conrelid = 'public.feature_flags'::regclass
  ) THEN
    ALTER TABLE public.feature_flags ADD CONSTRAINT feature_flags_pkey PRIMARY KEY (id);
  END IF;
END $$;

ALTER TABLE public.feature_flags
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now());

ALTER TABLE public.feature_flags
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now());

ALTER TABLE public.feature_flags
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

ALTER TABLE public.feature_flags
  ADD COLUMN IF NOT EXISTS country_id UUID REFERENCES public.countries(id) ON DELETE CASCADE;

ALTER TABLE public.feature_flags
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.feature_flags
  ADD COLUMN IF NOT EXISTS key TEXT;

ALTER TABLE public.feature_flags
  ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.feature_flags
  DROP COLUMN IF EXISTS scope_fingerprint;

ALTER TABLE public.feature_flags
  ADD COLUMN scope_fingerprint TEXT GENERATED ALWAYS AS (
    CASE
      WHEN org_id IS NOT NULL THEN 'org:' || org_id::text
      WHEN country_id IS NOT NULL THEN 'country:' || country_id::text
      ELSE 'global'
    END
  ) STORED;

ALTER TABLE public.feature_flags
  ALTER COLUMN key SET NOT NULL;

DROP INDEX IF EXISTS feature_flags_unique_scope_idx;
ALTER TABLE public.feature_flags DROP CONSTRAINT IF EXISTS feature_flags_unique_scope;
ALTER TABLE public.feature_flags
  ADD CONSTRAINT feature_flags_unique_scope UNIQUE (key, scope_fingerprint);

CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON public.feature_flags(key);
CREATE INDEX IF NOT EXISTS idx_feature_flags_country ON public.feature_flags(country_id) WHERE country_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_feature_flags_org ON public.feature_flags(org_id) WHERE org_id IS NOT NULL;

DROP TRIGGER IF EXISTS feature_flags_touch_updated_at ON public.feature_flags;
CREATE TRIGGER feature_flags_touch_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feature_flags_select ON public.feature_flags;
DROP POLICY IF EXISTS feature_flags_manage ON public.feature_flags;

CREATE POLICY feature_flags_select
  ON public.feature_flags
  FOR SELECT
  USING (true);

CREATE POLICY feature_flags_manage
  ON public.feature_flags
  FOR ALL
  USING (public.has_role(auth.uid(), 'SYSTEM_ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'SYSTEM_ADMIN'));

GRANT SELECT ON public.feature_flags TO authenticated;
GRANT ALL ON public.feature_flags TO service_role;

COMMENT ON TABLE public.feature_flags IS 'Feature flag overrides across global, country, and partner scopes.';
COMMENT ON COLUMN public.feature_flags.scope_fingerprint IS 'Deterministic scope identifier used for uniqueness checks.';

-- Seed global defaults
INSERT INTO public.feature_flags (key, is_enabled)
VALUES
  ('ai_agent', false),
  ('ussd_copy_first', true),
  ('offers_marketplace', false),
  ('statements_insights', false),
  ('group_join_requests', false)
ON CONFLICT ON CONSTRAINT feature_flags_unique_scope DO UPDATE
SET is_enabled = EXCLUDED.is_enabled,
    updated_at = timezone('UTC', now()),
    updated_by = NULL;

-- Enable marketplace reporting for Rwanda
INSERT INTO public.feature_flags (key, country_id, is_enabled)
SELECT 'offers_marketplace', id, true
FROM public.countries
WHERE iso3 = 'RWA'
ON CONFLICT ON CONSTRAINT feature_flags_unique_scope DO UPDATE
SET is_enabled = EXCLUDED.is_enabled,
    updated_at = timezone('UTC', now()),
    updated_by = NULL;

-- Pilot ai_agent experiences for launch tenants
INSERT INTO public.feature_flags (key, org_id, is_enabled)
VALUES
  ('ai_agent', 'd781e07d-189d-44f8-bab6-ca60aae0a4cf', true),
  ('ai_agent', '687f4414-c400-4c73-ad41-82da2f6822f9', true),
  ('ai_agent', 'f27b46ee-24cb-4ca2-acf2-38ca857d406b', true)
ON CONFLICT ON CONSTRAINT feature_flags_unique_scope DO UPDATE
SET is_enabled = EXCLUDED.is_enabled,
    updated_at = timezone('UTC', now()),
    updated_by = NULL;
