-- =============================================================================
-- RLS policies and supporting utilities for the anonymous web marketplace
-- Workflow WEB-1: Phase 2 (additive only)
-- =============================================================================

BEGIN;

-- Helper to confirm session ownership
CREATE OR REPLACE FUNCTION public.web_session_owned_by(uid UUID, session_uuid UUID)
RETURNS BOOLEAN AS $$
SELECT EXISTS (
  SELECT 1 FROM public.web_sessions
  WHERE id = session_uuid
    AND anon_user_id = uid
);
$$ LANGUAGE sql STABLE;

-- Helper to confirm market post ownership via the originating session
CREATE OR REPLACE FUNCTION public.market_post_owned_by(uid UUID, post_uuid UUID)
RETURNS BOOLEAN AS $$
SELECT EXISTS (
  SELECT 1 FROM public.market_posts mp
  INNER JOIN public.web_sessions ws ON mp.session_id = ws.id
  WHERE mp.id = post_uuid
    AND ws.anon_user_id = uid
);
$$ LANGUAGE sql STABLE;

-- =============================================================================
-- web_sessions: only allow anonymous owners or service role to manage their own rows
-- =============================================================================
ALTER TABLE public.web_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "web_sessions_owner_only" ON public.web_sessions
  FOR ALL
  TO authenticated
  USING (anon_user_id = auth.uid())
  WITH CHECK (anon_user_id = auth.uid());

CREATE POLICY "service_role_manage_web_sessions" ON public.web_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- market_posts: writes limited to the owning session, reads limited to owners + service role
-- =============================================================================
ALTER TABLE public.market_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "market_posts_owner_manage" ON public.market_posts
  FOR ALL
  TO authenticated
  USING (public.web_session_owned_by(auth.uid(), session_id))
  WITH CHECK (public.web_session_owned_by(auth.uid(), session_id));

CREATE POLICY "service_role_manage_market_posts" ON public.market_posts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- market_listings: public reads only for active, posted listings; writes reserved for service role
-- =============================================================================
ALTER TABLE public.market_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_posted_listings" ON public.market_listings
  FOR SELECT
  TO authenticated
  USING (
    is_active AND EXISTS (
      SELECT 1 FROM public.market_posts mp
      WHERE mp.id = public.market_listings.post_id
        AND mp.status = 'posted'
    )
  );

CREATE POLICY "service_role_manage_market_listings" ON public.market_listings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- match_suggestions: owners can read their matches; creation limited to service role
-- =============================================================================
ALTER TABLE public.match_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "match_suggestions_owner_select" ON public.match_suggestions
  FOR SELECT
  TO authenticated
  USING (public.market_post_owned_by(auth.uid(), post_id));

CREATE POLICY "service_role_manage_match_suggestions" ON public.match_suggestions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- web_notifications: owners may fetch notifications targeting their session; service role manages writes
-- =============================================================================
ALTER TABLE public.web_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "web_notifications_owner_select" ON public.web_notifications
  FOR SELECT
  TO authenticated
  USING (
    target_type IN ('seller_session', 'buyer_session')
    AND public.web_session_owned_by(auth.uid(), target_id)
  );

CREATE POLICY "service_role_manage_web_notifications" ON public.web_notifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- external_feed_items: read-safe for authenticated flows, writes restricted to service role
-- =============================================================================
ALTER TABLE public.external_feed_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_select_external_feed" ON public.external_feed_items
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "service_role_manage_external_feed_items" ON public.external_feed_items
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
