-- Agent Management: personas, versions, documents, tasks, runs, deployments
-- Additive-only; wrapped in a transaction; idempotent DDL.

BEGIN;

DO $$ BEGIN CREATE TYPE agent_status AS ENUM ('draft','active','disabled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE deploy_env AS ENUM ('staging','production'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE run_status AS ENUM ('queued','running','succeeded','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE ingest_status AS ENUM ('pending','processing','ready','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.agent_personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  summary text,
  status agent_status NOT NULL DEFAULT 'draft',
  default_language text DEFAULT 'en',
  tags text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agent_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agent_personas(id) ON DELETE CASCADE,
  version int NOT NULL,
  instructions text,
  tools jsonb NOT NULL DEFAULT '{}'::jsonb,
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, version)
);

CREATE TABLE IF NOT EXISTS public.agent_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agent_personas(id) ON DELETE CASCADE,
  title text NOT NULL,
  source_url text,
  storage_path text,
  embedding_status ingest_status NOT NULL DEFAULT 'pending',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agent_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agent_personas(id) ON DELETE CASCADE,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  assigned_to uuid,
  due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agent_personas(id) ON DELETE CASCADE,
  version_id uuid REFERENCES public.agent_versions(id) ON DELETE SET NULL,
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  output jsonb,
  status run_status NOT NULL DEFAULT 'queued',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agent_deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agent_personas(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES public.agent_versions(id) ON DELETE CASCADE,
  environment deploy_env NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, environment)
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS agent_versions_agent_idx ON public.agent_versions(agent_id);
CREATE INDEX IF NOT EXISTS agent_docs_agent_idx ON public.agent_documents(agent_id);
CREATE INDEX IF NOT EXISTS agent_tasks_agent_idx ON public.agent_tasks(agent_id);
CREATE INDEX IF NOT EXISTS agent_runs_agent_idx ON public.agent_runs(agent_id);
CREATE INDEX IF NOT EXISTS agent_deploy_agent_idx ON public.agent_deployments(agent_id);

-- RLS enablement (admin-only manage policies)
ALTER TABLE public.agent_personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_deployments ENABLE ROW LEVEL SECURITY;

-- Helper: ensure is_admin() exists; if not, fallback to service role bypass
-- (Assumes is_admin() from earlier migrations.)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'is_admin' AND n.nspname = 'public'
  ) THEN
    EXECUTE 'CREATE POLICY agent_personas_admin_manage ON public.agent_personas FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())';
    EXECUTE 'CREATE POLICY agent_versions_admin_manage ON public.agent_versions FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())';
    EXECUTE 'CREATE POLICY agent_documents_admin_manage ON public.agent_documents FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())';
    EXECUTE 'CREATE POLICY agent_tasks_admin_manage ON public.agent_tasks FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())';
    EXECUTE 'CREATE POLICY agent_runs_admin_manage ON public.agent_runs FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())';
    EXECUTE 'CREATE POLICY agent_deployments_admin_manage ON public.agent_deployments FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())';
  ELSE
    -- Fallback: allow service role via bypass (RLS bypass applies)
    EXECUTE 'CREATE POLICY agent_personas_admin_manage ON public.agent_personas FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')';
    EXECUTE 'CREATE POLICY agent_versions_admin_manage ON public.agent_versions FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')';
    EXECUTE 'CREATE POLICY agent_documents_admin_manage ON public.agent_documents FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')';
    EXECUTE 'CREATE POLICY agent_tasks_admin_manage ON public.agent_tasks FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')';
    EXECUTE 'CREATE POLICY agent_runs_admin_manage ON public.agent_runs FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')';
    EXECUTE 'CREATE POLICY agent_deployments_admin_manage ON public.agent_deployments FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')';
  END IF;
END;
$$;

-- RPC: publish version to an environment
CREATE OR REPLACE FUNCTION public.publish_agent_version(_agent_id uuid, _version_id uuid, _env deploy_env)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.agent_versions SET published = true WHERE id = _version_id AND agent_id = _agent_id;
  INSERT INTO public.agent_deployments(agent_id, version_id, environment, status)
    VALUES (_agent_id, _version_id, _env, 'active')
  ON CONFLICT (agent_id, environment) DO UPDATE SET version_id = EXCLUDED.version_id, status = 'active';
END;
$$;

COMMIT;
