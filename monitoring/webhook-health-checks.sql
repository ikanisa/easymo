-- Monitoring & Health Check Queries for WhatsApp Webhook System
-- Run these queries to monitor system health and identify issues

-- ============================================================================
-- 1. CHECK FOR STUCK WORKFLOWS
-- ============================================================================
-- Identifies workflows that have been active for too long
SELECT 
    workflow_type,
    COUNT(*) as stuck_count,
    MIN(started_at) as oldest_workflow,
    MAX(EXTRACT(EPOCH FROM (NOW() - started_at))) as max_age_seconds,
    array_agg(id ORDER BY started_at LIMIT 5) as sample_workflow_ids
FROM workflow_states
WHERE status = 'active'
    AND started_at < NOW() - INTERVAL '30 minutes'
GROUP BY workflow_type
ORDER BY stuck_count DESC;

-- ============================================================================
-- 2. MESSAGE QUEUE HEALTH
-- ============================================================================
-- Shows current state of message queue with retry statistics
SELECT 
    status,
    COUNT(*) as message_count,
    ROUND(AVG(retry_count), 2) as avg_retries,
    MAX(retry_count) as max_retries,
    COUNT(*) FILTER (WHERE retry_count >= max_retries) as max_retries_reached,
    MIN(created_at) as oldest_message,
    EXTRACT(EPOCH FROM (NOW() - MIN(created_at)))::INTEGER as oldest_age_seconds
FROM message_queue
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY status
ORDER BY 
    CASE status
        WHEN 'processing' THEN 1
        WHEN 'pending' THEN 2
        WHEN 'retry' THEN 3
        WHEN 'failed' THEN 4
        WHEN 'completed' THEN 5
    END;

-- ============================================================================
-- 3. DEAD LETTER QUEUE (DLQ) ANALYSIS
-- ============================================================================
-- Shows messages that have failed processing
SELECT 
    resolution_status,
    COUNT(*) as count,
    COUNT(*) FILTER (WHERE retry_count >= max_retries) as exhausted_retries,
    ROUND(AVG(retry_count), 2) as avg_retries,
    MIN(created_at) as oldest_entry,
    MAX(created_at) as newest_entry,
    array_agg(DISTINCT error) FILTER (WHERE error IS NOT NULL) as unique_errors
FROM webhook_dlq
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY resolution_status
ORDER BY count DESC;

-- ============================================================================
-- 4. AI AGENT PERFORMANCE METRICS
-- ============================================================================
-- Shows performance statistics for each AI agent type
SELECT 
    agent_type,
    COUNT(DISTINCT user_phone) as unique_users,
    COUNT(*) as total_conversations,
    ROUND(AVG(jsonb_array_length(conversation_history)), 1) as avg_messages_per_conversation,
    MAX(last_interaction) as last_activity,
    COUNT(*) FILTER (WHERE last_interaction > NOW() - INTERVAL '1 hour') as active_last_hour,
    COUNT(*) FILTER (WHERE last_interaction > NOW() - INTERVAL '24 hours') as active_last_day
FROM ai_conversation_memory
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY agent_type
ORDER BY total_conversations DESC;

-- ============================================================================
-- 5. CONVERSATION STATE HEALTH
-- ============================================================================
-- Overview of webhook conversation states
SELECT 
    status,
    agent_type,
    COUNT(*) as count,
    ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - last_activity_at)))) as avg_idle_seconds,
    MAX(retry_count) as max_retries,
    SUM(error_count) as total_errors,
    COUNT(*) FILTER (WHERE locked_by IS NOT NULL) as locked_count
FROM webhook_conversations
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status, agent_type
ORDER BY count DESC;

-- ============================================================================
-- 6. MESSAGE PROCESSING LATENCY
-- ============================================================================
-- Shows p50, p95, p99 latencies for message processing
SELECT 
    DATE_TRUNC('hour', processed_at) as hour,
    COUNT(*) as messages_processed,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY processing_time_ms)) as p50_ms,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY processing_time_ms)) as p95_ms,
    ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY processing_time_ms)) as p99_ms,
    MAX(processing_time_ms) as max_ms,
    ROUND(AVG(processing_time_ms)) as avg_ms
FROM processed_webhook_messages
WHERE processed_at > NOW() - INTERVAL '24 hours'
    AND processing_time_ms IS NOT NULL
GROUP BY DATE_TRUNC('hour', processed_at)
ORDER BY hour DESC
LIMIT 24;

-- ============================================================================
-- 7. ERROR RATE BY HOUR
-- ============================================================================
-- Shows error rates over time to identify patterns
WITH hourly_stats AS (
    SELECT 
        DATE_TRUNC('hour', created_at) as hour,
        COUNT(*) as total_conversations,
        SUM(error_count) as total_errors,
        COUNT(*) FILTER (WHERE status = 'error') as error_conversations
    FROM webhook_conversations
    WHERE created_at > NOW() - INTERVAL '24 hours'
    GROUP BY DATE_TRUNC('hour', created_at)
)
SELECT 
    hour,
    total_conversations,
    total_errors,
    error_conversations,
    ROUND(100.0 * error_conversations / NULLIF(total_conversations, 0), 2) as error_rate_percent
FROM hourly_stats
ORDER BY hour DESC;

-- ============================================================================
-- 8. TOP ERRORS IN LAST HOUR
-- ============================================================================
-- Identifies most common errors for investigation
SELECT 
    error,
    COUNT(*) as occurrence_count,
    MIN(created_at) as first_seen,
    MAX(created_at) as last_seen,
    array_agg(DISTINCT whatsapp_message_id) FILTER (WHERE whatsapp_message_id IS NOT NULL) as sample_message_ids
FROM webhook_dlq
WHERE created_at > NOW() - INTERVAL '1 hour'
    AND error IS NOT NULL
GROUP BY error
ORDER BY occurrence_count DESC
LIMIT 10;

-- ============================================================================
-- 9. WORKFLOW COMPLETION RATES
-- ============================================================================
-- Shows completion rates for different workflow types
SELECT 
    workflow_type,
    COUNT(*) as total_workflows,
    COUNT(*) FILTER (WHERE status = 'completed') as completed,
    COUNT(*) FILTER (WHERE status = 'failed') as failed,
    COUNT(*) FILTER (WHERE status = 'timeout') as timeout,
    COUNT(*) FILTER (WHERE status = 'active') as still_active,
    ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'completed') / COUNT(*), 2) as completion_rate_percent,
    ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(completed_at, NOW()) - started_at)))) as avg_duration_seconds
FROM workflow_states
WHERE started_at > NOW() - INTERVAL '24 hours'
GROUP BY workflow_type
ORDER BY total_workflows DESC;

-- ============================================================================
-- 10. AGENT SESSION STATISTICS
-- ============================================================================
-- Shows agent session metrics for capacity planning
SELECT 
    agent_type,
    session_state,
    COUNT(*) as session_count,
    ROUND(AVG(total_messages), 1) as avg_messages,
    ROUND(AVG(total_tokens_used)) as avg_tokens,
    ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at)))) as avg_duration_seconds,
    SUM(error_count) as total_errors
FROM agent_sessions
WHERE started_at > NOW() - INTERVAL '24 hours'
GROUP BY agent_type, session_state
ORDER BY agent_type, session_count DESC;

-- ============================================================================
-- 11. CIRCUIT BREAKER STATUS (Via Webhook Conversations)
-- ============================================================================
-- Identifies services that may be experiencing issues
SELECT 
    agent_type,
    COUNT(*) FILTER (WHERE error_count >= 3) as high_error_conversations,
    ROUND(AVG(error_count), 2) as avg_errors_per_conversation,
    MAX(error_count) as max_errors,
    COUNT(*) FILTER (WHERE status = 'timeout') as timeout_count
FROM webhook_conversations
WHERE created_at > NOW() - INTERVAL '1 hour'
    AND agent_type IS NOT NULL
GROUP BY agent_type
HAVING COUNT(*) FILTER (WHERE error_count >= 3) > 0
ORDER BY high_error_conversations DESC;

-- ============================================================================
-- 12. STALE LOCK DETECTION
-- ============================================================================
-- Finds locks that may need to be released
SELECT 
    'message_queue' as table_name,
    id,
    locked_by,
    locked_at,
    EXTRACT(EPOCH FROM (NOW() - locked_at))::INTEGER as lock_age_seconds,
    status,
    retry_count
FROM message_queue
WHERE locked_by IS NOT NULL
    AND locked_at < NOW() - INTERVAL '2 minutes'
UNION ALL
SELECT 
    'webhook_conversations' as table_name,
    id,
    locked_by,
    locked_at,
    EXTRACT(EPOCH FROM (NOW() - locked_at))::INTEGER as lock_age_seconds,
    status,
    retry_count
FROM webhook_conversations
WHERE locked_by IS NOT NULL
    AND locked_at < NOW() - INTERVAL '2 minutes'
ORDER BY lock_age_seconds DESC;

-- ============================================================================
-- 13. MESSAGE DEDUPLICATION EFFECTIVENESS
-- ============================================================================
-- Shows how often duplicate messages are being received
WITH message_counts AS (
    SELECT 
        whatsapp_message_id,
        COUNT(*) as duplicate_count
    FROM processed_webhook_messages
    WHERE processed_at > NOW() - INTERVAL '24 hours'
    GROUP BY whatsapp_message_id
)
SELECT 
    duplicate_count,
    COUNT(*) as messages_with_this_count,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM message_counts
GROUP BY duplicate_count
ORDER BY duplicate_count DESC;

-- ============================================================================
-- 14. SYSTEM HEALTH SUMMARY
-- ============================================================================
-- Overall system health at a glance
SELECT 
    'Message Queue Pending' as metric,
    COUNT(*)::TEXT as value,
    CASE WHEN COUNT(*) > 100 THEN 'WARNING' ELSE 'OK' END as status
FROM message_queue
WHERE status IN ('pending', 'retry')
UNION ALL
SELECT 
    'Stuck Workflows' as metric,
    COUNT(*)::TEXT as value,
    CASE WHEN COUNT(*) > 5 THEN 'CRITICAL' ELSE 'OK' END as status
FROM workflow_states
WHERE status = 'active' AND started_at < NOW() - INTERVAL '30 minutes'
UNION ALL
SELECT 
    'DLQ Messages (24h)' as metric,
    COUNT(*)::TEXT as value,
    CASE WHEN COUNT(*) > 10 THEN 'WARNING' ELSE 'OK' END as status
FROM webhook_dlq
WHERE created_at > NOW() - INTERVAL '24 hours' AND resolution_status IN ('pending', 'retrying')
UNION ALL
SELECT 
    'Active AI Sessions' as metric,
    COUNT(*)::TEXT as value,
    'INFO' as status
FROM agent_sessions
WHERE session_state = 'active' AND started_at > NOW() - INTERVAL '1 hour'
UNION ALL
SELECT 
    'Error Rate (1h)' as metric,
    ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'error') / NULLIF(COUNT(*), 0), 2)::TEXT || '%' as value,
    CASE 
        WHEN 100.0 * COUNT(*) FILTER (WHERE status = 'error') / NULLIF(COUNT(*), 0) > 10 THEN 'CRITICAL'
        WHEN 100.0 * COUNT(*) FILTER (WHERE status = 'error') / NULLIF(COUNT(*), 0) > 5 THEN 'WARNING'
        ELSE 'OK'
    END as status
FROM webhook_conversations
WHERE created_at > NOW() - INTERVAL '1 hour';
