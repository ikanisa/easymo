BEGIN;

-- =====================================================
-- FIX WA_EVENTS EVENT_TYPE NOT NULL CONSTRAINT
-- =====================================================
-- Issue: wa_events.event_type is NOT NULL but idempotency
-- tracking only inserts message_id, causing constraint violations
-- Solution: Make event_type nullable with default value
-- =====================================================

-- Make event_type nullable and add default value for idempotency tracking
ALTER TABLE public.wa_events 
  ALTER COLUMN event_type DROP NOT NULL,
  ALTER COLUMN event_type SET DEFAULT 'idempotency_check';

-- Add comment to clarify dual purpose of table
COMMENT ON COLUMN public.wa_events.event_type IS 'Type of WhatsApp event (message, status, etc.) or idempotency_check for duplicate prevention';

-- Update any existing NULL values to use the default
UPDATE public.wa_events 
SET event_type = 'idempotency_check' 
WHERE event_type IS NULL;

COMMIT;
