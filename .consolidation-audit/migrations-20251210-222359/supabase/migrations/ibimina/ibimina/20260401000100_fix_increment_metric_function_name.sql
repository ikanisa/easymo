-- Fix function name mismatch in analytics event logging
-- Issue: log_analytics_event calls increment_system_metric but function is named increment_metric

-- Create alias function to maintain compatibility
CREATE OR REPLACE FUNCTION public.increment_system_metric(
  event_name text,
  delta integer,
  meta jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Call the actual function
  PERFORM public.increment_metric(event_name, delta, meta);
END;
$$;

COMMENT ON FUNCTION public.increment_system_metric IS 'Alias for increment_metric for backwards compatibility';
