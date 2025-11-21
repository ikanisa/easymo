-- Ensure a system profile exists for the wallet
DO $$
DECLARE
  v_system_id uuid;
BEGIN
  -- Try to find existing system user or create a placeholder
  -- In a real scenario, this should be a specific admin user or a dedicated system account
  -- For now, we'll check if a user with email 'system@easymo.app' exists, or create a dummy profile
  
  -- This is a migration, so we can't easily create an auth.user. 
  -- We will assume the system profile ID is stored in wallet_settings.
  -- If not, we'll try to find a profile with a specific flag or just warn.
  
  -- Insert default redeem options if table is empty
  IF NOT EXISTS (SELECT 1 FROM public.wallet_redeem_options) THEN
    INSERT INTO public.wallet_redeem_options (cost_tokens, description, is_active, metadata)
    VALUES 
      (500, '500 RWF Airtime', true, '{"type": "airtime", "value": 500, "currency": "RWF"}'::jsonb),
      (1000, '1000 RWF Airtime', true, '{"type": "airtime", "value": 1000, "currency": "RWF"}'::jsonb),
      (5000, '5000 RWF Cash', true, '{"type": "cash", "value": 5000, "currency": "RWF"}'::jsonb);
  END IF;

  -- Ensure wallet_settings has the system profile key
  IF NOT EXISTS (SELECT 1 FROM public.wallet_settings WHERE key = 'wallet_system_profile_id') THEN
    -- Attempt to set it to the first admin user found, or leave empty for manual config
    -- Ideally, this should be set manually by the admin
    INSERT INTO public.wallet_settings (key, value) VALUES ('wallet_system_profile_id', '');
  END IF;

END $$;
