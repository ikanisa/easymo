-- Tracking columns for MoMo SMS inbox processing
BEGIN;
ALTER TABLE public.momo_sms_inbox
  ADD COLUMN IF NOT EXISTS processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_momo_sms_inbox_processed_at
  ON public.momo_sms_inbox (processed_at);
COMMIT;
