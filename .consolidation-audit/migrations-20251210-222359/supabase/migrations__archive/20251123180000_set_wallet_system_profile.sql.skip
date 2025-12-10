-- Migration: Set wallet system profile
-- Created: 2025-11-23
-- Purpose: Configure system profile for wallet operations

BEGIN;

-- Create or get system profile for wallet operations
DO $$
DECLARE
  v_system_profile_id uuid;
  v_system_phone text := '+22893002751'; -- System WhatsApp number
BEGIN
  -- Check if system profile exists in whatsapp_users
  SELECT id INTO v_system_profile_id
  FROM public.whatsapp_users
  WHERE phone_number = v_system_phone
  LIMIT 1;

  -- If not exists, create it
  IF v_system_profile_id IS NULL THEN
    INSERT INTO public.whatsapp_users (
      phone_number,
      display_name,
      preferred_language,
      user_roles
    )
    VALUES (
      v_system_phone,
      'easyMO System',
      'en',
      ARRAY['system']::text[]
    )
    RETURNING id INTO v_system_profile_id;
    
    RAISE NOTICE 'Created system profile: %', v_system_profile_id;
  ELSE
    RAISE NOTICE 'System profile already exists: %', v_system_profile_id;
  END IF;

  -- Set wallet_system_profile_id in wallet_settings (key-value table)
  INSERT INTO public.wallet_settings (key, value, updated_at)
  VALUES ('wallet_system_profile_id', v_system_profile_id::text, now())
  ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      updated_at = now();

  RAISE NOTICE 'Wallet system profile configured: %', v_system_profile_id;
END $$;

COMMIT;
