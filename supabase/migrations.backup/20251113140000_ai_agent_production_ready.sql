-- AI Agent System - Production-Ready Enhancements
-- Created: 2025-11-13
-- Purpose: Final database schema for production AI agent system
-- Ensures all required tables, indexes, and functions are present

BEGIN;

-- Ensure extensions are enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- ============================================================================
-- AGENT EMBEDDINGS TABLE (for semantic memory)
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES agent_conversations(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  embedding vector(1536), -- OpenAI text-embedding-3-small dimensions
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create vector similarity search index (IVFFlat for faster queries)
CREATE INDEX IF NOT EXISTS idx_agent_embeddings_vector 
  ON agent_embeddings 
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_agent_embeddings_conversation 
  ON agent_embeddings(conversation_id);
CREATE INDEX IF NOT EXISTS idx_agent_embeddings_created 
  ON agent_embeddings(created_at DESC);

-- ============================================================================
-- AGENT CONFIGURATIONS TABLE (for admin panel)
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_configurations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_type TEXT NOT NULL,
  config_key TEXT NOT NULL,
  config_value JSONB NOT NULL,
  environment TEXT DEFAULT 'production' CHECK (environment IN ('development', 'staging', 'production')),
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_type, config_key, environment)
);

CREATE INDEX IF NOT EXISTS idx_agent_config_type ON agent_configurations(agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_config_env ON agent_configurations(environment);
CREATE INDEX IF NOT EXISTS idx_agent_config_active ON agent_configurations(is_active) WHERE is_active = true;

-- ============================================================================
-- AI AGENTS REGISTRY (master list of available agents)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('customer_service', 'booking', 'payment', 'marketplace', 'support', 'general')),
  description TEXT,
  system_prompt TEXT NOT NULL,
  model_config JSONB DEFAULT '{"model": "gpt-4o-mini", "temperature": 0.7, "max_tokens": 1000}'::jsonb,
  enabled_tools TEXT[] DEFAULT ARRAY[]::TEXT[],
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
  priority INTEGER DEFAULT 0,
  triggers TEXT[] DEFAULT ARRAY[]::TEXT[],
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_agents_type ON ai_agents(type);
CREATE INDEX IF NOT EXISTS idx_ai_agents_status ON ai_agents(status);
CREATE INDEX IF NOT EXISTS idx_ai_agents_priority ON ai_agents(priority DESC);
CREATE INDEX IF NOT EXISTS idx_ai_agents_active ON ai_agents(status) WHERE status = 'active';

-- ============================================================================
-- ENHANCED INDEXES FOR EXISTING TABLES
-- ============================================================================

-- agent_conversations: Add composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_agent_conv_phone_status 
  ON agent_conversations(phone_number, status);
CREATE INDEX IF NOT EXISTS idx_agent_conv_type_active 
  ON agent_conversations(agent_type, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_agent_conv_last_message 
  ON agent_conversations(last_message_at DESC NULLS LAST);

-- agent_messages: Add composite indexes
CREATE INDEX IF NOT EXISTS idx_agent_msg_conv_role 
  ON agent_messages(conversation_id, role);
CREATE INDEX IF NOT EXISTS idx_agent_msg_conv_time 
  ON agent_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_msg_tool_calls 
  ON agent_messages(tool_calls) WHERE tool_calls IS NOT NULL;

-- agent_tool_executions: Add performance indexes
CREATE INDEX IF NOT EXISTS idx_agent_tool_conv_time 
  ON agent_tool_executions(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_tool_name_success 
  ON agent_tool_executions(tool_name, success);
CREATE INDEX IF NOT EXISTS idx_agent_tool_failed 
  ON agent_tool_executions(created_at DESC) WHERE success = false;

-- agent_metrics: Add time-series indexes
CREATE INDEX IF NOT EXISTS idx_agent_metrics_timestamp_type 
  ON agent_metrics(timestamp DESC, agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_hour 
  ON agent_metrics(date_trunc('hour', timestamp), agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_day 
  ON agent_metrics(date_trunc('day', timestamp), agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_errors 
  ON agent_metrics(timestamp DESC) WHERE success = false;

-- ============================================================================
-- VECTOR SIMILARITY SEARCH FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION match_agent_embeddings(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5,
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
    id,
    conversation_id,
    content,
    metadata,
    1 - (embedding <=> query_embedding) AS similarity,
    created_at
  FROM agent_embeddings
  WHERE 
    1 - (embedding <=> query_embedding) > match_threshold
    AND (filter_conversation_id IS NULL OR conversation_id = filter_conversation_id)
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ============================================================================
-- AGGREGATED METRICS VIEW
-- ============================================================================
CREATE OR REPLACE VIEW agent_metrics_hourly AS
SELECT
  date_trunc('hour', timestamp) AS hour,
  agent_type,
  COUNT(*) AS message_count,
  AVG(latency_ms) AS avg_latency_ms,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY latency_ms) AS p50_latency_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_latency_ms,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms) AS p99_latency_ms,
  SUM(tokens_total) AS total_tokens,
  AVG(tokens_total) AS avg_tokens,
  SUM(cost_usd) AS total_cost_usd,
  AVG(cost_usd) AS avg_cost_usd,
  COUNT(*) FILTER (WHERE success = true)::float / COUNT(*) AS success_rate,
  COUNT(*) FILTER (WHERE success = false) AS error_count
FROM agent_metrics
GROUP BY hour, agent_type
ORDER BY hour DESC, agent_type;

CREATE OR REPLACE VIEW agent_metrics_daily AS
SELECT
  date_trunc('day', timestamp) AS day,
  agent_type,
  COUNT(*) AS message_count,
  AVG(latency_ms) AS avg_latency_ms,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY latency_ms) AS p50_latency_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_latency_ms,
  SUM(tokens_total) AS total_tokens,
  SUM(cost_usd) AS total_cost_usd,
  COUNT(*) FILTER (WHERE success = true)::float / COUNT(*) AS success_rate,
  COUNT(DISTINCT conversation_id) AS unique_conversations
FROM agent_metrics
GROUP BY day, agent_type
ORDER BY day DESC, agent_type;

-- ============================================================================
-- AUTOMATIC UPDATED_AT TRIGGERS
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_agent_configurations_updated_at
  BEFORE UPDATE ON agent_configurations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_agents_updated_at
  BEFORE UPDATE ON ai_agents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_embeddings_updated_at
  BEFORE UPDATE ON agent_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- DATA RETENTION FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_old_agent_data()
RETURNS void AS $$
DECLARE
  retention_days_metrics INTEGER := 90;
  retention_days_messages INTEGER := 180;
  retention_days_embeddings INTEGER := 365;
  deleted_metrics INTEGER;
  deleted_messages INTEGER;
  deleted_embeddings INTEGER;
BEGIN
  -- Clean up old metrics
  DELETE FROM agent_metrics
  WHERE timestamp < NOW() - (retention_days_metrics || ' days')::INTERVAL;
  GET DIAGNOSTICS deleted_metrics = ROW_COUNT;

  -- Clean up old messages from ended conversations
  DELETE FROM agent_messages
  WHERE conversation_id IN (
    SELECT id FROM agent_conversations
    WHERE status = 'ended'
    AND ended_at < NOW() - (retention_days_messages || ' days')::INTERVAL
  );
  GET DIAGNOSTICS deleted_messages = ROW_COUNT;

  -- Clean up old embeddings
  DELETE FROM agent_embeddings
  WHERE created_at < NOW() - (retention_days_embeddings || ' days')::INTERVAL;
  GET DIAGNOSTICS deleted_embeddings = ROW_COUNT;

  RAISE NOTICE 'Cleaned up: % metrics, % messages, % embeddings',
    deleted_metrics, deleted_messages, deleted_embeddings;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- INSERT DEFAULT AI AGENTS
-- ============================================================================
INSERT INTO ai_agents (name, type, description, system_prompt, enabled_tools, priority, triggers)
VALUES 
  (
    'Customer Service Assistant',
    'customer_service',
    'Handles general inquiries, account issues, and provides support',
    'You are a helpful customer service assistant for EasyMO. Be empathetic, provide clear solutions, and escalate when necessary. Keep responses concise (2-3 sentences) for WhatsApp.',
    ARRAY['get_user_info', 'search_help_articles', 'create_support_ticket'],
    10,
    ARRAY['help', 'support', 'problem', 'issue', 'question', 'complaint']
  ),
  (
    'Booking Assistant',
    'booking',
    'Helps users search for trips, check availability, and make bookings',
    'You are a booking assistant for EasyMO mobility platform. Help users find trips, check availability, and complete bookings. Be clear about pricing and schedule details.',
    ARRAY['search_trips', 'check_trip_availability', 'get_route_info', 'initiate_booking'],
    9,
    ARRAY['book', 'trip', 'travel', 'bus', 'ride', 'schedule', 'available']
  ),
  (
    'Payment Assistant',
    'payment',
    'Manages wallet operations, transfers, and payment inquiries',
    'You are a payment assistant for EasyMO wallet services. Help users check balances, make transfers, and understand transactions. Always verify amounts and recipient details.',
    ARRAY['check_wallet_balance', 'initiate_transfer', 'get_transaction_history', 'get_payment_methods'],
    8,
    ARRAY['balance', 'wallet', 'pay', 'transfer', 'money', 'payment', 'transaction']
  ),
  (
    'Marketplace Assistant',
    'marketplace',
    'Helps users discover businesses, products, and local services',
    'You are a marketplace assistant for EasyMO. Help users find local businesses, products, and services. Provide relevant recommendations based on their needs and location.',
    ARRAY['search_businesses', 'get_business_info', 'search_products', 'get_nearby_services'],
    7,
    ARRAY['buy', 'shop', 'store', 'business', 'product', 'service', 'marketplace']
  ),
  (
    'General Assistant',
    'general',
    'Handles general conversations and routes to specialized agents',
    'You are a general assistant for EasyMO. Greet users warmly, answer general questions, and help them access specific services. If needed, inform them you can help with bookings, payments, marketplace, or support.',
    ARRAY['get_user_info', 'get_service_info'],
    5,
    ARRAY['hi', 'hello', 'hey', 'bonjour', 'muraho', 'start']
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- INSERT DEFAULT CONFIGURATIONS
-- ============================================================================
INSERT INTO agent_configurations (agent_type, config_key, config_value, environment)
VALUES
  ('customer_service', 'max_context_messages', '20', 'production'),
  ('customer_service', 'enable_streaming', 'true', 'production'),
  ('customer_service', 'escalation_keywords', '["urgent", "manager", "escalate", "serious"]', 'production'),
  
  ('booking', 'max_search_results', '10', 'production'),
  ('booking', 'enable_multi_step_booking', 'true', 'production'),
  ('booking', 'require_payment_confirmation', 'true', 'production'),
  
  ('payment', 'max_transfer_amount', '1000000', 'production'),
  ('payment', 'require_pin_confirmation', 'true', 'production'),
  ('payment', 'enable_transaction_notifications', 'true', 'production'),
  
  ('marketplace', 'max_search_radius_km', '10', 'production'),
  ('marketplace', 'enable_recommendations', 'true', 'production'),
  
  ('general', 'max_context_messages', '10', 'production'),
  ('general', 'auto_route_threshold', '0.8', 'production')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================
GRANT SELECT, INSERT, UPDATE ON agent_embeddings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON agent_configurations TO authenticated;
GRANT SELECT ON ai_agents TO authenticated;
GRANT INSERT, UPDATE ON ai_agents TO service_role;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION match_agent_embeddings TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_agent_data TO service_role;

-- Grant select on views
GRANT SELECT ON agent_metrics_hourly TO authenticated;
GRANT SELECT ON agent_metrics_daily TO authenticated;

COMMIT;
