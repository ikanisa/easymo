-- Enable 1% canary rollout for unified service
-- Day 1 of gradual rollout

UPDATE public.app_config
SET unified_service_flags = jsonb_set(
  unified_service_flags,
  '{rolloutPercent}',
  '1'::jsonb
)
WHERE id = 1;

-- Verify the rollout percentage
SELECT 
  id,
  unified_service_flags->>'enabled' as enabled,
  unified_service_flags->>'rolloutPercent' as rollout_percent,
  updated_at
FROM public.app_config 
WHERE id = 1;
