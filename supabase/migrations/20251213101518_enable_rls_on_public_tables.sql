BEGIN;

-- Enable RLS on all public tables that currently have it disabled
-- This addresses security lint errors: rls_disabled_in_public
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'menu_items',
    'admin_contacts', 'auth_qr_sessions', 'staff_devices', 'auth_logs',
    'sms_inbox', 'sms_parsed', 'sms_templates', 'sms_review_queue',
    'reconciliation_runs', 'reconciliation_exceptions', 'payments', 'settlements',
    'organizations', 'members', 'groups', 'group_members',
    'share_allocations', 'allocation_export_requests',
    'wallet_accounts_ibimina', 'wallet_transactions_ibimina',
    'configuration', 'org_feature_overrides', 'system_metrics', 'rate_limit_counters',
    'analytics_events', 'notification_queue', 'user_push_subscriptions', 'push_tokens'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    ELSE
      RAISE NOTICE 'Skipping RLS enable for %. Table is missing.', t;
    END IF;
  END LOOP;
END $$;

-- Spatial (PostGIS system table) - Skip if we don't have permissions
DO $$ 
BEGIN
  ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
EXCEPTION 
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping spatial_ref_sys - insufficient privileges (PostGIS system table)';
END $$;

COMMIT;
