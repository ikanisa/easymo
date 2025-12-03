-- Week 4 Migration Monitoring Queries
-- Run these regularly to track migration progress

-- ============================================================================
-- 1. Traffic Distribution (Last Hour)
-- ============================================================================
-- Shows how traffic is split between unified and legacy functions
SELECT 
  CASE 
    WHEN function_name = 'wa-webhook-unified' THEN 'UNIFIED'
    WHEN function_name IN ('wa-webhook-ai-agents', 'wa-webhook-jobs', 
                           'wa-webhook-marketplace', 'wa-webhook-property') THEN 'LEGACY'
    ELSE 'OTHER'
  END as version,
  COUNT(*) as request_count,
  ROUND(COUNT(*)::NUMERIC / SUM(COUNT(*)) OVER () * 100, 2) as percentage
FROM webhook_metrics
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY version
ORDER BY request_count DESC;


-- ============================================================================
-- 2. Performance Comparison (Unified vs Legacy)
-- ============================================================================
SELECT 
  CASE 
    WHEN function_name = 'wa-webhook-unified' THEN 'UNIFIED'
    ELSE 'LEGACY'
  END as version,
  COUNT(*) as total_requests,
  ROUND(AVG(duration_ms), 2) as avg_latency_ms,
  ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY duration_ms), 2) as p50_ms,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms), 2) as p95_ms,
  ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms), 2) as p99_ms,
  COUNT(*) FILTER (WHERE status_code >= 400) as errors,
  ROUND(COUNT(*) FILTER (WHERE status_code >= 400)::NUMERIC / COUNT(*) * 100, 2) as error_rate_pct
FROM webhook_metrics
WHERE timestamp > NOW() - INTERVAL '1 hour'
  AND function_name IN ('wa-webhook-unified', 'wa-webhook-ai-agents', 
                        'wa-webhook-jobs', 'wa-webhook-marketplace', 'wa-webhook-property')
GROUP BY version;


-- ============================================================================
-- 3. Agent Usage in Unified Function (Last Hour)
-- ============================================================================
SELECT 
  agent_type,
  COUNT(*) as invocations,
  ROUND(AVG(processing_time_ms), 2) as avg_processing_ms,
  COUNT(*) FILTER (WHERE success = true) as successful,
  COUNT(*) FILTER (WHERE success = false) as failed,
  ROUND(COUNT(*) FILTER (WHERE success = false)::NUMERIC / COUNT(*) * 100, 2) as failure_rate_pct
FROM ai_agent_metrics
WHERE created_at > NOW() - INTERVAL '1 hour'
  AND function_name = 'wa-webhook-unified'
GROUP BY agent_type
ORDER BY invocations DESC;


-- ============================================================================
-- 4. Error Details (Last Hour)
-- ============================================================================
SELECT 
  function_name,
  status_code,
  error_message,
  COUNT(*) as occurrences,
  MAX(timestamp) as last_seen
FROM webhook_metrics
WHERE timestamp > NOW() - INTERVAL '1 hour'
  AND status_code >= 400
GROUP BY function_name, status_code, error_message
ORDER BY occurrences DESC
LIMIT 20;


-- ============================================================================
-- 5. Hourly Trend (Last 24 Hours)
-- ============================================================================
SELECT 
  DATE_TRUNC('hour', timestamp) as hour,
  CASE 
    WHEN function_name = 'wa-webhook-unified' THEN 'UNIFIED'
    ELSE 'LEGACY'
  END as version,
  COUNT(*) as requests,
  ROUND(AVG(duration_ms), 2) as avg_latency,
  COUNT(*) FILTER (WHERE status_code >= 400) as errors
FROM webhook_metrics
WHERE timestamp > NOW() - INTERVAL '24 hours'
  AND function_name IN ('wa-webhook-unified', 'wa-webhook-ai-agents', 
                        'wa-webhook-jobs', 'wa-webhook-marketplace', 'wa-webhook-property')
GROUP BY hour, version
ORDER BY hour DESC, version;


-- ============================================================================
-- 6. DLQ Messages (Dead Letter Queue)
-- ============================================================================
SELECT 
  error_type,
  COUNT(*) as message_count,
  MAX(created_at) as latest_occurrence
FROM webhook_dlq
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY error_type
ORDER BY message_count DESC;


-- ============================================================================
-- 7. Top Active Users (By Request Count)
-- ============================================================================
SELECT 
  from_number as user_phone,
  COUNT(*) as message_count,
  MAX(created_at) as last_message
FROM wa_events
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY from_number
ORDER BY message_count DESC
LIMIT 20;


-- ============================================================================
-- 8. Success Rate by Agent Type (Last 24h)
-- ============================================================================
SELECT 
  agent_type,
  COUNT(*) as total_invocations,
  COUNT(*) FILTER (WHERE success = true) as successful,
  COUNT(*) FILTER (WHERE success = false) as failed,
  ROUND(COUNT(*) FILTER (WHERE success = true)::NUMERIC / COUNT(*) * 100, 2) as success_rate_pct
FROM ai_agent_metrics
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND function_name = 'wa-webhook-unified'
GROUP BY agent_type
ORDER BY total_invocations DESC;


-- ============================================================================
-- 9. Response Time Distribution (Unified Function)
-- ============================================================================
SELECT 
  CASE 
    WHEN duration_ms < 500 THEN '< 500ms'
    WHEN duration_ms < 1000 THEN '500ms - 1s'
    WHEN duration_ms < 2000 THEN '1s - 2s'
    WHEN duration_ms < 5000 THEN '2s - 5s'
    ELSE '> 5s'
  END as latency_bucket,
  COUNT(*) as request_count,
  ROUND(COUNT(*)::NUMERIC / SUM(COUNT(*)) OVER () * 100, 2) as percentage
FROM webhook_metrics
WHERE timestamp > NOW() - INTERVAL '1 hour'
  AND function_name = 'wa-webhook-unified'
GROUP BY latency_bucket
ORDER BY 
  CASE latency_bucket
    WHEN '< 500ms' THEN 1
    WHEN '500ms - 1s' THEN 2
    WHEN '1s - 2s' THEN 3
    WHEN '2s - 5s' THEN 4
    ELSE 5
  END;


-- ============================================================================
-- 10. Daily Summary Report
-- ============================================================================
WITH daily_stats AS (
  SELECT 
    DATE(timestamp) as day,
    CASE 
      WHEN function_name = 'wa-webhook-unified' THEN 'UNIFIED'
      ELSE 'LEGACY'
    END as version,
    COUNT(*) as requests,
    ROUND(AVG(duration_ms), 2) as avg_latency,
    COUNT(*) FILTER (WHERE status_code >= 400) as errors,
    ROUND(COUNT(*) FILTER (WHERE status_code >= 400)::NUMERIC / COUNT(*) * 100, 2) as error_rate
  FROM webhook_metrics
  WHERE timestamp > NOW() - INTERVAL '7 days'
    AND function_name IN ('wa-webhook-unified', 'wa-webhook-ai-agents', 
                          'wa-webhook-jobs', 'wa-webhook-marketplace', 'wa-webhook-property')
  GROUP BY day, version
)
SELECT * FROM daily_stats
ORDER BY day DESC, version;


-- ============================================================================
-- 11. Message Deduplication Stats
-- ============================================================================
SELECT 
  DATE_TRUNC('hour', processed_at) as hour,
  COUNT(*) as total_messages,
  COUNT(*) FILTER (WHERE is_duplicate = true) as duplicates,
  ROUND(COUNT(*) FILTER (WHERE is_duplicate = true)::NUMERIC / COUNT(*) * 100, 2) as dup_rate_pct
FROM message_deduplication_log
WHERE processed_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;


-- ============================================================================
-- 12. Quick Health Check
-- ============================================================================
-- Run this every 5 minutes during active monitoring
SELECT 
  'UNIFIED' as source,
  COUNT(*) as last_5min_requests,
  ROUND(AVG(duration_ms), 0) as avg_latency_ms,
  COUNT(*) FILTER (WHERE status_code >= 400) as errors,
  CASE 
    WHEN COUNT(*) FILTER (WHERE status_code >= 400)::NUMERIC / NULLIF(COUNT(*), 0) * 100 > 5 THEN '🔴 HIGH ERROR RATE'
    WHEN AVG(duration_ms) > 5000 THEN '🟡 SLOW RESPONSE'
    ELSE '🟢 HEALTHY'
  END as status
FROM webhook_metrics
WHERE timestamp > NOW() - INTERVAL '5 minutes'
  AND function_name = 'wa-webhook-unified';
