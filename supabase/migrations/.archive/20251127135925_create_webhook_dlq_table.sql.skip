-- Create webhook_dlq table if it doesn't exist
-- Dead Letter Queue for failed webhook processing

BEGIN;

CREATE TABLE IF NOT EXISTS webhook_dlq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT,
  service TEXT NOT NULL,
  correlation_id TEXT,
  request_id TEXT,
  payload JSONB NOT NULL,
  error_message TEXT NOT NULL,
  error_type TEXT NOT NULL,
  status_code INTEGER,
  retry_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reprocessed_at TIMESTAMPTZ,
  last_retry_at TIMESTAMPTZ,
  
  CONSTRAINT webhook_dlq_status_check 
    CHECK (status IN ('pending', 'processing', 'reprocessed', 'failed', 'discarded'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_webhook_dlq_status 
  ON webhook_dlq(status) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_webhook_dlq_next_retry 
  ON webhook_dlq(next_retry_at) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_webhook_dlq_service 
  ON webhook_dlq(service);

CREATE INDEX IF NOT EXISTS idx_webhook_dlq_created_at 
  ON webhook_dlq(created_at DESC);

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_webhook_dlq_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER webhook_dlq_update_timestamp
  BEFORE UPDATE ON webhook_dlq
  FOR EACH ROW
  EXECUTE FUNCTION update_webhook_dlq_timestamp();

-- RLS policies (admin only)
ALTER TABLE webhook_dlq ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view all DLQ entries"
  ON webhook_dlq FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

CREATE POLICY "Service role can manage DLQ"
  ON webhook_dlq FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add comments for documentation
COMMENT ON TABLE webhook_dlq IS 
  'Dead Letter Queue for failed webhook messages. Stores failed messages for automatic retry with exponential backoff.';

COMMENT ON COLUMN webhook_dlq.retry_count IS 
  'Number of retry attempts. Max 5 retries before marking as failed.';

COMMENT ON COLUMN webhook_dlq.next_retry_at IS 
  'When to retry next. Exponential backoff: 5min, 15min, 1hr, 4hr, 12hr.';

COMMIT;
