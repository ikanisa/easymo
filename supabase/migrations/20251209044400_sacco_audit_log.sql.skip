-- =====================================================
-- SACCO Audit Log Table
-- Tracks all changes for compliance and debugging
-- =====================================================

BEGIN;

-- Audit log for tracking changes
CREATE TABLE IF NOT EXISTS app.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sacco_id UUID REFERENCES app.saccos(id),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for audit_log
CREATE INDEX IF NOT EXISTS idx_audit_log_sacco ON app.audit_log(sacco_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON app.audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON app.audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON app.audit_log(action, created_at DESC);

-- Enable RLS
ALTER TABLE app.audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for audit_log
CREATE POLICY "Staff can view own SACCO audit logs" ON app.audit_log
  FOR SELECT USING (
    sacco_id IN (
      SELECT sacco_id FROM app.staff_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert audit logs" ON app.audit_log
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role full access to audit_log" ON app.audit_log
  FOR ALL USING (auth.role() = 'service_role');

-- Function to automatically log changes
CREATE OR REPLACE FUNCTION app.log_audit_event()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO app.audit_log (
    sacco_id,
    user_id,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data
  ) VALUES (
    COALESCE(NEW.sacco_id, OLD.sacco_id),
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add audit triggers to key tables (optional - can be enabled per table)
-- Example: Uncomment to enable audit logging on members table
-- CREATE TRIGGER audit_members_changes
--   AFTER INSERT OR UPDATE OR DELETE ON app.members
--   FOR EACH ROW
--   EXECUTE FUNCTION app.log_audit_event();

COMMIT;
