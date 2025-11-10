BEGIN;

-- Helper functions for workspace and organization scoping ------------------------------------
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT public.safe_cast_uuid(public.auth_claim('org_id'));
$$;
GRANT EXECUTE ON FUNCTION public.current_org_id() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.current_workspace_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT public.safe_cast_uuid(public.auth_claim('workspace_id'));
$$;
GRANT EXECUTE ON FUNCTION public.current_workspace_id() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.video_scope_allows_access(target_org uuid, target_workspace uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    public.is_admin()
    OR (
      (
        target_org IS NOT NULL
        AND (
          public.current_org_id() = target_org
          OR EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(coalesce(auth.jwt()->'org_ids', '[]'::jsonb)) AS payload(value)
            WHERE public.safe_cast_uuid(payload.value) = target_org
          )
        )
      )
      OR (
        target_workspace IS NOT NULL
        AND (
          public.current_workspace_id() = target_workspace
          OR EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(coalesce(auth.jwt()->'workspace_ids', '[]'::jsonb)) AS payload(value)
            WHERE public.safe_cast_uuid(payload.value) = target_workspace
          )
        )
      )
    );
$$;
GRANT EXECUTE ON FUNCTION public.video_scope_allows_access(uuid, uuid) TO anon, authenticated, service_role;

-- Enum definitions ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'figure_status') THEN
    CREATE TYPE public.figure_status AS ENUM ('draft', 'active', 'archived');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'figure_asset_kind') THEN
    CREATE TYPE public.figure_asset_kind AS ENUM ('image', 'video', 'audio', 'script', 'document', 'metadata');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'brand_guide_status') THEN
    CREATE TYPE public.brand_guide_status AS ENUM ('draft', 'published', 'archived');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'video_campaign_status') THEN
    CREATE TYPE public.video_campaign_status AS ENUM ('draft', 'scheduled', 'rendering', 'delivered', 'archived');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'script_status') THEN
    CREATE TYPE public.script_status AS ENUM ('draft', 'approved', 'retired');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'video_job_status') THEN
    CREATE TYPE public.video_job_status AS ENUM ('queued', 'running', 'succeeded', 'failed', 'cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'video_job_kind') THEN
    CREATE TYPE public.video_job_kind AS ENUM ('render', 'revision', 'distribution');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'edit_status') THEN
    CREATE TYPE public.edit_status AS ENUM ('pending', 'applied', 'rejected');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'approval_status') THEN
    CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END $$;

-- Core tables ---------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.figures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  slug text UNIQUE NOT NULL,
  display_name text NOT NULL,
  description text,
  persona_tags text[] DEFAULT ARRAY[]::text[],
  voice_id text,
  default_locale text NOT NULL DEFAULT 'en-US',
  status public.figure_status NOT NULL DEFAULT 'draft',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.figure_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  figure_id uuid REFERENCES public.figures(id) ON DELETE CASCADE,
  org_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  asset_kind public.figure_asset_kind NOT NULL,
  storage_path text NOT NULL,
  duration_seconds numeric,
  checksum text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.brand_guides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  title text NOT NULL,
  summary text,
  tone_words text[] DEFAULT ARRAY[]::text[],
  color_palette jsonb NOT NULL DEFAULT '{}'::jsonb,
  typography jsonb NOT NULL DEFAULT '{}'::jsonb,
  messaging_pillars jsonb NOT NULL DEFAULT '[]'::jsonb,
  status public.brand_guide_status NOT NULL DEFAULT 'draft',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  sku text,
  name text NOT NULL,
  summary text,
  category text,
  price jsonb NOT NULL DEFAULT '{}'::jsonb,
  media jsonb NOT NULL DEFAULT '[]'::jsonb,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  objective text,
  status public.video_campaign_status NOT NULL DEFAULT 'draft',
  primary_figure_id uuid REFERENCES public.figures(id) ON DELETE SET NULL,
  launch_at timestamptz,
  conclude_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,
  figure_id uuid REFERENCES public.figures(id) ON DELETE SET NULL,
  org_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  version integer NOT NULL DEFAULT 1,
  title text,
  language text NOT NULL DEFAULT 'en-US',
  status public.script_status NOT NULL DEFAULT 'draft',
  body jsonb NOT NULL DEFAULT '[]'::jsonb,
  prompts jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  script_id uuid REFERENCES public.scripts(id) ON DELETE SET NULL,
  job_kind public.video_job_kind NOT NULL DEFAULT 'render',
  status public.video_job_status NOT NULL DEFAULT 'queued',
  priority integer NOT NULL DEFAULT 0,
  requested_by uuid,
  requested_at timestamptz NOT NULL DEFAULT now(),
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE,
  script_id uuid REFERENCES public.scripts(id) ON DELETE SET NULL,
  org_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  editor_id uuid,
  status public.edit_status NOT NULL DEFAULT 'pending',
  diff jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE,
  script_id uuid REFERENCES public.scripts(id) ON DELETE SET NULL,
  org_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  approver_id uuid,
  status public.approval_status NOT NULL DEFAULT 'pending',
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  requested_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

-- Indexes ------------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS figures_org_workspace_idx ON public.figures (org_id, workspace_id);
CREATE INDEX IF NOT EXISTS figure_assets_figure_idx ON public.figure_assets (figure_id);
CREATE INDEX IF NOT EXISTS brand_guides_org_workspace_idx ON public.brand_guides (org_id, workspace_id);
CREATE INDEX IF NOT EXISTS products_org_workspace_idx ON public.products (org_id, workspace_id);
CREATE INDEX IF NOT EXISTS campaigns_org_workspace_idx ON public.campaigns (org_id, workspace_id);
CREATE INDEX IF NOT EXISTS campaigns_primary_figure_idx ON public.campaigns (primary_figure_id);
CREATE INDEX IF NOT EXISTS scripts_campaign_idx ON public.scripts (campaign_id);
CREATE INDEX IF NOT EXISTS scripts_org_workspace_idx ON public.scripts (org_id, workspace_id);
CREATE INDEX IF NOT EXISTS jobs_org_workspace_idx ON public.jobs (org_id, workspace_id);
CREATE INDEX IF NOT EXISTS jobs_status_idx ON public.jobs (status);
CREATE INDEX IF NOT EXISTS edits_job_idx ON public.edits (job_id);
CREATE INDEX IF NOT EXISTS approvals_job_idx ON public.approvals (job_id);

-- Storage buckets ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
SELECT 'figures', 'figures', false
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'figures');

INSERT INTO storage.buckets (id, name, public)
SELECT 'products', 'products', false
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'products');

INSERT INTO storage.buckets (id, name, public)
SELECT 'masters', 'masters', false
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'masters');

INSERT INTO storage.buckets (id, name, public)
SELECT 'whatsapp', 'whatsapp', false
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'whatsapp');

INSERT INTO storage.buckets (id, name, public)
SELECT 'captions', 'captions', false
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'captions');

INSERT INTO storage.buckets (id, name, public)
SELECT 'provenance', 'provenance', false
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'provenance');

-- RLS enablement ---------------------------------------------------------------------------
ALTER TABLE public.figures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.figure_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.figures FORCE ROW LEVEL SECURITY;
ALTER TABLE public.figure_assets FORCE ROW LEVEL SECURITY;
ALTER TABLE public.brand_guides FORCE ROW LEVEL SECURITY;
ALTER TABLE public.products FORCE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns FORCE ROW LEVEL SECURITY;
ALTER TABLE public.scripts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.edits FORCE ROW LEVEL SECURITY;
ALTER TABLE public.approvals FORCE ROW LEVEL SECURITY;

-- RLS policies -----------------------------------------------------------------------------
CREATE POLICY figures_access_policy ON public.figures
  FOR ALL
  USING (public.video_scope_allows_access(org_id, workspace_id))
  WITH CHECK (public.video_scope_allows_access(org_id, workspace_id));

CREATE POLICY figure_assets_access_policy ON public.figure_assets
  FOR ALL
  USING (public.video_scope_allows_access(org_id, workspace_id))
  WITH CHECK (public.video_scope_allows_access(org_id, workspace_id));

CREATE POLICY brand_guides_access_policy ON public.brand_guides
  FOR ALL
  USING (public.video_scope_allows_access(org_id, workspace_id))
  WITH CHECK (public.video_scope_allows_access(org_id, workspace_id));

CREATE POLICY products_access_policy ON public.products
  FOR ALL
  USING (public.video_scope_allows_access(org_id, workspace_id))
  WITH CHECK (public.video_scope_allows_access(org_id, workspace_id));

CREATE POLICY campaigns_access_policy ON public.campaigns
  FOR ALL
  USING (public.video_scope_allows_access(org_id, workspace_id))
  WITH CHECK (public.video_scope_allows_access(org_id, workspace_id));

CREATE POLICY scripts_access_policy ON public.scripts
  FOR ALL
  USING (public.video_scope_allows_access(org_id, workspace_id))
  WITH CHECK (public.video_scope_allows_access(org_id, workspace_id));

CREATE POLICY jobs_access_policy ON public.jobs
  FOR ALL
  USING (public.video_scope_allows_access(org_id, workspace_id))
  WITH CHECK (public.video_scope_allows_access(org_id, workspace_id));

CREATE POLICY edits_access_policy ON public.edits
  FOR ALL
  USING (public.video_scope_allows_access(org_id, workspace_id))
  WITH CHECK (public.video_scope_allows_access(org_id, workspace_id));

CREATE POLICY approvals_access_policy ON public.approvals
  FOR ALL
  USING (public.video_scope_allows_access(org_id, workspace_id))
  WITH CHECK (public.video_scope_allows_access(org_id, workspace_id));

-- Storage policies -------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'figures_media_access'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY figures_media_access
      ON storage.objects
      FOR ALL
      USING (
        bucket_id = 'figures'
        AND (
          public.is_admin()
          OR public.video_scope_allows_access(
            public.safe_cast_uuid(metadata->>'org_id'),
            public.safe_cast_uuid(metadata->>'workspace_id')
          )
        )
      )
      WITH CHECK (
        bucket_id = 'figures'
        AND (
          public.is_admin()
          OR public.video_scope_allows_access(
            public.safe_cast_uuid(metadata->>'org_id'),
            public.safe_cast_uuid(metadata->>'workspace_id')
          )
        )
      );
    $sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'products_media_access'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY products_media_access
      ON storage.objects
      FOR ALL
      USING (
        bucket_id = 'products'
        AND (
          public.is_admin()
          OR public.video_scope_allows_access(
            public.safe_cast_uuid(metadata->>'org_id'),
            public.safe_cast_uuid(metadata->>'workspace_id')
          )
        )
      )
      WITH CHECK (
        bucket_id = 'products'
        AND (
          public.is_admin()
          OR public.video_scope_allows_access(
            public.safe_cast_uuid(metadata->>'org_id'),
            public.safe_cast_uuid(metadata->>'workspace_id')
          )
        )
      );
    $sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'masters_media_access'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY masters_media_access
      ON storage.objects
      FOR ALL
      USING (
        bucket_id = 'masters'
        AND (
          public.is_admin()
          OR public.video_scope_allows_access(
            public.safe_cast_uuid(metadata->>'org_id'),
            public.safe_cast_uuid(metadata->>'workspace_id')
          )
        )
      )
      WITH CHECK (
        bucket_id = 'masters'
        AND (
          public.is_admin()
          OR public.video_scope_allows_access(
            public.safe_cast_uuid(metadata->>'org_id'),
            public.safe_cast_uuid(metadata->>'workspace_id')
          )
        )
      );
    $sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'whatsapp_media_access'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY whatsapp_media_access
      ON storage.objects
      FOR ALL
      USING (
        bucket_id = 'whatsapp'
        AND (
          public.is_admin()
          OR public.video_scope_allows_access(
            public.safe_cast_uuid(metadata->>'org_id'),
            public.safe_cast_uuid(metadata->>'workspace_id')
          )
        )
      )
      WITH CHECK (
        bucket_id = 'whatsapp'
        AND (
          public.is_admin()
          OR public.video_scope_allows_access(
            public.safe_cast_uuid(metadata->>'org_id'),
            public.safe_cast_uuid(metadata->>'workspace_id')
          )
        )
      );
    $sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'captions_media_access'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY captions_media_access
      ON storage.objects
      FOR ALL
      USING (
        bucket_id = 'captions'
        AND (
          public.is_admin()
          OR public.video_scope_allows_access(
            public.safe_cast_uuid(metadata->>'org_id'),
            public.safe_cast_uuid(metadata->>'workspace_id')
          )
        )
      )
      WITH CHECK (
        bucket_id = 'captions'
        AND (
          public.is_admin()
          OR public.video_scope_allows_access(
            public.safe_cast_uuid(metadata->>'org_id'),
            public.safe_cast_uuid(metadata->>'workspace_id')
          )
        )
      );
    $sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'provenance_media_access'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY provenance_media_access
      ON storage.objects
      FOR ALL
      USING (
        bucket_id = 'provenance'
        AND (
          public.is_admin()
          OR public.video_scope_allows_access(
            public.safe_cast_uuid(metadata->>'org_id'),
            public.safe_cast_uuid(metadata->>'workspace_id')
          )
        )
      )
      WITH CHECK (
        bucket_id = 'provenance'
        AND (
          public.is_admin()
          OR public.video_scope_allows_access(
            public.safe_cast_uuid(metadata->>'org_id'),
            public.safe_cast_uuid(metadata->>'workspace_id')
          )
        )
      );
    $sql$;
  END IF;
END;
$$;

COMMIT;
