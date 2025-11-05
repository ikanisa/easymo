-- WhatsApp Router Function schema foundation
-- Adds destination allowlists, idempotency storage, and rate limit helpers for router-fn

BEGIN;

CREATE TABLE IF NOT EXISTS public.router_destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_key text NOT NULL CHECK (route_key ~ '^[a-z][a-z0-9_]*$'),
  destination_url text NOT NULL CHECK (destination_url ~ '^https://'),
  priority integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT router_destinations_unique UNIQUE (route_key, destination_url)
);

CREATE INDEX IF NOT EXISTS idx_router_destinations_route_key
  ON public.router_destinations (route_key)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_router_destinations_priority
  ON public.router_destinations (route_key, priority)
  WHERE is_active = true;

COMMENT ON TABLE public.router_destinations IS 'Allowlisted HTTPS destinations for router fan-out. Populated by platform owners.';
COMMENT ON COLUMN public.router_destinations.route_key IS 'Router key that maps to keywords (insurance, basket, etc).';
COMMENT ON COLUMN public.router_destinations.destination_url IS 'HTTPS destination for downstream webhook. Must pass allowlist validation.';
COMMENT ON COLUMN public.router_destinations.priority IS 'Smaller numbers are attempted first during fan-out.';

ALTER TABLE public.router_destinations ENABLE ROW LEVEL SECURITY;

CREATE POLICY router_destinations_service_rw
  ON public.router_destinations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY router_destinations_authenticated_read
  ON public.router_destinations
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE TRIGGER trg_router_destinations_updated
  BEFORE UPDATE ON public.router_destinations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.router_destinations (route_key, destination_url, priority)
VALUES
  ('insurance', 'https://hooks.easymo.co/insurance', 10),
  ('basket', 'https://hooks.easymo.co/basket', 10),
  ('qr', 'https://hooks.easymo.co/qr', 10),
  ('dine', 'https://hooks.easymo.co/dine', 10),
  ('easymo', 'https://hooks.easymo.co/easymo', 10)
ON CONFLICT (route_key, destination_url) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.router_message_gate (
  message_id text PRIMARY KEY,
  wa_from text NOT NULL,
  route_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_router_message_gate_processed
  ON public.router_message_gate (processed_at DESC);

COMMENT ON TABLE public.router_message_gate IS 'Idempotency store keyed by WhatsApp message_id to prevent duplicate routing.';

ALTER TABLE public.router_message_gate ENABLE ROW LEVEL SECURITY;

CREATE POLICY router_message_gate_service_rw
  ON public.router_message_gate
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY router_message_gate_authenticated_read
  ON public.router_message_gate
  FOR SELECT
  TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS public.router_rate_limits (
  wa_from text NOT NULL,
  window_start timestamptz NOT NULL,
  message_count integer NOT NULL,
  PRIMARY KEY (wa_from, window_start)
);

CREATE INDEX IF NOT EXISTS idx_router_rate_limits_window
  ON public.router_rate_limits (window_start DESC);

COMMENT ON TABLE public.router_rate_limits IS 'Per-sender rolling counters for enforcing WhatsApp webhook rate limits.';

ALTER TABLE public.router_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY router_rate_limits_service_rw
  ON public.router_rate_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY router_rate_limits_authenticated_read
  ON public.router_rate_limits
  FOR SELECT
  TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.router_claim_message(
  p_message_id text,
  p_wa_from text,
  p_route_key text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  inserted integer;
BEGIN
  INSERT INTO public.router_message_gate (message_id, wa_from, route_key, metadata)
  VALUES (p_message_id, p_wa_from, p_route_key, coalesce(p_metadata, '{}'::jsonb))
  ON CONFLICT (message_id) DO NOTHING;

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted = 1;
END;
$$;

COMMENT ON FUNCTION public.router_claim_message(text, text, text, jsonb)
  IS 'Returns true if the router successfully claims a message_id for processing (idempotency guard).';

CREATE OR REPLACE FUNCTION public.router_check_rate_limit(
  p_wa_from text,
  p_window_seconds integer DEFAULT 60,
  p_max_messages integer DEFAULT 20,
  p_now timestamptz DEFAULT timezone('utc', now())
)
RETURNS TABLE(allowed boolean, current_count integer)
LANGUAGE plpgsql
AS $$
DECLARE
  bucket_start timestamptz;
  latest_count integer;
BEGIN
  bucket_start := p_now - make_interval(secs => mod(extract(epoch FROM p_now)::integer, greatest(p_window_seconds, 1)));

  INSERT INTO public.router_rate_limits (wa_from, window_start, message_count)
  VALUES (p_wa_from, bucket_start, 1)
  ON CONFLICT (wa_from, window_start)
  DO UPDATE SET message_count = router_rate_limits.message_count + 1
  RETURNING router_rate_limits.message_count INTO latest_count;

  allowed := latest_count <= p_max_messages;
  current_count := latest_count;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.router_check_rate_limit(text, integer, integer, timestamptz)
  IS 'Atomically increments the per-sender counter and returns whether the request is within the configured rate limit.';

COMMIT;
