BEGIN;

-- Unified AI Agent System - Database Schema
-- Created: 2025-11-27
-- Part of: Unified AI Agent Consolidation Plan

-- =====================================================
-- AI Agent Sessions Table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.ai_agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours'
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_agent_sessions_phone 
  ON public.ai_agent_sessions(phone);
CREATE INDEX IF NOT EXISTS idx_ai_agent_sessions_expires 
  ON public.ai_agent_sessions(expires_at) 
  WHERE expires_at > NOW();

-- =====================================================
-- AI Agent Interactions Table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.ai_agent_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.ai_agent_sessions(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL,
  user_message TEXT NOT NULL,
  agent_response TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for analytics
CREATE INDEX IF NOT EXISTS idx_ai_agent_interactions_session 
  ON public.ai_agent_interactions(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_interactions_agent 
  ON public.ai_agent_interactions(agent_type);
CREATE INDEX IF NOT EXISTS idx_ai_agent_interactions_created 
  ON public.ai_agent_interactions(created_at DESC);

-- =====================================================
-- AI Agent Metrics Table (for observability)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.ai_agent_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.ai_agent_sessions(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL,
  latency_ms INTEGER,
  tokens_used INTEGER,
  model TEXT,
  cost_usd DECIMAL(10,6),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for analytics
CREATE INDEX IF NOT EXISTS idx_ai_agent_metrics_agent 
  ON public.ai_agent_metrics(agent_type);
CREATE INDEX IF NOT EXISTS idx_ai_agent_metrics_created 
  ON public.ai_agent_metrics(created_at DESC);

-- =====================================================
-- Row Level Security Policies
-- =====================================================

-- Disable RLS for service role access
ALTER TABLE public.ai_agent_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_interactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_metrics DISABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON public.ai_agent_sessions TO anon, authenticated, service_role, postgres;
GRANT ALL ON public.ai_agent_interactions TO anon, authenticated, service_role, postgres;
GRANT ALL ON public.ai_agent_metrics TO anon, authenticated, service_role, postgres;

-- =====================================================
-- Cleanup Function (remove expired sessions)
-- =====================================================
CREATE OR REPLACE FUNCTION public.cleanup_expired_ai_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.ai_agent_sessions
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- =====================================================
-- Comments for documentation
-- =====================================================
COMMENT ON TABLE public.ai_agent_sessions IS 
  'Unified AI agent sessions - stores conversation context and state';
COMMENT ON TABLE public.ai_agent_interactions IS 
  'All AI agent interactions - for analytics and debugging';
COMMENT ON TABLE public.ai_agent_metrics IS 
  'Performance metrics for AI agents - latency, costs, etc.';

COMMIT;
