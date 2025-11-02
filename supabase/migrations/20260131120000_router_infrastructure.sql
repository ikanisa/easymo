-- Router infrastructure upgrade: destinations, idempotency, rate limiting, telemetry
BEGIN;

-- Destination catalog for keyword routing
CREATE TABLE IF NOT EXISTS public.router_destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9_\-]+$'),
  route_key text NOT NULL CHECK (route_key ~ '^[a-z][a-z0-9_]*$'),
  url text NOT NULL CHECK (url ~ '^https?://'),
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT router_destinations_slug_unique UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS idx_router_destinations_route_key
  ON public.router_destinations (route_key)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_router_destinations_active
  ON public.router_destinations (is_active)
  WHERE is_active = true;

COMMENT ON TABLE public.router_destinations IS
  'Catalog of downstream endpoints for WhatsApp router keywords.';

COMMENT ON COLUMN public.router_destinations.slug IS
  'Stable identifier for the destination (used by allowlists).';

COMMENT ON COLUMN public.router_destinations.route_key IS
  'Route key that matches entries in router_keyword_map.';

COMMENT ON COLUMN public.router_destinations.url IS
  'HTTPS endpoint that receives routed WhatsApp payloads.';

COMMENT ON COLUMN public.router_destinations.metadata IS
  'Additional JSON metadata such as owner contact or environment annotations.';

CREATE TRIGGER trg_router_destinations_updated
  BEFORE UPDATE ON public.router_destinations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

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

-- View joining keywords with active destinations for quick lookups
CREATE OR REPLACE VIEW public.router_keyword_destinations AS
SELECT
  LOWER(m.keyword) AS keyword,
  d.slug AS destination_slug,
  d.url AS destination_url
FROM public.router_keyword_map m
JOIN public.router_destinations d
  ON d.route_key = m.route_key
WHERE m.is_active = true
  AND d.is_active = true;

COMMENT ON VIEW public.router_keyword_destinations IS
  'Resolves keywords to active destination slugs and URLs for the router edge function.';

-- Idempotency ledger
CREATE TABLE IF NOT EXISTS public.router_idempotency (
  message_id text PRIMARY KEY,
  from_number text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.router_idempotency IS
  'Stores WhatsApp message IDs to prevent replay processing.';

ALTER TABLE public.router_idempotency ENABLE ROW LEVEL SECURITY;

CREATE POLICY router_idempotency_service_rw
  ON public.router_idempotency
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Sliding window rate limit storage
CREATE TABLE IF NOT EXISTS public.router_rate_limits (
  sender text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 1 CHECK (count >= 0),
  last_message_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (sender, window_start)
);

COMMENT ON TABLE public.router_rate_limits IS
  'Tracks per-sender message counts for rate limiting enforcement.';

ALTER TABLE public.router_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY router_rate_limits_service_rw
  ON public.router_rate_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Structured telemetry table
CREATE TABLE IF NOT EXISTS public.router_telemetry (
  id bigserial PRIMARY KEY,
  event text NOT NULL,
  message_id text,
  keyword text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_router_telemetry_event
  ON public.router_telemetry (event, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_router_telemetry_message
  ON public.router_telemetry (message_id)
  WHERE message_id IS NOT NULL;

COMMENT ON TABLE public.router_telemetry IS
  'Structured telemetry emitted by the WhatsApp router (counts, errors, unmatched keywords).';

ALTER TABLE public.router_telemetry ENABLE ROW LEVEL SECURITY;

CREATE POLICY router_telemetry_service_rw
  ON public.router_telemetry
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY router_telemetry_authenticated_read
  ON public.router_telemetry
  FOR SELECT
  TO authenticated
  USING (true);

-- Rate limiting helper function
CREATE OR REPLACE FUNCTION public.router_enforce_rate_limit(
  p_sender text,
  p_limit integer,
  p_window_seconds integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := timezone('utc', now());
  v_window_start timestamptz := to_timestamp(floor(extract(epoch FROM v_now) / p_window_seconds) * p_window_seconds);
  v_count integer;
BEGIN
  INSERT INTO public.router_rate_limits (sender, window_start, count, last_message_at)
  VALUES (p_sender, v_window_start, 1, v_now)
  ON CONFLICT (sender, window_start)
  DO UPDATE SET
    count = public.router_rate_limits.count + 1,
    last_message_at = excluded.last_message_at
  RETURNING public.router_rate_limits.count INTO v_count;

  RETURN jsonb_build_object('allowed', v_count <= p_limit, 'current_count', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.router_enforce_rate_limit TO service_role;

-- Seed placeholder destinations for existing route keys
INSERT INTO public.router_destinations (slug, route_key, url, metadata)
VALUES
  ('insurance-primary', 'insurance', 'https://router-placeholder.example/insurance', jsonb_build_object('seed', true)),
  ('basket-primary', 'basket', 'https://router-placeholder.example/basket', jsonb_build_object('seed', true)),
  ('qr-primary', 'qr', 'https://router-placeholder.example/qr', jsonb_build_object('seed', true)),
  ('dine-primary', 'dine', 'https://router-placeholder.example/dine', jsonb_build_object('seed', true)),
  ('easymo-primary', 'easymo', 'https://router-placeholder.example/easymo', jsonb_build_object('seed', true))
ON CONFLICT (slug) DO NOTHING;

COMMIT;
