-- AI Agent System - Complete Database Schema
-- Created: 2025-11-13
-- Purpose: Foundation for world-class AI agent orchestration system

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- =============================================================================
-- CORE AGENT TABLES
-- =============================================================================

-- Agent configurations
CREATE TABLE IF NOT EXISTS ai_agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'triage', 'booking', 'payment', 'support',
    'property', 'driver', 'shop', 'general'
  )),
  description TEXT,
  instructions TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'gpt-4o',
  temperature DECIMAL(3,2) NOT NULL DEFAULT 0.7 CHECK (temperature >= 0 AND temperature <= 2),
  max_tokens INTEGER NOT NULL DEFAULT 1000 CHECK (max_tokens > 0),
  tools JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- Conversation tracking
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL, -- phone number from WhatsApp
  profile_id UUID REFERENCES profiles(id),
  channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'web', 'api', 'voice')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended', 'escalated', 'paused')),
  context JSONB DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  summary TEXT,
  total_cost_usd DECIMAL(10,6) DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  message_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Message history (detailed conversation log)
CREATE TABLE IF NOT EXISTS ai_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool', 'function')),
  content TEXT,
  tool_calls JSONB,
  tool_call_id TEXT,
  name TEXT,
  tokens_prompt INTEGER,
  tokens_completion INTEGER,
  tokens_total INTEGER,
  cost_usd DECIMAL(10,6),
  latency_ms INTEGER,
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- =============================================================================
-- TOOL SYSTEM
-- =============================================================================

-- Tool registry
CREATE TABLE IF NOT EXISTS ai_tools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  category TEXT CHECK (category IN ('payment', 'booking', 'support', 'profile', 'location', 'general')),
  parameters JSONB NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  requires_auth BOOLEAN NOT NULL DEFAULT false,
  rate_limit_per_hour INTEGER DEFAULT 100,
  handler_path TEXT, -- Path to handler function
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tool execution log (audit trail)
CREATE TABLE IF NOT EXISTS ai_tool_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL,
  tool_name TEXT NOT NULL,
  input JSONB NOT NULL,
  output JSONB,
  success BOOLEAN NOT NULL DEFAULT true,
  error TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT, -- user_id who triggered
  metadata JSONB DEFAULT '{}'::jsonb
);

-- =============================================================================
-- MEMORY SYSTEM (Long-term memory with vector search)
-- =============================================================================

-- Embeddings for semantic search
CREATE TABLE IF NOT EXISTS ai_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension
  metadata JSONB DEFAULT '{}'::jsonb,
  importance_score DECIMAL(3,2) DEFAULT 0.5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ -- Optional expiration for cleanup
);

-- =============================================================================
-- METRICS & MONITORING
-- =============================================================================

-- Performance metrics
CREATE TABLE IF NOT EXISTS ai_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID REFERENCES ai_agents(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE SET NULL,
  metric_type TEXT NOT NULL,
  value DECIMAL(10,4) NOT NULL,
  dimensions JSONB DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prompt templates (for versioning and A/B testing)
CREATE TABLE IF NOT EXISTS ai_prompt_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  category TEXT,
  template TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  performance_score DECIMAL(3,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- Agent feedback (user satisfaction)
CREATE TABLE IF NOT EXISTS ai_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback_text TEXT,
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Conversation indexes
CREATE INDEX IF NOT EXISTS idx_conversations_user_status ON ai_conversations(user_id, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_conversations_agent ON ai_conversations(agent_id);
CREATE INDEX IF NOT EXISTS idx_conversations_started ON ai_conversations(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_profile ON ai_conversations(profile_id);

-- Message indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON ai_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_role ON ai_messages(role);

-- Tool execution indexes
CREATE INDEX IF NOT EXISTS idx_tool_execs_conversation ON ai_tool_executions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_tool_execs_tool ON ai_tool_executions(tool_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tool_execs_agent ON ai_tool_executions(agent_id);

-- Embedding indexes
CREATE INDEX IF NOT EXISTS idx_embeddings_conversation ON ai_embeddings(conversation_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_created ON ai_embeddings(created_at DESC);

-- Vector similarity search index (IVFFlat for better performance)
CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON ai_embeddings 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Metrics indexes
CREATE INDEX IF NOT EXISTS idx_metrics_agent ON ai_metrics(agent_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_conversation ON ai_metrics(conversation_id);
CREATE INDEX IF NOT EXISTS idx_metrics_type ON ai_metrics(metric_type, timestamp DESC);

-- Tool indexes
CREATE INDEX IF NOT EXISTS idx_tools_name ON ai_tools(name) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_tools_category ON ai_tools(category);

-- =============================================================================
-- FUNCTIONS & PROCEDURES
-- =============================================================================

-- Function: Match embeddings by similarity (semantic search)
CREATE OR REPLACE FUNCTION match_ai_embeddings(
  query_embedding vector(1536),
  match_count INT DEFAULT 5,
  match_threshold FLOAT DEFAULT 0.7,
  filter_conversation_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  conversation_id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    id,
    conversation_id,
    content,
    metadata,
    1 - (embedding <=> query_embedding) AS similarity
  FROM ai_embeddings
  WHERE 
    (filter_conversation_id IS NULL OR conversation_id = filter_conversation_id)
    AND 1 - (embedding <=> query_embedding) > match_threshold
    AND (expires_at IS NULL OR expires_at > NOW())
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Function: Get conversation summary with stats
CREATE OR REPLACE FUNCTION get_conversation_summary(conv_id UUID)
RETURNS TABLE (
  conversation_id UUID,
  agent_name TEXT,
  user_id TEXT,
  status TEXT,
  message_count BIGINT,
  total_tokens BIGINT,
  total_cost DECIMAL,
  avg_latency DECIMAL,
  duration_minutes DECIMAL
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    c.id,
    a.name,
    c.user_id,
    c.status,
    COUNT(m.id),
    SUM(m.tokens_total),
    SUM(m.cost_usd),
    AVG(m.latency_ms),
    EXTRACT(EPOCH FROM (COALESCE(c.ended_at, NOW()) - c.started_at)) / 60.0
  FROM ai_conversations c
  LEFT JOIN ai_agents a ON a.id = c.agent_id
  LEFT JOIN ai_messages m ON m.conversation_id = c.id
  WHERE c.id = conv_id
  GROUP BY c.id, a.name, c.user_id, c.status, c.ended_at, c.started_at;
$$;

-- Function: Update conversation stats
CREATE OR REPLACE FUNCTION update_conversation_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ai_conversations
  SET
    message_count = message_count + 1,
    total_tokens = total_tokens + COALESCE(NEW.tokens_total, 0),
    total_cost_usd = total_cost_usd + COALESCE(NEW.cost_usd, 0),
    last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update conversation stats on new message
DROP TRIGGER IF EXISTS trigger_update_conversation_stats ON ai_messages;
CREATE TRIGGER trigger_update_conversation_stats
  AFTER INSERT ON ai_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_stats();

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers: Auto-update updated_at
DROP TRIGGER IF EXISTS trigger_ai_agents_updated_at ON ai_agents;
CREATE TRIGGER trigger_ai_agents_updated_at
  BEFORE UPDATE ON ai_agents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_ai_tools_updated_at ON ai_tools;
CREATE TRIGGER trigger_ai_tools_updated_at
  BEFORE UPDATE ON ai_tools
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_ai_prompt_templates_updated_at ON ai_prompt_templates;
CREATE TRIGGER trigger_ai_prompt_templates_updated_at
  BEFORE UPDATE ON ai_prompt_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- SEED DATA (Initial agents and tools)
-- =============================================================================

-- Insert default agents
INSERT INTO ai_agents (name, type, description, instructions, enabled, tools) VALUES
(
  'TriageAgent',
  'triage',
  'Intelligent triage assistant that routes users to appropriate specialized agents',
  'You are a helpful triage assistant for EasyMO, a WhatsApp-based mobility platform. Your job is to understand what the user needs and route them to the right specialist. Be friendly, concise, and helpful. Ask clarifying questions if needed. Available specialists: BookingAgent (for bar-truck slot bookings), PaymentAgent (for wallet and payments), SupportAgent (for help and questions), DriverAgent (for driver-related queries), ShopAgent (for shop/business queries).',
  true,
  '["get_user_profile"]'::jsonb
),
(
  'BookingAgent',
  'booking',
  'Handles bar-truck slot bookings and reservations',
  'You are a booking specialist for EasyMO. Help users book bar-truck slots efficiently. Be clear about availability, pricing, and booking details. Always confirm booking details before finalizing. Use tools to check availability and create bookings.',
  true,
  '["check_availability", "create_booking", "view_bookings", "cancel_booking", "get_user_profile"]'::jsonb
),
(
  'PaymentAgent',
  'payment',
  'Assists with wallet balance, payments, and transactions',
  'You are a payment specialist for EasyMO. Help users check balances, make payments, and view transaction history. Be clear about amounts and always confirm before processing payments. Ensure security by verifying user identity for sensitive operations.',
  true,
  '["check_balance", "collect_payment", "transaction_history", "get_user_profile"]'::jsonb
),
(
  'SupportAgent',
  'support',
  'Provides customer support and answers general questions',
  'You are a customer support specialist for EasyMO. Help users with their questions, issues, and concerns. Be empathetic, patient, and solution-oriented. Escalate complex issues to human agents when necessary. Document issues properly.',
  true,
  '["create_ticket", "escalate_to_human", "get_user_profile", "search_faq"]'::jsonb
)
ON CONFLICT (name) DO NOTHING;

-- Insert default tools
INSERT INTO ai_tools (name, description, category, parameters, enabled) VALUES
(
  'check_balance',
  'Check user wallet balance and recent transactions',
  'payment',
  '{
    "type": "object",
    "properties": {
      "userId": {"type": "string", "description": "User phone number or ID"},
      "includePending": {"type": "boolean", "description": "Include pending transactions"}
    },
    "required": ["userId"]
  }'::jsonb,
  true
),
(
  'check_availability',
  'Check available bar-truck slots for a given date and location',
  'booking',
  '{
    "type": "object",
    "properties": {
      "date": {"type": "string", "description": "Date in YYYY-MM-DD format"},
      "location": {"type": "string", "description": "Location name or coordinates"},
      "vehicleType": {"type": "string", "description": "Type of vehicle needed"}
    },
    "required": ["date"]
  }'::jsonb,
  true
),
(
  'create_booking',
  'Create a new bar-truck booking',
  'booking',
  '{
    "type": "object",
    "properties": {
      "userId": {"type": "string"},
      "slotId": {"type": "string"},
      "date": {"type": "string"},
      "location": {"type": "string"},
      "vehicleType": {"type": "string"}
    },
    "required": ["userId", "slotId", "date"]
  }'::jsonb,
  true
),
(
  'get_user_profile',
  'Get user profile information',
  'profile',
  '{
    "type": "object",
    "properties": {
      "userId": {"type": "string", "description": "User phone number or ID"}
    },
    "required": ["userId"]
  }'::jsonb,
  true
),
(
  'create_ticket',
  'Create a support ticket',
  'support',
  '{
    "type": "object",
    "properties": {
      "userId": {"type": "string"},
      "subject": {"type": "string"},
      "description": {"type": "string"},
      "priority": {"type": "string", "enum": ["low", "medium", "high"]}
    },
    "required": ["userId", "subject", "description"]
  }'::jsonb,
  true
)
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

-- Enable RLS
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_tool_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_feedback ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role full access to ai_agents" ON ai_agents FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access to ai_conversations" ON ai_conversations FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access to ai_messages" ON ai_messages FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access to ai_tools" ON ai_tools FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access to ai_tool_executions" ON ai_tool_executions FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access to ai_embeddings" ON ai_embeddings FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access to ai_metrics" ON ai_metrics FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access to ai_feedback" ON ai_feedback FOR ALL TO service_role USING (true);

-- Authenticated users can read enabled agents
CREATE POLICY "Users can view enabled agents" ON ai_agents FOR SELECT TO authenticated USING (enabled = true);

-- Users can view their own conversations
CREATE POLICY "Users can view own conversations" ON ai_conversations FOR SELECT TO authenticated 
  USING (profile_id = auth.uid());

-- Users can view messages from their conversations
CREATE POLICY "Users can view own messages" ON ai_messages FOR SELECT TO authenticated
  USING (conversation_id IN (SELECT id FROM ai_conversations WHERE profile_id = auth.uid()));

-- Users can submit feedback
CREATE POLICY "Users can submit feedback" ON ai_feedback FOR INSERT TO authenticated
  WITH CHECK (conversation_id IN (SELECT id FROM ai_conversations WHERE profile_id = auth.uid()));

-- =============================================================================
-- HELPER VIEWS
-- =============================================================================

-- View: Active conversations with stats
CREATE OR REPLACE VIEW ai_active_conversations_stats AS
SELECT
  c.id,
  c.user_id,
  c.profile_id,
  a.name AS agent_name,
  a.type AS agent_type,
  c.channel,
  c.started_at,
  c.last_message_at,
  c.message_count,
  c.total_tokens,
  c.total_cost_usd,
  EXTRACT(EPOCH FROM (NOW() - c.started_at)) / 60.0 AS duration_minutes
FROM ai_conversations c
LEFT JOIN ai_agents a ON a.id = c.agent_id
WHERE c.status = 'active';

-- View: Daily agent metrics
CREATE OR REPLACE VIEW ai_daily_agent_metrics AS
SELECT
  DATE(c.started_at) AS date,
  a.name AS agent_name,
  a.type AS agent_type,
  COUNT(DISTINCT c.id) AS conversation_count,
  SUM(c.message_count) AS total_messages,
  SUM(c.total_tokens) AS total_tokens,
  SUM(c.total_cost_usd) AS total_cost_usd,
  AVG(EXTRACT(EPOCH FROM (COALESCE(c.ended_at, NOW()) - c.started_at)) / 60.0) AS avg_duration_minutes
FROM ai_conversations c
LEFT JOIN ai_agents a ON a.id = c.agent_id
WHERE c.started_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(c.started_at), a.name, a.type
ORDER BY date DESC, conversation_count DESC;

-- View: Tool usage stats
CREATE OR REPLACE VIEW ai_tool_usage_stats AS
SELECT
  tool_name,
  COUNT(*) AS execution_count,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) AS success_count,
  AVG(duration_ms) AS avg_duration_ms,
  DATE(created_at) AS date
FROM ai_tool_executions
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY tool_name, DATE(created_at)
ORDER BY date DESC, execution_count DESC;

-- =============================================================================
-- CLEANUP & MAINTENANCE
-- =============================================================================

-- Function: Cleanup old embeddings (optional, run periodically)
CREATE OR REPLACE FUNCTION cleanup_old_embeddings()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM ai_embeddings
  WHERE expires_at IS NOT NULL AND expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function: Archive ended conversations (move to archive table if needed)
CREATE OR REPLACE FUNCTION archive_old_conversations(days_old INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  archived_count INTEGER;
BEGIN
  UPDATE ai_conversations
  SET metadata = metadata || jsonb_build_object('archived_at', NOW())
  WHERE status = 'ended'
    AND ended_at < NOW() - (days_old || ' days')::INTERVAL
    AND NOT (metadata ? 'archived_at');
  
  GET DIAGNOSTICS archived_count = ROW_COUNT;
  
  RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE ai_agents IS 'Agent configurations and settings';
COMMENT ON TABLE ai_conversations IS 'Active and historical conversations';
COMMENT ON TABLE ai_messages IS 'Detailed message history for all conversations';
COMMENT ON TABLE ai_tools IS 'Registry of available tools for agents';
COMMENT ON TABLE ai_tool_executions IS 'Audit log of all tool executions';
COMMENT ON TABLE ai_embeddings IS 'Vector embeddings for semantic search and long-term memory';
COMMENT ON TABLE ai_metrics IS 'Performance metrics and monitoring data';
COMMENT ON TABLE ai_feedback IS 'User feedback on agent interactions';

COMMENT ON FUNCTION match_ai_embeddings IS 'Semantic search using vector similarity';
COMMENT ON FUNCTION get_conversation_summary IS 'Get comprehensive conversation statistics';
COMMENT ON FUNCTION update_conversation_stats IS 'Auto-update conversation totals on new messages';

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

-- Log migration
DO $$
BEGIN
  RAISE NOTICE 'AI Agent System migration completed successfully';
  RAISE NOTICE 'Tables created: 9';
  RAISE NOTICE 'Functions created: 6';
  RAISE NOTICE 'Views created: 3';
  RAISE NOTICE 'Default agents seeded: 4';
  RAISE NOTICE 'Default tools seeded: 5';
END $$;
