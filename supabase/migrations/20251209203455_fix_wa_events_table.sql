-- Fix wa_events table schema for message deduplication
-- Required columns: message_id, phone_number, event_type, timestamp, body, status, created_at

BEGIN;

-- Drop and recreate wa_events table with correct schema
DROP TABLE IF EXISTS public.wa_events;

CREATE TABLE public.wa_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT UNIQUE NOT NULL,
  phone_number TEXT NOT NULL,
  event_type TEXT,
  timestamp TIMESTAMPTZ NOT NULL,
  body TEXT,
  status TEXT DEFAULT 'processed',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_wa_events_message_id ON public.wa_events(message_id);
CREATE INDEX idx_wa_events_phone_number ON public.wa_events(phone_number);
CREATE INDEX idx_wa_events_timestamp ON public.wa_events(timestamp DESC);
CREATE INDEX idx_wa_events_created_at ON public.wa_events(created_at DESC);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_wa_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_wa_events_timestamp ON public.wa_events;
CREATE TRIGGER trigger_update_wa_events_timestamp
BEFORE UPDATE ON public.wa_events
FOR EACH ROW
EXECUTE FUNCTION update_wa_events_updated_at();

-- Enable RLS (optional - adjust based on your security requirements)
ALTER TABLE public.wa_events ENABLE ROW LEVEL SECURITY;

-- Policy: Service role full access
DROP POLICY IF EXISTS "Service role full access" ON public.wa_events;
CREATE POLICY "Service role full access"
ON public.wa_events
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Grant permissions
GRANT ALL ON public.wa_events TO service_role;

COMMIT;
