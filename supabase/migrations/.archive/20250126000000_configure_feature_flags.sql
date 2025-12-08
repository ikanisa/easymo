-- Transaction wrapper for production safety
BEGIN;

-- Configure feature flags for unified service
-- Works with existing app_config table structure (single row with id=1)

-- Add unified_service_flags column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'app_config' AND column_name = 'unified_service_flags'
  ) THEN
    ALTER TABLE public.app_config 
    ADD COLUMN unified_service_flags JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Update the single row with feature flags (0% rollout initially)
UPDATE public.app_config
SET unified_service_flags = '{
  "enabled": true,
  "rolloutPercent": 0,
  "agents": {
    "marketplace": true,
    "jobs": true,
    "property": true,
    "farmer": true,
    "waiter": true,
    "insurance": true,
    "rides": true,
    "sales": true,
    "business_broker": true,
    "support": true
  },
  "features": {
    "crossDomainHandoffs": true,
    "unifiedSearch": false,
    "sharedPreferences": false,
    "hybridFlows": true
  }
}'::jsonb
WHERE id = 1;

-- Insert row if it doesn't exist
INSERT INTO public.app_config (id, unified_service_flags)
VALUES (
  1,
  '{
    "enabled": true,
    "rolloutPercent": 0,
    "agents": {
      "marketplace": true,
      "jobs": true,
      "property": true,
      "farmer": true,
      "waiter": true,
      "insurance": true,
      "rides": true,
      "sales": true,
      "business_broker": true,
      "support": true
    },
    "features": {
      "crossDomainHandoffs": true,
      "unifiedSearch": false,
      "sharedPreferences": false,
      "hybridFlows": true
    }
  }'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Verify the configuration
SELECT id, unified_service_flags->>'rolloutPercent' as rollout_percent 
FROM public.app_config 
WHERE id = 1;

COMMIT;
