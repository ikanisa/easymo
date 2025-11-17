-- WhatsApp Webhook State Management Enhancement
-- Implements critical fixes for message processing pipeline
-- - Idempotency tracking
-- - Dead letter queue for failed messages
-- - AI agent context storage
-- - Conversation state audit trail
-- - Performance indexes

BEGIN;

-- 1. Add conversation state tracking columns (if conversations table exists)
-- Note: Creating a generic conversation tracking table since specific table wasn't found
CREATE TABLE IF NOT EXISTS webhook_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  whatsapp_phone TEXT NOT NULL,
  agent_type TEXT CHECK (agent_type IN ('waiter', 'real_estate', 'job_board', 'mobility', 'marketplace', 'wallet')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'processing', 'completed', 'timeout', 'error')),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  retry_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  locked_by UUID,
  locked_at TIMESTAMPTZ,
  conversation_context JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for active conversation lookups
CREATE INDEX IF NOT EXISTS idx_webhook_conversations_user_status 
ON webhook_conversations(user_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_conversations_phone_active 
ON webhook_conversations(whatsapp_phone, status) 
WHERE status IN ('active', 'pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_webhook_conversations_locked 
ON webhook_conversations(locked_by, locked_at) 
WHERE locked_by IS NOT NULL;

-- 2. Create state transition audit table
CREATE TABLE IF NOT EXISTS conversation_state_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES webhook_conversations(id) ON DELETE CASCADE,
  from_state TEXT,
  to_state TEXT NOT NULL,
  transition_reason TEXT,
  correlation_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_state_transitions_conversation 
ON conversation_state_transitions(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_state_transitions_correlation 
ON conversation_state_transitions(correlation_id);

-- 3. Create AI agent context storage
CREATE TABLE IF NOT EXISTS agent_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES webhook_conversations(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL CHECK (agent_type IN ('waiter', 'real_estate', 'job_board', 'mobility', 'marketplace', 'wallet')),
  context_data JSONB NOT NULL DEFAULT '{}',
  token_count INTEGER DEFAULT 0,
  messages_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_contexts_conversation 
ON agent_contexts(conversation_id, agent_type);

-- 4. Create agent sessions table
CREATE TABLE IF NOT EXISTS agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES webhook_conversations(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL,
  session_state TEXT DEFAULT 'active' CHECK (session_state IN ('active', 'completed', 'failed', 'timeout')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  total_messages INTEGER DEFAULT 0,
  total_tokens_used INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_conversation 
ON agent_sessions(conversation_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_type_state 
ON agent_sessions(agent_type, session_state, started_at DESC);

-- 5. Add processed messages tracking for idempotency
CREATE TABLE IF NOT EXISTS processed_webhook_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_message_id TEXT UNIQUE NOT NULL,
  correlation_id UUID NOT NULL,
  conversation_id UUID REFERENCES webhook_conversations(id) ON DELETE SET NULL,
  payload JSONB,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  processing_time_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_processed_messages_whatsapp_id 
ON processed_webhook_messages(whatsapp_message_id);

CREATE INDEX IF NOT EXISTS idx_processed_messages_correlation 
ON processed_webhook_messages(correlation_id);

-- 6. Create webhook dead letter queue
CREATE TABLE IF NOT EXISTS webhook_dlq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payload JSONB NOT NULL,
  error TEXT,
  error_stack TEXT,
  correlation_id UUID,
  whatsapp_message_id TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  resolution_status TEXT CHECK (resolution_status IN ('pending', 'retrying', 'resolved', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_webhook_dlq_retry 
ON webhook_dlq(next_retry_at, resolution_status) 
WHERE resolution_status IN ('pending', 'retrying');

CREATE INDEX IF NOT EXISTS idx_webhook_dlq_correlation 
ON webhook_dlq(correlation_id);

-- 7. Add RLS policies (enable but allow service role full access)
ALTER TABLE webhook_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_state_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE processed_webhook_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_dlq ENABLE ROW LEVEL SECURITY;

-- Service role bypass policy (for edge functions)
CREATE POLICY service_role_all ON webhook_conversations FOR ALL USING (true);
CREATE POLICY service_role_all ON agent_contexts FOR ALL USING (true);
CREATE POLICY service_role_all ON agent_sessions FOR ALL USING (true);
CREATE POLICY service_role_all ON conversation_state_transitions FOR ALL USING (true);
CREATE POLICY service_role_all ON processed_webhook_messages FOR ALL USING (true);
CREATE POLICY service_role_all ON webhook_dlq FOR ALL USING (true);

-- 8. Create cleanup function for stuck conversations
CREATE OR REPLACE FUNCTION cleanup_stuck_webhook_conversations()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- Release locks older than 2 minutes
  UPDATE webhook_conversations
  SET 
    locked_by = NULL,
    locked_at = NULL,
    status = CASE 
      WHEN status = 'processing' THEN 'timeout'
      ELSE status
    END,
    error_count = error_count + 1,
    updated_at = NOW()
  WHERE locked_at < NOW() - INTERVAL '2 minutes'
    AND locked_by IS NOT NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  -- Mark conversations as timeout if stuck too long
  UPDATE webhook_conversations
  SET 
    status = 'timeout',
    error_count = error_count + 1,
    updated_at = NOW()
  WHERE status IN ('processing', 'pending')
    AND last_activity_at < NOW() - INTERVAL '5 minutes'
    AND (locked_by IS NULL OR locked_at < NOW() - INTERVAL '2 minutes');
  
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Create helper function to acquire conversation lock
CREATE OR REPLACE FUNCTION acquire_conversation_lock(
  p_conversation_id UUID,
  p_lock_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  lock_acquired BOOLEAN;
BEGIN
  UPDATE webhook_conversations
  SET 
    locked_by = p_lock_id,
    locked_at = NOW(),
    status = 'processing',
    updated_at = NOW()
  WHERE id = p_conversation_id
    AND (locked_by IS NULL OR locked_at < NOW() - INTERVAL '2 minutes')
  RETURNING TRUE INTO lock_acquired;
  
  RETURN COALESCE(lock_acquired, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Create helper function to release conversation lock
CREATE OR REPLACE FUNCTION release_conversation_lock(
  p_conversation_id UUID,
  p_lock_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  lock_released BOOLEAN;
BEGIN
  UPDATE webhook_conversations
  SET 
    locked_by = NULL,
    locked_at = NULL,
    last_activity_at = NOW(),
    updated_at = NOW()
  WHERE id = p_conversation_id
    AND locked_by = p_lock_id
  RETURNING TRUE INTO lock_released;
  
  RETURN COALESCE(lock_released, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Create helper function to update session metrics
CREATE OR REPLACE FUNCTION increment_session_metrics(
  p_conversation_id UUID,
  p_agent_type TEXT
)
RETURNS VOID AS $$
BEGIN
  -- Update existing session or create new one
  INSERT INTO agent_sessions (conversation_id, agent_type, total_messages)
  VALUES (p_conversation_id, p_agent_type, 1)
  ON CONFLICT (conversation_id, agent_type) DO UPDATE
  SET 
    total_messages = agent_sessions.total_messages + 1,
    metadata = jsonb_set(
      COALESCE(agent_sessions.metadata, '{}'::jsonb),
      '{last_message_at}',
      to_jsonb(NOW())
    )
  WHERE agent_sessions.conversation_id = p_conversation_id
    AND agent_sessions.agent_type = p_agent_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add unique constraint for active sessions per conversation
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_sessions_conversation_agent_active
ON agent_sessions(conversation_id, agent_type)
WHERE session_state = 'active';

COMMIT;
