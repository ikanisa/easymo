-- =============================================================================
-- WEB PATCH — Anonymous product/service listings + verified vendor directory
-- Additive-only: introduces product listings, inquiries, verification requests
-- =============================================================================

BEGIN;

-- =============================================================================
-- Vendors: add explicit verified flag (directory should filter on this)
-- =============================================================================
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_vendors_verified_true
  ON public.vendors (verified)
  WHERE verified = true;

-- =============================================================================
-- product_listings: anonymous seller listings (optionally attached to verified vendor)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.product_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.web_sessions(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES public.vendors(id),
  listing_type TEXT NOT NULL CHECK (listing_type IN ('product', 'service')),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  price INT,
  currency TEXT NOT NULL DEFAULT 'RWF',
  price_type TEXT NOT NULL DEFAULT 'fixed' CHECK (price_type IN ('fixed', 'negotiable', 'range')),
  price_min INT,
  price_max INT,
  location_text TEXT,
  geo POINT,
  media_urls TEXT[] NOT NULL DEFAULT '{}',
  availability TEXT NOT NULL DEFAULT 'unknown' CHECK (availability IN ('unknown', 'in_stock', 'made_to_order', 'service_available')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'hidden', 'deleted')),
  is_verified_seller BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  CONSTRAINT product_listings_price_range_chk
    CHECK (price_type <> 'range' OR (price_min IS NOT NULL AND price_max IS NOT NULL AND price_min <= price_max))
  ,
  CONSTRAINT product_listings_publish_min_fields_chk
    CHECK (
      status <> 'published'
      OR (
        length(trim(title)) > 0
        AND length(trim(category)) > 0
        AND location_text IS NOT NULL
        AND length(trim(location_text)) > 0
      )
    )
);

ALTER TABLE public.product_listings ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_product_listings_status_category
  ON public.product_listings (status, category);

CREATE INDEX IF NOT EXISTS idx_product_listings_vendor_id
  ON public.product_listings (vendor_id);

CREATE INDEX IF NOT EXISTS idx_product_listings_session_id
  ON public.product_listings (session_id);

CREATE INDEX IF NOT EXISTS idx_product_listings_created_at_desc
  ON public.product_listings (created_at DESC);

-- =============================================================================
-- listing_inquiries: buyer -> seller messages for a listing
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.listing_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.product_listings(id) ON DELETE CASCADE,
  buyer_session_id UUID NOT NULL REFERENCES public.web_sessions(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'replied', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.listing_inquiries ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_listing_inquiries_listing_id
  ON public.listing_inquiries (listing_id);

CREATE INDEX IF NOT EXISTS idx_listing_inquiries_buyer_session_id
  ON public.listing_inquiries (buyer_session_id);

CREATE INDEX IF NOT EXISTS idx_listing_inquiries_created_at_desc
  ON public.listing_inquiries (created_at DESC);

-- =============================================================================
-- listing_verification_requests: seller requests to become a verified vendor
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.listing_verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.product_listings(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.web_sessions(id) ON DELETE CASCADE,
  requested_vendor_name TEXT,
  requested_phone TEXT,
  requested_business_location TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.listing_verification_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_listing_verification_requests_listing_id
  ON public.listing_verification_requests (listing_id);

CREATE INDEX IF NOT EXISTS idx_listing_verification_requests_status
  ON public.listing_verification_requests (status, created_at DESC);

-- =============================================================================
-- web_notifications: allow notifications for listings as well as market_posts
-- (post_id becomes nullable; at least one context id must be present)
-- =============================================================================
ALTER TABLE public.web_notifications
  ALTER COLUMN post_id DROP NOT NULL;

ALTER TABLE public.web_notifications
  ADD COLUMN IF NOT EXISTS listing_id UUID REFERENCES public.product_listings(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'web_notifications_context_chk'
  ) THEN
    ALTER TABLE public.web_notifications
      ADD CONSTRAINT web_notifications_context_chk
      CHECK (post_id IS NOT NULL OR listing_id IS NOT NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_web_notifications_listing_id
  ON public.web_notifications (listing_id);

COMMIT;
