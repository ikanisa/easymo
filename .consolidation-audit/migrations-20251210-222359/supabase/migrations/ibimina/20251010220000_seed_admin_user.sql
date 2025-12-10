-- Ensure the primary system admin account exists with the expected credentials
DO $$
DECLARE
  admin_id uuid;
  new_password_hash text := '$2b$10$Kp2OO179kzGCO/hFRjJk.OcbXRRMxc.pOaWegF79nQcZanVpITOFe';
BEGIN
  SELECT id INTO admin_id FROM auth.users WHERE email = 'info@ikanisa.com';

  IF admin_id IS NULL THEN
    admin_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      created_at,
      updated_at,
      confirmation_token,
      email_change_token_current,
      email_change_token_new,
      recovery_token,
      phone_change_token,
      reauthentication_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      admin_id,
      'authenticated',
      'authenticated',
      'info@ikanisa.com',
      new_password_hash,
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
      '{}'::jsonb,
      false,
      now(),
      now(),
      '',
      '',
      '',
      '',
      '',
      ''
    );
  ELSE
    UPDATE auth.users
    SET
      encrypted_password = new_password_hash,
      updated_at = now(),
      confirmation_token = coalesce(confirmation_token, ''),
      email_change_token_current = coalesce(email_change_token_current, ''),
      email_change_token_new = coalesce(email_change_token_new, ''),
      recovery_token = coalesce(recovery_token, ''),
      phone_change_token = coalesce(phone_change_token, ''),
      reauthentication_token = coalesce(reauthentication_token, '')
    WHERE id = admin_id;
  END IF;

  IF to_regclass('public.users') IS NOT NULL THEN
    INSERT INTO public.users (id, email, role, created_at, updated_at)
    VALUES (admin_id, 'info@ikanisa.com', 'SYSTEM_ADMIN', now(), now())
    ON CONFLICT (id) DO UPDATE
      SET email = EXCLUDED.email,
          role = 'SYSTEM_ADMIN',
          updated_at = now();
  END IF;
END $$;
