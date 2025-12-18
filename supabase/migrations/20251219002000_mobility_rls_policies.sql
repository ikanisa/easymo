-- =============================================================================
-- Mobility RLS Policies
-- Purpose: Ensure service_role can read/write mobility tables when RLS enabled.
-- =============================================================================

BEGIN;

ALTER TABLE public.mobility_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_mobility_users" ON public.mobility_users;
CREATE POLICY "service_role_full_mobility_users"
  ON public.mobility_users
  FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_full_mobility_presence" ON public.mobility_presence;
CREATE POLICY "service_role_full_mobility_presence"
  ON public.mobility_presence
  FOR ALL
  USING (auth.role() = 'service_role');

COMMIT;
