-- Enforce RLS policies for admin_alert_prefs and allow service/admin access
BEGIN;

ALTER TABLE public.admin_alert_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_alert_prefs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_alert_prefs_service_role ON public.admin_alert_prefs;
DROP POLICY IF EXISTS admin_alert_prefs_owner_select ON public.admin_alert_prefs;
DROP POLICY IF EXISTS admin_alert_prefs_owner_modify ON public.admin_alert_prefs;

CREATE POLICY admin_alert_prefs_service_role
  ON public.admin_alert_prefs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY admin_alert_prefs_owner_select
  ON public.admin_alert_prefs
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR (auth.uid() IS NOT NULL AND (admin_user_id IS NULL OR admin_user_id = auth.uid()))
  );

CREATE POLICY admin_alert_prefs_owner_modify
  ON public.admin_alert_prefs
  FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR (auth.uid() IS NOT NULL AND admin_user_id = auth.uid())
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.uid() IS NOT NULL AND admin_user_id = auth.uid())
  );

CREATE POLICY admin_alert_prefs_owner_insert
  ON public.admin_alert_prefs
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.uid() IS NOT NULL AND admin_user_id = auth.uid())
  );

CREATE POLICY admin_alert_prefs_owner_delete
  ON public.admin_alert_prefs
  FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR (auth.uid() IS NOT NULL AND admin_user_id = auth.uid())
  );

COMMIT;
