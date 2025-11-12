-- Agent Registry Extended Configuration
-- Migration to add comprehensive agent configuration fields to agent_registry table
-- Supports the full agent configuration structure defined in config/agent_configs.yaml

BEGIN;

-- Add new columns to agent_registry to support extended configuration
ALTER TABLE agent_registry
  ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT ARRAY['en']::TEXT[],
  ADD COLUMN IF NOT EXISTS autonomy TEXT DEFAULT 'auto' CHECK (autonomy IN ('auto', 'suggest', 'handoff')),
  ADD COLUMN IF NOT EXISTS guardrails JSONB DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS instructions TEXT;

-- Create index on slug for faster lookups
CREATE INDEX IF NOT EXISTS idx_agent_registry_slug ON agent_registry(slug);

-- Create index on autonomy level
CREATE INDEX IF NOT EXISTS idx_agent_registry_autonomy ON agent_registry(autonomy);

-- Backfill slug from agent_type for existing records (convert underscores to hyphens)
UPDATE agent_registry 
SET slug = REPLACE(agent_type, '_', '-')
WHERE slug IS NULL;

-- Add comment explaining the schema
COMMENT ON COLUMN agent_registry.slug IS 'Unique kebab-case identifier for the agent';
COMMENT ON COLUMN agent_registry.languages IS 'Array of supported language codes (en, fr, rw, sw, ln)';
COMMENT ON COLUMN agent_registry.autonomy IS 'Autonomy level: auto (full automation), suggest (requires approval), handoff (human required)';
COMMENT ON COLUMN agent_registry.guardrails IS 'JSON object containing safety and operational limits';
COMMENT ON COLUMN agent_registry.instructions IS 'Complete system prompt with ROLE, GOAL, STYLE, BEHAVIOR, FLOW';

COMMIT;
