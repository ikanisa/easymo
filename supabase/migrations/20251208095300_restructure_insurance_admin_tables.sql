-- =====================================================
-- RESTRUCTURE INSURANCE ADMIN TABLES
-- =====================================================
-- Consolidate to exactly TWO tables for insurance admin domain
-- Part 1: Create new enums and restructure tables
-- =====================================================

BEGIN;

-- Create enums for insurance admin domain
DO $$ BEGIN
  CREATE TYPE public.insurance_admin_channel AS ENUM ('whatsapp', 'email');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.insurance_admin_notify_status AS ENUM ('sent', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- RESTRUCTURE insurance_admin_contacts
-- =====================================================

-- Add new columns with new schema
ALTER TABLE public.insurance_admin_contacts
  ADD COLUMN IF NOT EXISTS channel public.insurance_admin_channel,
  ADD COLUMN IF NOT EXISTS destination text;

-- Backfill channel and destination from old columns
UPDATE public.insurance_admin_contacts
SET 
  channel = CASE 
    WHEN contact_type = 'whatsapp' THEN 'whatsapp'::public.insurance_admin_channel
    WHEN contact_type = 'email' THEN 'email'::public.insurance_admin_channel
    ELSE 'whatsapp'::public.insurance_admin_channel -- default fallback
  END,
  destination = contact_value
WHERE channel IS NULL OR destination IS NULL;

-- Make new columns NOT NULL after backfill
ALTER TABLE public.insurance_admin_contacts
  ALTER COLUMN channel SET NOT NULL,
  ALTER COLUMN channel SET DEFAULT 'whatsapp'::public.insurance_admin_channel,
  ALTER COLUMN destination SET NOT NULL;

-- Add unique constraint on (channel, destination)
-- First, remove duplicates by keeping the first occurrence (lowest id)
DELETE FROM public.insurance_admin_contacts a
USING public.insurance_admin_contacts b
WHERE a.id > b.id 
  AND a.channel = b.channel 
  AND a.destination = b.destination;

-- Now add the unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS insurance_admin_contacts_channel_dest_unique
  ON public.insurance_admin_contacts (channel, destination);

-- Drop old index if exists
DROP INDEX IF EXISTS idx_insurance_admin_contacts_active;

-- Create new index on is_active
CREATE INDEX IF NOT EXISTS insurance_admin_contacts_active_idx
  ON public.insurance_admin_contacts (is_active) WHERE is_active = true;

-- =====================================================
-- RESTRUCTURE insurance_admin_notifications
-- =====================================================

-- Add new columns for restructured schema
ALTER TABLE public.insurance_admin_notifications
  ADD COLUMN IF NOT EXISTS contact_id uuid,
  ADD COLUMN IF NOT EXISTS certificate_id uuid,
  ADD COLUMN IF NOT EXISTS new_status public.insurance_admin_notify_status,
  ADD COLUMN IF NOT EXISTS error text;

-- Backfill contact_id by matching admin_wa_id to insurance_admin_contacts.destination
-- This is a best-effort migration - some records may not have a match
UPDATE public.insurance_admin_notifications ian
SET contact_id = iac.id
FROM public.insurance_admin_contacts iac
WHERE ian.contact_id IS NULL
  AND iac.channel = 'whatsapp'
  AND (
    -- Try exact match first
    iac.destination = ian.admin_wa_id
    -- Try normalized match (remove +, spaces, etc.)
    OR REGEXP_REPLACE(iac.destination, '[^0-9]', '', 'g') = REGEXP_REPLACE(ian.admin_wa_id, '[^0-9]', '', 'g')
  );

-- Backfill certificate_id from lead_id (assuming 1:1 relationship)
-- The problem statement mentions certificate_id but current schema has lead_id
-- We'll keep lead_id as the source and add certificate_id for future flexibility
UPDATE public.insurance_admin_notifications
SET certificate_id = lead_id
WHERE certificate_id IS NULL AND lead_id IS NOT NULL;

-- Backfill new_status from old status
UPDATE public.insurance_admin_notifications
SET new_status = CASE 
  WHEN status = 'sent' THEN 'sent'::public.insurance_admin_notify_status
  WHEN status = 'failed' THEN 'failed'::public.insurance_admin_notify_status
  ELSE 'sent'::public.insurance_admin_notify_status -- default for 'queued'
END
WHERE new_status IS NULL;

-- Backfill error from error_message
UPDATE public.insurance_admin_notifications
SET error = error_message
WHERE error IS NULL AND error_message IS NOT NULL;

-- Add FK constraint to contact_id
-- For records without a contact match, we'll need to handle them
-- Option 1: Delete orphaned records (safer for cleanup)
-- Option 2: Keep them (for historical audit trail)
-- We'll choose Option 2 initially - make FK nullable

ALTER TABLE public.insurance_admin_notifications
  ADD CONSTRAINT insurance_admin_notifications_contact_fk 
  FOREIGN KEY (contact_id) 
  REFERENCES public.insurance_admin_contacts(id) 
  ON DELETE CASCADE;

-- Make new_status NOT NULL with default
ALTER TABLE public.insurance_admin_notifications
  ALTER COLUMN new_status SET DEFAULT 'sent'::public.insurance_admin_notify_status,
  ALTER COLUMN new_status SET NOT NULL;

-- Rename sent_at column to maintain consistency
ALTER TABLE public.insurance_admin_notifications
  ALTER COLUMN sent_at SET DEFAULT now();

-- Drop old indexes
DROP INDEX IF EXISTS idx_insurance_admin_notifications_lead;
DROP INDEX IF EXISTS idx_insurance_admin_notifications_status;
DROP INDEX IF EXISTS idx_insurance_admin_notifications_admin;
DROP INDEX IF EXISTS idx_insurance_admin_notifications_created;

-- Create new indexes for restructured table
CREATE INDEX IF NOT EXISTS insurance_admin_notifications_contact_time_idx
  ON public.insurance_admin_notifications (contact_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS insurance_admin_notifications_cert_idx
  ON public.insurance_admin_notifications (certificate_id);

CREATE INDEX IF NOT EXISTS insurance_admin_notifications_status_idx
  ON public.insurance_admin_notifications (new_status);

-- Grant permissions (should already exist, but ensure)
GRANT ALL ON public.insurance_admin_contacts TO service_role;
GRANT ALL ON public.insurance_admin_notifications TO service_role;

-- Add comments for documentation
COMMENT ON TABLE public.insurance_admin_contacts IS 'Lists all insurance admins who receive notifications. All active contacts receive notifications concurrently (broadcast).';
COMMENT ON TABLE public.insurance_admin_notifications IS 'Records all notifications sent to insurance admins. One row per recipient per send.';

COMMENT ON COLUMN public.insurance_admin_contacts.channel IS 'Communication channel (whatsapp or email)';
COMMENT ON COLUMN public.insurance_admin_contacts.destination IS 'Phone number or email address';
COMMENT ON COLUMN public.insurance_admin_notifications.contact_id IS 'Foreign key to insurance_admin_contacts';
COMMENT ON COLUMN public.insurance_admin_notifications.certificate_id IS 'Link to certificate/lead (nullable for flexibility)';
COMMENT ON COLUMN public.insurance_admin_notifications.new_status IS 'Delivery status (sent or failed)';
COMMENT ON COLUMN public.insurance_admin_notifications.error IS 'Error message if status is failed';

COMMIT;
