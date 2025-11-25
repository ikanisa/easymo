-- ================================================================
-- AI Agent Metrics Table
-- ================================================================
-- Creates a dedicated table for tracking AI agent metrics including
-- token usage, costs, and performance data.
--
-- This table consolidates metrics tracking across all AI agent
-- implementations and provides data for cost monitoring and
-- performance optimization.
--
-- Created: 2025-11-25
-- ================================================================

BEGIN;

-- ================================================================
-- 1. AI AGENT METRICS TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS public.ai_agent_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Session/conversation reference
  session_id UUID REFERENCES public.agent_chat_sessions(id) ON DELETE SET NULL,
  conversation_id UUID,
  
  -- Agent information
  agent_type TEXT NOT NULL,
  agent_id UUID,
  
  -- Performance metrics
  latency_ms INTEGER NOT NULL DEFAULT 0,
  
  -- Token usage
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  tokens_total INTEGER GENERATED ALWAYS AS (tokens_in + tokens_out) STORED,
  
  -- Cost tracking (in USD, 6 decimal precision for micro-transactions)
  cost_usd DECIMAL(10,6) NOT NULL DEFAULT 0,
  
  -- Model and provider information
  model TEXT,
  provider TEXT CHECK (provider IN ('openai', 'gemini', 'anthropic', 'other')),
  
  -- Success/failure tracking
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  
  -- Tools executed in this interaction
  tools_executed TEXT[] DEFAULT '{}',
  
  -- Request metadata
  correlation_id TEXT,
  user_id UUID,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.ai_agent_metrics IS 
  'Metrics tracking for AI agent interactions including token usage, costs, and performance';

COMMENT ON COLUMN public.ai_agent_metrics.tokens_in IS 'Number of input/prompt tokens';
COMMENT ON COLUMN public.ai_agent_metrics.tokens_out IS 'Number of output/completion tokens';
COMMENT ON COLUMN public.ai_agent_metrics.cost_usd IS 'Estimated cost in USD based on provider pricing';
COMMENT ON COLUMN public.ai_agent_metrics.latency_ms IS 'Total processing time in milliseconds';

-- ================================================================
-- 2. INDEXES
-- ================================================================

-- Primary lookup indexes
CREATE INDEX IF NOT EXISTS idx_ai_agent_metrics_agent_type 
  ON public.ai_agent_metrics(agent_type);
CREATE INDEX IF NOT EXISTS idx_ai_agent_metrics_session_id 
  ON public.ai_agent_metrics(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_metrics_conversation_id 
  ON public.ai_agent_metrics(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_metrics_correlation_id 
  ON public.ai_agent_metrics(correlation_id);

-- Time-based queries for reporting
CREATE INDEX IF NOT EXISTS idx_ai_agent_metrics_created_at 
  ON public.ai_agent_metrics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_agent_metrics_agent_created 
  ON public.ai_agent_metrics(agent_type, created_at DESC);

-- Cost analysis queries
CREATE INDEX IF NOT EXISTS idx_ai_agent_metrics_provider 
  ON public.ai_agent_metrics(provider);
CREATE INDEX IF NOT EXISTS idx_ai_agent_metrics_model 
  ON public.ai_agent_metrics(model);

-- Error tracking
CREATE INDEX IF NOT EXISTS idx_ai_agent_metrics_success 
  ON public.ai_agent_metrics(success) WHERE success = false;

-- ================================================================
-- 3. ROW LEVEL SECURITY
-- ================================================================

ALTER TABLE public.ai_agent_metrics ENABLE ROW LEVEL SECURITY;

-- Service role has full access
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ai_agent_metrics' 
    AND policyname = 'ai_agent_metrics_service_role'
  ) THEN
    CREATE POLICY "ai_agent_metrics_service_role"
      ON public.ai_agent_metrics
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Authenticated users can read their own metrics
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ai_agent_metrics' 
    AND policyname = 'ai_agent_metrics_read_own'
  ) THEN
    CREATE POLICY "ai_agent_metrics_read_own"
      ON public.ai_agent_metrics
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- ================================================================
-- 4. HELPER FUNCTIONS
-- ================================================================

-- Record a new metric entry
CREATE OR REPLACE FUNCTION public.record_ai_agent_metric(
  p_agent_type TEXT,
  p_session_id UUID DEFAULT NULL,
  p_conversation_id UUID DEFAULT NULL,
  p_latency_ms INTEGER DEFAULT 0,
  p_tokens_in INTEGER DEFAULT 0,
  p_tokens_out INTEGER DEFAULT 0,
  p_cost_usd DECIMAL(10,6) DEFAULT 0,
  p_model TEXT DEFAULT NULL,
  p_provider TEXT DEFAULT NULL,
  p_success BOOLEAN DEFAULT true,
  p_error_message TEXT DEFAULT NULL,
  p_tools_executed TEXT[] DEFAULT '{}',
  p_correlation_id TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_metric_id UUID;
BEGIN
  INSERT INTO public.ai_agent_metrics (
    agent_type,
    session_id,
    conversation_id,
    latency_ms,
    tokens_in,
    tokens_out,
    cost_usd,
    model,
    provider,
    success,
    error_message,
    tools_executed,
    correlation_id,
    user_id
  ) VALUES (
    p_agent_type,
    p_session_id,
    p_conversation_id,
    p_latency_ms,
    p_tokens_in,
    p_tokens_out,
    p_cost_usd,
    p_model,
    p_provider,
    p_success,
    p_error_message,
    p_tools_executed,
    p_correlation_id,
    p_user_id
  )
  RETURNING id INTO v_metric_id;

  RETURN v_metric_id;
END;
$$;

-- Get aggregated metrics for an agent type within a time range
CREATE OR REPLACE FUNCTION public.get_ai_agent_metrics_summary(
  p_agent_type TEXT DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '7 days',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  agent_type TEXT,
  total_requests BIGINT,
  successful_requests BIGINT,
  failed_requests BIGINT,
  success_rate DECIMAL(5,2),
  total_tokens BIGINT,
  total_cost_usd DECIMAL(12,6),
  avg_latency_ms DECIMAL(10,2),
  avg_tokens_per_request DECIMAL(10,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.agent_type,
    COUNT(*)::BIGINT AS total_requests,
    COUNT(*) FILTER (WHERE m.success = true)::BIGINT AS successful_requests,
    COUNT(*) FILTER (WHERE m.success = false)::BIGINT AS failed_requests,
    ROUND(
      (COUNT(*) FILTER (WHERE m.success = true)::DECIMAL / NULLIF(COUNT(*), 0) * 100),
      2
    ) AS success_rate,
    SUM(m.tokens_in + m.tokens_out)::BIGINT AS total_tokens,
    SUM(m.cost_usd) AS total_cost_usd,
    ROUND(AVG(m.latency_ms)::DECIMAL, 2) AS avg_latency_ms,
    ROUND(AVG(m.tokens_in + m.tokens_out)::DECIMAL, 2) AS avg_tokens_per_request
  FROM public.ai_agent_metrics m
  WHERE m.created_at BETWEEN p_start_date AND p_end_date
    AND (p_agent_type IS NULL OR m.agent_type = p_agent_type)
  GROUP BY m.agent_type
  ORDER BY total_requests DESC;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.record_ai_agent_metric TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_ai_agent_metrics_summary TO authenticated, service_role;

COMMIT;
