-- Simple script to configure feature flags directly
-- Run this manually in Supabase SQL editor

-- Check if app_config table exists and its structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'app_config'
ORDER BY ordinal_position;

-- If the table has different columns, use this alternative approach:
-- Create a dedicated feature_flags table
CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key TEXT UNIQUE NOT NULL,
  flag_value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert unified service feature flags
-- Note: Jobs, Property, Farmer, Waiter, and Sales domains have been deprecated
-- Current active services: buy_sell, mobility (rides/insurance via WhatsApp flows)
INSERT INTO feature_flags (flag_key, flag_value) VALUES (
  'unified_service',
  '{
    "enabled": true,
    "rolloutPercent": 1,
    "agents": {
      "buy_sell": true,
      "support": true
    },
    "features": {
      "crossDomainHandoffs": true,
      "unifiedSearch": false,
      "sharedPreferences": false,
      "hybridFlows": true
    },
    "whatsapp_workflows": {
      "mobility": true,
      "insurance": true
    }
  }'::jsonb
)
ON CONFLICT (flag_key) DO UPDATE SET
  flag_value = EXCLUDED.flag_value,
  updated_at = NOW();

-- Verify
SELECT flag_key, flag_value->>'rolloutPercent' as rollout_percent 
FROM feature_flags 
WHERE flag_key = 'unified_service';
