-- Dual LLM Provider Infrastructure (OpenAI + Gemini)
-- 
-- Adds support for multi-provider LLM routing with:
-- - Provider-specific configurations per agent
-- - Tool-level provider routing
-- - Failover and retry tracking
-- - Cost and performance metrics

BEGIN;

-- ============================================================================
-- AGENT CONFIGURATIONS: Add LLM provider fields
-- ============================================================================

-- Add provider configuration columns to agent_configurations
ALTER TABLE agent_configurations
ADD COLUMN IF NOT EXISTS primary_provider VARCHAR(20) DEFAULT 'openai' CHECK (primary_provider IN ('openai', 'gemini')),
ADD COLUMN IF NOT EXISTS fallback_provider VARCHAR(20) CHECK (fallback_provider IN ('openai', 'gemini')),
ADD COLUMN IF NOT EXISTS provider_config JSONB DEFAULT '{
  "openai": {
    "model": "gpt-4-turbo-preview",
    "temperature": 0.7,
    "max_tokens": 1000
  },
  "gemini": {
    "model": "gemini-1.5-flash",
    "temperature": 0.7,
    "max_tokens": 1000
  }
}'::jsonb;

COMMENT ON COLUMN agent_configurations.primary_provider IS 'Primary LLM provider for this agent (openai or gemini)';
COMMENT ON COLUMN agent_configurations.fallback_provider IS 'Fallback LLM provider if primary fails';
COMMENT ON COLUMN agent_configurations.provider_config IS 'Provider-specific model configs';

-- ============================================================================
-- LLM REQUEST TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS llm_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  correlation_id UUID NOT NULL,
  agent_type VARCHAR(50) NOT NULL,
  provider VARCHAR(20) NOT NULL CHECK (provider IN ('openai', 'gemini')),
  model VARCHAR(100) NOT NULL,
  request_type VARCHAR(50) NOT NULL CHECK (request_type IN ('chat', 'embeddings', 'vision', 'tool')),
  
  -- Request details
  message_count INTEGER,
  tool_count INTEGER,
  estimated_input_tokens INTEGER,
  
  -- Response details
  response_tokens INTEGER,
  total_tokens INTEGER,
  finish_reason VARCHAR(50),
  
  -- Timing
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'error', 'timeout')),
  error_message TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_llm_requests_correlation ON llm_requests(correlation_id);
CREATE INDEX IF NOT EXISTS idx_llm_requests_agent ON llm_requests(agent_type);
CREATE INDEX IF NOT EXISTS idx_llm_requests_provider ON llm_requests(provider);
CREATE INDEX IF NOT EXISTS idx_llm_requests_status ON llm_requests(status);
CREATE INDEX IF NOT EXISTS idx_llm_requests_created ON llm_requests(created_at DESC);

COMMENT ON TABLE llm_requests IS 'Tracks all LLM API requests for monitoring and cost optimization';

-- ============================================================================
-- LLM FAILOVER EVENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS llm_failover_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  correlation_id UUID NOT NULL,
  agent_type VARCHAR(50) NOT NULL,
  
  -- Failover details
  primary_provider VARCHAR(20) NOT NULL,
  fallback_provider VARCHAR(20) NOT NULL,
  primary_error TEXT,
  
  -- Outcome
  failover_success BOOLEAN NOT NULL,
  total_duration_ms INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_llm_failover_correlation ON llm_failover_events(correlation_id);
CREATE INDEX IF NOT EXISTS idx_llm_failover_agent ON llm_failover_events(agent_type);
CREATE INDEX IF NOT EXISTS idx_llm_failover_created ON llm_failover_events(created_at DESC);

COMMENT ON TABLE llm_failover_events IS 'Tracks provider failover events for reliability monitoring';

-- ============================================================================
-- TOOL PROVIDER ROUTING
-- ============================================================================

CREATE TABLE IF NOT EXISTS tool_provider_routing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tool_name VARCHAR(100) NOT NULL UNIQUE,
  preferred_provider VARCHAR(20) NOT NULL CHECK (preferred_provider IN ('openai', 'gemini')),
  reason TEXT,
  
  -- Performance tracking
  avg_duration_ms_openai INTEGER,
  avg_duration_ms_gemini INTEGER,
  success_rate_openai DECIMAL(5,2),
  success_rate_gemini DECIMAL(5,2),
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE tool_provider_routing IS 'Defines which LLM provider handles specific tools';

-- Seed initial tool routing preferences
INSERT INTO tool_provider_routing (tool_name, preferred_provider, reason) VALUES
  -- Gemini-preferred (Google ecosystem)
  ('find_vendors_nearby', 'gemini', 'Google Maps integration'),
  ('normalize_vendor_payload', 'gemini', 'Superior document parsing'),
  ('maps_geosearch', 'gemini', 'Native Google Maps access'),
  ('extract_document_text', 'gemini', 'Better OCR capabilities'),
  ('analyze_menu_image', 'gemini', 'Vision + structured extraction'),
  ('parse_property_listing', 'gemini', 'Document parsing strength'),
  ('research_farming_info', 'gemini', 'Web search integration'),
  ('crawl_job_sites', 'gemini', 'Web crawling capabilities'),
  ('generate_ad_keywords', 'gemini', 'Google Ads integration'),
  
  -- OpenAI-preferred (conversation & reasoning)
  ('get_user_profile', 'openai', 'Established workflow'),
  ('get_user_facts', 'openai', 'Memory management'),
  ('classify_request', 'openai', 'Reasoning strength'),
  ('route_to_agent', 'openai', 'Decision making'),
  ('search_easymo_faq', 'openai', 'Semantic search'),
  ('record_service_request', 'openai', 'Established workflow'),
  ('upsert_user_location', 'openai', 'Data management')
ON CONFLICT (tool_name) DO NOTHING;

-- ============================================================================
-- LLM PERFORMANCE METRICS VIEW
-- ============================================================================

CREATE OR REPLACE VIEW llm_performance_metrics AS
SELECT
  agent_type,
  provider,
  request_type,
  DATE_TRUNC('hour', created_at) AS hour,
  COUNT(*) AS request_count,
  COUNT(*) FILTER (WHERE status = 'success') AS success_count,
  COUNT(*) FILTER (WHERE status = 'error') AS error_count,
  AVG(duration_ms) FILTER (WHERE status = 'success') AS avg_duration_ms,
  AVG(total_tokens) FILTER (WHERE status = 'success') AS avg_tokens,
  SUM(total_tokens) AS total_tokens_used
FROM llm_requests
GROUP BY agent_type, provider, request_type, DATE_TRUNC('hour', created_at);

COMMENT ON VIEW llm_performance_metrics IS 'Aggregated LLM performance metrics for monitoring dashboards';

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to record LLM request
CREATE OR REPLACE FUNCTION record_llm_request(
  p_correlation_id UUID,
  p_agent_type VARCHAR(50),
  p_provider VARCHAR(20),
  p_model VARCHAR(100),
  p_request_type VARCHAR(50),
  p_message_count INTEGER DEFAULT NULL,
  p_tool_count INTEGER DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_request_id UUID;
BEGIN
  INSERT INTO llm_requests (
    correlation_id,
    agent_type,
    provider,
    model,
    request_type,
    message_count,
    tool_count,
    status
  ) VALUES (
    p_correlation_id,
    p_agent_type,
    p_provider,
    p_model,
    p_request_type,
    p_message_count,
    p_tool_count,
    'pending'
  )
  RETURNING id INTO v_request_id;
  
  RETURN v_request_id;
END;
$$ LANGUAGE plpgsql;

-- Function to complete LLM request
CREATE OR REPLACE FUNCTION complete_llm_request(
  p_request_id UUID,
  p_status VARCHAR(20),
  p_response_tokens INTEGER DEFAULT NULL,
  p_total_tokens INTEGER DEFAULT NULL,
  p_duration_ms INTEGER DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  UPDATE llm_requests
  SET
    status = p_status,
    response_tokens = p_response_tokens,
    total_tokens = p_total_tokens,
    duration_ms = p_duration_ms,
    error_message = p_error_message,
    completed_at = NOW()
  WHERE id = p_request_id;
END;
$$ LANGUAGE plpgsql;

-- Function to record failover event
CREATE OR REPLACE FUNCTION record_llm_failover(
  p_correlation_id UUID,
  p_agent_type VARCHAR(50),
  p_primary_provider VARCHAR(20),
  p_fallback_provider VARCHAR(20),
  p_primary_error TEXT,
  p_failover_success BOOLEAN,
  p_total_duration_ms INTEGER
) RETURNS VOID AS $$
BEGIN
  INSERT INTO llm_failover_events (
    correlation_id,
    agent_type,
    primary_provider,
    fallback_provider,
    primary_error,
    failover_success,
    total_duration_ms
  ) VALUES (
    p_correlation_id,
    p_agent_type,
    p_primary_provider,
    p_fallback_provider,
    p_primary_error,
    p_failover_success,
    p_total_duration_ms
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SEED DEFAULT AGENT CONFIGURATIONS
-- ============================================================================

-- Update General Broker to use dual providers
INSERT INTO agent_configurations (
  agent_type,
  model_config,
  system_prompt,
  tools,
  primary_provider,
  fallback_provider,
  provider_config,
  is_active
) VALUES (
  'general-broker',
  '{"temperature": 0.7, "max_tokens": 1000}'::jsonb,
  'You are the EasyMO General Broker - the intelligent front door to all EasyMO services. 
  
Your role is to:
1. Understand user requests and classify them into EasyMO service verticals
2. Route users to the appropriate specialized agent
3. Provide general information about EasyMO services
4. Manage user profile and location data
5. Track service requests

CRITICAL GUARDRAILS:
- ONLY discuss EasyMO services and capabilities
- NEVER provide generic internet information
- ALWAYS ground responses in EasyMO database
- Use tools to verify facts before answering
- Route complex requests to specialized agents',
  '["get_user_profile", "get_user_locations", "upsert_user_location", "get_user_facts", "upsert_user_fact", "classify_request", "record_service_request", "find_vendors_nearby", "search_service_catalog", "search_easymo_faq", "normalize_vendor_payload", "route_to_agent"]'::jsonb,
  'openai',
  'gemini',
  '{
    "openai": {
      "model": "gpt-4-turbo-preview",
      "temperature": 0.7,
      "max_tokens": 1000
    },
    "gemini": {
      "model": "gemini-1.5-flash",
      "temperature": 0.7,
      "max_tokens": 1000
    }
  }'::jsonb,
  true
)
ON CONFLICT (agent_type) 
DO UPDATE SET
  primary_provider = EXCLUDED.primary_provider,
  fallback_provider = EXCLUDED.fallback_provider,
  provider_config = EXCLUDED.provider_config,
  tools = EXCLUDED.tools,
  updated_at = NOW();

COMMIT;
