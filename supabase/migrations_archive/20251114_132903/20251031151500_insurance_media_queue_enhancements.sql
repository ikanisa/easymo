-- Enhance insurance media queue to support OCR worker metadata
BEGIN;

ALTER TABLE public.insurance_media_queue
  ADD COLUMN IF NOT EXISTS attempts smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.insurance_leads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS insurance_media_queue_status_idx
  ON public.insurance_media_queue (status, created_at);

COMMIT;
