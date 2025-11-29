-- Transaction wrapper for production safety
BEGIN;

-- Phase 5: Advanced Features - Conversation History & Memory
-- Enable vector search for semantic memory

-- Conversation history table with vector embeddings
CREATE TABLE IF NOT EXISTS conversation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  agent_type TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversation_history_user_id ON conversation_history(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_history_agent_type ON conversation_history(agent_type);
CREATE INDEX IF NOT EXISTS idx_conversation_history_timestamp ON conversation_history(timestamp DESC);

-- Vector similarity search index (using ivfflat)
CREATE INDEX IF NOT EXISTS idx_conversation_history_embedding 
ON conversation_history 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Function to search conversation history semantically
CREATE OR REPLACE FUNCTION search_conversation_history(
  user_id TEXT,
  query_embedding vector(1536),
  match_count INT DEFAULT 5,
  similarity_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  id UUID,
  role TEXT,
  content TEXT,
  timestamp TIMESTAMPTZ,
  similarity FLOAT
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ch.id,
    ch.role,
    ch.content,
    ch.timestamp,
    1 - (ch.embedding <=> query_embedding) AS similarity
  FROM conversation_history ch
  WHERE ch.user_id = search_conversation_history.user_id
    AND 1 - (ch.embedding <=> query_embedding) > similarity_threshold
  ORDER BY ch.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Agent collaboration table (for agent-to-agent communication)
CREATE TABLE IF NOT EXISTS agent_collaborations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initiating_agent TEXT NOT NULL,
  target_agent TEXT NOT NULL,
  user_id TEXT NOT NULL,
  request_type TEXT NOT NULL,
  request_data JSONB NOT NULL,
  response_data JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_collaborations_user_id ON agent_collaborations(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_collaborations_status ON agent_collaborations(status);

-- Proactive notifications table
CREATE TABLE IF NOT EXISTS proactive_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  agent_type TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proactive_notifications_user_id ON proactive_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_proactive_notifications_status ON proactive_notifications(status);
CREATE INDEX IF NOT EXISTS idx_proactive_notifications_scheduled ON proactive_notifications(scheduled_for);

-- Agent analytics table
CREATE TABLE IF NOT EXISTS agent_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type TEXT NOT NULL,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  query TEXT NOT NULL,
  response_time_ms INT NOT NULL,
  tools_used TEXT[] DEFAULT ARRAY[]::TEXT[],
  model_used TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_analytics_agent_type ON agent_analytics(agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_analytics_user_id ON agent_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_analytics_created_at ON agent_analytics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_analytics_success ON agent_analytics(success);

-- User preferences for multilingual support
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY,
  preferred_language TEXT NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en', 'fr', 'rw', 'sw')),
  timezone TEXT DEFAULT 'Africa/Kigali',
  notification_preferences JSONB DEFAULT '{
    "whatsapp": true,
    "sms": false,
    "email": false
  }'::jsonb,
  agent_preferences JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Function to get user's preferred language
CREATE OR REPLACE FUNCTION get_user_language(user_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  lang TEXT;
BEGIN
  SELECT preferred_language INTO lang
  FROM user_preferences
  WHERE user_preferences.user_id = get_user_language.user_id;
  
  RETURN COALESCE(lang, 'en');
END;
$$;

-- Comments
COMMENT ON TABLE conversation_history IS 'Stores conversation history with vector embeddings for semantic search';
COMMENT ON TABLE agent_collaborations IS 'Tracks agent-to-agent collaboration requests';
COMMENT ON TABLE proactive_notifications IS 'Manages proactive notifications sent to users';
COMMENT ON TABLE agent_analytics IS 'Tracks agent performance and usage analytics';
COMMENT ON TABLE user_preferences IS 'Stores user preferences including language and notifications';

COMMIT;
