-- =====================================================================
-- CREATE AI AGENT SESSIONS TABLE
-- =====================================================================
-- Critical infrastructure for AI agent conversation management
-- 
-- This table stores conversation sessions for all AI agents:
-- - Waiter Agent (restaurant/bar discovery and ordering)
-- - Business Broker Agent (business discovery)
-- - All other agents (jobs, rides, property, etc.)
--
-- Context JSONB structure examples:
-- Waiter: {restaurantId, barId, tableNumber, discoveryState, entryMethod}
-- Business: {businessId, searchResults, location: {lat, lng}, discoveryState}
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. CREATE AI AGENT SESSIONS TABLE
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.ai_agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User identification
  phone TEXT NOT NULL,
  
  -- Agent identification
  agent_type TEXT,
  
  -- Session context (JSONB for flexibility)
  -- Examples:
  -- Waiter Agent: {"restaurantId": "uuid", "tableNumber": "5", "discoveryState": "awaiting_bar_selection"}
  -- Business Agent: {"location": {"lat": -1.9536, "lng": 30.0606}, "searchResults": [...]}
  context JSONB DEFAULT '{}'::jsonb,
  
  -- Conversation history (optional - can be stored separately)
  conversation_history JSONB DEFAULT '[]'::jsonb,
  
  -- Session metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- Session state
  is_active BOOLEAN DEFAULT true
);

-- =====================================================================
-- 2. CREATE INDEXES FOR PERFORMANCE
-- =====================================================================

-- Fast lookup by phone number (primary query pattern)
CREATE INDEX idx_ai_agent_sessions_phone 
ON public.ai_agent_sessions(phone) 
WHERE is_active = true;

-- Fast cleanup of expired sessions
CREATE INDEX idx_ai_agent_sessions_expires 
ON public.ai_agent_sessions(expires_at) 
WHERE is_active = true;

-- Filter by agent type
CREATE INDEX idx_ai_agent_sessions_agent_type 
ON public.ai_agent_sessions(agent_type) 
WHERE agent_type IS NOT NULL AND is_active = true;

-- Find active sessions for a user
CREATE INDEX idx_ai_agent_sessions_phone_active 
ON public.ai_agent_sessions(phone, expires_at DESC) 
WHERE is_active = true;

-- JSONB context queries (e.g., find sessions by restaurantId)
CREATE INDEX idx_ai_agent_sessions_context 
ON public.ai_agent_sessions USING GIN(context);

-- =====================================================================
-- 3. CREATE TRIGGER FOR UPDATED_AT
-- =====================================================================

CREATE OR REPLACE FUNCTION update_ai_agent_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ai_agent_sessions_timestamp
BEFORE UPDATE ON public.ai_agent_sessions
FOR EACH ROW
EXECUTE FUNCTION update_ai_agent_sessions_updated_at();

-- =====================================================================
-- 4. CREATE CLEANUP FUNCTION FOR EXPIRED SESSIONS
-- =====================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_ai_agent_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Mark expired sessions as inactive (soft delete)
  UPDATE public.ai_agent_sessions
  SET is_active = false
  WHERE expires_at < now() 
    AND is_active = true;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a scheduled job to run cleanup (requires pg_cron extension)
-- SELECT cron.schedule(
--   'cleanup-ai-agent-sessions',
--   '0 * * * *', -- Every hour
--   $$SELECT cleanup_expired_ai_agent_sessions();$$
-- );

-- =====================================================================
-- 5. CREATE HELPER FUNCTIONS
-- =====================================================================

-- Get or create session for a phone number
CREATE OR REPLACE FUNCTION get_or_create_ai_agent_session(
  p_phone TEXT,
  p_agent_type TEXT DEFAULT NULL,
  p_ttl_hours INTEGER DEFAULT 24
)
RETURNS UUID AS $$
DECLARE
  v_session_id UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Calculate expiration time
  v_expires_at := now() + (p_ttl_hours || ' hours')::INTERVAL;
  
  -- Try to find existing active session
  SELECT id INTO v_session_id
  FROM public.ai_agent_sessions
  WHERE phone = p_phone
    AND is_active = true
    AND expires_at > now()
    AND (p_agent_type IS NULL OR agent_type = p_agent_type)
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- If no active session found, create new one
  IF v_session_id IS NULL THEN
    INSERT INTO public.ai_agent_sessions (
      phone,
      agent_type,
      context,
      expires_at
    ) VALUES (
      p_phone,
      p_agent_type,
      '{}'::jsonb,
      v_expires_at
    )
    RETURNING id INTO v_session_id;
  ELSE
    -- Extend expiration of existing session
    UPDATE public.ai_agent_sessions
    SET expires_at = v_expires_at,
        updated_at = now()
    WHERE id = v_session_id;
  END IF;
  
  RETURN v_session_id;
END;
$$ LANGUAGE plpgsql;

-- Update session context
CREATE OR REPLACE FUNCTION update_ai_agent_session_context(
  p_session_id UUID,
  p_context JSONB
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.ai_agent_sessions
  SET context = p_context,
      updated_at = now()
  WHERE id = p_session_id
    AND is_active = true;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- =====================================================================

-- Enable RLS
ALTER TABLE public.ai_agent_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own sessions
CREATE POLICY "Users can read own sessions"
ON public.ai_agent_sessions
FOR SELECT
USING (
  -- Allow access if phone matches authenticated user's phone
  -- OR if user is service role
  auth.role() = 'service_role'
  OR phone = (SELECT phone FROM public.profiles WHERE user_id = auth.uid())
);

-- Policy: Service role can do everything
CREATE POLICY "Service role full access"
ON public.ai_agent_sessions
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- =====================================================================
-- 7. GRANT PERMISSIONS
-- =====================================================================

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE ON public.ai_agent_sessions TO authenticated;

-- Grant full access to service role
GRANT ALL ON public.ai_agent_sessions TO service_role;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION get_or_create_ai_agent_session(TEXT, TEXT, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION update_ai_agent_session_context(UUID, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION cleanup_expired_ai_agent_sessions() TO service_role;

-- =====================================================================
-- 8. ADD COMMENTS
-- =====================================================================

COMMENT ON TABLE public.ai_agent_sessions IS 
'Stores conversation sessions for all AI agents. Context JSONB contains agent-specific state like restaurantId, tableNumber, searchResults, etc.';

COMMENT ON COLUMN public.ai_agent_sessions.phone IS 
'WhatsApp phone number (primary user identifier)';

COMMENT ON COLUMN public.ai_agent_sessions.agent_type IS 
'Agent type (waiter, business_broker, marketplace, jobs, etc.) - matches ai_agent_configs.agent_type';

COMMENT ON COLUMN public.ai_agent_sessions.context IS 
'Agent-specific session context. Waiter: {restaurantId, barId, tableNumber, discoveryState}. Business: {location, searchResults, pendingQuery}';

COMMENT ON COLUMN public.ai_agent_sessions.conversation_history IS 
'Optional conversation history storage. Can also use separate table (agent_chat_messages) for this.';

COMMENT ON COLUMN public.ai_agent_sessions.expires_at IS 
'Session expiration timestamp. Default TTL is 24 hours but can be extended.';

COMMIT;
