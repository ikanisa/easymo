-- =============================================================================
-- Core tables for the anonymous web marketplace
-- Workflow WEB-1: Phase 1, Step 1 (additive only)
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.web_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anon_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  language TEXT NOT NULL DEFAULT 'en',
  device_fingerprint_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_web_sessions_anon_user_id
  ON public.web_sessions (anon_user_id);

CREATE TABLE IF NOT EXISTS public.market_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.web_sessions(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('buy', 'sell')),
  category TEXT,
  title TEXT,
  description TEXT,
  price_min INT,
  price_max INT,
  currency TEXT NOT NULL DEFAULT 'RWF',
  location_text TEXT,
  geo POINT,
  media_urls TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'matched', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  posted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.market_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.market_posts(id) ON DELETE CASCADE,
  seller_display_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.match_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.market_posts(id) ON DELETE CASCADE,
  match_type TEXT NOT NULL CHECK (match_type IN ('internal_listing', 'vendor_db', 'external_feed')),
  target_id UUID,
  score NUMERIC NOT NULL,
  reasons JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_match_suggestions_post_score
  ON public.match_suggestions (post_id, score DESC);

CREATE TABLE IF NOT EXISTS public.web_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.market_posts(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('seller_session', 'buyer_session', 'vendor', 'lead')),
  target_id UUID NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('web', 'whatsapp', 'email')),
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.external_feed_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  snippet TEXT,
  url TEXT NOT NULL,
  phone TEXT,
  location_text TEXT,
  category_guess TEXT,
  confidence NUMERIC,
  raw_sources JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
