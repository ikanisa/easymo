-- Create listing_sources table
CREATE TABLE IF NOT EXISTS public.listing_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('jobs', 'real_estate')),
    source_type TEXT CHECK (source_type IN ('google_search', 'rss', 'direct')),
    config JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    last_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Rwanda Jobs Source
INSERT INTO public.listing_sources (name, type, source_type, config, is_active)
VALUES (
  'Rwanda Jobs Search',
  'jobs',
  'google_search',
  '{
    "country": "Rwanda",
    "queries": [
      "jobs in Rwanda",
      "jobs in Kigali",
      "remote jobs Rwanda",
      "driver jobs Kigali",
      "construction jobs Rwanda",
      "waiter jobs Kigali",
      "security jobs Rwanda",
      "site:linkedin.com/jobs Rwanda",
      "site:jobinrwanda.com",
      "site:umucyo.gov.rw",
      "site:tohoza.com jobs"
    ]
  }'::jsonb,
  true
)
ON CONFLICT DO NOTHING;

-- Insert Rwanda Real Estate Source
INSERT INTO public.listing_sources (name, type, source_type, config, is_active)
VALUES (
  'Rwanda Real Estate Search',
  'real_estate',
  'google_search',
  '{
    "country": "Rwanda",
    "queries": [
      "apartments for rent Kigali",
      "houses for sale Kigali",
      "land for sale Rwanda",
      "commercial property for rent Kigali",
      "site:airbnb.com Rwanda",
      "site:booking.com hotels Rwanda",
      "site:hotels.com Rwanda",
      "site:plaka.rw",
      "site:igihe.com real estate",
      "site:tohoza.com real estate"
    ]
  }'::jsonb,
  true
)
ON CONFLICT DO NOTHING;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
