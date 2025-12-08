-- Transaction wrapper for production safety
BEGIN;

-- Increase to 10% rollout for unified service
-- Day 2-3 of gradual rollout

UPDATE public.app_config
SET unified_service_flags = jsonb_set(
  unified_service_flags,
  '{rolloutPercent}',
  '10'::jsonb
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

-- Show monitoring query for next 48 hours
COMMENT ON TABLE public.app_config IS 'Monitor unified service at 10% rollout for 48 hours. Check error rates, response times, and user feedback.';

COMMIT;
