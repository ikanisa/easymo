-- =====================================================
-- INSURANCE ADMIN NOTIFICATIONS SYSTEM
-- =====================================================
-- Creates tables for managing insurance admins who receive
-- certificate notifications with user contact information
-- =====================================================

BEGIN;

-- =====================================================
-- 1. Insurance Admins Table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.insurance_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_id text NOT NULL UNIQUE,
  name text NOT NULL,
  role text DEFAULT 'admin',
  is_active boolean DEFAULT true,
  receives_all_alerts boolean DEFAULT true,
  notification_preferences jsonb DEFAULT '{
    "certificate_submitted": true,
    "policy_expiring": true,
    "verification_needed": true
  }'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_notified_at timestamptz,
  total_notifications_sent integer DEFAULT 0
);

-- Index for active admin lookups
CREATE INDEX IF NOT EXISTS insurance_admins_active_idx 
  ON public.insurance_admins(is_active, created_at) 
  WHERE is_active = true;

-- =====================================================
-- 2. Insurance Admin Notifications Tracking
-- =====================================================
CREATE TABLE IF NOT EXISTS public.insurance_admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.insurance_leads(id) ON DELETE CASCADE,
  admin_wa_id text NOT NULL,
  user_wa_id text NOT NULL,
  notification_payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed', 'delivered', 'read')),
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  error_message text,
  retry_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Foreign key to insurance_admins
  CONSTRAINT fk_admin FOREIGN KEY (admin_wa_id) REFERENCES public.insurance_admins(wa_id) ON DELETE CASCADE
);

-- Indexes for tracking and reporting
CREATE INDEX IF NOT EXISTS insurance_admin_notifications_lead_idx 
  ON public.insurance_admin_notifications(lead_id);

CREATE INDEX IF NOT EXISTS insurance_admin_notifications_admin_idx 
  ON public.insurance_admin_notifications(admin_wa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS insurance_admin_notifications_status_idx 
  ON public.insurance_admin_notifications(status, created_at) 
  WHERE status IN ('queued', 'failed');

-- =====================================================
-- 3. Insert Default Insurance Admins
-- =====================================================
INSERT INTO public.insurance_admins (wa_id, name, role, is_active, receives_all_alerts)
VALUES
  ('250788767816', 'Insurance Admin 1', 'admin', true, true),
  ('250793094876', 'Insurance Admin 2', 'admin', true, true),
  ('250795588248', 'Insurance Admin 3', 'admin', true, true)
ON CONFLICT (wa_id) DO UPDATE SET
  is_active = EXCLUDED.is_active,
  receives_all_alerts = EXCLUDED.receives_all_alerts,
  updated_at = now();

-- =====================================================
-- 4. Update Trigger for updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_insurance_admins_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS insurance_admins_updated_at ON public.insurance_admins;
CREATE TRIGGER insurance_admins_updated_at
  BEFORE UPDATE ON public.insurance_admins
  FOR EACH ROW
  EXECUTE FUNCTION update_insurance_admins_updated_at();

-- Same for notifications tracking
CREATE OR REPLACE FUNCTION update_insurance_admin_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS insurance_admin_notifications_updated_at ON public.insurance_admin_notifications;
CREATE TRIGGER insurance_admin_notifications_updated_at
  BEFORE UPDATE ON public.insurance_admin_notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_insurance_admin_notifications_updated_at();

-- =====================================================
-- 5. Update admin stats on notification send
-- =====================================================
CREATE OR REPLACE FUNCTION update_admin_notification_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'sent' AND (OLD.status IS NULL OR OLD.status != 'sent') THEN
    UPDATE public.insurance_admins
    SET 
      total_notifications_sent = total_notifications_sent + 1,
      last_notified_at = NEW.sent_at
    WHERE wa_id = NEW.admin_wa_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_admin_stats_on_send ON public.insurance_admin_notifications;
CREATE TRIGGER update_admin_stats_on_send
  AFTER UPDATE ON public.insurance_admin_notifications
  FOR EACH ROW
  WHEN (NEW.status = 'sent' AND (OLD.status IS NULL OR OLD.status != 'sent'))
  EXECUTE FUNCTION update_admin_notification_stats();

-- =====================================================
-- 6. Admin Performance View
-- =====================================================
CREATE OR REPLACE VIEW insurance_admin_performance AS
SELECT 
  a.wa_id,
  a.name,
  a.role,
  a.is_active,
  a.total_notifications_sent,
  a.last_notified_at,
  COUNT(CASE WHEN n.status = 'sent' THEN 1 END) as notifications_sent,
  COUNT(CASE WHEN n.status = 'delivered' THEN 1 END) as notifications_delivered,
  COUNT(CASE WHEN n.status = 'read' THEN 1 END) as notifications_read,
  COUNT(CASE WHEN n.status = 'failed' THEN 1 END) as notifications_failed,
  MAX(n.created_at) as last_notification_time
FROM public.insurance_admins a
LEFT JOIN public.insurance_admin_notifications n ON a.wa_id = n.admin_wa_id
GROUP BY a.wa_id, a.name, a.role, a.is_active, a.total_notifications_sent, a.last_notified_at;

-- Grant access to views
GRANT SELECT ON insurance_admin_performance TO authenticated, anon;

-- =====================================================
-- 7. RLS Policies (if needed for admin portal)
-- =====================================================
ALTER TABLE public.insurance_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_admin_notifications ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
DROP POLICY IF EXISTS "Service role has full access to insurance_admins" ON public.insurance_admins;
CREATE POLICY "Service role has full access to insurance_admins"
  ON public.insurance_admins
  FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role has full access to insurance_admin_notifications" ON public.insurance_admin_notifications;
CREATE POLICY "Service role has full access to insurance_admin_notifications"
  ON public.insurance_admin_notifications
  FOR ALL
  USING (auth.role() = 'service_role');

-- Allow authenticated users to view admins (for admin portal)
DROP POLICY IF EXISTS "Authenticated users can view insurance admins" ON public.insurance_admins;
CREATE POLICY "Authenticated users can view insurance admins"
  ON public.insurance_admins
  FOR SELECT
  TO authenticated
  USING (true);

-- =====================================================
-- 8. Helper Function: Get Active Admins
-- =====================================================
CREATE OR REPLACE FUNCTION get_active_insurance_admins()
RETURNS TABLE (
  wa_id text,
  name text,
  role text
) AS $$
BEGIN
  RETURN QUERY
  SELECT a.wa_id, a.name, a.role
  FROM public.insurance_admins a
  WHERE a.is_active = true
    AND a.receives_all_alerts = true
  ORDER BY a.created_at;
END;
$$ LANGUAGE plpgsql STABLE;

COMMIT;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Run these to verify setup:
--
-- SELECT * FROM insurance_admins;
-- SELECT * FROM insurance_admin_performance;
-- SELECT * FROM get_active_insurance_admins();
