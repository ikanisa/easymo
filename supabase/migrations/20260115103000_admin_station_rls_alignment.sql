-- Align admin/station RLS policies with application expectations
BEGIN;

-- Helper to safely coerce JWT string claims into UUIDs without raising errors
CREATE OR REPLACE FUNCTION public.safe_cast_uuid(input text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  result uuid;
BEGIN
  IF input IS NULL OR length(trim(input)) = 0 THEN
    RETURN NULL;
  END IF;
  BEGIN
    result := trim(input)::uuid;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
  RETURN result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.safe_cast_uuid(text) TO anon, authenticated, service_role;

-- Expanded admin helper covering legacy and current role claim placements
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT (
    auth.role() = 'service_role'
    OR coalesce(auth.jwt()->>'role', '') = ANY (ARRAY['admin','super_admin','support','data_ops'])
    OR coalesce(auth.jwt()->'app_metadata'->>'role', '') = ANY (ARRAY['admin','super_admin','support','data_ops'])
    OR EXISTS (
      SELECT 1
      FROM json_array_elements_text(coalesce(auth.jwt()->'roles', '[]'::json)) AS role(value)
      WHERE role.value = ANY (ARRAY['admin','super_admin','support','data_ops'])
    )
    OR EXISTS (
      SELECT 1
      FROM json_array_elements_text(coalesce(auth.jwt()->'app_metadata'->'roles', '[]'::json)) AS role(value)
      WHERE role.value = ANY (ARRAY['admin','super_admin','support','data_ops'])
    )
    OR COALESCE((auth.jwt()->'user_roles') ?| ARRAY['admin','super_admin','support','data_ops'], FALSE)
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;

-- Read-only admin helper extends to "readonly" observers
CREATE OR REPLACE FUNCTION public.is_admin_reader()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT (
    public.is_admin()
    OR coalesce(auth.jwt()->>'role', '') = 'readonly'
    OR coalesce(auth.jwt()->'app_metadata'->>'role', '') = 'readonly'
    OR EXISTS (
      SELECT 1
      FROM json_array_elements_text(coalesce(auth.jwt()->'roles', '[]'::json)) AS role(value)
      WHERE role.value = 'readonly'
    )
    OR EXISTS (
      SELECT 1
      FROM json_array_elements_text(coalesce(auth.jwt()->'app_metadata'->'roles', '[]'::json)) AS role(value)
      WHERE role.value = 'readonly'
    )
    OR COALESCE((auth.jwt()->'user_roles') ? 'readonly', FALSE)
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_admin_reader() TO anon, authenticated, service_role;

-- Station helper supports single and multi-station JWT claims
CREATE OR REPLACE FUNCTION public.station_scope_matches(target uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT target IS NOT NULL AND (
    public.safe_cast_uuid(auth.jwt()->>'station_id') = target
    OR EXISTS (
      SELECT 1
      FROM json_array_elements_text(coalesce(auth.jwt()->'station_ids', '[]'::json)) AS payload(value)
      WHERE public.safe_cast_uuid(payload.value) = target
    )
    OR EXISTS (
      SELECT 1
      FROM json_array_elements_text(coalesce(auth.jwt()->'stations', '[]'::json)) AS payload(value)
      WHERE public.safe_cast_uuid(payload.value) = target
    )
  );
$$;
GRANT EXECUTE ON FUNCTION public.station_scope_matches(uuid) TO anon, authenticated, service_role;

-- Enforce RLS at the table level
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vouchers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.voucher_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voucher_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns FORCE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_targets FORCE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_quotes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log FORCE ROW LEVEL SECURITY;

-- Replace legacy policies with scoped variants
DROP POLICY IF EXISTS vouchers_admin_manage ON public.vouchers;
DROP POLICY IF EXISTS vouchers_admin_read ON public.vouchers;
DROP POLICY IF EXISTS vouchers_owner_select ON public.vouchers;
DROP POLICY IF EXISTS vouchers_station_select ON public.vouchers;
DROP POLICY IF EXISTS vouchers_user_select ON public.vouchers;
DROP POLICY IF EXISTS vouchers_select ON public.vouchers;
DROP POLICY IF EXISTS vouchers_insert ON public.vouchers;
DROP POLICY IF EXISTS vouchers_update ON public.vouchers;
DROP POLICY IF EXISTS vouchers_delete ON public.vouchers;

CREATE POLICY vouchers_admin_manage ON public.vouchers
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY vouchers_admin_read ON public.vouchers
  FOR SELECT
  USING (public.is_admin_reader());

CREATE POLICY vouchers_owner_read ON public.vouchers
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND auth.uid() = vouchers.user_id);

CREATE POLICY vouchers_station_read ON public.vouchers
  FOR SELECT
  USING (
    public.station_scope_matches(vouchers.station_scope)
    OR public.station_scope_matches(vouchers.redeemed_by_station_id)
  );

DROP POLICY IF EXISTS voucher_events_admin_manage ON public.voucher_events;
DROP POLICY IF EXISTS voucher_events_admin_select ON public.voucher_events;
DROP POLICY IF EXISTS voucher_events_station_select ON public.voucher_events;

CREATE POLICY voucher_events_admin_manage ON public.voucher_events
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY voucher_events_admin_read ON public.voucher_events
  FOR SELECT
  USING (public.is_admin_reader());

CREATE POLICY voucher_events_station_read ON public.voucher_events
  FOR SELECT
  USING (public.station_scope_matches(voucher_events.station_id));

DROP POLICY IF EXISTS campaigns_admin_manage ON public.campaigns;
DROP POLICY IF EXISTS campaigns_admin_select ON public.campaigns;

CREATE POLICY campaigns_admin_manage ON public.campaigns
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY campaigns_admin_read ON public.campaigns
  FOR SELECT
  USING (public.is_admin_reader());

DROP POLICY IF EXISTS campaign_targets_admin_manage ON public.campaign_targets;
DROP POLICY IF EXISTS campaign_targets_admin_select ON public.campaign_targets;

CREATE POLICY campaign_targets_admin_manage ON public.campaign_targets
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS insurance_quotes_admin_manage ON public.insurance_quotes;
DROP POLICY IF EXISTS insurance_quotes_user_select ON public.insurance_quotes;
DROP POLICY IF EXISTS insurance_quotes_admin_read ON public.insurance_quotes;

CREATE POLICY insurance_quotes_admin_manage ON public.insurance_quotes
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY insurance_quotes_admin_read ON public.insurance_quotes
  FOR SELECT
  USING (public.is_admin_reader());

CREATE POLICY insurance_quotes_owner_read ON public.insurance_quotes
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND auth.uid() = insurance_quotes.user_id);

DROP POLICY IF EXISTS stations_admin_manage ON public.stations;
DROP POLICY IF EXISTS stations_admin_select ON public.stations;
DROP POLICY IF EXISTS stations_station_select ON public.stations;

CREATE POLICY stations_admin_manage ON public.stations
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY stations_admin_read ON public.stations
  FOR SELECT
  USING (public.is_admin_reader());

CREATE POLICY stations_operator_read ON public.stations
  FOR SELECT
  USING (public.station_scope_matches(stations.id));

DROP POLICY IF EXISTS settings_admin_manage ON public.settings;
DROP POLICY IF EXISTS settings_admin_read ON public.settings;
DROP POLICY IF EXISTS settings_authenticated_select ON public.settings;

CREATE POLICY settings_admin_manage ON public.settings
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY settings_admin_read ON public.settings
  FOR SELECT
  USING (public.is_admin_reader());

DROP POLICY IF EXISTS audit_log_admin_select ON public.audit_log;
DROP POLICY IF EXISTS audit_log_admin_insert ON public.audit_log;

CREATE POLICY audit_log_admin_read ON public.audit_log
  FOR SELECT
  USING (public.is_admin_reader());

CREATE POLICY audit_log_admin_append ON public.audit_log
  FOR INSERT
  WITH CHECK (public.is_admin());

COMMIT;
