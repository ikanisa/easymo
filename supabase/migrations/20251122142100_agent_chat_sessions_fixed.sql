-- Agent Chat Sessions Migration (CORRECTED for actual schema)
-- Fixed: profiles table uses 'user_id' not 'id'

CREATE TABLE IF NOT EXISTS public.agent_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL,
  session_id TEXT NOT NULL UNIQUE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  message_count INTEGER NOT NULL DEFAULT 0,
  options_presented JSONB,
  last_selection INTEGER,
  fallback_triggered BOOLEAN DEFAULT FALSE,
  fallback_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  CONSTRAINT valid_agent_type CHECK (
    agent_type IN (
      'waiter', 'rides', 'jobs', 'business_broker', 'real_estate',
      'farmer', 'insurance', 'sales', 'support', 'pharmacy'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_agent_chat_sessions_user 
  ON public.agent_chat_sessions(user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_chat_sessions_agent 
  ON public.agent_chat_sessions(agent_type, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_chat_sessions_active 
  ON public.agent_chat_sessions(user_id, agent_type) 
  WHERE last_message_at > NOW() - INTERVAL '1 hour';

CREATE INDEX IF NOT EXISTS idx_agent_chat_sessions_session_id 
  ON public.agent_chat_sessions(session_id);

ALTER TABLE public.agent_chat_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own sessions" ON public.agent_chat_sessions;
DROP POLICY IF EXISTS "Service role full access" ON public.agent_chat_sessions;

CREATE POLICY "Users can view own sessions"
  ON public.agent_chat_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access"
  ON public.agent_chat_sessions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_agent_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_message_at = NOW();
  NEW.message_count = NEW.message_count + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_agent_session_timestamp_trigger ON public.agent_chat_sessions;

CREATE TRIGGER update_agent_session_timestamp_trigger
  BEFORE UPDATE ON public.agent_chat_sessions
  FOR EACH ROW
  WHEN (OLD.metadata IS DISTINCT FROM NEW.metadata)
  EXECUTE FUNCTION public.update_agent_session_timestamp();

CREATE OR REPLACE FUNCTION public.cleanup_old_agent_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.agent_chat_sessions
  WHERE last_message_at < NOW() - INTERVAL '24 hours';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

GRANT SELECT ON public.agent_chat_sessions TO authenticated;
GRANT ALL ON public.agent_chat_sessions TO service_role;

CREATE OR REPLACE VIEW public.active_agent_sessions AS
SELECT 
  acs.*,
  p.whatsapp_e164,
  p.wa_id
FROM public.agent_chat_sessions acs
JOIN public.profiles p ON p.user_id = acs.user_id
WHERE acs.last_message_at > NOW() - INTERVAL '1 hour'
ORDER BY acs.last_message_at DESC;

GRANT SELECT ON public.active_agent_sessions TO authenticated;
GRANT SELECT ON public.active_agent_sessions TO service_role;

COMMENT ON TABLE public.agent_chat_sessions IS 
  'Tracks active AI agent chat sessions for chat-first architecture';
