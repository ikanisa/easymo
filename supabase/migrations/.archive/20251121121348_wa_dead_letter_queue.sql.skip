BEGIN;

-- =====================================================
-- WHATSAPP DEAD LETTER QUEUE - November 21, 2025
-- =====================================================
-- Adds dead letter queue and workflow recovery tables
-- for improved reliability and error recovery
-- =====================================================

-- Dead letter queue for failed webhook messages
CREATE TABLE IF NOT EXISTS public.wa_dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT UNIQUE NOT NULL,
  from_number TEXT NOT NULL,
  payload JSONB NOT NULL,
  error_message TEXT,
  error_stack TEXT,
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ
);

-- Workflow recovery tracking
CREATE TABLE IF NOT EXISTS public.wa_workflow_recovery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id TEXT NOT NULL,
  workflow_type TEXT NOT NULL,
  recovery_action TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_wa_dlq_next_retry 
  ON public.wa_dead_letter_queue(next_retry_at) 
  WHERE processed = FALSE;

CREATE INDEX IF NOT EXISTS idx_wa_dlq_message_id 
  ON public.wa_dead_letter_queue(message_id);

CREATE INDEX IF NOT EXISTS idx_wa_recovery_conversation 
  ON public.wa_workflow_recovery(conversation_id);

CREATE INDEX IF NOT EXISTS idx_wa_recovery_status 
  ON public.wa_workflow_recovery(status) 
  WHERE status IN ('pending', 'in_progress');

-- Update trigger for wa_dead_letter_queue
CREATE OR REPLACE FUNCTION update_wa_dlq_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_wa_dlq_timestamp
  BEFORE UPDATE ON public.wa_dead_letter_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_wa_dlq_timestamp();

-- RLS Policies
ALTER TABLE public.wa_dead_letter_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_workflow_recovery ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role full access on wa_dlq"
  ON public.wa_dead_letter_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on wa_recovery"
  ON public.wa_workflow_recovery
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Reload schema
NOTIFY pgrst, 'reload schema';

COMMIT;
