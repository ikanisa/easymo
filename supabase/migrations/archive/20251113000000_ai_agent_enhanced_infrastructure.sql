-- AI Agent Enhanced Infrastructure Migration
-- Version: 2.0.0
-- Date: 2025-11-13
-- Description: Add tables and functions for enhanced AI agent capabilities

BEGIN;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- Agent configurations table
CREATE TABLE IF NOT EXISTS agent_configurations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_type VARCHAR(50) NOT NULL,
  model_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  system_prompt TEXT NOT NULL,
  tools JSONB DEFAULT '[]'::jsonb,
  memory_config JSONB DEFAULT '{}'::jsonb,
  routing_config JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_type)
);

-- Agent conversations (for multi-agent tracking)
CREATE TABLE IF NOT EXISTS agent_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  phone_number VARCHAR(20) NOT NULL,
  agent_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'ended')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  summary TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_agent_conversations_phone ON agent_conversations(phone_number);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_user ON agent_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_status ON agent_conversations(status);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_started ON agent_conversations(started_at DESC);

-- Agent messages (detailed message tracking)
CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES agent_conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool')),
  content TEXT,
  tool_calls JSONB,
  tool_call_id VARCHAR(255),
  tokens_prompt INTEGER,
  tokens_completion INTEGER,
  tokens_total INTEGER,
  cost_usd DECIMAL(10, 6),
  latency_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_agent_messages_conversation ON agent_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_created ON agent_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_messages_role ON agent_messages(role);

-- Vector embeddings for long-term memory
CREATE TABLE IF NOT EXISTS agent_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content TEXT NOT NULL,
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension
  metadata JSONB DEFAULT '{}'::jsonb,
  importance_score FLOAT DEFAULT 0.5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create vector index for similarity search using ivfflat
-- Note: Requires pgvector extension
CREATE INDEX IF NOT EXISTS idx_agent_embeddings_vector 
ON agent_embeddings 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_agent_embeddings_importance ON agent_embeddings(importance_score DESC);
CREATE INDEX IF NOT EXISTS idx_agent_embeddings_created ON agent_embeddings(created_at DESC);

-- Agent metrics (for monitoring and analytics)
CREATE TABLE IF NOT EXISTS agent_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_type VARCHAR(50) NOT NULL,
  conversation_id UUID REFERENCES agent_conversations(id) ON DELETE SET NULL,
  tokens_prompt INTEGER DEFAULT 0,
  tokens_completion INTEGER DEFAULT 0,
  tokens_total INTEGER DEFAULT 0,
  cost_usd DECIMAL(10, 6) DEFAULT 0,
  latency_ms INTEGER,
  llm_latency_ms INTEGER,
  tool_execution_ms INTEGER,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_agent_metrics_agent_type ON agent_metrics(agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_conversation ON agent_metrics(conversation_id);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_created ON agent_metrics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_success ON agent_metrics(success);

-- Tool executions (for monitoring)
CREATE TABLE IF NOT EXISTS agent_tool_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES agent_conversations(id) ON DELETE SET NULL,
  agent_type VARCHAR(50),
  tool_name VARCHAR(100) NOT NULL,
  input_args JSONB NOT NULL,
  output_result JSONB,
  success BOOLEAN DEFAULT true,
  execution_time_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_agent_tool_exec_conversation ON agent_tool_executions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_agent_tool_exec_tool_name ON agent_tool_executions(tool_name);
CREATE INDEX IF NOT EXISTS idx_agent_tool_exec_created ON agent_tool_executions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_tool_exec_success ON agent_tool_executions(success);

-- Function for vector similarity search
CREATE OR REPLACE FUNCTION match_agent_embeddings(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  similarity float,
  importance_score float
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    id,
    content,
    metadata,
    1 - (embedding <=> query_embedding) AS similarity,
    importance_score
  FROM agent_embeddings
  WHERE 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_agent_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS trigger_agent_configurations_updated_at ON agent_configurations;
CREATE TRIGGER trigger_agent_configurations_updated_at
  BEFORE UPDATE ON agent_configurations
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_updated_at();

DROP TRIGGER IF EXISTS trigger_agent_embeddings_updated_at ON agent_embeddings;
CREATE TRIGGER trigger_agent_embeddings_updated_at
  BEFORE UPDATE ON agent_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_updated_at();

-- Insert default agent configurations
INSERT INTO agent_configurations (agent_type, system_prompt, tools, model_config, is_active)
VALUES
  (
    'customer_service',
    'You are a helpful customer service assistant for EasyMO, a mobility platform in Rwanda. Be empathetic, professional, and concise. Always respond in the user''s preferred language. Keep responses under 3 sentences unless more detail is requested.',
    '["check_wallet_balance", "search_trips", "get_user_profile", "web_search"]'::jsonb,
    '{"model": "gpt-4o-mini", "temperature": 0.7, "max_tokens": 1000}'::jsonb,
    true
  ),
  (
    'booking',
    'You are a booking assistant for EasyMO. Help users find and book transportation. Be clear about prices, times, and locations. Confirm all booking details before proceeding. Keep responses under 3 sentences.',
    '["search_trips", "get_user_profile", "check_wallet_balance"]'::jsonb,
    '{"model": "gpt-4o-mini", "temperature": 0.7, "max_tokens": 800}'::jsonb,
    true
  ),
  (
    'payment',
    'You are a payment assistant for EasyMO. Help users with wallet operations and transfers. Always confirm amounts and recipients before proceeding. Be clear about fees and processing times. Keep responses under 3 sentences.',
    '["check_wallet_balance", "initiate_transfer", "get_user_profile", "convert_currency"]'::jsonb,
    '{"model": "gpt-4o-mini", "temperature": 0.5, "max_tokens": 600}'::jsonb,
    true
  ),
  (
    'general',
    'You are a helpful assistant for EasyMO. Provide general information and assistance. If you don''t know something, be honest and offer to connect the user with support. Keep responses under 2-3 sentences.',
    '["get_user_profile", "web_search", "get_weather"]'::jsonb,
    '{"model": "gpt-4o-mini", "temperature": 0.7, "max_tokens": 800}'::jsonb,
    true
  )
ON CONFLICT (agent_type) DO NOTHING;

-- Create view for agent performance analytics
CREATE OR REPLACE VIEW agent_performance_analytics AS
SELECT
  agent_type,
  DATE_TRUNC('hour', created_at) AS time_bucket,
  COUNT(*) AS total_requests,
  COUNT(*) FILTER (WHERE success = true) AS successful_requests,
  COUNT(*) FILTER (WHERE success = false) AS failed_requests,
  ROUND(AVG(latency_ms)::numeric, 2) AS avg_latency_ms,
  ROUND(AVG(tokens_total)::numeric, 2) AS avg_tokens,
  ROUND(SUM(cost_usd)::numeric, 6) AS total_cost_usd
FROM agent_metrics
GROUP BY agent_type, DATE_TRUNC('hour', created_at)
ORDER BY time_bucket DESC, agent_type;

-- Create view for tool usage analytics
CREATE OR REPLACE VIEW tool_usage_analytics AS
SELECT
  tool_name,
  DATE_TRUNC('hour', created_at) AS time_bucket,
  COUNT(*) AS total_executions,
  COUNT(*) FILTER (WHERE success = true) AS successful_executions,
  COUNT(*) FILTER (WHERE success = false) AS failed_executions,
  ROUND(AVG(execution_time_ms)::numeric, 2) AS avg_execution_time_ms
FROM agent_tool_executions
GROUP BY tool_name, DATE_TRUNC('hour', created_at)
ORDER BY time_bucket DESC, tool_name;

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
-- GRANT EXECUTE ON FUNCTION match_agent_embeddings TO authenticated;

COMMIT;

-- Add comments for documentation
COMMENT ON TABLE agent_configurations IS 'Stores AI agent type configurations and system prompts';
COMMENT ON TABLE agent_conversations IS 'Tracks individual conversations with agents';
COMMENT ON TABLE agent_messages IS 'Stores all messages within agent conversations';
COMMENT ON TABLE agent_embeddings IS 'Vector embeddings for long-term memory and semantic search';
COMMENT ON TABLE agent_metrics IS 'Performance and usage metrics for AI agents';
COMMENT ON TABLE agent_tool_executions IS 'Logs of tool executions for monitoring';
COMMENT ON FUNCTION match_agent_embeddings IS 'Performs vector similarity search for relevant memories';
