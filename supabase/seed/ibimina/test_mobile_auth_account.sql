-- Create test account for mobile authentication testing
-- Email: info@ikanisa.com
-- Password: MoMo!!0099

-- First, insert into auth.users (Supabase Auth)
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role
) VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'info@ikanisa.com',
  crypt('MoMo!!0099', gen_salt('bf')), -- Bcrypt hash of password
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Test Mobile User","role":"staff"}',
  false,
  'authenticated'
) ON CONFLICT (email) DO NOTHING;

-- Get the user ID
DO $$
DECLARE
  v_user_id uuid;
  v_country_id uuid;
  v_org_id uuid;
BEGIN
  -- Get the user ID
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'info@ikanisa.com';
  
  -- Get Rwanda country ID
  SELECT id INTO v_country_id FROM countries WHERE iso2 = 'RW' LIMIT 1;
  
  -- Get or create an organization for testing
  SELECT id INTO v_org_id FROM organizations WHERE country_id = v_country_id LIMIT 1;
  
  -- If no organization exists, create one
  IF v_org_id IS NULL THEN
    INSERT INTO organizations (
      country_id,
      name,
      type,
      settings
    ) VALUES (
      v_country_id,
      'Test SACCO',
      'SACCO',
      '{}'
    ) RETURNING id INTO v_org_id;
  END IF;
  
  -- Create staff profile
  INSERT INTO staff (
    user_id,
    org_id,
    email,
    role,
    status,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    v_org_id,
    'info@ikanisa.com',
    'staff',
    'active',
    now(),
    now()
  ) ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = now();
    
  RAISE NOTICE 'Test account created successfully for mobile authentication testing';
  RAISE NOTICE 'Email: info@ikanisa.com';
  RAISE NOTICE 'Password: MoMo!!0099';
  RAISE NOTICE 'Organization: %', v_org_id;
  RAISE NOTICE 'User ID: %', v_user_id;
END $$;
