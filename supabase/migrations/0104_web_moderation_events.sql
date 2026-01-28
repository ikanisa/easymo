-- =============================================================================
-- Moderation events + abuse control helpers for the anonymous web marketplace
-- Workflow WEB-1: Phase 9 (additive only)
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.moderation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.web_sessions(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.market_posts(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  blocked_until TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_moderation_session_id
  ON public.moderation_events (session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_moderation_post_id
  ON public.moderation_events (post_id, created_at DESC);

COMMIT;
