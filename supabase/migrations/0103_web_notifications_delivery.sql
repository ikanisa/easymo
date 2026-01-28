-- =============================================================================
-- Delivery metadata for web notifications
-- Workflow WEB-1: Phase 7 (additive only)
-- =============================================================================

BEGIN;

ALTER TABLE public.web_notifications
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

ALTER TABLE public.web_notifications
  ADD COLUMN IF NOT EXISTS error_message TEXT;

CREATE INDEX IF NOT EXISTS idx_web_notifications_status
  ON public.web_notifications (status);

COMMIT;
