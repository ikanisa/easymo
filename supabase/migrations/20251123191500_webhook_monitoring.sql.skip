-- ============================================
-- WEBHOOK MONITORING VIEWS & QUERIES
-- ============================================
-- Created: 2025-11-23
-- Purpose: Real-time monitoring and analytics for webhook infrastructure

BEGIN;

-- ============================================
-- REAL-TIME WEBHOOK PROCESSING STATS
-- ============================================

CREATE OR REPLACE VIEW webhook_stats AS
SELECT 
  date_trunc('minute', created_at) as minute,
  status,
  source,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_processing_time_sec,
  MAX(EXTRACT(EPOCH FROM (completed_at - started_at))) as max_processing_time_sec,
  MIN(EXTRACT(EPOCH FROM (completed_at - started_at))) as min_processing_time_sec,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
  SUM(CASE WHEN status = 'dead' THEN 1 ELSE 0 END) as dead_count
FROM webhook_queue
WHERE created_at >= now() - interval '1 hour'
GROUP BY date_trunc('minute', created_at), status, source
ORDER BY minute DESC;

COMMENT ON VIEW webhook_stats IS 'Real-time webhook processing statistics aggregated by minute';

-- ============================================
-- MESSAGE VOLUME BY TYPE
-- ============================================

CREATE OR REPLACE VIEW message_volume AS
SELECT 
  date_trunc('hour', created_at) as hour,
  type,
  direction,
  COUNT(*) as count,
  AVG(processing_time_ms) as avg_processing_time_ms,
  SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered_count,
  SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as read_count,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count
FROM messages
WHERE created_at >= now() - interval '24 hours'
GROUP BY date_trunc('hour', created_at), type, direction
ORDER BY hour DESC;

COMMENT ON VIEW message_volume IS 'Message volume and delivery statistics by hour';

-- ============================================
-- CONVERSATION ACTIVITY
-- ============================================

CREATE OR REPLACE VIEW conversation_activity AS
SELECT 
  date_trunc('day', c.created_at) as day,
  c.status,
  COUNT(DISTINCT c.id) as conversation_count,
  COUNT(m.id) as message_count,
  AVG(EXTRACT(EPOCH FROM (m.created_at - c.created_at))) as avg_first_response_time_sec
FROM conversations c
LEFT JOIN messages m ON c.id = m.conversation_id AND m.direction = 'outbound'
WHERE c.created_at >= now() - interval '7 days'
GROUP BY date_trunc('day', c.created_at), c.status
ORDER BY day DESC;

COMMENT ON VIEW conversation_activity IS 'Daily conversation activity and response times';

-- ============================================
-- RATE LIMIT VIOLATIONS
-- ============================================

CREATE OR REPLACE VIEW rate_limit_violations AS
SELECT 
  date_trunc('hour', created_at) as hour,
  identifier,
  bucket,
  COUNT(*) as violation_count,
  MAX(violation_count) as max_violations,
  MAX(blocked_until) as latest_block_until
FROM rate_limits
WHERE violation_count > 0
  AND created_at >= now() - interval '24 hours'
GROUP BY date_trunc('hour', created_at), identifier, bucket
ORDER BY hour DESC, violation_count DESC;

COMMENT ON VIEW rate_limit_violations IS 'Rate limiting violations by hour and identifier';

-- ============================================
-- WEBHOOK QUEUE HEALTH
-- ============================================

CREATE OR REPLACE VIEW webhook_queue_health AS
SELECT 
  status,
  COUNT(*) as count,
  MIN(created_at) as oldest_created_at,
  MAX(created_at) as newest_created_at,
  AVG(retry_count) as avg_retry_count,
  MAX(retry_count) as max_retry_count,
  SUM(CASE WHEN next_retry_at < now() THEN 1 ELSE 0 END) as ready_for_retry
FROM webhook_queue
WHERE status IN ('pending', 'failed', 'processing')
GROUP BY status;

COMMENT ON VIEW webhook_queue_health IS 'Current state of webhook queue';

-- ============================================
-- MESSAGE DELIVERY FUNNEL
-- ============================================

CREATE OR REPLACE VIEW message_delivery_funnel AS
WITH message_stats AS (
  SELECT 
    COUNT(*) FILTER (WHERE status = 'pending') as pending,
    COUNT(*) FILTER (WHERE status = 'sent') as sent,
    COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
    COUNT(*) FILTER (WHERE status = 'read') as read,
    COUNT(*) FILTER (WHERE status = 'failed') as failed,
    COUNT(*) FILTER (WHERE direction = 'outbound') as total_outbound
  FROM messages
  WHERE created_at >= now() - interval '24 hours'
    AND direction = 'outbound'
)
SELECT 
  'pending' as stage,
  pending as count,
  ROUND(100.0 * pending / NULLIF(total_outbound, 0), 2) as percentage
FROM message_stats
UNION ALL
SELECT 
  'sent',
  sent,
  ROUND(100.0 * sent / NULLIF(total_outbound, 0), 2)
FROM message_stats
UNION ALL
SELECT 
  'delivered',
  delivered,
  ROUND(100.0 * delivered / NULLIF(total_outbound, 0), 2)
FROM message_stats
UNION ALL
SELECT 
  'read',
  read,
  ROUND(100.0 * read / NULLIF(total_outbound, 0), 2)
FROM message_stats
UNION ALL
SELECT 
  'failed',
  failed,
  ROUND(100.0 * failed / NULLIF(total_outbound, 0), 2)
FROM message_stats;

COMMENT ON VIEW message_delivery_funnel IS 'Message delivery funnel showing conversion rates';

-- ============================================
-- METRICS SUMMARY
-- ============================================

CREATE OR REPLACE VIEW metrics_summary AS
SELECT 
  metric_type,
  metric_name,
  COUNT(*) as data_points,
  AVG(metric_value) as avg_value,
  MIN(metric_value) as min_value,
  MAX(metric_value) as max_value,
  STDDEV(metric_value) as stddev_value,
  MIN(timestamp) as earliest_timestamp,
  MAX(timestamp) as latest_timestamp
FROM webhook_metrics
WHERE timestamp >= now() - interval '1 hour'
GROUP BY metric_type, metric_name
ORDER BY metric_name;

COMMENT ON VIEW metrics_summary IS 'Aggregated metrics summary for the last hour';

-- ============================================
-- TOP ERROR MESSAGES
-- ============================================

CREATE OR REPLACE VIEW top_error_messages AS
SELECT 
  error_message,
  COUNT(*) as occurrence_count,
  MIN(created_at) as first_seen,
  MAX(created_at) as last_seen,
  COUNT(DISTINCT correlation_id) as affected_webhooks
FROM webhook_queue
WHERE status IN ('failed', 'dead')
  AND created_at >= now() - interval '24 hours'
GROUP BY error_message
ORDER BY occurrence_count DESC
LIMIT 20;

COMMENT ON VIEW top_error_messages IS 'Most common error messages in the last 24 hours';

-- ============================================
-- IDEMPOTENCY CACHE HIT RATE
-- ============================================

CREATE OR REPLACE VIEW idempotency_stats AS
WITH recent_keys AS (
  SELECT 
    DATE(created_at) as day,
    COUNT(*) as total_keys,
    COUNT(DISTINCT key) as unique_keys
  FROM idempotency_keys
  WHERE created_at >= now() - interval '7 days'
  GROUP BY DATE(created_at)
)
SELECT 
  day,
  total_keys,
  unique_keys,
  total_keys - unique_keys as duplicate_requests,
  ROUND(100.0 * (total_keys - unique_keys) / NULLIF(total_keys, 0), 2) as cache_hit_rate_pct
FROM recent_keys
ORDER BY day DESC;

COMMENT ON VIEW idempotency_stats IS 'Idempotency cache hit rates by day';

-- ============================================
-- ACTIVE CONVERSATIONS
-- ============================================

CREATE OR REPLACE VIEW active_conversations AS
SELECT 
  c.id,
  c.phone_number,
  c.display_name,
  c.status,
  c.last_message_at,
  COUNT(m.id) as message_count,
  MAX(m.created_at) FILTER (WHERE m.direction = 'inbound') as last_inbound_at,
  MAX(m.created_at) FILTER (WHERE m.direction = 'outbound') as last_outbound_at,
  EXTRACT(EPOCH FROM (now() - c.last_message_at)) as seconds_since_last_message
FROM conversations c
LEFT JOIN messages m ON c.id = m.conversation_id
WHERE c.status = 'active'
  AND c.last_message_at >= now() - interval '24 hours'
GROUP BY c.id, c.phone_number, c.display_name, c.status, c.last_message_at
ORDER BY c.last_message_at DESC;

COMMENT ON VIEW active_conversations IS 'Currently active conversations with message counts';

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get webhook processing summary
CREATE OR REPLACE FUNCTION get_webhook_summary(
  p_interval interval DEFAULT interval '1 hour'
)
RETURNS TABLE (
  total_webhooks bigint,
  completed_webhooks bigint,
  failed_webhooks bigint,
  pending_webhooks bigint,
  avg_processing_time_sec numeric,
  success_rate_pct numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_webhooks,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_webhooks,
    COUNT(*) FILTER (WHERE status IN ('failed', 'dead')) as failed_webhooks,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_webhooks,
    ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - started_at))), 2) as avg_processing_time_sec,
    ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'completed') / NULLIF(COUNT(*), 0), 2) as success_rate_pct
  FROM webhook_queue
  WHERE created_at >= now() - p_interval;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_webhook_summary IS 'Get webhook processing summary for a given time interval';

-- Function to get slow webhooks
CREATE OR REPLACE FUNCTION get_slow_webhooks(
  p_threshold_seconds integer DEFAULT 5,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  source text,
  created_at timestamptz,
  processing_time_sec numeric,
  retry_count integer,
  error_message text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wq.id,
    wq.source,
    wq.created_at,
    ROUND(EXTRACT(EPOCH FROM (wq.completed_at - wq.started_at)), 2) as processing_time_sec,
    wq.retry_count,
    wq.error_message
  FROM webhook_queue wq
  WHERE wq.completed_at IS NOT NULL
    AND EXTRACT(EPOCH FROM (wq.completed_at - wq.started_at)) > p_threshold_seconds
  ORDER BY processing_time_sec DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_slow_webhooks IS 'Get webhooks that took longer than threshold to process';

COMMIT;
