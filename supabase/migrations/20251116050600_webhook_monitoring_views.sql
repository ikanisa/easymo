-- Monitoring & Observability Views for WhatsApp Webhook Pipeline
-- Provides operational visibility into webhook processing health

BEGIN;

-- 1. Conversation health overview
CREATE OR REPLACE VIEW webhook_conversation_health AS
SELECT 
  status,
  COUNT(*) as count,
  ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - last_activity_at)))) as avg_idle_seconds,
  MAX(retry_count) as max_retries,
  SUM(error_count) as total_errors,
  COUNT(*) FILTER (WHERE locked_by IS NOT NULL) as locked_count
FROM webhook_conversations
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status;

-- 2. Stuck conversations detection
CREATE OR REPLACE VIEW stuck_webhook_conversations AS
SELECT 
  id,
  user_id,
  whatsapp_phone,
  agent_type,
  status,
  last_activity_at,
  retry_count,
  error_count,
  locked_by,
  locked_at,
  ROUND(EXTRACT(EPOCH FROM (NOW() - last_activity_at))) as idle_seconds
FROM webhook_conversations
WHERE (
  (status IN ('processing', 'pending') AND last_activity_at < NOW() - INTERVAL '5 minutes')
  OR (locked_at < NOW() - INTERVAL '2 minutes' AND locked_by IS NOT NULL)
)
ORDER BY last_activity_at ASC;

-- 3. AI agent performance metrics
CREATE OR REPLACE VIEW webhook_agent_performance AS
SELECT 
  agent_type,
  COUNT(DISTINCT conversation_id) as unique_conversations,
  ROUND(AVG(total_messages)) as avg_messages_per_session,
  ROUND(AVG(total_tokens_used)) as avg_tokens_used,
  SUM(error_count) as total_errors,
  COUNT(*) FILTER (WHERE session_state = 'completed') as completed_sessions,
  COUNT(*) FILTER (WHERE session_state = 'failed') as failed_sessions,
  COUNT(*) FILTER (WHERE session_state = 'active') as active_sessions,
  ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at)))) as avg_duration_seconds
FROM agent_sessions
WHERE started_at > NOW() - INTERVAL '24 hours'
GROUP BY agent_type;

-- 4. Message processing metrics
CREATE OR REPLACE VIEW webhook_message_processing_metrics AS
SELECT 
  DATE_TRUNC('hour', processed_at) as hour,
  COUNT(*) as messages_processed,
  ROUND(AVG(processing_time_ms)) as avg_processing_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY processing_time_ms) as p95_processing_ms,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY processing_time_ms) as p99_processing_ms,
  MAX(processing_time_ms) as max_processing_ms,
  MIN(processing_time_ms) as min_processing_ms
FROM processed_webhook_messages
WHERE processed_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', processed_at)
ORDER BY hour DESC;

-- 5. Dead letter queue summary
CREATE OR REPLACE VIEW webhook_dlq_summary AS
SELECT 
  resolution_status,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE retry_count >= max_retries) as max_retries_reached,
  ROUND(AVG(retry_count)) as avg_retry_count,
  MIN(created_at) as oldest_message,
  MAX(created_at) as newest_message
FROM webhook_dlq
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY resolution_status;

-- 6. Conversation state transition history (last 100)
CREATE OR REPLACE VIEW recent_webhook_state_transitions AS
SELECT 
  cst.id,
  cst.conversation_id,
  wc.user_id,
  wc.whatsapp_phone,
  wc.agent_type,
  cst.from_state,
  cst.to_state,
  cst.transition_reason,
  cst.correlation_id,
  cst.created_at
FROM conversation_state_transitions cst
JOIN webhook_conversations wc ON wc.id = cst.conversation_id
ORDER BY cst.created_at DESC
LIMIT 100;

-- 7. System health check function
CREATE OR REPLACE FUNCTION check_webhook_system_health()
RETURNS TABLE(
  alert_type TEXT,
  severity TEXT,
  message TEXT,
  details JSONB
) AS $$
BEGIN
  -- Check for stuck conversations
  RETURN QUERY
  SELECT 
    'STUCK_CONVERSATIONS'::TEXT,
    'HIGH'::TEXT,
    'Conversations stuck for > 5 minutes'::TEXT,
    jsonb_build_object(
      'count', COUNT(*), 
      'conversation_ids', jsonb_agg(id),
      'oldest_idle_seconds', MAX(ROUND(EXTRACT(EPOCH FROM (NOW() - last_activity_at))))
    )
  FROM stuck_webhook_conversations
  HAVING COUNT(*) > 0;

  -- Check for high error rates
  RETURN QUERY
  SELECT 
    'HIGH_ERROR_RATE'::TEXT,
    'CRITICAL'::TEXT,
    'Error rate above threshold in last hour'::TEXT,
    jsonb_build_object(
      'error_count', SUM(error_count),
      'conversations_affected', COUNT(DISTINCT id)
    )
  FROM webhook_conversations
  WHERE created_at > NOW() - INTERVAL '1 hour'
    AND error_count > 0
  HAVING SUM(error_count) > 10;

  -- Check for DLQ buildup
  RETURN QUERY
  SELECT 
    'DLQ_BUILDUP'::TEXT,
    'HIGH'::TEXT,
    'Dead letter queue has unprocessed messages'::TEXT,
    jsonb_build_object(
      'count', COUNT(*),
      'max_retries_reached', COUNT(*) FILTER (WHERE retry_count >= max_retries)
    )
  FROM webhook_dlq
  WHERE resolution_status IN ('pending', 'retrying')
  HAVING COUNT(*) > 5;

  -- Check for processing timeouts
  RETURN QUERY
  SELECT 
    'PROCESSING_TIMEOUTS'::TEXT,
    'MEDIUM'::TEXT,
    'High number of timeout conversions'::TEXT,
    jsonb_build_object(
      'timeout_count', COUNT(*),
      'percentage', ROUND(COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM webhook_conversations WHERE created_at > NOW() - INTERVAL '1 hour'), 0), 2)
    )
  FROM webhook_conversations
  WHERE status = 'timeout'
    AND created_at > NOW() - INTERVAL '1 hour'
  HAVING COUNT(*) > 5;

  -- Check for stale locks
  RETURN QUERY
  SELECT 
    'STALE_LOCKS'::TEXT,
    'MEDIUM'::TEXT,
    'Conversations with stale locks detected'::TEXT,
    jsonb_build_object(
      'count', COUNT(*),
      'oldest_lock_seconds', MAX(ROUND(EXTRACT(EPOCH FROM (NOW() - locked_at))))
    )
  FROM webhook_conversations
  WHERE locked_at < NOW() - INTERVAL '2 minutes'
    AND locked_by IS NOT NULL
  HAVING COUNT(*) > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Performance statistics function
CREATE OR REPLACE FUNCTION get_webhook_performance_stats(
  lookback_hours INTEGER DEFAULT 24
)
RETURNS TABLE(
  metric_name TEXT,
  value NUMERIC,
  unit TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'total_conversations'::TEXT,
    COUNT(*)::NUMERIC,
    'count'::TEXT
  FROM webhook_conversations
  WHERE created_at > NOW() - (lookback_hours || ' hours')::INTERVAL;

  RETURN QUERY
  SELECT 
    'total_messages_processed'::TEXT,
    COUNT(*)::NUMERIC,
    'count'::TEXT
  FROM processed_webhook_messages
  WHERE processed_at > NOW() - (lookback_hours || ' hours')::INTERVAL;

  RETURN QUERY
  SELECT 
    'avg_processing_time_ms'::TEXT,
    ROUND(AVG(processing_time_ms)::NUMERIC, 2),
    'milliseconds'::TEXT
  FROM processed_webhook_messages
  WHERE processed_at > NOW() - (lookback_hours || ' hours')::INTERVAL;

  RETURN QUERY
  SELECT 
    'p95_processing_time_ms'::TEXT,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY processing_time_ms)::NUMERIC, 2),
    'milliseconds'::TEXT
  FROM processed_webhook_messages
  WHERE processed_at > NOW() - (lookback_hours || ' hours')::INTERVAL;

  RETURN QUERY
  SELECT 
    'dlq_messages'::TEXT,
    COUNT(*)::NUMERIC,
    'count'::TEXT
  FROM webhook_dlq
  WHERE created_at > NOW() - (lookback_hours || ' hours')::INTERVAL;

  RETURN QUERY
  SELECT 
    'stuck_conversations'::TEXT,
    COUNT(*)::NUMERIC,
    'count'::TEXT
  FROM stuck_webhook_conversations;

  RETURN QUERY
  SELECT 
    'active_sessions'::TEXT,
    COUNT(*)::NUMERIC,
    'count'::TEXT
  FROM agent_sessions
  WHERE session_state = 'active'
    AND started_at > NOW() - (lookback_hours || ' hours')::INTERVAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
