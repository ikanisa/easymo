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

-- Partition bootstrapping (default partition plus current & next month)
-- Default partition to ensure inserts always succeed even if monthly partitions are missing
CREATE TABLE IF NOT EXISTS public.system_metrics_default PARTITION OF public.system_metrics DEFAULT;

-- Indexes for efficient metric queries on default partition
CREATE INDEX IF NOT EXISTS idx_system_metrics_service_time_default
  ON public.system_metrics_default (service_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_metrics_type_time_default
  ON public.system_metrics_default (metric_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_metrics_tags_default
  ON public.system_metrics_default USING gin (tags);

-- Create partitions for the current and next UTC months dynamically with supporting indexes
DO $$
DECLARE
  v_months date[] := ARRAY[
    date_trunc('month', timezone('utc', now()))::date,
    (date_trunc('month', timezone('utc', now()))::date + INTERVAL '1 month')::date
  ];
  v_start date;
  v_end date;
  v_suffix text;
BEGIN
  FOREACH v_start IN ARRAY v_months
  LOOP
    v_end := (v_start + INTERVAL '1 month')::date;
    v_suffix := to_char(v_start, 'YYYY_MM');

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I.%I PARTITION OF public.system_metrics FOR VALUES FROM (%L) TO (%L);',
      'public',
      'system_metrics_' || v_suffix,
      v_start,
      v_end
    );

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I.%I (service_name, created_at DESC);',
      'idx_system_metrics_service_time_' || v_suffix,
      'public',
      'system_metrics_' || v_suffix
    );

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I.%I (metric_type, created_at DESC);',
      'idx_system_metrics_type_time_' || v_suffix,
      'public',
      'system_metrics_' || v_suffix
    );

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I.%I USING gin (tags);',
      'idx_system_metrics_tags_' || v_suffix,
      'public',
      'system_metrics_' || v_suffix
    );
  END LOOP;
END
$$;

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

-- Partition bootstrapping
-- Default partition for audit logs
CREATE TABLE IF NOT EXISTS public.system_audit_logs_default PARTITION OF public.system_audit_logs DEFAULT;

-- Indexes on default audit log partition
CREATE INDEX IF NOT EXISTS idx_system_audit_user_time_default
  ON public.system_audit_logs_default (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_audit_resource_default
  ON public.system_audit_logs_default (resource_type, resource_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_audit_correlation_default
  ON public.system_audit_logs_default (correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_system_audit_action_default
  ON public.system_audit_logs_default (action, created_at DESC);

-- Create current and next month partitions for audit logs dynamically
DO $$
DECLARE
  v_months date[] := ARRAY[
    date_trunc('month', timezone('utc', now()))::date,
    (date_trunc('month', timezone('utc', now()))::date + INTERVAL '1 month')::date
  ];
  v_start date;
  v_end date;
  v_suffix text;
BEGIN
  FOREACH v_start IN ARRAY v_months
  LOOP
    v_end := (v_start + INTERVAL '1 month')::date;
    v_suffix := to_char(v_start, 'YYYY_MM');

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I.%I PARTITION OF public.system_audit_logs FOR VALUES FROM (%L) TO (%L);',
      'public',
      'system_audit_logs_' || v_suffix,
      v_start,
      v_end
    );

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I.%I (user_id, created_at DESC);',
      'idx_system_audit_user_time_' || v_suffix,
      'public',
      'system_audit_logs_' || v_suffix
    );

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I.%I (resource_type, resource_id, created_at DESC);',
      'idx_system_audit_resource_' || v_suffix,
      'public',
      'system_audit_logs_' || v_suffix
    );

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I.%I (correlation_id) WHERE correlation_id IS NOT NULL;',
      'idx_system_audit_correlation_' || v_suffix,
      'public',
      'system_audit_logs_' || v_suffix
    );

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I.%I (action, created_at DESC);',
      'idx_system_audit_action_' || v_suffix,
      'public',
      'system_audit_logs_' || v_suffix
    );
  END LOOP;
END
$$;

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
