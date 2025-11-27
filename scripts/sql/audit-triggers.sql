-- Audit Triggers for Financial Tables
-- Creates comprehensive audit trail with field change tracking

BEGIN;

-- Enhanced audit trigger function
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
  v_correlation_id := NULLIF(current_setting('app.correlation_id', true), '')::UUID;
  v_ip_address := NULLIF(current_setting('app.ip_address', true), '')::INET;
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
    FOR col IN SELECT jsonb_object_keys(new_json) LOOP
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

-- Apply triggers to financial tables
DO $$
DECLARE
  tables TEXT[] := ARRAY[
    'wallet_accounts',
    'wallet_entries',
    'wallet_transactions',
    'payments',
    'payment_intents',
    'momo_transactions',
    'revolut_transactions',
    'invoices',
    'subscriptions',
    'refunds'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Drop existing trigger if any
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%s ON %I', t, t);
    
    -- Create new trigger (only if table exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format(
        'CREATE TRIGGER audit_%s
         AFTER INSERT OR UPDATE OR DELETE ON %I
         FOR EACH ROW EXECUTE FUNCTION audit_trigger_func()',
        t, t
      );
      RAISE NOTICE '✓ Created audit trigger for table: %', t;
    ELSE
      RAISE NOTICE '⚠  Table % does not exist, skipping trigger creation', t;
    END IF;
  END LOOP;
END $$;

COMMIT;

\echo ''
\echo '✅ Audit triggers created successfully'
\echo ''
\echo 'Verify with:'
\echo 'SELECT COUNT(*) FROM pg_trigger WHERE tgname LIKE ''audit_%'';'
