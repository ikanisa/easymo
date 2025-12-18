-- =============================================================================
-- Buyer Alert Scheduling schema for notify-buyers
-- =============================================================================
-- Tables referenced by supabase/functions/notify-buyers/index.ts
-- - buyer_market_alerts : scheduled WhatsApp alerts for buyers
-- - produce_catalog     : optional price hints per market/variety/grade
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.buyer_market_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id TEXT,
  buyer_phone TEXT NOT NULL,
  buyer_type TEXT NOT NULL DEFAULT 'merchant',
  market_code TEXT NOT NULL,
  template_intent TEXT NOT NULL,
  template_locale TEXT NOT NULL DEFAULT 'en',
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  cod_fallback JSONB,
  send_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- basic indexes for scheduling
CREATE INDEX IF NOT EXISTS idx_buyer_market_alerts_status_send_at
  ON public.buyer_market_alerts (status, send_at);
CREATE INDEX IF NOT EXISTS idx_buyer_market_alerts_market_code
  ON public.buyer_market_alerts (market_code);

-- Produce catalog for price hints
CREATE TABLE IF NOT EXISTS public.produce_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_code TEXT NOT NULL,
  commodity TEXT NOT NULL,
  variety TEXT NOT NULL,
  grade TEXT NOT NULL,
  price_floor NUMERIC,
  price_ceiling NUMERIC,
  synonyms TEXT[],
  localized_names JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (market_code, commodity, variety, grade)
);

-- RLS: locked to service role by default
ALTER TABLE public.buyer_market_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produce_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_buyer_market_alerts" ON public.buyer_market_alerts;
CREATE POLICY "service_role_full_buyer_market_alerts"
  ON public.buyer_market_alerts FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_full_produce_catalog" ON public.produce_catalog;
CREATE POLICY "service_role_full_produce_catalog"
  ON public.produce_catalog FOR ALL
  USING (auth.role() = 'service_role');

COMMIT;
