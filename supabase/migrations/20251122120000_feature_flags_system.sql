BEGIN;

-- Feature flags system for controlling agent routing
CREATE TABLE IF NOT EXISTS system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(key);
CREATE INDEX IF NOT EXISTS idx_system_config_active ON system_config(is_active) WHERE is_active = true;

-- Updated timestamp trigger
CREATE TRIGGER set_updated_at_system_config
  BEFORE UPDATE ON system_config
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Insert initial feature flags
INSERT INTO system_config (key, value, description, is_active)
VALUES 
  (
    'feature_unified_agent_system',
    '{"enabled": true, "rollout_percentage": 100, "agents_enabled": ["waiter", "farmer", "broker", "business_broker", "real_estate", "jobs", "sales_sdr", "rides", "insurance"]}'::jsonb,
    'Enable unified AI agent system with new WhatsApp pipeline',
    true
  ),
  (
    'feature_legacy_webhooks',
    '{"enabled": false, "deprecated": true}'::jsonb,
    'Legacy per-feature webhook handlers (deprecated)',
    false
  ),
  (
    'feature_agent_personalization',
    '{"enabled": true, "use_saved_locations": true, "use_user_preferences": true}'::jsonb,
    'Enable personalization features for agents',
    true
  )
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = now();

-- Helper function to check if a feature is enabled
CREATE OR REPLACE FUNCTION is_feature_enabled(feature_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  config_record RECORD;
BEGIN
  SELECT value INTO config_record
  FROM system_config
  WHERE key = feature_key AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  RETURN COALESCE((config_record.value->>'enabled')::boolean, false);
END;
$$;

-- Helper function to get feature config
CREATE OR REPLACE FUNCTION get_feature_config(feature_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  config_value JSONB;
BEGIN
  SELECT value INTO config_value
  FROM system_config
  WHERE key = feature_key AND is_active = true;
  
  RETURN COALESCE(config_value, '{}'::jsonb);
END;
$$;

COMMENT ON TABLE system_config IS 'System-wide feature flags and configuration';
COMMENT ON FUNCTION is_feature_enabled IS 'Check if a feature flag is enabled';
COMMENT ON FUNCTION get_feature_config IS 'Get feature flag configuration as JSONB';

COMMIT;
