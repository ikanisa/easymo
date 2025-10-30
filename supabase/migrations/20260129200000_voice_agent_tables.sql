BEGIN;

-- Voice Agent Tables
-- Creates tables for storing voice call data, events, and related metadata

-- Table: calls
-- Stores main call records with metadata, transcripts, and intents
CREATE TABLE IF NOT EXISTS calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sid TEXT UNIQUE NOT NULL,
  from_number TEXT,
  to_number TEXT,
  direction TEXT CHECK (direction IN ('inbound', 'outbound')),
  status TEXT DEFAULT 'initiated',
  transcript TEXT,
  intent TEXT,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for calls table
CREATE INDEX IF NOT EXISTS idx_calls_call_sid ON calls(call_sid);
CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_direction ON calls(direction);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);

-- Table: call_events
-- Stores individual events that occur during calls (start, stop, transcript, tool calls, errors)
CREATE TABLE IF NOT EXISTS call_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sid TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for call_events table
CREATE INDEX IF NOT EXISTS idx_call_events_call_sid ON call_events(call_sid);
CREATE INDEX IF NOT EXISTS idx_call_events_event_type ON call_events(event_type);
CREATE INDEX IF NOT EXISTS idx_call_events_created_at ON call_events(created_at DESC);

-- Comments for documentation
COMMENT ON TABLE calls IS 'Voice call records with metadata, transcripts, and intents';
COMMENT ON TABLE call_events IS 'Individual events that occur during voice calls';

COMMENT ON COLUMN calls.call_sid IS 'Twilio call identifier (unique)';
COMMENT ON COLUMN calls.direction IS 'Call direction: inbound or outbound';
COMMENT ON COLUMN calls.status IS 'Call status: initiated, in_progress, completed, failed';
COMMENT ON COLUMN calls.transcript IS 'Full transcript of the call';
COMMENT ON COLUMN calls.intent IS 'Detected intent from the call';
COMMENT ON COLUMN calls.meta IS 'Additional metadata (JSON)';

COMMENT ON COLUMN call_events.call_sid IS 'References the parent call';
COMMENT ON COLUMN call_events.event_type IS 'Event type: start, stop, transcript, tool_call, error, webhook';
COMMENT ON COLUMN call_events.payload IS 'Event-specific payload data (JSON)';

COMMIT;
