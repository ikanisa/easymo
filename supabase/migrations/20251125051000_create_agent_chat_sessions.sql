-- ================================================================
-- Agent Chat Sessions and Tool Executions Tables
-- ================================================================
-- Creates tables for AI agent session persistence and tool
-- execution tracking.
--
-- Tables:
--   - agent_chat_sessions: Persistent conversation sessions
--   - agent_tool_executions: Tool execution history
--
-- Created: 2025-11-25
-- ================================================================

BEGIN;

-- ================================================================
-- 1. AGENT CHAT SESSIONS TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS public.agent_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.whatsapp_users(id) ON DELETE CASCADE,
  user_phone TEXT,
  agent_type TEXT NOT NULL,
  agent_id UUID,
  conversation_history JSONB DEFAULT '[]'::jsonb,
  context JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours'
);

ALTER TABLE public.agent_chat_sessions
  ADD COLUMN IF NOT EXISTS user_phone TEXT,
  ADD COLUMN IF NOT EXISTS agent_type TEXT NOT NULL DEFAULT 'general',
  ALTER COLUMN agent_type DROP DEFAULT;

COMMENT ON TABLE public.agent_chat_sessions IS 
  'Persistent chat sessions for AI agents with conversation history';

-- Indexes for agent_chat_sessions
CREATE INDEX IF NOT EXISTS idx_agent_chat_sessions_user_id 
  ON public.agent_chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_chat_sessions_user_phone 
  ON public.agent_chat_sessions(user_phone);
CREATE INDEX IF NOT EXISTS idx_agent_chat_sessions_agent_type 
  ON public.agent_chat_sessions(agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_chat_sessions_status 
  ON public.agent_chat_sessions(status);
CREATE INDEX IF NOT EXISTS idx_agent_chat_sessions_last_message_at 
  ON public.agent_chat_sessions(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_chat_sessions_expires_at 
  ON public.agent_chat_sessions(expires_at);

-- Unique constraint for active sessions per user per agent type
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_chat_sessions_active_unique
  ON public.agent_chat_sessions(user_phone, agent_type)
  WHERE status = 'active';

-- ================================================================
-- 2. AGENT TOOL EXECUTIONS TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS public.agent_tool_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Session reference
  session_id UUID REFERENCES public.agent_chat_sessions(id) ON DELETE CASCADE,
  
  -- Tool details
  tool_name TEXT NOT NULL,
  parameters JSONB DEFAULT '{}'::jsonb,
  result JSONB,
  
  -- Execution metrics
  duration_ms INTEGER,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.agent_tool_executions IS 
  'Tool execution history for AI agent sessions';

-- Indexes for agent_tool_executions
CREATE INDEX IF NOT EXISTS idx_agent_tool_executions_session_id 
  ON public.agent_tool_executions(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_tool_executions_tool_name 
  ON public.agent_tool_executions(tool_name);
CREATE INDEX IF NOT EXISTS idx_agent_tool_executions_success 
  ON public.agent_tool_executions(success);
CREATE INDEX IF NOT EXISTS idx_agent_tool_executions_created_at 
  ON public.agent_tool_executions(created_at DESC);

-- ================================================================
-- 3. ROW LEVEL SECURITY
-- ================================================================

ALTER TABLE public.agent_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_tool_executions ENABLE ROW LEVEL SECURITY;

-- Chat sessions: Service role has full access
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'agent_chat_sessions' 
    AND policyname = 'agent_chat_sessions_service_role'
  ) THEN
    CREATE POLICY "agent_chat_sessions_service_role"
      ON public.agent_chat_sessions
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Chat sessions: Users can read their own sessions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'agent_chat_sessions' 
    AND policyname = 'agent_chat_sessions_read_own'
  ) THEN
    CREATE POLICY "agent_chat_sessions_read_own"
      ON public.agent_chat_sessions
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- Tool executions: Service role has full access
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'agent_tool_executions' 
    AND policyname = 'agent_tool_executions_service_role'
  ) THEN
    CREATE POLICY "agent_tool_executions_service_role"
      ON public.agent_tool_executions
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Tool executions: Users can read their own session's executions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'agent_tool_executions' 
    AND policyname = 'agent_tool_executions_read_own'
  ) THEN
    CREATE POLICY "agent_tool_executions_read_own"
      ON public.agent_tool_executions
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.agent_chat_sessions
          WHERE id = agent_tool_executions.session_id
          AND user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ================================================================
-- 4. TRIGGERS
-- ================================================================

-- Updated_at trigger for agent_chat_sessions
CREATE OR REPLACE FUNCTION public.update_agent_chat_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.last_message_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_agent_chat_sessions_updated_at ON public.agent_chat_sessions;
CREATE TRIGGER trigger_agent_chat_sessions_updated_at
  BEFORE UPDATE ON public.agent_chat_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_agent_chat_sessions_updated_at();

-- ================================================================
-- 5. HELPER FUNCTIONS
-- ================================================================

-- Get or create active session for a user and agent type
CREATE OR REPLACE FUNCTION public.get_or_create_agent_session(
  p_user_phone TEXT,
  p_agent_type TEXT,
  p_user_id UUID DEFAULT NULL,
  p_agent_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_id UUID;
BEGIN
  -- Try to find active session
  SELECT id INTO v_session_id
  FROM public.agent_chat_sessions
  WHERE user_phone = p_user_phone
    AND agent_type = p_agent_type
    AND status = 'active'
    AND expires_at > NOW()
  LIMIT 1;

  -- If found, update last_message_at and return
  IF v_session_id IS NOT NULL THEN
    UPDATE public.agent_chat_sessions
    SET last_message_at = NOW()
    WHERE id = v_session_id;
    RETURN v_session_id;
  END IF;

  -- Create new session
  INSERT INTO public.agent_chat_sessions (
    user_phone,
    user_id,
    agent_type,
    agent_id,
    status
  ) VALUES (
    p_user_phone,
    p_user_id,
    p_agent_type,
    p_agent_id,
    'active'
  )
  RETURNING id INTO v_session_id;

  RETURN v_session_id;
END;
$$;

-- Add message to session conversation history
CREATE OR REPLACE FUNCTION public.add_agent_message(
  p_session_id UUID,
  p_role TEXT, -- 'user', 'assistant', 'system'
  p_content TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.agent_chat_sessions
  SET conversation_history = conversation_history || jsonb_build_object(
    'role', p_role,
    'content', p_content,
    'timestamp', NOW(),
    'metadata', p_metadata
  )
  WHERE id = p_session_id;

  RETURN FOUND;
END;
$$;

-- Get conversation history for a session
CREATE OR REPLACE FUNCTION public.get_agent_conversation(
  p_session_id UUID,
  p_limit INTEGER DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_history JSONB;
  v_context JSONB;
BEGIN
  SELECT 
    conversation_history,
    context
  INTO v_history, v_context
  FROM public.agent_chat_sessions
  WHERE id = p_session_id;

  -- Return last N messages with context
  RETURN jsonb_build_object(
    'messages', (
      SELECT jsonb_agg(elem)
      FROM (
        SELECT elem
        FROM jsonb_array_elements(COALESCE(v_history, '[]'::jsonb)) elem
        ORDER BY (elem->>'timestamp')::timestamptz DESC
        LIMIT p_limit
      ) sub
    ),
    'context', v_context
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_or_create_agent_session TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.add_agent_message TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_agent_conversation TO authenticated, anon, service_role;

COMMIT;
