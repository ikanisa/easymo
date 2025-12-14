-- Phase 6: Feature Flags System
-- Create feature_flags table for safe feature rollout

BEGIN;

-- Create feature_flags table
CREATE TABLE IF NOT EXISTS feature_flags (
  name TEXT PRIMARY KEY,
  enabled BOOLEAN DEFAULT false NOT NULL,
  rollout_percentage INTEGER DEFAULT 0 NOT NULL CHECK (rollout_percentage BETWEEN 0 AND 100),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT,
  updated_by TEXT
);

-- Add index for enabled flags (common query)
CREATE INDEX idx_feature_flags_enabled ON feature_flags(enabled) WHERE enabled = true;

-- Enable RLS
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access on feature_flags"
  ON feature_flags
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can read enabled flags
CREATE POLICY "Authenticated users can read enabled flags"
  ON feature_flags
  FOR SELECT
  TO authenticated
  USING (enabled = true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_feature_flags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER update_feature_flags_timestamp
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_feature_flags_updated_at();

-- Insert initial feature flags
INSERT INTO feature_flags (name, enabled, rollout_percentage, description) VALUES
  ('ai_agents', false, 0, 'Enable AI-powered customer support agents'),
  ('enhanced_matching', false, 0, 'New matching algorithm for nearby rides with ML ranking'),
  ('momo_qr_v2', false, 0, 'Enhanced MoMo QR code generation with retry logic'),
  ('schedule_v2', false, 0, 'New scheduling system with multi-stop support'),
  ('driver_ratings', false, 0, 'Enable driver rating system for passengers'),
  ('passenger_preferences', false, 0, 'Allow passengers to set ride preferences'),
  ('real_time_tracking', false, 0, 'Real-time GPS tracking for active trips'),
  ('surge_pricing', false, 0, 'Dynamic pricing based on demand'),
  ('wallet_v2', false, 0, 'New wallet system with transaction history'),
  ('multi_language', true, 100, 'Multi-language support (already enabled)')
ON CONFLICT (name) DO NOTHING;

-- Add comment
COMMENT ON TABLE feature_flags IS 'Feature flags for gradual rollout and A/B testing';
COMMENT ON COLUMN feature_flags.rollout_percentage IS 'Percentage of users to enable feature for (0-100)';

COMMIT;
