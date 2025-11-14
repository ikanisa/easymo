BEGIN;

-- Migration: Analytics Infrastructure
-- Purpose: Analytics events and metrics for business insights
-- Supports data-driven decision making with partitioned time-series data

-- ============================================================================
-- ANALYTICS EVENTS TABLE (Partitioned for high volume)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  event_name text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text,
  event_category text, -- 'user_action', 'system_event', 'business_metric'
  properties jsonb DEFAULT '{}'::jsonb,
  context jsonb DEFAULT '{}'::jsonb,
  correlation_id text,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create initial partitions for analytics events (current and next month)
CREATE TABLE IF NOT EXISTS public.analytics_events_2026_04 PARTITION OF public.analytics_events
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE IF NOT EXISTS public.analytics_events_2026_05 PARTITION OF public.analytics_events
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_name_time 
  ON public.analytics_events_2026_04 (event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_user_time 
  ON public.analytics_events_2026_04 (user_id, created_at DESC) 
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analytics_events_session 
  ON public.analytics_events_2026_04 (session_id, created_at DESC) 
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analytics_events_category 
  ON public.analytics_events_2026_04 (event_category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_name_time_05 
  ON public.analytics_events_2026_05 (event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_user_time_05 
  ON public.analytics_events_2026_05 (user_id, created_at DESC) 
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analytics_events_session_05 
  ON public.analytics_events_2026_05 (session_id, created_at DESC) 
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analytics_events_category_05 
  ON public.analytics_events_2026_05 (event_category, created_at DESC);

-- RLS policies for analytics events
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_analytics" ON public.analytics_events;
CREATE POLICY "service_role_full_access_analytics" 
  ON public.analytics_events 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_analytics" ON public.analytics_events;
CREATE POLICY "authenticated_read_analytics" 
  ON public.analytics_events 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Grant permissions
GRANT SELECT ON public.analytics_events TO authenticated;
GRANT INSERT ON public.analytics_events TO service_role;

-- ============================================================================
-- AGGREGATED METRICS VIEW
-- ============================================================================

-- Materialized view for daily metrics (refreshed periodically)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.daily_metrics AS
SELECT 
  date_trunc('day', created_at) as date,
  event_category,
  event_name,
  COUNT(*) as event_count,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(DISTINCT session_id) as unique_sessions
FROM public.analytics_events
WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY 1, 2, 3;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_metrics_unique 
  ON public.daily_metrics (date, event_category, event_name);

-- Grant view access
GRANT SELECT ON public.daily_metrics TO authenticated;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to record an analytics event
CREATE OR REPLACE FUNCTION public.track_event(
  p_event_name text,
  p_event_category text DEFAULT 'user_action',
  p_properties jsonb DEFAULT '{}'::jsonb,
  p_context jsonb DEFAULT '{}'::jsonb,
  p_session_id text DEFAULT NULL,
  p_correlation_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  INSERT INTO public.analytics_events (
    event_name,
    user_id,
    session_id,
    event_category,
    properties,
    context,
    correlation_id
  ) VALUES (
    p_event_name,
    auth.uid(),
    p_session_id,
    p_event_category,
    p_properties,
    p_context,
    p_correlation_id
  ) RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;

-- Function to refresh daily metrics
CREATE OR REPLACE FUNCTION public.refresh_daily_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.daily_metrics;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.track_event(text, text, jsonb, jsonb, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_daily_metrics() TO service_role;

-- ============================================================================
-- MONITORING VIEWS
-- ============================================================================

-- View for recent analytics summary
CREATE OR REPLACE VIEW public.analytics_summary AS
SELECT 
  event_category,
  event_name,
  COUNT(*) as event_count,
  COUNT(DISTINCT user_id) as unique_users,
  MAX(created_at) as last_event_at
FROM public.analytics_events
WHERE created_at > now() - interval '24 hours'
GROUP BY event_category, event_name
ORDER BY event_count DESC;

-- View for user engagement metrics
CREATE OR REPLACE VIEW public.user_engagement_metrics AS
SELECT 
  user_id,
  COUNT(*) as total_events,
  COUNT(DISTINCT event_name) as unique_events,
  COUNT(DISTINCT session_id) as session_count,
  MIN(created_at) as first_event,
  MAX(created_at) as last_event
FROM public.analytics_events
WHERE created_at > now() - interval '30 days'
  AND user_id IS NOT NULL
GROUP BY user_id;

-- Grant view access
GRANT SELECT ON public.analytics_summary TO authenticated;
GRANT SELECT ON public.user_engagement_metrics TO authenticated;

COMMIT;
