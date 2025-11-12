BEGIN;

-- Fix auth.role() syntax error - use auth.jwt() -> role instead
CREATE OR REPLACE FUNCTION auth.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'role',
    'anon'
  )
$$;

-- Apply RLS policies using the fixed function
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Fix for service role access
CREATE POLICY "Service role has full access" ON public.profiles
  FOR ALL USING (auth.current_user_role() = 'service_role');

COMMIT;
