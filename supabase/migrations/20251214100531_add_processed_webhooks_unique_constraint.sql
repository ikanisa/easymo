-- Migration: add_processed_webhooks_unique_constraint
-- Purpose: Enable atomic idempotency checks for webhook processing
-- Date: 2025-12-14
-- Related: wa-webhook-profile Phase 1 fixes

BEGIN;

-- Add unique constraint to prevent duplicate message processing
-- Use message_id + webhook_type combination for uniqueness
ALTER TABLE public.processed_webhooks 
  ADD CONSTRAINT IF NOT EXISTS processed_webhooks_message_webhook_unique 
  UNIQUE (message_id, webhook_type);

-- Ensure index exists for faster cleanup of old records
CREATE INDEX IF NOT EXISTS idx_processed_webhooks_created_at 
  ON public.processed_webhooks(created_at);

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT processed_webhooks_message_webhook_unique 
  ON public.processed_webhooks IS 
  'Ensures atomic idempotency: one message per webhook type. Used by wa-webhook-profile and other webhook handlers to prevent duplicate processing.';

COMMIT;
