BEGIN;

-- Agent management schema: definitions, versions, documents, tasks, runs, audit

CREATE TABLE IF NOT EXISTS agent_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  active_version_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agent_definitions(id) ON DELETE CASCADE,
  version INT NOT NULL,
  instructions TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (agent_id, version)
);

ALTER TABLE agent_definitions
  ADD CONSTRAINT agent_definitions_active_version_fk
  FOREIGN KEY (active_version_id) REFERENCES agent_versions(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS agent_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agent_definitions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_url TEXT,
  storage_path TEXT,
  checksum TEXT,
  tokens INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agent_definitions(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  payload JSONB,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agent_definitions(id) ON DELETE CASCADE,
  version_id UUID REFERENCES agent_versions(id) ON DELETE SET NULL,
  input JSONB,
  output JSONB,
  status TEXT NOT NULL DEFAULT 'running',
  trace_id TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS agent_audit (
  id BIGSERIAL PRIMARY KEY,
  agent_id UUID REFERENCES agent_definitions(id) ON DELETE CASCADE,
  actor TEXT,
  action TEXT NOT NULL,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_versions_agent ON agent_versions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_documents_agent ON agent_documents(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_agent_status ON agent_tasks(agent_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_started ON agent_runs(agent_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_audit_agent_created ON agent_audit(agent_id, created_at DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_agent_definitions_set_updated ON agent_definitions;
CREATE TRIGGER trg_agent_definitions_set_updated
BEFORE UPDATE ON agent_definitions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Simple deploy helper
CREATE OR REPLACE FUNCTION agent_deploy(p_agent_id UUID, p_version INT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_ver_id UUID;
BEGIN
  SELECT id INTO v_ver_id FROM agent_versions WHERE agent_id = p_agent_id AND version = p_version;
  IF v_ver_id IS NULL THEN
    RAISE EXCEPTION 'version_not_found';
  END IF;
  UPDATE agent_definitions SET active_version_id = v_ver_id, status = 'active', updated_at = now() WHERE id = p_agent_id;
  INSERT INTO agent_audit(agent_id, actor, action, meta) VALUES (p_agent_id, 'system', 'deploy', jsonb_build_object('version', p_version));
  RETURN v_ver_id;
END;
$$;

-- RLS (lockdown by default; service role bypasses)
ALTER TABLE agent_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_audit ENABLE ROW LEVEL SECURITY;

COMMIT;

