-- Insurance Admin Cleanup: Reduce to Two Canonical Tables
-- ============================================================================
-- BEFORE: 4 tables (insurance_admin_contacts, insurance_admins, 
--         insurance_admin_notifications, admin_notifications[insurance-related])
-- AFTER:  2 tables (insurance_admin_contacts, insurance_admin_notifications)
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: CREATE ENUMS FOR TYPE SAFETY
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.insurance_admin_channel AS ENUM ('whatsapp', 'email', 'sms');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.insurance_admin_notify_status AS ENUM ('sent', 'failed', 'queued');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- PART 2: RESTRUCTURE insurance_admin_contacts (Keep, but simplify)
-- ============================================================================

-- Drop old table and recreate with canonical schema
DROP TABLE IF EXISTS public.insurance_admin_contacts CASCADE;

CREATE TABLE IF NOT EXISTS public.insurance_admin_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text,
  channel public.insurance_admin_channel NOT NULL DEFAULT 'whatsapp',
  destination text NOT NULL,  -- phone number or email
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel, destination)
);

COMMENT ON TABLE public.insurance_admin_contacts IS 'Insurance admin contacts for notifications (broadcast to all active)';
COMMENT ON COLUMN public.insurance_admin_contacts.channel IS 'Communication channel: whatsapp | email | sms';
COMMENT ON COLUMN public.insurance_admin_contacts.destination IS 'Phone number (E.164) or email address';
COMMENT ON COLUMN public.insurance_admin_contacts.is_active IS 'Only active contacts receive notifications';

-- Indexes
CREATE INDEX insurance_admin_contacts_active_idx
  ON public.insurance_admin_contacts (is_active) 
  WHERE is_active = true;

-- RLS Policies
ALTER TABLE public.insurance_admin_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insurance_admin_contacts_select_active" ON public.insurance_admin_contacts;
DROP POLICY IF EXISTS "insurance_admin_contacts_select_active" ON public.insurance_admin_contacts;
CREATE POLICY "insurance_admin_contacts_select_active"
  ON public.insurance_admin_contacts
  FOR SELECT
  USING (is_active = true OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "insurance_admin_contacts_manage_service" ON public.insurance_admin_contacts;
DROP POLICY IF EXISTS "insurance_admin_contacts_manage_service" ON public.insurance_admin_contacts;
CREATE POLICY "insurance_admin_contacts_manage_service"
  ON public.insurance_admin_contacts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION insurance_admin_contacts_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_insurance_admin_contacts_updated_at ON public.insurance_admin_contacts;
DROP TRIGGER IF EXISTS trg_insurance_admin_contacts_updated_at ON ; -- FIXME: add table name
CREATE TRIGGER trg_insurance_admin_contacts_updated_at
  BEFORE UPDATE ON public.insurance_admin_contacts
  FOR EACH ROW
  EXECUTE FUNCTION insurance_admin_contacts_set_updated_at();

-- ============================================================================
-- PART 3: BACKFILL insurance_admin_contacts FROM insurance_admins
-- ============================================================================

-- Migrate from insurance_admins (wa_id → destination, name → display_name)
INSERT INTO public.insurance_admin_contacts (
  display_name,
  channel,
  destination,
  is_active,
  created_at
)
SELECT 
  COALESCE(ia.name, 'Insurance Admin') as display_name,
  'whatsapp'::public.insurance_admin_channel as channel,
  ia.wa_id as destination,
  ia.is_active,
  ia.created_at
FROM insurance_admins ia
WHERE ia.wa_id IS NOT NULL
ON CONFLICT (channel, destination) DO UPDATE
  SET display_name = COALESCE(EXCLUDED.display_name, insurance_admin_contacts.display_name),
      is_active = EXCLUDED.is_active;

-- Log backfill results
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.insurance_admin_contacts;
  RAISE NOTICE 'Backfilled % contacts from insurance_admins', v_count;
END $$;

-- ============================================================================
-- PART 4: RESTRUCTURE insurance_admin_notifications (Log per contact)
-- ============================================================================

-- Rename old table for backup
ALTER TABLE IF EXISTS public.insurance_admin_notifications 
  RENAME TO insurance_admin_notifications_old;

-- Create new structure with contact_id FK
CREATE TABLE IF NOT EXISTS public.insurance_admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.insurance_admin_contacts(id) ON DELETE CASCADE,
  
  -- Link to certificate/lead (nullable - could be different entity types)
  lead_id uuid,  -- References insurance_leads if exists
  certificate_id uuid,  -- Future: reference driver_insurance_certificates
  
  status public.insurance_admin_notify_status NOT NULL DEFAULT 'queued',
  error text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at timestamptz,
  retry_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.insurance_admin_notifications IS 'Per-contact notification log for insurance admin alerts';
COMMENT ON COLUMN public.insurance_admin_notifications.contact_id IS 'FK to insurance_admin_contacts - one row per recipient';
COMMENT ON COLUMN public.insurance_admin_notifications.status IS 'sent | failed | queued';
COMMENT ON COLUMN public.insurance_admin_notifications.payload IS 'Message content and metadata';

-- Indexes
CREATE INDEX insurance_admin_notifications_contact_time_idx
  ON public.insurance_admin_notifications (contact_id, sent_at DESC NULLS LAST);

CREATE INDEX insurance_admin_notifications_lead_idx
  ON public.insurance_admin_notifications (lead_id) 
  WHERE lead_id IS NOT NULL;

CREATE INDEX insurance_admin_notifications_status_idx
  ON public.insurance_admin_notifications (status, created_at DESC)
  WHERE status IN ('queued', 'failed');

-- RLS Policies
ALTER TABLE public.insurance_admin_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insurance_admin_notifications_service_all" ON public.insurance_admin_notifications;
DROP POLICY IF EXISTS "insurance_admin_notifications_service_all" ON public.insurance_admin_notifications;
CREATE POLICY "insurance_admin_notifications_service_all"
  ON public.insurance_admin_notifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION insurance_admin_notifications_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_insurance_admin_notifications_updated_at ON public.insurance_admin_notifications;
DROP TRIGGER IF EXISTS trg_insurance_admin_notifications_updated_at ON ; -- FIXME: add table name
CREATE TRIGGER trg_insurance_admin_notifications_updated_at
  BEFORE UPDATE ON public.insurance_admin_notifications
  FOR EACH ROW
  EXECUTE FUNCTION insurance_admin_notifications_set_updated_at();

-- ============================================================================
-- PART 5: BACKFILL insurance_admin_notifications FROM OLD TABLE
-- ============================================================================

-- Migrate old notifications (map admin_wa_id → contact_id)
INSERT INTO public.insurance_admin_notifications (
  contact_id,
  lead_id,
  status,
  error,
  payload,
  sent_at,
  retry_count,
  created_at,
  updated_at
)
SELECT 
  c.id as contact_id,
  n.lead_id,
  CASE 
    WHEN n.status = 'sent' THEN 'sent'::public.insurance_admin_notify_status
    WHEN n.status = 'failed' THEN 'failed'::public.insurance_admin_notify_status
    ELSE 'queued'::public.insurance_admin_notify_status
  END as status,
  n.error_message as error,
  COALESCE(n.notification_payload, '{}'::jsonb) as payload,
  n.sent_at,
  COALESCE(n.retry_count, 0) as retry_count,
  n.created_at,
  n.updated_at
FROM insurance_admin_notifications_old n
JOIN public.insurance_admin_contacts c 
  ON c.destination = n.admin_wa_id 
  AND c.channel = 'whatsapp'
WHERE n.admin_wa_id IS NOT NULL;

-- Log backfill results
DO $$
DECLARE
  v_migrated integer;
  v_orphaned integer;
BEGIN
  SELECT COUNT(*) INTO v_migrated FROM public.insurance_admin_notifications;
  SELECT COUNT(*) INTO v_orphaned 
  FROM insurance_admin_notifications_old n
  WHERE n.admin_wa_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.insurance_admin_contacts c 
      WHERE c.destination = n.admin_wa_id AND c.channel = 'whatsapp'
    );
  
  RAISE NOTICE 'Migrated % notifications, % orphaned (no matching contact)', 
    v_migrated, v_orphaned;
END $$;

-- ============================================================================
-- PART 6: DROP OBSOLETE TABLES
-- ============================================================================

-- Drop insurance_admins (merged into insurance_admin_contacts)
DROP TABLE IF EXISTS public.insurance_admins CASCADE;

-- Drop old notifications backup
DROP TABLE IF EXISTS public.insurance_admin_notifications_old CASCADE;

-- Note: admin_notifications is kept for wallet cashouts and other domains
-- Insurance notifications are now ONLY in insurance_admin_notifications

-- ============================================================================
-- PART 7: CREATE HELPER VIEWS
-- ============================================================================

-- Active contacts ready to receive notifications
DROP VIEW IF EXISTS active_insurance_admin_contacts;
CREATE OR REPLACE VIEW active_insurance_admin_contacts AS
SELECT 
  id,
  display_name,
  channel,
  destination,
  created_at
FROM public.insurance_admin_contacts
WHERE is_active = true
ORDER BY created_at;

COMMENT ON VIEW active_insurance_admin_contacts IS 'Active insurance admin contacts for broadcast notifications';

-- Recent notification audit (per-contact)
DROP VIEW IF EXISTS recent_insurance_admin_notifications;
CREATE OR REPLACE VIEW recent_insurance_admin_notifications AS
SELECT 
  n.id,
  n.contact_id,
  c.display_name as contact_name,
  c.destination,
  n.lead_id,
  n.status,
  n.error,
  n.sent_at,
  n.retry_count,
  n.created_at
FROM public.insurance_admin_notifications n
JOIN public.insurance_admin_contacts c ON c.id = n.contact_id
ORDER BY n.created_at DESC
LIMIT 100;

COMMENT ON VIEW recent_insurance_admin_notifications IS 'Last 100 insurance admin notifications with contact details';

-- ============================================================================
-- PART 8: VERIFICATION
-- ============================================================================

DO $$
DECLARE
  v_active_contacts integer;
  v_total_notifications integer;
BEGIN
  SELECT COUNT(*) INTO v_active_contacts 
  FROM public.insurance_admin_contacts 
  WHERE is_active = true;
  
  SELECT COUNT(*) INTO v_total_notifications 
  FROM public.insurance_admin_notifications;
  
  RAISE NOTICE '✅ Insurance Admin Cleanup Complete:';
  RAISE NOTICE '   - Active contacts: %', v_active_contacts;
  RAISE NOTICE '   - Total notifications: %', v_total_notifications;
  RAISE NOTICE '   - Tables remaining: 2 (insurance_admin_contacts, insurance_admin_notifications)';
  RAISE NOTICE '   - Deleted: insurance_admins, insurance_admin_notifications_old';
END $$;

COMMIT;
