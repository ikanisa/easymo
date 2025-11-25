-- Create Dead Letter Queue table for failed webhooks
-- This table stores webhook payloads that failed after all retry attempts

BEGIN;

CREATE TABLE IF NOT EXISTS public.webhook_dlq (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Webhook metadata
    phone_number text,
    service text,
    correlation_id text,
    request_id text,
    
    -- Payload and error details
    payload jsonb NOT NULL,
    error_message text,
    error_type text,
    status_code int,
    
    -- Retry tracking
    retry_count int DEFAULT 0,
    last_retry_at timestamptz,
    next_retry_at timestamptz,
    
    -- Status
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'reprocessed', 'failed', 'discarded')),
    
    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    reprocessed_at timestamptz
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_webhook_dlq_status 
    ON public.webhook_dlq(status, next_retry_at) 
    WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_webhook_dlq_phone 
    ON public.webhook_dlq(phone_number);

CREATE INDEX IF NOT EXISTS idx_webhook_dlq_service 
    ON public.webhook_dlq(service);

CREATE INDEX IF NOT EXISTS idx_webhook_dlq_created 
    ON public.webhook_dlq(created_at DESC);

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_webhook_dlq_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_webhook_dlq_timestamp'
    ) THEN
        CREATE TRIGGER trg_update_webhook_dlq_timestamp
        BEFORE UPDATE ON public.webhook_dlq
        FOR EACH ROW EXECUTE FUNCTION public.update_webhook_dlq_timestamp();
    END IF;
END $$;

-- RLS
ALTER TABLE public.webhook_dlq ENABLE ROW LEVEL SECURITY;

-- Service role policy
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'webhook_dlq'
        AND policyname = 'service_role_webhook_dlq'
    ) THEN
        CREATE POLICY service_role_webhook_dlq
        ON public.webhook_dlq
        FOR ALL USING (auth.role() = 'service_role');
    END IF;
END $$;

GRANT ALL ON public.webhook_dlq TO service_role;

-- Add comment
COMMENT ON TABLE public.webhook_dlq IS 'Dead Letter Queue for failed webhook payloads that can be reprocessed';

COMMIT;
