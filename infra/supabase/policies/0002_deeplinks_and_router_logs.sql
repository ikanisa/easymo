BEGIN;

ALTER TABLE public.deeplink_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deeplink_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.router_logs ENABLE ROW LEVEL SECURITY;

-- Deeplink tokens: owner (creator) manage, service role full access
CREATE POLICY deeplink_tokens_owner_manage
  ON public.deeplink_tokens
  FOR ALL TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY deeplink_tokens_service_role_manage
  ON public.deeplink_tokens
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Deeplink events: owners can read via token relationship; service role manages
CREATE POLICY deeplink_events_owner_read
  ON public.deeplink_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.deeplink_tokens dt
      WHERE dt.id = token_id
      AND dt.created_by = auth.uid()
    )
  );

CREATE POLICY deeplink_events_service_role_manage
  ON public.deeplink_events
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Helper view for simplified access to deeplink audit trail
CREATE OR REPLACE VIEW public.my_deeplink_events AS
  SELECT
    e.id,
    e.token_id,
    t.token,
    t.flow,
    e.event,
    e.context,
    e.created_at
  FROM public.deeplink_events e
  JOIN public.deeplink_tokens t ON t.id = e.token_id
  WHERE t.created_by = auth.uid();

-- Router logs: service role writes, authenticated tenants read own rows
CREATE POLICY router_logs_service_role_manage
  ON public.router_logs
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY router_logs_tenant_read
  ON public.router_logs
  FOR SELECT TO authenticated
  USING (tenant_id = auth.uid());

COMMIT;
