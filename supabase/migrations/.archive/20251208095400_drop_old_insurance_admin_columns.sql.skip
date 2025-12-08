-- =====================================================
-- DROP OLD INSURANCE ADMIN COLUMNS
-- =====================================================
-- Remove old columns after restructuring is complete
-- Part 2: Clean up old schema
-- =====================================================

BEGIN;

-- =====================================================
-- DROP old columns from insurance_admin_contacts
-- =====================================================

-- Drop old columns (contact_type, contact_value, display_order)
ALTER TABLE public.insurance_admin_contacts
  DROP COLUMN IF EXISTS contact_type CASCADE,
  DROP COLUMN IF EXISTS contact_value CASCADE,
  DROP COLUMN IF EXISTS display_order CASCADE;

-- =====================================================
-- DROP old columns from insurance_admin_notifications
-- =====================================================

-- First, ensure new_status is set correctly and make it NOT NULL
ALTER TABLE public.insurance_admin_notifications
  ALTER COLUMN new_status SET NOT NULL,
  ALTER COLUMN new_status SET DEFAULT 'sent'::public.insurance_admin_notify_status;

-- Drop old status column (safe now that new_status is populated and NOT NULL)
ALTER TABLE public.insurance_admin_notifications
  DROP COLUMN IF EXISTS status CASCADE;

-- Rename new_status to status
ALTER TABLE public.insurance_admin_notifications
  RENAME COLUMN new_status TO status;

-- Drop other old columns
ALTER TABLE public.insurance_admin_notifications
  DROP COLUMN IF EXISTS admin_wa_id CASCADE,
  DROP COLUMN IF EXISTS user_wa_id CASCADE,
  DROP COLUMN IF EXISTS notification_payload CASCADE,
  DROP COLUMN IF EXISTS retry_count CASCADE,
  DROP COLUMN IF EXISTS error_message CASCADE,
  DROP COLUMN IF EXISTS updated_at CASCADE;

-- Add payload column for flexible metadata storage
ALTER TABLE public.insurance_admin_notifications
  ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Recreate index on status with correct column name
CREATE INDEX IF NOT EXISTS insurance_admin_notifications_status_idx
  ON public.insurance_admin_notifications (status);

COMMIT;
