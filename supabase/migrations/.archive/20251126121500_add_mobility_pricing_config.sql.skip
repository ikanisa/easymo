-- Purpose: Add JSON pricing configuration for mobility fares and surge controls
-- Allows wa-webhook-mobility to read dynamic pricing without redeploys
BEGIN;

ALTER TABLE public.app_config
  ADD COLUMN IF NOT EXISTS mobility_pricing jsonb,
  ADD COLUMN IF NOT EXISTS surge_pricing jsonb;

UPDATE public.app_config
SET
  mobility_pricing = COALESCE(mobility_pricing, '{}'::jsonb),
  surge_pricing = COALESCE(
    surge_pricing,
    jsonb_build_object(
      'enabled', false,
      'peak_hours', jsonb_build_array(7,8,9,17,18,19),
      'weekend_multiplier', 1.2,
      'peak_hour_multiplier', 1.5,
      'high_demand_multiplier', 2.0
    )
  ),
  updated_at = NOW()
WHERE id = 1;

COMMENT ON COLUMN public.app_config.mobility_pricing IS 'JSON overrides for mobility pricing keyed by vehicle type.';
COMMENT ON COLUMN public.app_config.surge_pricing IS 'JSON configuration for surge pricing (enabled flag, multipliers, peak_hours).';

COMMIT;
