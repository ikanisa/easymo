-- Audit Log Table Schema
-- Comprehensive audit trail for financial and sensitive operations

BEGIN;

-- Create audit log table if it doesn't exist
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  changed_fields TEXT[],
  user_id TEXT,
  session_id TEXT,
  ip_address INET,
  user_agent TEXT,
  correlation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_log_table_created 
  ON audit_log(table_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_created 
  ON audit_log(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_correlation 
  ON audit_log(correlation_id) 
  WHERE correlation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_log_operation 
  ON audit_log(operation);

-- Enable RLS on audit log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Service role can insert audit logs (triggers run as SECURITY DEFINER)
DROP POLICY IF EXISTS "Service role can insert audit logs" ON audit_log;
CREATE POLICY "Service role can insert audit logs"
  ON audit_log FOR INSERT
  WITH CHECK (true);

-- Service role can read audit logs
DROP POLICY IF EXISTS "Service role can read audit logs" ON audit_log;
CREATE POLICY "Service role can read audit logs"
  ON audit_log FOR SELECT
  USING (auth.role() = 'service_role');

-- Prevent updates and deletes on audit log (immutable)
DROP POLICY IF EXISTS "No updates on audit log" ON audit_log;
CREATE POLICY "No updates on audit log"
  ON audit_log FOR UPDATE
  USING (false);

DROP POLICY IF EXISTS "No deletes on audit log" ON audit_log;
CREATE POLICY "No deletes on audit log"
  ON audit_log FOR DELETE
  USING (false);

-- Add table comment
COMMENT ON TABLE audit_log IS 'Immutable audit trail for financial and sensitive operations';

COMMIT;

\echo '✅ Audit log table created successfully'
