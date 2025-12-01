BEGIN;

-- Create comprehensive audit log table
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
CREATE INDEX IF NOT EXISTS idx_audit_log_table_created ON audit_log(table_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_created ON audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_correlation ON audit_log(correlation_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_operation ON audit_log(operation);

-- RLS for audit log (read-only for service role)
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can insert audit logs" ON audit_log;
CREATE POLICY "Service role can insert audit logs"
  ON audit_log FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can read audit logs" ON audit_log;
CREATE POLICY "Service role can read audit logs"
  ON audit_log FOR SELECT
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "No updates on audit log" ON audit_log;
CREATE POLICY "No updates on audit log"
  ON audit_log FOR UPDATE
  USING (false);

DROP POLICY IF EXISTS "No deletes on audit log" ON audit_log;
CREATE POLICY "No deletes on audit log"
  ON audit_log FOR DELETE
  USING (false);

COMMENT ON TABLE audit_log IS 'Immutable audit trail for financial and sensitive operations';

-- Enhanced audit trigger with field change tracking
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
  changed_cols TEXT[];
  old_json JSONB;
  new_json JSONB;
  col TEXT;
  v_user_id TEXT;
  v_session_id TEXT;
  v_correlation_id UUID;
  v_ip_address INET;
  v_user_agent TEXT;
BEGIN
  -- Extract session context
  v_user_id := COALESCE(
    auth.uid()::TEXT,
    current_setting('app.user_id', true),
    'system'
  );
  v_session_id := current_setting('app.session_id', true);
  
  BEGIN
    v_correlation_id := NULLIF(current_setting('app.correlation_id', true), '')::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_correlation_id := NULL;
  END;
  
  BEGIN
    v_ip_address := NULLIF(current_setting('app.ip_address', true), '')::INET;
  EXCEPTION WHEN OTHERS THEN
    v_ip_address := NULL;
  END;
  
  v_user_agent := current_setting('app.user_agent', true);
  
  -- Build JSON representations
  IF TG_OP = 'DELETE' THEN
    old_json := row_to_json(OLD)::JSONB;
    new_json := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    old_json := NULL;
    new_json := row_to_json(NEW)::JSONB;
  ELSE -- UPDATE
    old_json := row_to_json(OLD)::JSONB;
    new_json := row_to_json(NEW)::JSONB;
    
    -- Track which fields changed
    changed_cols := ARRAY[]::TEXT[];
    FOR col IN SELECT key FROM jsonb_object_keys(new_json) AS key LOOP
      IF old_json->col IS DISTINCT FROM new_json->col THEN
        changed_cols := array_append(changed_cols, col);
      END IF;
    END LOOP;
  END IF;

  INSERT INTO audit_log (
    table_name,
    operation,
    old_data,
    new_data,
    changed_fields,
    user_id,
    session_id,
    correlation_id,
    ip_address,
    user_agent,
    created_at
  ) VALUES (
    TG_TABLE_NAME,
    TG_OP,
    old_json,
    new_json,
    changed_cols,
    v_user_id,
    v_session_id,
    v_correlation_id,
    v_ip_address,
    v_user_agent,
    NOW()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
