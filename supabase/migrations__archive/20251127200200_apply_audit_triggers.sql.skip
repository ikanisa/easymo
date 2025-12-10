BEGIN;

-- Apply audit triggers to all financial tables
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
    -- Check if table exists
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      -- Drop existing trigger if any
      EXECUTE format('DROP TRIGGER IF EXISTS audit_%s ON %I', t, t);
      
      -- Create new trigger
      EXECUTE format(
        'CREATE TRIGGER audit_%s
         AFTER INSERT OR UPDATE OR DELETE ON %I
         FOR EACH ROW EXECUTE FUNCTION audit_trigger_func()',
        t, t
      );
      
      RAISE NOTICE 'Created audit trigger for table: %', t;
    ELSE
      RAISE NOTICE 'Table does not exist, skipping: %', t;
    END IF;
  END LOOP;
END $$;

COMMIT;
