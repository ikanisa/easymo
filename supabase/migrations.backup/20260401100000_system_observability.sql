BEGIN;

-- Migration: System Observability Infrastructure
-- Purpose: Add comprehensive observability tables for metrics, monitoring, and audit
-- This supports the Ground Rules requirements for structured logging and observability

-- ============================================================================
-- SYSTEM METRICS (Partitioned by time for scalability)
-- ============================================================================

-- Create partitioned metrics table for high-volume time-series data
CREATE TABLE IF NOT EXISTS public.system_metrics (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  service_name text NOT NULL,
  metric_type text NOT NULL, -- 'latency', 'error_rate', 'throughput', 'memory', 'cpu'
  metric_name text NOT NULL,
  value numeric NOT NULL,
  unit text, -- 'ms', 'percent', 'count', 'bytes'
  tags jsonb DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create initial partitions (current month and next month)
CREATE TABLE IF NOT EXISTS public.system_metrics_2026_04 PARTITION OF public.system_metrics
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE IF NOT EXISTS public.system_metrics_2026_05 PARTITION OF public.system_metrics
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

-- Indexes for efficient metric queries
CREATE INDEX IF NOT EXISTS idx_system_metrics_service_time 
  ON public.system_metrics_2026_04 (service_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_metrics_type_time 
  ON public.system_metrics_2026_04 (metric_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_metrics_tags 
  ON public.system_metrics_2026_04 USING gin (tags);

CREATE INDEX IF NOT EXISTS idx_system_metrics_service_time_05 
  ON public.system_metrics_2026_05 (service_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_metrics_type_time_05 
  ON public.system_metrics_2026_05 (metric_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_metrics_tags_05 
  ON public.system_metrics_2026_05 USING gin (tags);

-- RLS policies for metrics
ALTER TABLE public.system_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_insert_metrics" ON public.system_metrics;
CREATE POLICY "service_role_insert_metrics" 
  ON public.system_metrics 
  FOR INSERT 
  TO service_role 
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_metrics" ON public.system_metrics;
CREATE POLICY "authenticated_read_metrics" 
  ON public.system_metrics 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Grant permissions
GRANT SELECT ON public.system_metrics TO authenticated;
GRANT INSERT ON public.system_metrics TO service_role;

-- ============================================================================
-- COMPREHENSIVE AUDIT LOGS (Extends existing audit_log for centralized tracking)
-- ============================================================================

-- Enhanced audit table for comprehensive system-wide auditing
-- Note: This complements existing audit_log and admin_audit_logs tables
CREATE TABLE IF NOT EXISTS public.system_audit_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_type text NOT NULL, -- 'user', 'service', 'system', 'admin'
  actor_identifier text NOT NULL, -- user_id, service_name, or system identifier
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  ip_address inet,
  user_agent text,
  correlation_id text,
  request_id text,
  session_id text,
  old_data jsonb,
  new_data jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'success', -- 'success', 'failure', 'error'
  error_message text,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create initial partitions
CREATE TABLE IF NOT EXISTS public.system_audit_logs_2026_04 PARTITION OF public.system_audit_logs
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE IF NOT EXISTS public.system_audit_logs_2026_05 PARTITION OF public.system_audit_logs
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

-- Indexes for audit log queries
CREATE INDEX IF NOT EXISTS idx_system_audit_user_time 
  ON public.system_audit_logs_2026_04 (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_audit_resource 
  ON public.system_audit_logs_2026_04 (resource_type, resource_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_audit_correlation 
  ON public.system_audit_logs_2026_04 (correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_system_audit_action 
  ON public.system_audit_logs_2026_04 (action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_audit_user_time_05 
  ON public.system_audit_logs_2026_05 (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_audit_resource_05 
  ON public.system_audit_logs_2026_05 (resource_type, resource_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_audit_correlation_05 
  ON public.system_audit_logs_2026_05 (correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_system_audit_action_05 
  ON public.system_audit_logs_2026_05 (action, created_at DESC);

-- RLS policies for audit logs
ALTER TABLE public.system_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_insert_audit" ON public.system_audit_logs;
CREATE POLICY "service_role_insert_audit" 
  ON public.system_audit_logs 
  FOR INSERT 
  TO service_role 
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_own_audit" ON public.system_audit_logs;
CREATE POLICY "authenticated_read_own_audit" 
  ON public.system_audit_logs 
  FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id OR actor_type = 'admin');

-- Grant permissions
GRANT SELECT ON public.system_audit_logs TO authenticated;
GRANT INSERT ON public.system_audit_logs TO service_role;

-- ============================================================================
-- HELPER FUNCTIONS FOR OBSERVABILITY
-- ============================================================================

-- Function to record a metric
CREATE OR REPLACE FUNCTION public.record_metric(
  p_service_name text,
  p_metric_type text,
  p_metric_name text,
  p_value numeric,
  p_unit text DEFAULT NULL,
  p_tags jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_metric_id uuid;
BEGIN
  INSERT INTO public.system_metrics (
    service_name,
    metric_type,
    metric_name,
    value,
    unit,
    tags
  ) VALUES (
    p_service_name,
    p_metric_type,
    p_metric_name,
    p_value,
    p_unit,
    p_tags
  ) RETURNING id INTO v_metric_id;
  
  RETURN v_metric_id;
END;
$$;

-- Function to log an audit event
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_actor_type text,
  p_actor_identifier text,
  p_action text,
  p_resource_type text,
  p_resource_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_correlation_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_audit_id uuid;
BEGIN
  INSERT INTO public.system_audit_logs (
    user_id,
    actor_type,
    actor_identifier,
    action,
    resource_type,
    resource_id,
    correlation_id,
    metadata
  ) VALUES (
    auth.uid(),
    p_actor_type,
    p_actor_identifier,
    p_action,
    p_resource_type,
    p_resource_id,
    p_correlation_id,
    p_metadata
  ) RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$;

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION public.record_metric(text, text, text, numeric, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, text, text, text, jsonb, text) TO service_role;

-- ============================================================================
-- MONITORING VIEWS
-- ============================================================================

-- View for recent metrics by service
CREATE OR REPLACE VIEW public.recent_metrics_by_service AS
SELECT 
  service_name,
  metric_type,
  metric_name,
  AVG(value) as avg_value,
  MIN(value) as min_value,
  MAX(value) as max_value,
  COUNT(*) as sample_count,
  MAX(created_at) as last_recorded_at
FROM public.system_metrics
WHERE created_at > now() - interval '1 hour'
GROUP BY service_name, metric_type, metric_name
ORDER BY service_name, metric_type, metric_name;

-- Grant view access
GRANT SELECT ON public.recent_metrics_by_service TO authenticated;

COMMIT;
