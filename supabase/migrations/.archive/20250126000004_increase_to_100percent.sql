-- Transaction wrapper for production safety
BEGIN;

-- Increase to 100% rollout for unified service
-- Day 5 - FULL PRODUCTION DEPLOYMENT

UPDATE public.app_config
SET unified_service_flags = jsonb_set(
  unified_service_flags,
  '{rolloutPercent}',
  '100'::jsonb
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

-- Add comment for full deployment
COMMENT ON TABLE public.app_config IS 'Unified service at 100% rollout - FULL PRODUCTION DEPLOYMENT. All traffic now uses the unified AI agent service. Monitor for 1 week before deprecating legacy services.';

COMMIT;
