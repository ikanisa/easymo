-- =============================================================================
-- RLS policies for anonymous listings + inquiries + verification requests
-- Additive-only (WEB PATCH)
-- =============================================================================

BEGIN;

-- =============================================================================
-- product_listings
-- - Owners can manage their own listings, but cannot self-verify or attach vendor_id.
-- - Public (authenticated/anon) can read published listings only.
-- =============================================================================
ALTER TABLE public.product_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_listings_owner_manage" ON public.product_listings
  FOR ALL
  TO authenticated
  USING (public.web_session_owned_by(auth.uid(), session_id))
  WITH CHECK (
    public.web_session_owned_by(auth.uid(), session_id)
    AND vendor_id IS NULL
    AND is_verified_seller = false
  );

CREATE POLICY "product_listings_public_read_published" ON public.product_listings
  FOR SELECT
  TO authenticated
  USING (status = 'published');

CREATE POLICY "service_role_manage_product_listings" ON public.product_listings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- listing_inquiries
-- - Buyers can create inquiries from their own session.
-- - Sellers can read inquiries for their listings.
-- - Buyers can read their own inquiries.
-- =============================================================================
ALTER TABLE public.listing_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "listing_inquiries_buyer_insert" ON public.listing_inquiries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.web_session_owned_by(auth.uid(), buyer_session_id)
    AND EXISTS (
      SELECT 1
      FROM public.product_listings pl
      WHERE pl.id = listing_id
        AND pl.status = 'published'
    )
  );

CREATE POLICY "listing_inquiries_seller_or_buyer_select" ON public.listing_inquiries
  FOR SELECT
  TO authenticated
  USING (
    public.web_session_owned_by(auth.uid(), buyer_session_id)
    OR EXISTS (
      SELECT 1
      FROM public.product_listings pl
      WHERE pl.id = listing_id
        AND public.web_session_owned_by(auth.uid(), pl.session_id)
    )
  );

CREATE POLICY "service_role_manage_listing_inquiries" ON public.listing_inquiries
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- listing_verification_requests
-- - Sellers can create verification requests for their own listings.
-- - Sellers can read their own requests.
-- - Admin/service role can review/update.
-- =============================================================================
ALTER TABLE public.listing_verification_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "listing_verification_requests_owner_insert" ON public.listing_verification_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.web_session_owned_by(auth.uid(), session_id)
    AND EXISTS (
      SELECT 1
      FROM public.product_listings pl
      WHERE pl.id = listing_id
        AND pl.session_id = session_id
    )
  );

CREATE POLICY "listing_verification_requests_owner_select" ON public.listing_verification_requests
  FOR SELECT
  TO authenticated
  USING (public.web_session_owned_by(auth.uid(), session_id));

CREATE POLICY "service_role_manage_listing_verification_requests" ON public.listing_verification_requests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- market_posts: allow public browsing of posted requests (still anonymous)
-- =============================================================================
CREATE POLICY "market_posts_public_read_posted" ON public.market_posts
  FOR SELECT
  TO authenticated
  USING (status = 'posted');

COMMIT;

