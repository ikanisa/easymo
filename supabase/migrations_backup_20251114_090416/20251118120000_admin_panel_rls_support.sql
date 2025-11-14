-- Admin panel read access baseline
-- Ensures tables referenced by the admin UI expose SELECT access (for anon/service role)
-- while keeping writes blocked behind the service role bypass.

BEGIN;

DO $$
DECLARE
  target text;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'settings',
    'profiles',
    'driver_presence',
    'trips',
    'subscriptions',
    'vouchers',
    'voucher_events',
    'campaigns',
    'campaign_targets',
    'orders',
    'order_events',
    'insurance_leads',
    'insurance_documents',
    'wallet_accounts',
    'wallet_transactions',
    'baskets',
    'basket_members',
    'businesses'
  ]
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target);
      BEGIN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR SELECT USING (true)',
          target || '_read_all',
          target
        );
      EXCEPTION
        WHEN duplicate_object THEN
          RAISE NOTICE 'Policy %.% already exists, skipping read baseline.', 'public', target;
      END;
      BEGIN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR ALL USING (false) WITH CHECK (false)',
          target || '_block_writes',
          target
        );
      EXCEPTION
        WHEN duplicate_object THEN
          RAISE NOTICE 'Policy %.% already exists, skipping write block.', 'public', target;
      END;
    EXCEPTION
      WHEN undefined_table THEN
        -- Table may belong to a later phase; ignore gracefully.
        RAISE NOTICE 'Table %.% does not exist yet, skipping RLS bootstrap.', 'public', target;
    END;
  END LOOP;
END $$;

COMMIT;
