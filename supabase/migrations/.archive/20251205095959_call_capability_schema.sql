-- ============================================================================
-- Call Capability Schema
-- Unified call handling for all easyMO agents
-- ============================================================================

BEGIN;

-- 1) Enum for call channel
DO $$ BEGIN
  CREATE TYPE call_channel AS ENUM (
    'phone',
    'whatsapp_call',
    'whatsapp_voice_note'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2) Main call record (extending existing calls table pattern)
CREATE TABLE IF NOT EXISTS calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  agent_id TEXT,
  channel TEXT,  -- Will be converted to call_channel enum below
  direction TEXT CHECK (direction IN ('inbound','outbound')),
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  status TEXT DEFAULT 'initiated' CHECK (status IN ('initiated', 'in_progress', 'completed', 'abandoned', 'failed')),
  provider_call_id TEXT,
  from_number TEXT,
  to_number TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add missing columns and convert channel to enum if table already exists
DO $$ BEGIN
  ALTER TABLE calls ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
  ALTER TABLE calls ADD COLUMN IF NOT EXISTS agent_id TEXT;
  ALTER TABLE calls ADD COLUMN IF NOT EXISTS provider_call_id TEXT;
  ALTER TABLE calls ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
  
  -- Try to alter channel column to use enum type
  BEGIN
    ALTER TABLE calls ALTER COLUMN channel TYPE call_channel USING channel::call_channel;
    ALTER TABLE calls ALTER COLUMN channel SET DEFAULT 'phone'::call_channel;
    ALTER TABLE calls ALTER COLUMN channel SET NOT NULL;
  EXCEPTION WHEN others THEN
    -- If conversion fails, add as new column
    ALTER TABLE calls ADD COLUMN IF NOT EXISTS channel call_channel DEFAULT 'phone';
  END;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Indexes for calls table
CREATE INDEX IF NOT EXISTS idx_calls_user_id ON calls(user_id);
CREATE INDEX IF NOT EXISTS idx_calls_agent_id ON calls(agent_id);
CREATE INDEX IF NOT EXISTS idx_calls_channel ON calls(channel);
CREATE INDEX IF NOT EXISTS idx_calls_started_at ON calls(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_provider_call_id ON calls(provider_call_id);

-- 3) Transcript chunks (for streaming / analysis)
CREATE TABLE IF NOT EXISTS call_transcripts (
  id BIGSERIAL PRIMARY KEY,
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,                            -- 1..N sequence number
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  text TEXT NOT NULL,
  confidence NUMERIC(4,3),                         -- STT confidence score 0.000-1.000
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,          -- Raw STT/TTS metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for call_transcripts
CREATE INDEX IF NOT EXISTS idx_call_transcripts_call_id ON call_transcripts(call_id);
CREATE INDEX IF NOT EXISTS idx_call_transcripts_call_id_seq ON call_transcripts(call_id, seq);
CREATE UNIQUE INDEX IF NOT EXISTS idx_call_transcripts_call_seq_unique ON call_transcripts(call_id, seq);

-- 4) High-level summary + structured extraction
CREATE TABLE IF NOT EXISTS call_summaries (
  call_id UUID PRIMARY KEY REFERENCES calls(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  language TEXT,                                   -- e.g. 'en', 'rw', 'sw', 'fr'
  main_intent TEXT,                                -- e.g. 'farmer_supply', 'job_search', 'property_inquiry'
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
  entities JSONB NOT NULL DEFAULT '{}'::jsonb,     -- Domain-specific structured data
  next_actions JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of follow-up actions
  duration_seconds INTEGER,
  word_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for call_summaries
CREATE INDEX IF NOT EXISTS idx_call_summaries_main_intent ON call_summaries(main_intent);
CREATE INDEX IF NOT EXISTS idx_call_summaries_sentiment ON call_summaries(sentiment);
CREATE INDEX IF NOT EXISTS idx_call_summaries_entities ON call_summaries USING GIN (entities);

-- Comments for documentation
COMMENT ON TABLE calls IS 'Unified call records across all easyMO agents';
COMMENT ON COLUMN calls.agent_id IS 'Agent identifier: jobs_ai, farmers_ai, real_estate_ai, sales_ai, waiter_ai';
COMMENT ON COLUMN calls.channel IS 'Call channel: phone, whatsapp_call, whatsapp_voice_note';
COMMENT ON COLUMN calls.provider_call_id IS 'External call ID from Twilio, WhatsApp, or other telephony provider';

COMMENT ON TABLE call_transcripts IS 'Streaming transcript chunks during calls';
COMMENT ON COLUMN call_transcripts.seq IS 'Sequence number for ordering transcript chunks';
COMMENT ON COLUMN call_transcripts.role IS 'Speaker role: user (caller), assistant (agent), system';
COMMENT ON COLUMN call_transcripts.confidence IS 'Speech-to-text confidence score';

COMMENT ON TABLE call_summaries IS 'AI-generated call summary with structured entity extraction';
COMMENT ON COLUMN call_summaries.entities IS 'Domain-specific structured data extracted from call';
COMMENT ON COLUMN call_summaries.next_actions IS 'Array of recommended follow-up actions';

-- Enable RLS
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_summaries ENABLE ROW LEVEL SECURITY;

-- RLS policies for calls
DROP POLICY IF EXISTS "Users can view their own calls" ON calls;
CREATE POLICY "Users can view their own calls"
  ON calls FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage all calls" ON calls;
CREATE POLICY "Service role can manage all calls"
  ON calls FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- RLS policies for call_transcripts
DROP POLICY IF EXISTS "Users can view transcripts of their calls" ON call_transcripts;
CREATE POLICY "Users can view transcripts of their calls"
  ON call_transcripts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM calls WHERE calls.id = call_transcripts.call_id AND calls.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Service role can manage all transcripts" ON call_transcripts;
CREATE POLICY "Service role can manage all transcripts"
  ON call_transcripts FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- RLS policies for call_summaries
DROP POLICY IF EXISTS "Users can view summaries of their calls" ON call_summaries;
CREATE POLICY "Users can view summaries of their calls"
  ON call_summaries FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM calls WHERE calls.id = call_summaries.call_id AND calls.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Service role can manage all summaries" ON call_summaries;
CREATE POLICY "Service role can manage all summaries"
  ON call_summaries FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

COMMIT;
