-- Fix wallet system config migration
-- This script manually applies the wallet_system_config migration

-- Ensure wallet_settings table exists first
CREATE TABLE IF NOT EXISTS public.wallet_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Enable RLS if not already enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'wallet_settings' AND rowsecurity = true
  ) THEN
    ALTER TABLE public.wallet_settings ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Create policy if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='wallet_settings' AND policyname='wallet_settings_service'
  ) THEN
    CREATE POLICY "wallet_settings_service" ON public.wallet_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Ensure a system profile exists for the wallet
DO $$
DECLARE
  v_system_id uuid;
BEGIN
  -- Insert default redeem options if table exists and is empty
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'wallet_redeem_options') THEN
    IF NOT EXISTS (SELECT 1 FROM public.wallet_redeem_options) THEN
      INSERT INTO public.wallet_redeem_options (cost_tokens, description, is_active, metadata)
      VALUES 
        (500, '500 RWF Airtime', true, '{"type": "airtime", "value": 500, "currency": "RWF"}'::jsonb),
        (1000, '1000 RWF Airtime', true, '{"type": "airtime", "value": 1000, "currency": "RWF"}'::jsonb),
        (5000, '5000 RWF Cash', true, '{"type": "cash", "value": 5000, "currency": "RWF"}'::jsonb);
    END IF;
  END IF;

  -- Ensure wallet_settings has the system profile key
  IF NOT EXISTS (SELECT 1 FROM public.wallet_settings WHERE key = 'wallet_system_profile_id') THEN
    INSERT INTO public.wallet_settings (key, value) VALUES ('wallet_system_profile_id', '');
  END IF;

END $$;

-- Update the migration record to mark it as successful
UPDATE supabase_migrations.schema_migrations 
SET statements = ARRAY[
  'CREATE TABLE IF NOT EXISTS public.wallet_settings',
  'ALTER TABLE public.wallet_settings ENABLE ROW LEVEL SECURITY',
  'CREATE POLICY wallet_settings_service',
  'INSERT default redeem options',
  'INSERT wallet_system_profile_id setting'
]
WHERE version = '20251122100000';
