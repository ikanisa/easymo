BEGIN;

-- =====================================================
-- VOICE INFRASTRUCTURE COMPLETE
-- =====================================================
-- Comprehensive voice tables for OpenAI Realtime API + MTN SIP
-- Supports: MTN SIP, OpenAI Realtime API
-- =====================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLE: voice_calls
-- =====================================================
-- Main voice call records with metadata
CREATE TABLE IF NOT EXISTS public.voice_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Call identifiers
  mtn_call_sid TEXT UNIQUE,
  sip_session_id TEXT,
  openai_call_id TEXT,
  
  -- Direction & routing
  direction TEXT CHECK (direction IN ('inbound','outbound')) NOT NULL,
  from_e164 TEXT,
  to_e164 TEXT,
  
  -- Project & locale
  project_id TEXT,
  locale TEXT DEFAULT 'en',
  country TEXT,
  
  -- Timing
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INT,
  
  -- Status & outcome
  status TEXT DEFAULT 'initiated' CHECK (status IN ('initiated', 'ringing', 'in_progress', 'completed', 'failed', 'busy', 'no_answer')),
  outcome TEXT,
  
  -- Consent management
  consent_obtained BOOLEAN DEFAULT FALSE,
  consent_recorded_at TIMESTAMPTZ,
  consent_channel TEXT,
  consent_media_url TEXT,
  
  -- Transcription
  transcript TEXT,
  transcript_locale TEXT DEFAULT 'en',
  transcript_status TEXT DEFAULT 'pending' CHECK (transcript_status IN ('pending', 'processing', 'completed', 'failed')),
  last_transcript_segment_at TIMESTAMPTZ,
  
  -- Intent & handoff
  intent TEXT,
  handoff BOOLEAN DEFAULT FALSE,
  handoff_target TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for voice_calls
CREATE INDEX IF NOT EXISTS idx_voice_calls_mtn_sid ON public.voice_calls(mtn_call_sid);
CREATE INDEX IF NOT EXISTS idx_voice_calls_openai_id ON public.voice_calls(openai_call_id);
CREATE INDEX IF NOT EXISTS idx_voice_calls_direction ON public.voice_calls(direction);
CREATE INDEX IF NOT EXISTS idx_voice_calls_status ON public.voice_calls(status);
CREATE INDEX IF NOT EXISTS idx_voice_calls_started_at ON public.voice_calls(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_calls_country ON public.voice_calls(country);
CREATE INDEX IF NOT EXISTS idx_voice_calls_from_e164 ON public.voice_calls(from_e164);

-- =====================================================
-- TABLE: voice_events
-- =====================================================
-- Event log for all voice call events
CREATE TABLE IF NOT EXISTS public.voice_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID REFERENCES public.voice_calls(id) ON DELETE CASCADE,
  t TIMESTAMPTZ DEFAULT NOW(),
  type TEXT NOT NULL CHECK (type IN (
    'call_started', 'call_ended', 'ringing', 'answered',
    'transcript_segment', 'tool_call', 'error', 'webhook',
    'openai_session_created', 'openai_session_updated',
    'openai_response_created', 'openai_response_done',
    'openai_audio_buffer_committed', 'openai_input_audio_buffer_speech_started',
    'openai_input_audio_buffer_speech_stopped', 'openai_conversation_item_created'
  )),
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for voice_events
CREATE INDEX IF NOT EXISTS idx_voice_events_call_id ON public.voice_events(call_id);
CREATE INDEX IF NOT EXISTS idx_voice_events_type ON public.voice_events(type);
CREATE INDEX IF NOT EXISTS idx_voice_events_created_at ON public.voice_events(created_at DESC);

-- =====================================================
-- TABLE: transcripts (renamed from voice_segments)
-- =====================================================
-- Conversation transcript segments
CREATE TABLE IF NOT EXISTS public.transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES public.voice_calls(id) ON DELETE CASCADE,
  sequence INTEGER,
  role TEXT CHECK (role IN ('user','assistant','system','caller')) NOT NULL,
  content TEXT NOT NULL,
  confidence NUMERIC,
  lang TEXT,
  t TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for transcripts
CREATE INDEX IF NOT EXISTS idx_transcripts_call_id ON public.transcripts(call_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_call_sequence ON public.transcripts(call_id, sequence);
CREATE INDEX IF NOT EXISTS idx_transcripts_created_at ON public.transcripts(created_at DESC);

-- Unique constraint for sequence per call
CREATE UNIQUE INDEX IF NOT EXISTS transcripts_call_sequence_unique 
  ON public.transcripts(call_id, sequence) 
  WHERE sequence IS NOT NULL;

-- =====================================================
-- TABLE: call_consents
-- =====================================================
-- Call recording consent tracking
CREATE TABLE IF NOT EXISTS public.call_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID REFERENCES public.voice_calls(id) ON DELETE CASCADE,
  consent_text TEXT,
  consent_result BOOLEAN,
  audio_url TEXT,
  t TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_consents_call_id ON public.call_consents(call_id);

-- =====================================================
-- TABLE: mcp_tool_calls
-- =====================================================
-- Model Context Protocol tool invocations during calls
CREATE TABLE IF NOT EXISTS public.mcp_tool_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID REFERENCES public.voice_calls(id) ON DELETE CASCADE,
  server TEXT,
  tool TEXT NOT NULL,
  args JSONB,
  result JSONB,
  success BOOLEAN,
  error TEXT,
  t TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcp_tool_calls_call_id ON public.mcp_tool_calls(call_id);
CREATE INDEX IF NOT EXISTS idx_mcp_tool_calls_tool ON public.mcp_tool_calls(tool);
CREATE INDEX IF NOT EXISTS idx_mcp_tool_calls_success ON public.mcp_tool_calls(success);

-- =====================================================
-- TABLE: wa_threads
-- =====================================================
-- Link voice calls to WhatsApp conversations
CREATE TABLE IF NOT EXISTS public.wa_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID REFERENCES public.voice_calls(id) ON DELETE CASCADE,
  wa_conversation_id TEXT,
  customer_msisdn TEXT,
  state TEXT,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_threads_call_id ON public.wa_threads(call_id);
CREATE INDEX IF NOT EXISTS idx_wa_threads_wa_conversation_id ON public.wa_threads(wa_conversation_id);
CREATE INDEX IF NOT EXISTS idx_wa_threads_customer_msisdn ON public.wa_threads(customer_msisdn);

-- =====================================================
-- TABLE: voice_memories
-- =====================================================
-- User preferences & context persistence
CREATE TABLE IF NOT EXISTS public.voice_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  msisdn TEXT UNIQUE NOT NULL,
  country TEXT,
  prefs JSONB DEFAULT '{}'::jsonb,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_memories_msisdn ON public.voice_memories(msisdn);
CREATE INDEX IF NOT EXISTS idx_voice_memories_country ON public.voice_memories(country);
CREATE INDEX IF NOT EXISTS idx_voice_memories_last_seen ON public.voice_memories(last_seen_at DESC);

-- =====================================================
-- TABLE: openai_sessions
-- =====================================================
-- OpenAI Realtime API session tracking
CREATE TABLE IF NOT EXISTS public.openai_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID REFERENCES public.voice_calls(id) ON DELETE CASCADE,
  session_id TEXT UNIQUE NOT NULL,
  model TEXT DEFAULT 'gpt-4o-realtime-preview',
  voice TEXT DEFAULT 'alloy',
  instructions TEXT,
  modalities TEXT[] DEFAULT ARRAY['text', 'audio'],
  input_audio_format TEXT DEFAULT 'pcm16',
  output_audio_format TEXT DEFAULT 'pcm16',
  turn_detection JSONB,
  tools JSONB,
  temperature NUMERIC DEFAULT 0.8,
  max_response_output_tokens INTEGER,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_openai_sessions_call_id ON public.openai_sessions(call_id);
CREATE INDEX IF NOT EXISTS idx_openai_sessions_session_id ON public.openai_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_openai_sessions_status ON public.openai_sessions(status);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.voice_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_tool_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.openai_sessions ENABLE ROW LEVEL SECURITY;

-- Service role policies
DO $$
BEGIN
  -- voice_calls
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'voice_calls' AND policyname = 'svc_rw_voice_calls'
  ) THEN
    CREATE POLICY svc_rw_voice_calls ON public.voice_calls
      FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
  END IF;

  -- voice_events
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'voice_events' AND policyname = 'svc_rw_voice_events'
  ) THEN
    CREATE POLICY svc_rw_voice_events ON public.voice_events
      FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
  END IF;

  -- transcripts
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'transcripts' AND policyname = 'svc_rw_transcripts'
  ) THEN
    CREATE POLICY svc_rw_transcripts ON public.transcripts
      FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
  END IF;

  -- call_consents
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'call_consents' AND policyname = 'svc_rw_call_consents'
  ) THEN
    CREATE POLICY svc_rw_call_consents ON public.call_consents
      FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
  END IF;

  -- mcp_tool_calls
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'mcp_tool_calls' AND policyname = 'svc_rw_mcp_tool_calls'
  ) THEN
    CREATE POLICY svc_rw_mcp_tool_calls ON public.mcp_tool_calls
      FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
  END IF;

  -- wa_threads
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'wa_threads' AND policyname = 'svc_rw_wa_threads'
  ) THEN
    CREATE POLICY svc_rw_wa_threads ON public.wa_threads
      FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
  END IF;

  -- voice_memories
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'voice_memories' AND policyname = 'svc_rw_voice_memories'
  ) THEN
    CREATE POLICY svc_rw_voice_memories ON public.voice_memories
      FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
  END IF;

  -- openai_sessions
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'openai_sessions' AND policyname = 'svc_rw_openai_sessions'
  ) THEN
    CREATE POLICY svc_rw_openai_sessions ON public.openai_sessions
      FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
  END IF;
END $$;

-- =====================================================
-- GRANTS
-- =====================================================

GRANT ALL ON TABLE public.voice_calls TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.voice_events TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.transcripts TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.call_consents TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.mcp_tool_calls TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.wa_threads TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.voice_memories TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.openai_sessions TO postgres, anon, authenticated, service_role;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE public.voice_calls IS 'Voice call records supporting MTN SIP and OpenAI Realtime API';
COMMENT ON TABLE public.voice_events IS 'Event log for all voice call events including OpenAI Realtime events';
COMMENT ON TABLE public.transcripts IS 'Conversation transcript segments from voice calls';
COMMENT ON TABLE public.call_consents IS 'Call recording consent tracking';
COMMENT ON TABLE public.mcp_tool_calls IS 'Model Context Protocol tool invocations during calls';
COMMENT ON TABLE public.wa_threads IS 'Link voice calls to WhatsApp conversations';
COMMENT ON TABLE public.voice_memories IS 'User preferences and context persistence across calls';
COMMENT ON TABLE public.openai_sessions IS 'OpenAI Realtime API session tracking and configuration';

COMMIT;
