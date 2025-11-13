-- AI Agent System - Complete Database Schema
-- Created: 2025-11-13
-- Purpose: Support AI agent conversations, tool executions, and monitoring
-- Additive only: Creates new tables for AI agent functionality

BEGIN;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Agent Conversations Table
-- Tracks AI agent conversation sessions
CREATE TABLE IF NOT EXISTS agent_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  phone_number TEXT NOT NULL,
  agent_type TEXT NOT NULL CHECK (agent_type IN ('booking', 'payment', 'customer_service', 'general')),
  channel TEXT DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'web', 'api')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'ended')),
  context JSONB DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  message_count INTEGER DEFAULT 0,
  summary TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for agent_conversations
CREATE INDEX IF NOT EXISTS idx_agent_conversations_user_id ON agent_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_phone ON agent_conversations(phone_number);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_status ON agent_conversations(status);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_agent_type ON agent_conversations(agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_started_at ON agent_conversations(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_active ON agent_conversations(status, last_message_at DESC) WHERE status = 'active';

-- Agent Messages Table
-- Stores individual messages in agent conversations
CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool', 'function')),
  content TEXT,
  tool_calls JSONB,
  tool_call_id TEXT,
  name TEXT,
  tokens_prompt INTEGER,
  tokens_completion INTEGER,
  tokens_total INTEGER,
  latency_ms INTEGER,
  cost_usd DECIMAL(10, 6),
  model TEXT,
  temperature DECIMAL(3, 2),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for agent_messages
CREATE INDEX IF NOT EXISTS idx_agent_messages_conversation_id ON agent_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_role ON agent_messages(role);
CREATE INDEX IF NOT EXISTS idx_agent_messages_created_at ON agent_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_messages_conversation_created ON agent_messages(conversation_id, created_at DESC);

-- Agent Tool Executions Table
-- Logs all tool executions by AI agents
CREATE TABLE IF NOT EXISTS agent_tool_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES agent_conversations(id) ON DELETE SET NULL,
  message_id UUID REFERENCES agent_messages(id) ON DELETE SET NULL,
  agent_type TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  input JSONB NOT NULL,
  output JSONB,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  execution_time_ms INTEGER,
  retries INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for agent_tool_executions
CREATE INDEX IF NOT EXISTS idx_agent_tool_exec_conversation ON agent_tool_executions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_agent_tool_exec_tool_name ON agent_tool_executions(tool_name);
CREATE INDEX IF NOT EXISTS idx_agent_tool_exec_success ON agent_tool_executions(success);
CREATE INDEX IF NOT EXISTS idx_agent_tool_exec_created_at ON agent_tool_executions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_tool_exec_tool_created ON agent_tool_executions(tool_name, created_at DESC);

-- Agent Metrics Table
-- Aggregated metrics for monitoring and cost tracking
CREATE TABLE IF NOT EXISTS agent_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_type TEXT NOT NULL,
  conversation_id UUID REFERENCES agent_conversations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  tokens_prompt INTEGER DEFAULT 0,
  tokens_completion INTEGER DEFAULT 0,
  tokens_total INTEGER DEFAULT 0,
  cost_usd DECIMAL(10, 6) DEFAULT 0,
  latency_ms INTEGER,
  llm_latency_ms INTEGER,
  tool_execution_ms INTEGER,
  message_count INTEGER DEFAULT 1,
  success BOOLEAN DEFAULT true,
  error_code TEXT,
  model TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for agent_metrics
CREATE INDEX IF NOT EXISTS idx_agent_metrics_agent_type ON agent_metrics(agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_timestamp ON agent_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_conversation ON agent_metrics(conversation_id);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_user ON agent_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_success ON agent_metrics(success);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_agent_timestamp ON agent_metrics(agent_type, timestamp DESC);

-- Agent Embeddings Table
-- Stores OpenAI embeddings for long-term memory and semantic search
CREATE TABLE IF NOT EXISTS agent_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES agent_conversations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for agent_embeddings
CREATE INDEX IF NOT EXISTS idx_agent_embeddings_conversation ON agent_embeddings(conversation_id);
CREATE INDEX IF NOT EXISTS idx_agent_embeddings_user ON agent_embeddings(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_embeddings_created_at ON agent_embeddings(created_at DESC);

-- Vector similarity search index using ivfflat
-- This enables fast nearest-neighbor searches for semantic memory retrieval
CREATE INDEX IF NOT EXISTS idx_agent_embeddings_vector ON agent_embeddings 
  USING ivfflat (embedding vector_cosine_ops) 
  WITH (lists = 100);

-- Vector Similarity Search Function
-- Finds embeddings most similar to a query embedding
CREATE OR REPLACE FUNCTION match_agent_embeddings(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_user_id uuid DEFAULT NULL,
  filter_conversation_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  conversation_id UUID,
  content TEXT,
  metadata JSONB,
  similarity float,
  created_at TIMESTAMPTZ
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    ae.id,
    ae.conversation_id,
    ae.content,
    ae.metadata,
    1 - (ae.embedding <=> query_embedding) AS similarity,
    ae.created_at
  FROM agent_embeddings ae
  WHERE 
    (filter_user_id IS NULL OR ae.user_id = filter_user_id)
    AND (filter_conversation_id IS NULL OR ae.conversation_id = filter_conversation_id)
    AND 1 - (ae.embedding <=> query_embedding) > match_threshold
  ORDER BY ae.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Update Timestamp Trigger Function
CREATE OR REPLACE FUNCTION update_agent_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updating timestamps
CREATE TRIGGER update_agent_conversations_updated_at
  BEFORE UPDATE ON agent_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_updated_at();

CREATE TRIGGER update_agent_embeddings_updated_at
  BEFORE UPDATE ON agent_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_updated_at();

-- Trigger to update conversation message count and last_message_at
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE agent_conversations
  SET 
    message_count = message_count + 1,
    last_message_at = NEW.created_at,
    updated_at = NOW()
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversation_on_new_message
  AFTER INSERT ON agent_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_on_message();

-- View for conversation summaries
CREATE OR REPLACE VIEW agent_conversation_summaries AS
SELECT 
  ac.id,
  ac.user_id,
  ac.phone_number,
  ac.agent_type,
  ac.status,
  ac.started_at,
  ac.ended_at,
  ac.message_count,
  ac.last_message_at,
  COUNT(DISTINCT am.id) as actual_message_count,
  SUM(am.tokens_total) as total_tokens,
  SUM(am.cost_usd) as total_cost_usd,
  AVG(am.latency_ms) as avg_latency_ms,
  MAX(am.created_at) as latest_message_at,
  COUNT(DISTINCT ate.id) as tool_execution_count
FROM agent_conversations ac
LEFT JOIN agent_messages am ON ac.id = am.conversation_id
LEFT JOIN agent_tool_executions ate ON ac.id = ate.conversation_id
GROUP BY ac.id;

-- View for daily agent metrics
CREATE OR REPLACE VIEW agent_daily_metrics AS
SELECT 
  DATE(timestamp) as date,
  agent_type,
  COUNT(*) as total_requests,
  COUNT(*) FILTER (WHERE success = true) as successful_requests,
  COUNT(*) FILTER (WHERE success = false) as failed_requests,
  SUM(tokens_prompt) as total_prompt_tokens,
  SUM(tokens_completion) as total_completion_tokens,
  SUM(tokens_total) as total_tokens,
  SUM(cost_usd) as total_cost_usd,
  AVG(latency_ms) as avg_latency_ms,
  AVG(llm_latency_ms) as avg_llm_latency_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_latency_ms,
  COUNT(DISTINCT conversation_id) as unique_conversations,
  COUNT(DISTINCT user_id) as unique_users
FROM agent_metrics
GROUP BY DATE(timestamp), agent_type;

-- Comment on tables
COMMENT ON TABLE agent_conversations IS 'Tracks AI agent conversation sessions with users';
COMMENT ON TABLE agent_messages IS 'Stores individual messages in AI agent conversations';
COMMENT ON TABLE agent_tool_executions IS 'Logs all tool executions by AI agents';
COMMENT ON TABLE agent_metrics IS 'Aggregated metrics for monitoring AI agent performance and costs';
COMMENT ON TABLE agent_embeddings IS 'Stores OpenAI embeddings for long-term semantic memory';

-- Comment on important columns
COMMENT ON COLUMN agent_embeddings.embedding IS 'OpenAI text-embedding-3-small vector (1536 dimensions)';
COMMENT ON COLUMN agent_messages.tokens_total IS 'Total tokens used (prompt + completion)';
COMMENT ON COLUMN agent_metrics.cost_usd IS 'Estimated cost in USD based on OpenAI pricing';

-- Grant permissions (adjust based on your security requirements)
-- These are examples - modify based on your RLS policies

-- Allow authenticated users to read their own conversations
ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY agent_conversations_user_read ON agent_conversations
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow service role to manage all agent data
CREATE POLICY agent_conversations_service_all ON agent_conversations
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Similar policies for other tables
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY agent_messages_service_all ON agent_messages
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

ALTER TABLE agent_tool_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY agent_tool_executions_service_all ON agent_tool_executions
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

ALTER TABLE agent_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY agent_metrics_service_all ON agent_metrics
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

ALTER TABLE agent_embeddings ENABLE ROW LEVEL SECURITY;
CREATE POLICY agent_embeddings_service_all ON agent_embeddings
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

COMMIT;
