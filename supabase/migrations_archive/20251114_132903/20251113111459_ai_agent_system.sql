-- Migration: AI Agent System Tables
-- Description: Add tables for AI agent orchestration, conversations, tools, and monitoring
-- Author: EasyMO Dev Team
-- Date: 2025-11-13
-- Version: 1.0.0

BEGIN;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- =====================================================
-- AI AGENTS CONFIGURATION
-- =====================================================

CREATE TABLE IF NOT EXISTS ai_agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'triage', 'booking', 'payment', 'support', 
        'property', 'driver', 'shop', 'general'
    )),
    description TEXT,
    instructions TEXT NOT NULL,  -- System prompt
    model VARCHAR(100) NOT NULL DEFAULT 'gpt-4o-mini',
    temperature DECIMAL(3,2) NOT NULL DEFAULT 0.7 CHECK (temperature >= 0 AND temperature <= 2),
    max_tokens INTEGER NOT NULL DEFAULT 1000 CHECK (max_tokens > 0),
    tools JSONB DEFAULT '[]'::jsonb,  -- Array of tool names
    enabled BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    
    CONSTRAINT valid_tools CHECK (jsonb_typeof(tools) = 'array')
);

CREATE INDEX idx_ai_agents_type ON ai_agents(type);
CREATE INDEX idx_ai_agents_enabled ON ai_agents(enabled);

COMMENT ON TABLE ai_agents IS 'AI agent configurations for different use cases';
COMMENT ON COLUMN ai_agents.instructions IS 'System prompt that defines agent behavior';
COMMENT ON COLUMN ai_agents.tools IS 'Array of tool names available to this agent';

-- =====================================================
-- AI CONVERSATIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS ai_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL,
    user_id VARCHAR(255) NOT NULL,  -- WhatsApp phone number or user ID
    profile_id UUID,  -- Link to users table if exists
    channel VARCHAR(50) NOT NULL CHECK (channel IN ('whatsapp', 'web', 'api', 'voice')),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'ended', 'escalated', 'paused')),
    context JSONB DEFAULT '{}'::jsonb,  -- Conversation-specific context
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    last_message_at TIMESTAMPTZ,
    summary TEXT,  -- AI-generated summary
    total_cost_usd DECIMAL(10,6) DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    message_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    CONSTRAINT valid_context CHECK (jsonb_typeof(context) = 'object')
);

CREATE INDEX idx_ai_conversations_user ON ai_conversations(user_id);
CREATE INDEX idx_ai_conversations_agent ON ai_conversations(agent_id);
CREATE INDEX idx_ai_conversations_status ON ai_conversations(status);
CREATE INDEX idx_ai_conversations_started ON ai_conversations(started_at DESC);
CREATE INDEX idx_ai_conversations_channel ON ai_conversations(channel);

COMMENT ON TABLE ai_conversations IS 'AI-managed conversation sessions';
COMMENT ON COLUMN ai_conversations.context IS 'Conversation state and variables';
COMMENT ON COLUMN ai_conversations.summary IS 'AI-generated summary for long-term memory';

-- =====================================================
-- AI MESSAGES
-- =====================================================

CREATE TABLE IF NOT EXISTS ai_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool', 'function')),
    content TEXT,
    tool_calls JSONB,  -- OpenAI tool calls
    tool_call_id VARCHAR(255),  -- For tool responses
    name VARCHAR(255),  -- Tool or function name
    tokens_prompt INTEGER,
    tokens_completion INTEGER,
    tokens_total INTEGER,
    cost_usd DECIMAL(10,6),
    latency_ms INTEGER,
    model VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    
    CONSTRAINT valid_tool_calls CHECK (tool_calls IS NULL OR jsonb_typeof(tool_calls) = 'array')
);

CREATE INDEX idx_ai_messages_conversation ON ai_messages(conversation_id);
CREATE INDEX idx_ai_messages_created ON ai_messages(created_at DESC);
CREATE INDEX idx_ai_messages_role ON ai_messages(role);

COMMENT ON TABLE ai_messages IS 'Individual messages in AI conversations';
COMMENT ON COLUMN ai_messages.tool_calls IS 'OpenAI function calling data';

-- =====================================================
-- AI TOOLS
-- =====================================================

CREATE TABLE IF NOT EXISTS ai_tools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    category VARCHAR(50),  -- 'booking', 'payment', 'profile', 'support', etc.
    parameters JSONB NOT NULL,  -- JSON Schema for tool parameters
    handler VARCHAR(255) NOT NULL,  -- Handler function/class name
    is_builtin BOOLEAN DEFAULT false,
    requires_auth BOOLEAN DEFAULT false,
    rate_limit JSONB,  -- {requests: 10, window: 'minute'}
    config JSONB DEFAULT '{}'::jsonb,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_parameters CHECK (jsonb_typeof(parameters) = 'object'),
    CONSTRAINT valid_rate_limit CHECK (rate_limit IS NULL OR jsonb_typeof(rate_limit) = 'object')
);

CREATE INDEX idx_ai_tools_name ON ai_tools(name);
CREATE INDEX idx_ai_tools_category ON ai_tools(category);
CREATE INDEX idx_ai_tools_enabled ON ai_tools(enabled);

COMMENT ON TABLE ai_tools IS 'Available tools for AI agents to use';
COMMENT ON COLUMN ai_tools.parameters IS 'JSON Schema defining tool parameters';
COMMENT ON COLUMN ai_tools.handler IS 'Function/class that executes the tool';

-- =====================================================
-- TOOL EXECUTIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS ai_tool_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES ai_conversations(id) ON DELETE SET NULL,
    agent_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL,
    tool_name VARCHAR(255) NOT NULL,
    input JSONB NOT NULL,
    output JSONB,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    execution_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    
    CONSTRAINT valid_input CHECK (jsonb_typeof(input) = 'object')
);

CREATE INDEX idx_ai_tool_exec_conversation ON ai_tool_executions(conversation_id);
CREATE INDEX idx_ai_tool_exec_tool ON ai_tool_executions(tool_name);
CREATE INDEX idx_ai_tool_exec_created ON ai_tool_executions(created_at DESC);
CREATE INDEX idx_ai_tool_exec_success ON ai_tool_executions(success);

COMMENT ON TABLE ai_tool_executions IS 'Log of all tool executions for debugging and monitoring';

-- =====================================================
-- AI METRICS
-- =====================================================

CREATE TABLE IF NOT EXISTS ai_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID REFERENCES ai_agents(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES ai_conversations(id) ON DELETE SET NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    tokens_prompt INTEGER NOT NULL DEFAULT 0,
    tokens_completion INTEGER NOT NULL DEFAULT 0,
    tokens_total INTEGER NOT NULL DEFAULT 0,
    latency_ms INTEGER NOT NULL,
    llm_latency_ms INTEGER,
    tool_execution_ms INTEGER,
    cost_usd DECIMAL(10,6),
    tokens_per_second DECIMAL(10,2),
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_ai_metrics_agent ON ai_metrics(agent_id);
CREATE INDEX idx_ai_metrics_conversation ON ai_metrics(conversation_id);
CREATE INDEX idx_ai_metrics_timestamp ON ai_metrics(timestamp DESC);
CREATE INDEX idx_ai_metrics_success ON ai_metrics(success);

COMMENT ON TABLE ai_metrics IS 'Performance metrics for AI agent operations';

-- =====================================================
-- EMBEDDINGS (Vector Store for Long-Term Memory)
-- =====================================================

CREATE TABLE IF NOT EXISTS ai_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content TEXT NOT NULL,
    embedding vector(1536),  -- OpenAI text-embedding-3-small dimension
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_metadata CHECK (jsonb_typeof(metadata) = 'object')
);

-- Create vector index for similarity search (using ivfflat)
CREATE INDEX idx_ai_embeddings_vector ON ai_embeddings 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX idx_ai_embeddings_metadata ON ai_embeddings USING GIN (metadata);

COMMENT ON TABLE ai_embeddings IS 'Vector embeddings for semantic search and long-term memory';
COMMENT ON COLUMN ai_embeddings.embedding IS 'OpenAI embedding vector (1536 dimensions)';

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function for vector similarity search
CREATE OR REPLACE FUNCTION match_ai_embeddings(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    metadata JSONB,
    similarity float
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        id,
        content,
        metadata,
        1 - (embedding <=> query_embedding) AS similarity
    FROM ai_embeddings
    WHERE 1 - (embedding <=> query_embedding) > match_threshold
    ORDER BY embedding <=> query_embedding
    LIMIT match_count;
$$;

COMMENT ON FUNCTION match_ai_embeddings IS 'Find similar embeddings using cosine similarity';

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to tables
CREATE TRIGGER update_ai_agents_updated_at 
BEFORE UPDATE ON ai_agents
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_tools_updated_at 
BEFORE UPDATE ON ai_tools
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_embeddings_updated_at 
BEFORE UPDATE ON ai_embeddings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update conversation statistics
CREATE OR REPLACE FUNCTION update_conversation_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE ai_conversations
        SET 
            message_count = message_count + 1,
            last_message_at = NEW.created_at,
            total_tokens = COALESCE(total_tokens, 0) + COALESCE(NEW.tokens_total, 0),
            total_cost_usd = COALESCE(total_cost_usd, 0) + COALESCE(NEW.cost_usd, 0)
        WHERE id = NEW.conversation_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversation_stats_trigger
AFTER INSERT ON ai_messages
FOR EACH ROW EXECUTE FUNCTION update_conversation_stats();

-- =====================================================
-- SEED DEFAULT AGENTS
-- =====================================================

INSERT INTO ai_agents (name, type, description, instructions, tools, enabled) VALUES
(
    'Triage Agent',
    'triage',
    'Classifies user intent and routes to appropriate specialized agent',
    'You are a triage agent. Your job is to understand what the user needs and route them to the right specialist. Be concise and helpful. Always classify the intent accurately.',
    '[]'::jsonb,
    true
),
(
    'Booking Agent',
    'booking',
    'Handles property bookings and reservations',
    'You are a booking specialist. Help users find and book properties, check availability, and manage reservations. Be friendly and efficient. Always confirm booking details before finalizing.',
    '["checkAvailability", "createBooking", "getBookingDetails"]'::jsonb,
    true
),
(
    'Payment Agent',
    'payment',
    'Manages money transfers and wallet operations',
    'You are a payment specialist. Help users with money transfers, balance checks, and transaction history. Be clear about amounts and always confirm before processing transactions. Security is paramount.',
    '["checkBalance", "sendMoney", "getTransactionHistory"]'::jsonb,
    true
),
(
    'Support Agent',
    'support',
    'Provides customer support and troubleshooting',
    'You are a customer support specialist. Help users with issues, answer questions, and escalate when needed. Be empathetic and patient. Always gather all necessary information before escalating.',
    '["createTicket", "searchKnowledgeBase", "escalateToHuman"]'::jsonb,
    true
);

-- =====================================================
-- SEED DEFAULT TOOLS
-- =====================================================

INSERT INTO ai_tools (name, description, category, parameters, handler, is_builtin, enabled) VALUES
(
    'checkBalance',
    'Check user wallet balance',
    'payment',
    '{"type": "object", "properties": {"userId": {"type": "string", "description": "User ID"}}, "required": ["userId"]}'::jsonb,
    'payment.checkBalance',
    true,
    true
),
(
    'sendMoney',
    'Transfer money to another user',
    'payment',
    '{"type": "object", "properties": {"to": {"type": "string"}, "amount": {"type": "number"}, "currency": {"type": "string", "default": "RWF"}}, "required": ["to", "amount"]}'::jsonb,
    'payment.sendMoney',
    true,
    true
),
(
    'checkAvailability',
    'Check booking availability for a property',
    'booking',
    '{"type": "object", "properties": {"propertyId": {"type": "string"}, "startDate": {"type": "string", "format": "date"}, "endDate": {"type": "string", "format": "date"}}, "required": ["propertyId", "startDate", "endDate"]}'::jsonb,
    'booking.checkAvailability',
    true,
    true
),
(
    'createBooking',
    'Create a new booking reservation',
    'booking',
    '{"type": "object", "properties": {"propertyId": {"type": "string"}, "startDate": {"type": "string", "format": "date"}, "endDate": {"type": "string", "format": "date"}, "guests": {"type": "integer"}}, "required": ["propertyId", "startDate", "endDate"]}'::jsonb,
    'booking.createBooking',
    true,
    true
),
(
    'getUserProfile',
    'Get user profile information',
    'profile',
    '{"type": "object", "properties": {"userId": {"type": "string"}}, "required": ["userId"]}'::jsonb,
    'profile.getUserProfile',
    true,
    true
),
(
    'createTicket',
    'Create a support ticket',
    'support',
    '{"type": "object", "properties": {"subject": {"type": "string"}, "description": {"type": "string"}, "priority": {"type": "string", "enum": ["low", "medium", "high"]}}, "required": ["subject", "description"]}'::jsonb,
    'support.createTicket',
    true,
    true
);

-- =====================================================
-- ROW LEVEL SECURITY (Optional - Configure as needed)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_tool_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_embeddings ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role has full access to ai_agents"
ON ai_agents FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role has full access to ai_conversations"
ON ai_conversations FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role has full access to ai_messages"
ON ai_messages FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role has full access to ai_tools"
ON ai_tools FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role has full access to ai_tool_executions"
ON ai_tool_executions FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role has full access to ai_metrics"
ON ai_metrics FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role has full access to ai_embeddings"
ON ai_embeddings FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =====================================================
-- GRANTS
-- =====================================================

-- Grant usage to anon and authenticated roles (read-only for now)
GRANT SELECT ON ai_agents TO anon, authenticated;
GRANT SELECT ON ai_tools TO anon, authenticated;

-- Service role gets full access
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

COMMIT;
