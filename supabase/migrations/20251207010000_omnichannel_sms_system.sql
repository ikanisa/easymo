-- Omnichannel SMS System: Voice + WhatsApp + SMS unified conversation
-- Enables post-call summary delivery and cross-channel messaging

BEGIN;

-- =====================================================
-- 1. EXTEND PROFILES FOR OMNICHANNEL SUPPORT
-- =====================================================

DO $$ 
BEGIN
  -- Add WhatsApp tracking columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'profiles' 
                 AND column_name = 'whatsapp_jid') THEN
    ALTER TABLE public.profiles ADD COLUMN whatsapp_jid TEXT;
    CREATE INDEX IF NOT EXISTS idx_profiles_whatsapp_jid ON public.profiles(whatsapp_jid);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'profiles' 
                 AND column_name = 'has_whatsapp') THEN
    ALTER TABLE public.profiles ADD COLUMN has_whatsapp BOOLEAN DEFAULT FALSE;
  END IF;

  -- Add SMS preference column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'profiles' 
                 AND column_name = 'allows_sms') THEN
    ALTER TABLE public.profiles ADD COLUMN allows_sms BOOLEAN DEFAULT TRUE;
  END IF;

  -- Track last active channel
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'profiles' 
                 AND column_name = 'last_active_channel') THEN
    ALTER TABLE public.profiles ADD COLUMN last_active_channel TEXT;
    COMMENT ON COLUMN public.profiles.last_active_channel IS 'Last channel used: voice, whatsapp, sms';
  END IF;

  -- Add notification preferences
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'profiles' 
                 AND column_name = 'notification_preferences') THEN
    ALTER TABLE public.profiles ADD COLUMN notification_preferences JSONB DEFAULT '{"whatsapp": true, "sms": true}'::jsonb;
  END IF;
END $$;

-- =====================================================
-- 2. OMNICHANNEL SESSIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.omnichannel_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  
  -- Session metadata
  primary_channel TEXT NOT NULL, -- 'voice', 'whatsapp', 'sms'
  active_channels TEXT[] DEFAULT ARRAY[]::TEXT[], -- channels used in this session
  
  -- Agent tracking
  last_agent_id TEXT, -- e.g., 'easymo-callcenter-agi'
  last_intent TEXT, -- e.g., 'real_estate_rental', 'mobility_ride'
  
  -- Session state
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'closed', 'follow_up'
  
  -- Timestamps
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  
  -- Context and metadata
  context JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Indexes
  CONSTRAINT valid_primary_channel CHECK (primary_channel IN ('voice', 'whatsapp', 'sms')),
  CONSTRAINT valid_status CHECK (status IN ('active', 'closed', 'follow_up'))
);

CREATE INDEX IF NOT EXISTS idx_omnichannel_sessions_profile ON public.omnichannel_sessions(profile_id);
CREATE INDEX IF NOT EXISTS idx_omnichannel_sessions_status ON public.omnichannel_sessions(status);
CREATE INDEX IF NOT EXISTS idx_omnichannel_sessions_updated ON public.omnichannel_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_omnichannel_sessions_active ON public.omnichannel_sessions(profile_id, status) 
  WHERE status IN ('active', 'follow_up');

COMMENT ON TABLE public.omnichannel_sessions IS 'Unified sessions across voice, WhatsApp, and SMS channels';

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_omnichannel_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_omnichannel_session_timestamp ON public.omnichannel_sessions;
DROP TRIGGER IF EXISTS trigger_update_omnichannel_session_timestamp ON ; -- FIXME: add table name
CREATE TRIGGER trigger_update_omnichannel_session_timestamp
  BEFORE UPDATE ON public.omnichannel_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_omnichannel_session_timestamp();

-- =====================================================
-- 3. MESSAGE DELIVERY LOG TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.message_delivery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- References
  session_id UUID REFERENCES public.omnichannel_sessions(id) ON DELETE SET NULL,
  profile_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  call_id UUID REFERENCES public.call_summaries(call_id) ON DELETE SET NULL,
  
  -- Message details
  channel TEXT NOT NULL, -- 'whatsapp', 'sms'
  direction TEXT NOT NULL, -- 'outbound', 'inbound'
  message_type TEXT NOT NULL, -- 'summary', 'follow_up', 'reply'
  
  -- Content
  content TEXT NOT NULL,
  recipient_phone TEXT NOT NULL,
  
  -- Delivery status
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed'
  external_message_id TEXT, -- WhatsApp or SMS provider message ID
  
  -- Error tracking
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  CONSTRAINT valid_channel CHECK (channel IN ('whatsapp', 'sms')),
  CONSTRAINT valid_direction CHECK (direction IN ('outbound', 'inbound')),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'sent', 'delivered', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_message_delivery_profile ON public.message_delivery_log(profile_id);
CREATE INDEX IF NOT EXISTS idx_message_delivery_session ON public.message_delivery_log(session_id);
CREATE INDEX IF NOT EXISTS idx_message_delivery_call ON public.message_delivery_log(call_id);
CREATE INDEX IF NOT EXISTS idx_message_delivery_status ON public.message_delivery_log(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_delivery_external_id ON public.message_delivery_log(external_message_id) 
  WHERE external_message_id IS NOT NULL;

COMMENT ON TABLE public.message_delivery_log IS 'Tracks all outbound/inbound messages across WhatsApp and SMS';

-- =====================================================
-- 4. CONVERSATION THREADING TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.conversation_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- References
  session_id UUID NOT NULL REFERENCES public.omnichannel_sessions(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  parent_call_id UUID REFERENCES public.call_summaries(call_id) ON DELETE SET NULL,
  
  -- Thread details
  channel TEXT NOT NULL, -- 'voice', 'whatsapp', 'sms'
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  
  -- Thread status
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'closed'
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Context preservation
  thread_context JSONB DEFAULT '{}'::jsonb,
  
  CONSTRAINT valid_thread_channel CHECK (channel IN ('voice', 'whatsapp', 'sms')),
  CONSTRAINT valid_thread_status CHECK (status IN ('active', 'closed'))
);

CREATE INDEX IF NOT EXISTS idx_conversation_threads_session ON public.conversation_threads(session_id);
CREATE INDEX IF NOT EXISTS idx_conversation_threads_profile ON public.conversation_threads(profile_id);
CREATE INDEX IF NOT EXISTS idx_conversation_threads_active ON public.conversation_threads(profile_id, status) 
  WHERE status = 'active';

COMMENT ON TABLE public.conversation_threads IS 'Links messages across channels to maintain conversation context';

-- =====================================================
-- 5. HELPER FUNCTIONS
-- =====================================================

-- Get or create omnichannel session
CREATE OR REPLACE FUNCTION get_or_create_omnichannel_session(
  p_profile_id UUID,
  p_channel TEXT,
  p_call_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_session_id UUID;
BEGIN
  -- Try to find an active or follow_up session from the last 24 hours
  SELECT id INTO v_session_id
  FROM public.omnichannel_sessions
  WHERE profile_id = p_profile_id
    AND status IN ('active', 'follow_up')
    AND updated_at > NOW() - INTERVAL '24 hours'
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_session_id IS NULL THEN
    -- Create new session
    INSERT INTO public.omnichannel_sessions (
      profile_id,
      primary_channel,
      active_channels,
      status,
      metadata
    )
    VALUES (
      p_profile_id,
      p_channel,
      ARRAY[p_channel],
      'active',
      jsonb_build_object('call_id', p_call_id)
    )
    RETURNING id INTO v_session_id;
  ELSE
    -- Update existing session
    UPDATE public.omnichannel_sessions
    SET 
      active_channels = array_append(
        CASE 
          WHEN p_channel = ANY(active_channels) THEN active_channels
          ELSE active_channels
        END,
        CASE 
          WHEN p_channel = ANY(active_channels) THEN NULL
          ELSE p_channel
        END
      ),
      status = 'active',
      updated_at = NOW()
    WHERE id = v_session_id;
  END IF;

  RETURN v_session_id;
END;
$$;

-- Update session status
CREATE OR REPLACE FUNCTION update_omnichannel_session_status(
  p_session_id UUID,
  p_status TEXT,
  p_last_agent_id TEXT DEFAULT NULL,
  p_last_intent TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.omnichannel_sessions
  SET 
    status = p_status,
    last_agent_id = COALESCE(p_last_agent_id, last_agent_id),
    last_intent = COALESCE(p_last_intent, last_intent),
    closed_at = CASE WHEN p_status = 'closed' THEN NOW() ELSE closed_at END,
    updated_at = NOW()
  WHERE id = p_session_id;
END;
$$;

-- Check if user has WhatsApp
CREATE OR REPLACE FUNCTION check_whatsapp_available(p_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_has_whatsapp BOOLEAN;
BEGIN
  SELECT has_whatsapp INTO v_has_whatsapp
  FROM public.profiles
  WHERE user_id = p_profile_id;
  
  RETURN COALESCE(v_has_whatsapp, FALSE);
END;
$$;

-- Log message delivery
CREATE OR REPLACE FUNCTION log_message_delivery(
  p_session_id UUID,
  p_profile_id UUID,
  p_call_id UUID,
  p_channel TEXT,
  p_direction TEXT,
  p_message_type TEXT,
  p_content TEXT,
  p_recipient_phone TEXT,
  p_external_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_message_id UUID;
BEGIN
  INSERT INTO public.message_delivery_log (
    session_id,
    profile_id,
    call_id,
    channel,
    direction,
    message_type,
    content,
    recipient_phone,
    external_message_id,
    status
  )
  VALUES (
    p_session_id,
    p_profile_id,
    p_call_id,
    p_channel,
    p_direction,
    p_message_type,
    p_content,
    p_recipient_phone,
    p_external_id,
    'pending'
  )
  RETURNING id INTO v_message_id;
  
  RETURN v_message_id;
END;
$$;

-- =====================================================
-- 6. RLS POLICIES
-- =====================================================

ALTER TABLE public.omnichannel_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_delivery_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_threads ENABLE ROW LEVEL SECURITY;

-- Sessions: Users can only see their own
DROP POLICY IF EXISTS "Users can view own sessions" ON public.omnichannel_sessions;
CREATE POLICY "Users can view own sessions"
  ON public.omnichannel_sessions FOR SELECT
  USING (auth.uid() = profile_id);

-- Message logs: Users can only see their own
DROP POLICY IF EXISTS "Users can view own messages" ON public.message_delivery_log;
CREATE POLICY "Users can view own messages"
  ON public.message_delivery_log FOR SELECT
  USING (auth.uid() = profile_id);

-- Threads: Users can only see their own
DROP POLICY IF EXISTS "Users can view own threads" ON public.conversation_threads;
CREATE POLICY "Users can view own threads"
  ON public.conversation_threads FOR SELECT
  USING (auth.uid() = profile_id);

-- Service role can do everything
DROP POLICY IF EXISTS "Service role full access to sessions" ON public.omnichannel_sessions;
CREATE POLICY "Service role full access to sessions"
  ON public.omnichannel_sessions FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Service role full access to messages" ON public.message_delivery_log;
CREATE POLICY "Service role full access to messages"
  ON public.message_delivery_log FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Service role full access to threads" ON public.conversation_threads;
CREATE POLICY "Service role full access to threads"
  ON public.conversation_threads FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

COMMIT;
