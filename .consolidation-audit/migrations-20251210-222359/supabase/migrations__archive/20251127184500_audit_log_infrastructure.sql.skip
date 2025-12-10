-- Migration: Audit Log Infrastructure for Financial Tables
-- Description: Creates comprehensive audit logging system with triggers
-- Author: Production Readiness Initiative
-- Date: 2025-11-27

BEGIN;

-- Create audit log table if not exists
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

-- Create indexes for common audit queries
CREATE INDEX IF NOT EXISTS idx_audit_log_table_created 
  ON audit_log(table_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_created 
  ON audit_log(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_correlation 
  ON audit_log(correlation_id) 
  WHERE correlation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_log_operation 
  ON audit_log(operation);

-- Enable RLS on audit log (immutable, service role only)
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can insert audit logs (triggered by SECURITY DEFINER function)
DROP POLICY IF EXISTS "Service role can insert audit logs" ON audit_log;
CREATE POLICY "Service role can insert audit logs"
  ON audit_log FOR INSERT
  WITH CHECK (true);

-- Policy: Service role can read audit logs
DROP POLICY IF EXISTS "Service role can read audit logs" ON audit_log;
CREATE POLICY "Service role can read audit logs"
  ON audit_log FOR SELECT
  USING (auth.role() = 'service_role');

-- Policy: Prevent updates on audit log (immutable)
DROP POLICY IF EXISTS "No updates on audit log" ON audit_log;
CREATE POLICY "No updates on audit log"
  ON audit_log FOR UPDATE
  USING (false);

-- Policy: Prevent deletes on audit log (immutable)
DROP POLICY IF EXISTS "No deletes on audit log" ON audit_log;
CREATE POLICY "No deletes on audit log"
  ON audit_log FOR DELETE
  USING (false);

COMMENT ON TABLE audit_log IS 'Immutable audit trail for financial and sensitive operations';
COMMENT ON COLUMN audit_log.changed_fields IS 'Array of field names that changed (UPDATE only)';
COMMENT ON COLUMN audit_log.correlation_id IS 'Request correlation ID for distributed tracing';

-- Enhanced audit trigger function with field change tracking
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
  -- Extract session context (set by application)
  BEGIN
    v_user_id := COALESCE(
      auth.uid()::TEXT,
      current_setting('app.user_id', true),
      'system'
    );
    v_session_id := current_setting('app.session_id', true);
    v_correlation_id := NULLIF(current_setting('app.correlation_id', true), '')::UUID;
    v_ip_address := NULLIF(current_setting('app.ip_address', true), '')::INET;
    v_user_agent := current_setting('app.user_agent', true);
  EXCEPTION
    WHEN OTHERS THEN
      -- Fallback if context not set
      v_user_id := 'system';
  END;

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

  -- Insert audit log entry
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

COMMENT ON FUNCTION audit_trigger_func() IS 'Trigger function to log all changes to audited tables';

-- Apply audit triggers to financial tables
-- Wallet tables
DROP TRIGGER IF EXISTS audit_wallet_accounts ON wallet_accounts;
CREATE TRIGGER audit_wallet_accounts
  AFTER INSERT OR UPDATE OR DELETE ON wallet_accounts
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS audit_wallet_entries ON wallet_entries;
CREATE TRIGGER audit_wallet_entries
  AFTER INSERT OR UPDATE OR DELETE ON wallet_entries
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS audit_wallet_transactions ON wallet_transactions;
CREATE TRIGGER audit_wallet_transactions
  AFTER INSERT OR UPDATE OR DELETE ON wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Payment tables (if they exist)
DO $$
BEGIN
  -- Only create trigger if table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
    DROP TRIGGER IF EXISTS audit_payments ON payments;
    CREATE TRIGGER audit_payments
      AFTER INSERT OR UPDATE OR DELETE ON payments
      FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_intents') THEN
    DROP TRIGGER IF EXISTS audit_payment_intents ON payment_intents;
    CREATE TRIGGER audit_payment_intents
      AFTER INSERT OR UPDATE OR DELETE ON payment_intents
      FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'momo_transactions') THEN
    DROP TRIGGER IF EXISTS audit_momo_transactions ON momo_transactions;
    CREATE TRIGGER audit_momo_transactions
      AFTER INSERT OR UPDATE OR DELETE ON momo_transactions
      FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'revolut_transactions') THEN
    DROP TRIGGER IF EXISTS audit_revolut_transactions ON revolut_transactions;
    CREATE TRIGGER audit_revolut_transactions
      AFTER INSERT OR UPDATE OR DELETE ON revolut_transactions
      FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices') THEN
    DROP TRIGGER IF EXISTS audit_invoices ON invoices;
    CREATE TRIGGER audit_invoices
      AFTER INSERT OR UPDATE OR DELETE ON invoices
      FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscriptions') THEN
    DROP TRIGGER IF EXISTS audit_subscriptions ON subscriptions;
    CREATE TRIGGER audit_subscriptions
      AFTER INSERT OR UPDATE OR DELETE ON subscriptions
      FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'refunds') THEN
    DROP TRIGGER IF EXISTS audit_refunds ON refunds;
    CREATE TRIGGER audit_refunds
      AFTER INSERT OR UPDATE OR DELETE ON refunds
      FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
  END IF;
END $$;

COMMIT;
