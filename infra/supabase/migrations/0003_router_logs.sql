BEGIN;

-- ---------------------------------------------------------------------------
-- WhatsApp router logs for observability and retention planning.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.router_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_id text NOT NULL,
  text_snippet text,
  route_key text,
  status_code text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  expires_at timestamptz NOT NULL DEFAULT timezone('utc', now()) + INTERVAL '90 days'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_router_logs_message_tenant
  ON public.router_logs (tenant_id, message_id);

CREATE INDEX IF NOT EXISTS idx_router_logs_route_status
  ON public.router_logs (tenant_id, route_key, status_code);

CREATE INDEX IF NOT EXISTS idx_router_logs_created_at
  ON public.router_logs (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_router_logs_expiration
  ON public.router_logs (expires_at);

COMMENT ON TABLE public.router_logs IS 'Per-tenant router telemetry with automatic 90 day retention horizon.';

COMMIT;
