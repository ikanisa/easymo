-- =============================================================================
-- Link external feed items to market posts and enforce deduplication
-- Workflow WEB-1: Phase 5 (additive only)
-- =============================================================================

BEGIN;

ALTER TABLE public.external_feed_items
  ADD COLUMN IF NOT EXISTS post_id UUID REFERENCES public.market_posts(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_external_feed_post_id
  ON public.external_feed_items (post_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_external_feed_post_source_url
  ON public.external_feed_items (post_id, source, url);

COMMIT;
