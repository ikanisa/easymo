-- AI Agent System Enhancements
-- Date: 2025-11-16
-- Description: Add conversation memory, message queue, and workflow tracking
-- for robust AI agent operations with retry logic and state persistence

BEGIN;

-- ============================================================================
-- 1. AI CONVERSATION MEMORY (for context across messages)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_conversation_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_phone TEXT NOT NULL,
  agent_type TEXT NOT NULL CHECK (agent_type IN ('waiter-ai', 'job-board-ai', 'real_estate', 'concierge-router', 'mobility', 'marketplace', 'wallet')),
  conversation_history JSONB DEFAULT '[]'::jsonb,
  context JSONB DEFAULT '{}'::jsonb,
  last_interaction TIMESTAMPTZ DEFAULT NOW(),
  session_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_agent_session UNIQUE (user_phone, agent_type, session_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_memory_user_phone 
  ON ai_conversation_memory(user_phone);

CREATE INDEX IF NOT EXISTS idx_ai_memory_agent_type 
  ON ai_conversation_memory(agent_type, last_interaction DESC);

CREATE INDEX IF NOT EXISTS idx_ai_memory_last_interaction 
  ON ai_conversation_memory(last_interaction DESC) 
  WHERE last_interaction > NOW() - INTERVAL '24 hours';

-- RLS for conversation memory
ALTER TABLE ai_conversation_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all ON ai_conversation_memory FOR ALL USING (true);

COMMENT ON TABLE ai_conversation_memory IS 'Stores AI agent conversation history and context for continuity across messages';
COMMENT ON COLUMN ai_conversation_memory.conversation_history IS 'Array of message objects with role, content, timestamp';
COMMENT ON COLUMN ai_conversation_memory.context IS 'Additional context like user preferences, order state, etc.';

-- ============================================================================
-- 2. MESSAGE QUEUE FOR RELIABLE PROCESSING
-- ============================================================================
CREATE TABLE IF NOT EXISTS message_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT UNIQUE NOT NULL,
  user_phone TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('text', 'image', 'audio', 'video', 'document', 'interactive', 'button', 'template')),
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'retry')),
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  error_details JSONB,
  correlation_id UUID,
  priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  locked_by UUID,
  locked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_message_queue_status 
  ON message_queue(status, next_retry_at, priority DESC) 
  WHERE status IN ('pending', 'retry');

CREATE INDEX IF NOT EXISTS idx_message_queue_user 
  ON message_queue(user_phone, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_message_queue_correlation 
  ON message_queue(correlation_id) 
  WHERE correlation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_message_queue_locked 
  ON message_queue(locked_by, locked_at) 
  WHERE locked_by IS NOT NULL;

-- RLS for message queue
ALTER TABLE message_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all ON message_queue FOR ALL USING (true);

COMMENT ON TABLE message_queue IS 'Reliable message processing queue with retry logic';
COMMENT ON COLUMN message_queue.priority IS '1=highest, 10=lowest priority';

-- ============================================================================
-- 3. WORKFLOW STATE TRACKING
-- ============================================================================
CREATE TABLE IF NOT EXISTS workflow_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_phone TEXT NOT NULL,
  workflow_type TEXT NOT NULL CHECK (workflow_type IN ('order', 'payment', 'job_application', 'property_inquiry', 'ride_request', 'insurance_claim', 'onboarding')),
  current_step TEXT NOT NULL,
  workflow_data JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'failed', 'timeout')),
  agent_type TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  timeout_at TIMESTAMPTZ,
  error_info JSONB,
  correlation_id UUID,
  CONSTRAINT unique_active_workflow UNIQUE (user_phone, workflow_type) 
    WHERE status = 'active'
);

CREATE INDEX IF NOT EXISTS idx_workflow_states_active 
  ON workflow_states(user_phone, status, workflow_type) 
  WHERE status IN ('active', 'paused');

CREATE INDEX IF NOT EXISTS idx_workflow_timeout 
  ON workflow_states(timeout_at) 
  WHERE status = 'active' AND timeout_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workflow_updated 
  ON workflow_states(updated_at DESC);

-- RLS for workflow states
ALTER TABLE workflow_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all ON workflow_states FOR ALL USING (true);

COMMENT ON TABLE workflow_states IS 'Tracks multi-step workflow states for users';
COMMENT ON COLUMN workflow_states.current_step IS 'Current step identifier in the workflow';
COMMENT ON COLUMN workflow_states.workflow_data IS 'Workflow-specific state data';

-- ============================================================================
-- 4. HELPER FUNCTIONS FOR QUEUE MANAGEMENT
-- ============================================================================

-- Function to acquire message lock for processing
CREATE OR REPLACE FUNCTION acquire_message_lock(
  p_message_id UUID,
  p_lock_id UUID,
  p_lock_duration_seconds INTEGER DEFAULT 60
)
RETURNS BOOLEAN AS $$
DECLARE
  lock_acquired BOOLEAN;
BEGIN
  UPDATE message_queue
  SET 
    locked_by = p_lock_id,
    locked_at = NOW(),
    status = 'processing',
    processed_at = NOW()
  WHERE id = p_message_id
    AND (locked_by IS NULL OR locked_at < NOW() - (p_lock_duration_seconds || ' seconds')::INTERVAL)
    AND status IN ('pending', 'retry')
  RETURNING TRUE INTO lock_acquired;
  
  RETURN COALESCE(lock_acquired, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to release message lock
CREATE OR REPLACE FUNCTION release_message_lock(
  p_message_id UUID,
  p_lock_id UUID,
  p_status TEXT DEFAULT 'completed'
)
RETURNS BOOLEAN AS $$
DECLARE
  lock_released BOOLEAN;
BEGIN
  UPDATE message_queue
  SET 
    locked_by = NULL,
    locked_at = NULL,
    status = p_status,
    completed_at = CASE WHEN p_status = 'completed' THEN NOW() ELSE completed_at END
  WHERE id = p_message_id
    AND locked_by = p_lock_id
  RETURNING TRUE INTO lock_released;
  
  RETURN COALESCE(lock_released, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to schedule message retry with exponential backoff
CREATE OR REPLACE FUNCTION schedule_message_retry(
  p_message_id UUID,
  p_error_details JSONB DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  current_retry INTEGER;
  max_retry INTEGER;
  backoff_seconds INTEGER;
  scheduled BOOLEAN;
BEGIN
  -- Get current retry count and max retries
  SELECT retry_count, max_retries
  INTO current_retry, max_retry
  FROM message_queue
  WHERE id = p_message_id;
  
  IF current_retry >= max_retry THEN
    -- Max retries reached, mark as failed
    UPDATE message_queue
    SET 
      status = 'failed',
      error_details = COALESCE(p_error_details, error_details),
      locked_by = NULL,
      locked_at = NULL
    WHERE id = p_message_id;
    
    RETURN FALSE;
  END IF;
  
  -- Calculate exponential backoff: 1s, 2s, 4s, 8s...
  backoff_seconds := POWER(2, current_retry);
  
  UPDATE message_queue
  SET 
    status = 'retry',
    retry_count = retry_count + 1,
    next_retry_at = NOW() + (backoff_seconds || ' seconds')::INTERVAL,
    error_details = COALESCE(p_error_details, error_details),
    locked_by = NULL,
    locked_at = NULL
  WHERE id = p_message_id
  RETURNING TRUE INTO scheduled;
  
  RETURN COALESCE(scheduled, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup old completed messages (keep last 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_messages()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM message_queue
  WHERE status = 'completed'
    AND completed_at < NOW() - INTERVAL '7 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup stale locks
CREATE OR REPLACE FUNCTION cleanup_stale_message_locks()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE message_queue
  SET 
    locked_by = NULL,
    locked_at = NULL,
    status = 'retry',
    retry_count = retry_count + 1,
    next_retry_at = NOW() + INTERVAL '30 seconds'
  WHERE locked_at < NOW() - INTERVAL '5 minutes'
    AND locked_by IS NOT NULL
    AND status = 'processing';
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get next message from queue
CREATE OR REPLACE FUNCTION get_next_queue_message(p_lock_id UUID)
RETURNS TABLE(
  message_id UUID,
  message_external_id TEXT,
  user_phone TEXT,
  message_type TEXT,
  payload JSONB,
  retry_count INTEGER,
  correlation_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mq.id,
    mq.message_id,
    mq.user_phone,
    mq.message_type,
    mq.payload,
    mq.retry_count,
    mq.correlation_id
  FROM message_queue mq
  WHERE mq.status IN ('pending', 'retry')
    AND (mq.next_retry_at IS NULL OR mq.next_retry_at <= NOW())
    AND (mq.locked_by IS NULL OR mq.locked_at < NOW() - INTERVAL '5 minutes')
  ORDER BY mq.priority ASC, mq.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. MONITORING VIEWS
-- ============================================================================

-- View for queue health
CREATE OR REPLACE VIEW message_queue_health AS
SELECT 
  status,
  COUNT(*) as count,
  ROUND(AVG(retry_count)) as avg_retries,
  MAX(retry_count) as max_retries,
  MIN(created_at) as oldest_message,
  COUNT(*) FILTER (WHERE locked_by IS NOT NULL) as locked_count
FROM message_queue
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status;

-- View for workflow health
CREATE OR REPLACE VIEW workflow_health AS
SELECT 
  workflow_type,
  status,
  COUNT(*) as count,
  ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(completed_at, NOW()) - started_at)))) as avg_duration_seconds,
  MAX(EXTRACT(EPOCH FROM (NOW() - updated_at))) as max_idle_seconds
FROM workflow_states
WHERE started_at > NOW() - INTERVAL '24 hours'
GROUP BY workflow_type, status;

-- View for AI agent usage
CREATE OR REPLACE VIEW ai_agent_usage AS
SELECT 
  agent_type,
  COUNT(DISTINCT user_phone) as unique_users,
  COUNT(*) as total_conversations,
  ROUND(AVG(jsonb_array_length(conversation_history))) as avg_messages_per_conversation,
  MAX(last_interaction) as last_used,
  COUNT(*) FILTER (WHERE last_interaction > NOW() - INTERVAL '1 hour') as active_last_hour
FROM ai_conversation_memory
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY agent_type;

COMMIT;
