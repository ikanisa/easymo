-- Agent Orchestration System Tables
-- Creates tables for agent sessions, quotes, and orchestration workflows
--
-- This migration supports the AI Agent Orchestrator microservice
-- as defined in services/agent-core/

BEGIN;

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Agent Sessions Table
-- Stores negotiation sessions with 5-minute windows
CREATE TABLE IF NOT EXISTS public.agent_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  flow_type TEXT NOT NULL CHECK (flow_type IN (
    'nearby_drivers',
    'nearby_passengers', 
    'pharmacy',
    'quincaillerie',
    'shops',
    'property_rental',
    'schedule_trip',
    'waiter',
    'job_board',
    'marketplace'
  )),
  status TEXT NOT NULL DEFAULT 'searching' CHECK (status IN (
    'searching',
    'negotiating',
    'presenting',
    'completed',
    'timeout',
    'cancelled'
  )),
  request_data JSONB NOT NULL DEFAULT '{}',
  result_data JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  deadline_at TIMESTAMPTZ NOT NULL,
  selected_quote_id UUID,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.agent_sessions IS 'AI agent negotiation sessions with time-bound windows';
COMMENT ON COLUMN public.agent_sessions.flow_type IS 'Type of agent workflow (e.g., nearby_drivers, pharmacy)';
COMMENT ON COLUMN public.agent_sessions.status IS 'Current session state';
COMMENT ON COLUMN public.agent_sessions.deadline_at IS 'Session expiration time (typically 5 minutes from start)';

-- Agent Quotes Table
-- Stores vendor quotes collected during negotiation
CREATE TABLE IF NOT EXISTS public.agent_quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES public.agent_sessions(id) ON DELETE CASCADE,
  vendor_id TEXT,
  vendor_type TEXT NOT NULL,
  vendor_name TEXT,
  vendor_phone TEXT,
  offer_data JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'received',
    'accepted',
    'rejected',
    'expired'
  )),
  price_amount NUMERIC(10,2),
  price_currency TEXT DEFAULT 'RWF',
  estimated_time_minutes INT,
  notes TEXT,
  received_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.agent_quotes IS 'Vendor quotes collected by AI agents';
COMMENT ON COLUMN public.agent_quotes.status IS 'Quote status (pending=requested, received=vendor responded)';
COMMENT ON COLUMN public.agent_quotes.expires_at IS 'When quote becomes invalid';

-- Agent Traces Table
-- Stores execution traces for debugging and analytics
CREATE TABLE IF NOT EXISTS public.agent_traces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_name TEXT NOT NULL,
  user_id TEXT NOT NULL,
  session_id UUID,
  query TEXT,
  result JSONB,
  duration_ms INT,
  tools_invoked TEXT[],
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.agent_traces IS 'Agent execution traces for monitoring and debugging';

-- Agent Conversations Table
-- Stores conversation history for agents
CREATE TABLE IF NOT EXISTS public.agent_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES public.agent_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'agent', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.agent_conversations IS 'Conversation history for agent sessions';

-- Create Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_agent_sessions_user_id ON public.agent_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_flow_type ON public.agent_sessions(flow_type);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_status ON public.agent_sessions(status);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_deadline_at ON public.agent_sessions(deadline_at);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_started_at ON public.agent_sessions(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_quotes_session_id ON public.agent_quotes(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_quotes_vendor_id ON public.agent_quotes(vendor_id);
CREATE INDEX IF NOT EXISTS idx_agent_quotes_status ON public.agent_quotes(status);
CREATE INDEX IF NOT EXISTS idx_agent_quotes_expires_at ON public.agent_quotes(expires_at);

CREATE INDEX IF NOT EXISTS idx_agent_traces_agent_name ON public.agent_traces(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_traces_user_id ON public.agent_traces(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_traces_session_id ON public.agent_traces(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_traces_created_at ON public.agent_traces(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_conversations_session_id ON public.agent_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_created_at ON public.agent_conversations(created_at DESC);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_agent_sessions_updated_at
    BEFORE UPDATE ON public.agent_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agent_quotes_updated_at
    BEFORE UPDATE ON public.agent_quotes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Helper function to get expiring sessions
CREATE OR REPLACE FUNCTION public.get_expiring_agent_sessions(minutes_threshold INT DEFAULT 1)
RETURNS TABLE (
  session_id UUID,
  user_id TEXT,
  flow_type TEXT,
  minutes_remaining NUMERIC,
  quotes_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.user_id,
    s.flow_type,
    EXTRACT(EPOCH FROM (s.deadline_at - NOW())) / 60 AS minutes_remaining,
    COUNT(q.id) AS quotes_count
  FROM public.agent_sessions s
  LEFT JOIN public.agent_quotes q ON s.id = q.session_id AND q.status = 'received'
  WHERE 
    s.status IN ('searching', 'negotiating')
    AND s.deadline_at > NOW()
    AND s.deadline_at <= NOW() + (minutes_threshold || ' minutes')::INTERVAL
  GROUP BY s.id, s.user_id, s.flow_type, s.deadline_at;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.get_expiring_agent_sessions IS 'Find sessions approaching their deadline';

-- Row Level Security (RLS) Policies
ALTER TABLE public.agent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_traces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role has full access to agent_sessions"
  ON public.agent_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to agent_quotes"
  ON public.agent_quotes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to agent_traces"
  ON public.agent_traces
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to agent_conversations"
  ON public.agent_conversations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can read their own sessions
CREATE POLICY "Users can view their own agent_sessions"
  ON public.agent_sessions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can view quotes for their sessions"
  ON public.agent_quotes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.agent_sessions
      WHERE id = agent_quotes.session_id
      AND user_id = auth.uid()::text
    )
  );

COMMIT;
