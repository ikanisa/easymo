BEGIN;

-- Add RLS policies to restore access after enabling RLS
-- Service role has full access, authenticated users have read access by default
-- Specific tables may need more restrictive policies based on business logic

-- ============================================================================
-- HELPER FUNCTION: Check if user is admin
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if current user has admin role
  -- This is a placeholder - adjust based on your admin detection logic
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND raw_user_meta_data->>'role' = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_push_subscriptions'
  ) THEN
    CREATE POLICY "users_manage_own_subscriptions" ON public.user_push_subscriptions
      TO authenticated 
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  ELSE
    RAISE NOTICE 'Skipping policies for user_push_subscriptions: table missing.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'push_tokens'
  ) THEN
    CREATE POLICY "service_role_all_push_tokens" ON public.push_tokens
      TO service_role USING (true) WITH CHECK (true);

    CREATE POLICY "users_manage_own_push_tokens" ON public.push_tokens
      TO authenticated 
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  ELSE
    RAISE NOTICE 'Skipping policies for push_tokens: table missing.';
  END IF;
END $$;

-- ============================================================================
-- Grant execute permissions on helper function
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON FUNCTION public.is_admin() IS 'Helper function to check if current user is an admin. Adjust logic based on your admin detection mechanism.';

COMMIT;
