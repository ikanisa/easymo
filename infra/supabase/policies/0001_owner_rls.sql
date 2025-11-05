BEGIN;

-- ---------------------------------------------------------------------------
-- Favorites and driver availability - owner only with service role bypass
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_parking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_favorites_owner_manage
  ON public.user_favorites
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_favorites_service_role_manage
  ON public.user_favorites
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY driver_parking_owner_manage
  ON public.driver_parking
  FOR ALL TO authenticated
  USING (auth.uid() = driver_id)
  WITH CHECK (auth.uid() = driver_id);

CREATE POLICY driver_parking_service_role_manage
  ON public.driver_parking
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY driver_availability_owner_manage
  ON public.driver_availability
  FOR ALL TO authenticated
  USING (auth.uid() = driver_id)
  WITH CHECK (auth.uid() = driver_id);

CREATE POLICY driver_availability_service_role_manage
  ON public.driver_availability
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY recurring_trips_owner_manage
  ON public.recurring_trips
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY recurring_trips_service_role_manage
  ON public.recurring_trips
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
