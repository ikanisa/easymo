BEGIN;

ALTER TABLE IF EXISTS public.agent_configurations
  ADD COLUMN IF NOT EXISTS updated_by uuid;

COMMENT ON COLUMN public.agent_configurations.updated_by IS 'Admin user id who last updated this configuration.';

-- Optional: index for audit queries
CREATE INDEX IF NOT EXISTS idx_agent_config_updated_by ON public.agent_configurations(updated_by);

COMMIT;

