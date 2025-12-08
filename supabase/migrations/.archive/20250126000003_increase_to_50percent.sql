-- Transaction wrapper for production safety
BEGIN;

-- Increase to 50% rollout for unified service
-- Day 4 of gradual rollout - MAJOR MILESTONE

UPDATE public.app_config
SET unified_service_flags = jsonb_set(
  unified_service_flags,
  '{rolloutPercent}',
  '50'::jsonb
),
updated_at = NOW()
WHERE id = 1;

-- Verify the rollout percentage
SELECT 
  id,
  unified_service_flags->>'enabled' as enabled,
  unified_service_flags->>'rolloutPercent' as rollout_percent,
  updated_at
FROM public.app_config 
WHERE id = 1;

-- Add comment for monitoring
COMMENT ON TABLE public.app_config IS 'Monitor unified service at 50% rollout for 48 hours. This is a major milestone - half of all traffic now uses the unified service. Watch for any performance degradation or increased error rates.';

COMMIT;
