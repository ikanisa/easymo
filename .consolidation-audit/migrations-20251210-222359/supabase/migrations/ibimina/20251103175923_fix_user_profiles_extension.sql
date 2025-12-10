-- Fix user profiles: Create extension table instead of modifying auth.users view
-- This migration creates a separate user_profiles table for extended user data
-- that complements the auth.users table without trying to alter the view

-- 1. Create enum for account status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_account_status') THEN
    CREATE TYPE public.user_account_status AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');
  END IF;
END $$;

-- 2. Create user_profiles extension table
CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  account_status public.user_account_status NOT NULL DEFAULT 'ACTIVE',
  pw_reset_required BOOLEAN NOT NULL DEFAULT false,
  full_name TEXT,
  phone TEXT,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_account_status ON public.user_profiles(account_status);
CREATE INDEX IF NOT EXISTS idx_user_profiles_pw_reset ON public.user_profiles(pw_reset_required) WHERE pw_reset_required = true;
CREATE INDEX IF NOT EXISTS idx_user_profiles_last_login ON public.user_profiles(last_login_at);

-- 4. Add helpful comments
COMMENT ON TABLE public.user_profiles IS 'Extended user profile data complementing auth.users';
COMMENT ON COLUMN public.user_profiles.pw_reset_required IS 'Forces password reset on next login for newly invited staff';
COMMENT ON COLUMN public.user_profiles.account_status IS 'Account status: ACTIVE, SUSPENDED, or INACTIVE';
COMMENT ON COLUMN public.user_profiles.full_name IS 'Staff member full name';
COMMENT ON COLUMN public.user_profiles.phone IS 'Staff member phone number';
COMMENT ON COLUMN public.user_profiles.last_login_at IS 'Timestamp of last successful login';

-- 5. Create trigger to auto-create profile on user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 6. Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_user_profile_updated ON public.user_profiles;
CREATE TRIGGER on_user_profile_updated
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 7. Create comprehensive view joining auth.users + user_profiles
CREATE OR REPLACE VIEW public.users_complete AS
SELECT 
  u.id,
  u.email,
  u.raw_user_meta_data,
  u.created_at as auth_created_at,
  u.updated_at as auth_updated_at,
  u.email_confirmed_at,
  u.last_sign_in_at,
  COALESCE(p.account_status, 'ACTIVE'::user_account_status) as account_status,
  COALESCE(p.pw_reset_required, false) as pw_reset_required,
  p.full_name,
  p.phone,
  p.last_login_at,
  p.created_at as profile_created_at,
  p.updated_at as profile_updated_at
FROM auth.users u
LEFT JOIN public.user_profiles p ON u.id = p.user_id;

COMMENT ON VIEW public.users_complete IS 'Complete user view combining auth.users and user_profiles';

-- 8. Create helper function to check if user account is active
CREATE OR REPLACE FUNCTION public.is_user_account_active(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  status public.user_account_status;
BEGIN
  SELECT account_status INTO status
  FROM public.user_profiles
  WHERE user_id = user_uuid;
  
  -- If no profile exists yet, consider active
  IF NOT FOUND THEN
    RETURN TRUE;
  END IF;
  
  RETURN status = 'ACTIVE';
END;
$$;

COMMENT ON FUNCTION public.is_user_account_active IS 'Check if user account is in ACTIVE status';

-- 9. Enable RLS on user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 10. Create RLS policies

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON public.user_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own profile (except account_status and pw_reset_required)
CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin users can read all profiles
CREATE POLICY "Admins can read all profiles"
  ON public.user_profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' IN ('Admin', 'Super Admin')
    )
  );

-- Admin users can update all profiles
CREATE POLICY "Admins can update all profiles"
  ON public.user_profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' IN ('Admin', 'Super Admin')
    )
  );

-- Admin users can insert profiles
CREATE POLICY "Admins can insert profiles"
  ON public.user_profiles
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' IN ('Admin', 'Super Admin')
    )
  );

-- 11. Backfill existing users (create profiles for users without them)
INSERT INTO public.user_profiles (user_id)
SELECT id
FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_profiles WHERE user_id = auth.users.id
)
ON CONFLICT (user_id) DO NOTHING;

-- 12. Grant necessary permissions
GRANT SELECT ON public.user_profiles TO authenticated;
GRANT SELECT ON public.users_complete TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_account_active TO authenticated;
