BEGIN;

-- Migration: Security policy refinements
-- Date: 2025-11-12
-- Description: Refine overly permissive policies to be more restrictive

-- Note: is_admin() function already exists from phase2_mobility_rls migration

-- Profiles: Restrict full read to own profile + admin
DROP POLICY IF EXISTS "profiles_read_all" ON public.profiles;
CREATE POLICY "profiles_read_own" ON public.profiles
  FOR SELECT
  USING (
    user_id = (auth.jwt() ->> 'sub')::UUID
    OR public.is_admin()
    OR auth.role() = 'service_role'
  );

-- Trips: Users can only see their own trips + service role
DROP POLICY IF EXISTS "trips_read_all" ON public.trips;
CREATE POLICY "trips_read_own" ON public.trips
  FOR SELECT
  USING (
    creator_user_id = (auth.jwt() ->> 'sub')::UUID
    OR public.is_admin()
    OR auth.role() = 'service_role'
  );

-- Orders: Users can only see their own orders (uses profile_id UUID)
DROP POLICY IF EXISTS "orders_read_all" ON public.orders;
CREATE POLICY "orders_read_own" ON public.orders
  FOR SELECT
  USING (
    profile_id = (auth.jwt() ->> 'sub')::UUID
    OR public.is_admin()
    OR auth.role() = 'service_role'
  );

-- Driver presence: Service role and own data only
DROP POLICY IF EXISTS "driver_presence_read_all" ON public.driver_presence;
CREATE POLICY "driver_presence_read_limited" ON public.driver_presence
  FOR SELECT
  USING (
    user_id = (auth.jwt() ->> 'sub')::UUID
    OR public.is_admin()
    OR auth.role() = 'service_role'
  );

-- Settings: Authenticated users can read, admins and service role can manage
DROP POLICY IF EXISTS "settings_read_all" ON public.settings;
CREATE POLICY "settings_read_authenticated" ON public.settings
  FOR SELECT
  USING (
    auth.role() IN ('authenticated', 'service_role')
  );

-- Subscriptions: Users can only see their own (uses UUID user_id)
DROP POLICY IF EXISTS "subscriptions_read_all" ON public.subscriptions;
CREATE POLICY "subscriptions_read_own" ON public.subscriptions
  FOR SELECT
  USING (
    user_id = (auth.jwt() ->> 'sub')::UUID
    OR public.is_admin()
    OR auth.role() = 'service_role'
  );

-- Businesses: Keep public read for marketplace functionality
-- (Reviews should remain public for transparency)

-- Order events: Restrict to order owner (orders use profile_id)
DROP POLICY IF EXISTS "order_events_read_all" ON public.order_events;
CREATE POLICY "order_events_read_own" ON public.order_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_events.order_id
      AND (
        o.profile_id = (auth.jwt() ->> 'sub')::UUID
        OR public.is_admin()
      )
    )
    OR auth.role() = 'service_role'
  );

-- Campaign targets: Admin and service role only
DROP POLICY IF EXISTS "campaign_targets_read_all" ON public.campaign_targets;
CREATE POLICY "campaign_targets_admin_only" ON public.campaign_targets
  FOR SELECT
  USING (
    public.is_admin()
    OR auth.role() = 'service_role'
  );

-- Campaigns: Admin and service role only
DROP POLICY IF EXISTS "campaigns_read_all" ON public.campaigns;
CREATE POLICY "campaigns_admin_only" ON public.campaigns
  FOR SELECT
  USING (
    public.is_admin()
    OR auth.role() = 'service_role'
  );

-- Add missing policies for wallet tables with RLS now enabled
-- These tables don't have user columns, so restrict to service role and admins
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'wallet_earn_actions' AND policyname = 'wallet_earn_actions_service') THEN
    CREATE POLICY "wallet_earn_actions_service" ON public.wallet_earn_actions
      FOR ALL
      USING (
        public.is_admin()
        OR auth.role() = 'service_role'
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'wallet_promoters' AND policyname = 'wallet_promoters_service') THEN
    CREATE POLICY "wallet_promoters_service" ON public.wallet_promoters
      FOR ALL
      USING (
        public.is_admin()
        OR auth.role() = 'service_role'
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'wallet_redeem_options' AND policyname = 'wallet_redeem_options_read') THEN
    CREATE POLICY "wallet_redeem_options_read" ON public.wallet_redeem_options
      FOR SELECT
      USING (
        auth.role() IN ('authenticated', 'service_role')
      );
  END IF;
END $$;

COMMIT;
