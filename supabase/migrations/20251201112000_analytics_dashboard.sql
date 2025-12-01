-- =====================================================================
-- AGENT ANALYTICS DASHBOARD - LONG-TERM MONITORING
-- =====================================================================
-- Comprehensive analytics for agent performance, tool usage, and user satisfaction
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. AGENT PERFORMANCE METRICS VIEW
-- =====================================================================

CREATE OR REPLACE VIEW public.agent_performance_dashboard AS
WITH response_times AS (
  SELECT 
    c.agent_id,
    c.id as conversation_id,
    DATE_TRUNC('day', c.created_at) as date,
    EXTRACT(EPOCH FROM (m2.created_at - m1.created_at)) as response_time_seconds
  FROM whatsapp_conversations c
  JOIN whatsapp_messages m1 ON m1.conversation_id = c.id
  JOIN whatsapp_messages m2 ON m2.conversation_id = c.id 
    AND m2.created_at > m1.created_at
    AND m1.direction = 'inbound'
    AND m2.direction = 'outbound'
  WHERE c.created_at >= NOW() - INTERVAL '30 days'
)
SELECT 
  a.slug,
  a.name,
  COUNT(DISTINCT c.id) as total_conversations,
  COUNT(DISTINCT c.user_id) as unique_users,
  COUNT(m.id) as total_messages,
  COALESCE(AVG(rt.response_time_seconds), 0) as avg_response_time_seconds,
  COUNT(te.id) as total_tool_executions,
  AVG(CASE WHEN te.success THEN 1 ELSE 0 END) as tool_success_rate,
  AVG(te.execution_time_ms) as avg_tool_execution_time_ms,
  COUNT(DISTINCT te.tool_id) as unique_tools_used,
  DATE_TRUNC('day', c.created_at) as date
FROM ai_agents a
LEFT JOIN whatsapp_conversations c ON c.agent_id = a.id
LEFT JOIN whatsapp_messages m ON m.conversation_id = c.id
LEFT JOIN ai_agent_tool_executions te ON te.conversation_id = c.id
LEFT JOIN response_times rt ON rt.agent_id = a.id AND rt.conversation_id = c.id AND rt.date = DATE_TRUNC('day', c.created_at)
WHERE a.is_active = true
  AND c.created_at >= NOW() - INTERVAL '30 days'
GROUP BY a.slug, a.name, DATE_TRUNC('day', c.created_at)
ORDER BY date DESC, a.slug;

-- =====================================================================
-- 2. TOOL USAGE ANALYTICS VIEW
-- =====================================================================

CREATE OR REPLACE VIEW public.tool_usage_analytics AS
SELECT 
  a.slug as agent_slug,
  t.name as tool_name,
  t.tool_type,
  COUNT(te.id) as execution_count,
  AVG(CASE WHEN te.success THEN 1 ELSE 0 END) as success_rate,
  AVG(te.execution_time_ms) as avg_execution_time_ms,
  MAX(te.execution_time_ms) as max_execution_time_ms,
  MIN(te.execution_time_ms) as min_execution_time_ms,
  COUNT(DISTINCT te.user_id) as unique_users,
  DATE_TRUNC('day', te.created_at) as date
FROM ai_agents a
JOIN ai_agent_tools t ON t.agent_id = a.id
LEFT JOIN ai_agent_tool_executions te ON te.tool_id = t.id
WHERE a.is_active = true
  AND t.is_active = true
  AND te.created_at >= NOW() - INTERVAL '30 days'
GROUP BY a.slug, t.name, t.tool_type, DATE_TRUNC('day', te.created_at)
ORDER BY date DESC, execution_count DESC;

-- =====================================================================
-- 3. CONFIG CACHE HIT RATE VIEW
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.agent_config_cache_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_slug text NOT NULL,
  cache_hit boolean NOT NULL,
  load_source text CHECK (load_source IN ('database', 'cache', 'fallback')),
  load_time_ms integer,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_config_cache_metrics_slug_date 
ON public.agent_config_cache_metrics(agent_slug, created_at);

CREATE OR REPLACE VIEW public.config_cache_performance AS
SELECT 
  agent_slug,
  COUNT(*) as total_loads,
  SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END) as cache_hits,
  AVG(CASE WHEN cache_hit THEN 1.0 ELSE 0.0 END) * 100 as cache_hit_rate_percent,
  AVG(load_time_ms) as avg_load_time_ms,
  AVG(CASE WHEN cache_hit THEN load_time_ms END) as avg_cache_hit_time_ms,
  AVG(CASE WHEN NOT cache_hit THEN load_time_ms END) as avg_cache_miss_time_ms,
  DATE_TRUNC('hour', created_at) as hour
FROM agent_config_cache_metrics
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY agent_slug, DATE_TRUNC('hour', created_at)
ORDER BY hour DESC, agent_slug;

-- =====================================================================
-- 4. USER SATISFACTION TRACKING
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.agent_user_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.whatsapp_conversations(id),
  agent_id uuid REFERENCES public.ai_agents(id),
  user_id uuid REFERENCES public.whatsapp_users(id),
  rating integer CHECK (rating >= 1 AND rating <= 5),
  feedback_text text,
  issue_resolved boolean,
  would_recommend boolean,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_feedback_agent ON public.agent_user_feedback(agent_id, created_at);
CREATE INDEX IF NOT EXISTS idx_user_feedback_rating ON public.agent_user_feedback(rating);

CREATE OR REPLACE VIEW public.agent_satisfaction_metrics AS
SELECT 
  a.slug,
  a.name,
  COUNT(f.id) as total_feedback,
  AVG(f.rating) as avg_rating,
  AVG(CASE WHEN f.issue_resolved THEN 1 ELSE 0 END) * 100 as resolution_rate_percent,
  AVG(CASE WHEN f.would_recommend THEN 1 ELSE 0 END) * 100 as recommendation_rate_percent,
  COUNT(*) FILTER (WHERE f.rating >= 4) as positive_feedback_count,
  COUNT(*) FILTER (WHERE f.rating <= 2) as negative_feedback_count,
  DATE_TRUNC('day', f.created_at) as date
FROM ai_agents a
LEFT JOIN agent_user_feedback f ON f.agent_id = a.id
WHERE a.is_active = true
  AND f.created_at >= NOW() - INTERVAL '30 days'
GROUP BY a.slug, a.name, DATE_TRUNC('day', f.created_at)
ORDER BY date DESC, avg_rating DESC;

-- =====================================================================
-- 5. ERROR TRACKING & MONITORING
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.agent_error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES public.ai_agents(id),
  error_type text NOT NULL,
  error_message text,
  stack_trace text,
  context jsonb,
  severity text CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  resolved boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_error_logs_agent ON public.agent_error_logs(agent_id, created_at);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON public.agent_error_logs(severity, resolved);

CREATE OR REPLACE VIEW public.agent_error_summary AS
SELECT 
  a.slug,
  a.name,
  e.error_type,
  e.severity,
  COUNT(*) as error_count,
  COUNT(*) FILTER (WHERE e.resolved = false) as unresolved_count,
  MAX(e.created_at) as last_occurrence,
  array_agg(DISTINCT e.error_message) FILTER (WHERE e.error_message IS NOT NULL) as sample_messages
FROM ai_agents a
LEFT JOIN agent_error_logs e ON e.agent_id = a.id
WHERE e.created_at >= NOW() - INTERVAL '7 days'
GROUP BY a.slug, a.name, e.error_type, e.severity
HAVING COUNT(*) > 0
ORDER BY error_count DESC, severity DESC;

-- =====================================================================
-- 6. REAL-TIME MONITORING FUNCTIONS
-- =====================================================================

-- Function to get current agent status
CREATE OR REPLACE FUNCTION public.get_agent_health_status()
RETURNS TABLE (
  agent_slug text,
  status text,
  active_conversations bigint,
  recent_errors bigint,
  avg_response_time_seconds numeric,
  last_activity timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.slug,
    CASE 
      WHEN recent_errors > 10 THEN 'unhealthy'
      WHEN recent_errors > 5 THEN 'degraded'
      WHEN active_convs > 0 THEN 'active'
      ELSE 'idle'
    END as status,
    active_convs,
    recent_errors,
    COALESCE(avg_resp_time, 0) as avg_response_time_seconds,
    last_act
  FROM ai_agents a
  LEFT JOIN LATERAL (
    SELECT COUNT(*) as active_convs
    FROM whatsapp_conversations c
    WHERE c.agent_id = a.id 
      AND c.status = 'active'
      AND c.last_message_at >= NOW() - INTERVAL '1 hour'
  ) conv ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) as recent_errors
    FROM agent_error_logs e
    WHERE e.agent_id = a.id
      AND e.created_at >= NOW() - INTERVAL '15 minutes'
      AND e.resolved = false
  ) err ON true
  LEFT JOIN LATERAL (
    SELECT 
      AVG(EXTRACT(EPOCH FROM (m2.created_at - m1.created_at))) as avg_resp_time
    FROM whatsapp_messages m1
    JOIN whatsapp_messages m2 ON m2.conversation_id = m1.conversation_id
      AND m2.id > m1.id
      AND m2.created_at >= NOW() - INTERVAL '1 hour'
    JOIN whatsapp_conversations c ON c.id = m1.conversation_id
    WHERE c.agent_id = a.id
      AND m1.direction = 'inbound'
      AND m2.direction = 'outbound'
  ) resp ON true
  LEFT JOIN LATERAL (
    SELECT MAX(c.last_message_at) as last_act
    FROM whatsapp_conversations c
    WHERE c.agent_id = a.id
  ) act ON true
  WHERE a.is_active = true;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- 7. DAILY SUMMARY REPORT MATERIALIZED VIEW
-- =====================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS public.agent_daily_summary AS
WITH daily_feedback AS (
  SELECT 
    agent_id,
    DATE(created_at) as feedback_date,
    AVG(rating) as avg_rating
  FROM agent_user_feedback
  GROUP BY agent_id, DATE(created_at)
),
daily_errors AS (
  SELECT 
    agent_id,
    DATE(created_at) as error_date,
    COUNT(*) as error_count
  FROM agent_error_logs
  GROUP BY agent_id, DATE(created_at)
)
SELECT 
  a.slug,
  a.name,
  DATE(c.created_at) as report_date,
  COUNT(DISTINCT c.id) as conversations,
  COUNT(DISTINCT c.user_id) as unique_users,
  COUNT(m.id) as messages,
  COUNT(te.id) as tool_executions,
  AVG(CASE WHEN te.success THEN 1 ELSE 0 END) as tool_success_rate,
  df.avg_rating,
  COALESCE(de.error_count, 0) as errors
FROM ai_agents a
LEFT JOIN whatsapp_conversations c ON c.agent_id = a.id
LEFT JOIN whatsapp_messages m ON m.conversation_id = c.id
LEFT JOIN ai_agent_tool_executions te ON te.conversation_id = c.id
LEFT JOIN daily_feedback df ON df.agent_id = a.id AND df.feedback_date = DATE(c.created_at)
LEFT JOIN daily_errors de ON de.agent_id = a.id AND de.error_date = DATE(c.created_at)
WHERE a.is_active = true
  AND c.created_at >= NOW() - INTERVAL '90 days'
GROUP BY a.slug, a.name, DATE(c.created_at), df.avg_rating, de.error_count;

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_daily_summary_unique 
ON public.agent_daily_summary(slug, report_date);

-- Refresh function (call daily via cron)
CREATE OR REPLACE FUNCTION public.refresh_agent_daily_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.agent_daily_summary;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- =====================================================================
-- USAGE EXAMPLES
-- =====================================================================

-- Get current agent health:
-- SELECT * FROM get_agent_health_status();

-- View performance metrics:
-- SELECT * FROM agent_performance_dashboard WHERE date >= CURRENT_DATE - 7;

-- Check tool usage:
-- SELECT * FROM tool_usage_analytics WHERE agent_slug = 'support' ORDER BY date DESC;

-- Monitor cache performance:
-- SELECT * FROM config_cache_performance ORDER BY hour DESC LIMIT 24;

-- Check satisfaction:
-- SELECT * FROM agent_satisfaction_metrics WHERE date >= CURRENT_DATE - 30;

-- View errors:
-- SELECT * FROM agent_error_summary;

-- Daily summary:
-- SELECT * FROM agent_daily_summary WHERE report_date >= CURRENT_DATE - 30 ORDER BY report_date DESC;

-- =====================================================================
