BEGIN;

-- Insurance admin table for notification recipients
CREATE TABLE IF NOT EXISTS insurance_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_id TEXT NOT NULL UNIQUE,
  name TEXT,
  role TEXT DEFAULT 'admin',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for active admin lookup
CREATE INDEX IF NOT EXISTS idx_insurance_admins_active 
  ON insurance_admins(is_active) WHERE is_active = true;

-- Insert the three admin numbers
INSERT INTO insurance_admins (wa_id, name, role, is_active)
VALUES
  ('250793094876', 'Insurance Admin 1', 'admin', true),
  ('250788767816', 'Insurance Admin 2', 'admin', true),
  ('250795588248', 'Insurance Admin 3', 'admin', true)
ON CONFLICT (wa_id) DO UPDATE
  SET is_active = EXCLUDED.is_active,
      updated_at = now();

-- Track admin notifications sent
CREATE TABLE IF NOT EXISTS insurance_admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES insurance_leads(id) ON DELETE CASCADE,
  admin_wa_id TEXT NOT NULL,
  user_wa_id TEXT NOT NULL,
  notification_payload JSONB,
  sent_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'sent',
  error_message TEXT
);

-- Indexes for tracking
CREATE INDEX IF NOT EXISTS idx_insurance_admin_notifications_lead 
  ON insurance_admin_notifications(lead_id);
CREATE INDEX IF NOT EXISTS idx_insurance_admin_notifications_admin 
  ON insurance_admin_notifications(admin_wa_id);
CREATE INDEX IF NOT EXISTS idx_insurance_admin_notifications_sent 
  ON insurance_admin_notifications(sent_at DESC);

-- Function to get active insurance admins
CREATE OR REPLACE FUNCTION get_active_insurance_admins()
RETURNS TABLE (wa_id TEXT, name TEXT, role TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT ia.wa_id, ia.name, ia.role
  FROM insurance_admins ia
  WHERE ia.is_active = true
  ORDER BY ia.created_at;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON TABLE insurance_admins IS 'WhatsApp numbers of insurance backend staff who receive certificate notifications';
COMMENT ON TABLE insurance_admin_notifications IS 'Tracks notifications sent to insurance admins with extracted certificate data';
COMMENT ON FUNCTION get_active_insurance_admins IS 'Returns list of active insurance admin WhatsApp IDs for notifications';

COMMIT;
