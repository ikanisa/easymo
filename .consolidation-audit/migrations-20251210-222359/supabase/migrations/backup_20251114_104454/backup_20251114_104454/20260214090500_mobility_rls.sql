BEGIN;

-- Ensure owner scoped tables enforce row level security with explicit policies.
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_favorites FORCE ROW LEVEL SECURITY;
ALTER TABLE public.driver_parking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_parking FORCE ROW LEVEL SECURITY;
ALTER TABLE public.driver_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_availability FORCE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_trips FORCE ROW LEVEL SECURITY;
ALTER TABLE public.deeplink_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deeplink_tokens FORCE ROW LEVEL SECURITY;
ALTER TABLE public.deeplink_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deeplink_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.router_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.router_logs FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- User favorites policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS user_favorites_owner_manage ON public.user_favorites;
DROP POLICY IF EXISTS user_favorites_owner_rw ON public.user_favorites;
DROP POLICY IF EXISTS user_favorites_service_rw ON public.user_favorites;

CREATE POLICY user_favorites_owner_rw
  ON public.user_favorites
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY user_favorites_service_rw
  ON public.user_favorites
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Driver parking policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS driver_parking_owner_manage ON public.driver_parking;
DROP POLICY IF EXISTS driver_parking_owner_rw ON public.driver_parking;
DROP POLICY IF EXISTS driver_parking_service_rw ON public.driver_parking;

CREATE POLICY driver_parking_owner_rw
  ON public.driver_parking
  FOR ALL
  TO authenticated
  USING (driver_id = auth.uid())
  WITH CHECK (driver_id = auth.uid());

CREATE POLICY driver_parking_service_rw
  ON public.driver_parking
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Driver availability policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS driver_availability_owner_manage ON public.driver_availability;
DROP POLICY IF EXISTS driver_availability_owner_rw ON public.driver_availability;
DROP POLICY IF EXISTS driver_availability_service_rw ON public.driver_availability;

CREATE POLICY driver_availability_owner_rw
  ON public.driver_availability
  FOR ALL
  TO authenticated
  USING (driver_id = auth.uid())
  WITH CHECK (driver_id = auth.uid());

CREATE POLICY driver_availability_service_rw
  ON public.driver_availability
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Recurring trip policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS recurring_trips_owner_manage ON public.recurring_trips;
DROP POLICY IF EXISTS recurring_trips_owner_rw ON public.recurring_trips;
DROP POLICY IF EXISTS recurring_trips_service_rw ON public.recurring_trips;

CREATE POLICY recurring_trips_owner_rw
  ON public.recurring_trips
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY recurring_trips_service_rw
  ON public.recurring_trips
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Deeplink token policies (service role only, enforced by TTL cleanup job)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS deeplink_tokens_service_rw ON public.deeplink_tokens;
DROP POLICY IF EXISTS deeplink_tokens_service_ro ON public.deeplink_tokens;
DROP POLICY IF EXISTS deeplink_events_service_rw ON public.deeplink_events;

CREATE POLICY deeplink_tokens_service_rw
  ON public.deeplink_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY deeplink_tokens_service_ro
  ON public.deeplink_tokens
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY deeplink_events_service_rw
  ON public.deeplink_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Router log policies (service role write, authenticated read)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS router_logs_service_rw ON public.router_logs;
DROP POLICY IF EXISTS router_logs_authenticated_read ON public.router_logs;
DROP POLICY IF EXISTS router_logs_support_ro ON public.router_logs;

CREATE POLICY router_logs_service_rw
  ON public.router_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY router_logs_authenticated_read
  ON public.router_logs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY router_logs_support_ro
  ON public.router_logs
  FOR SELECT
  TO service_role
  USING (true);

COMMIT;
