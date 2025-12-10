-- Migration script to create and populate the 'bars' table.
-- Generated at: 2025-11-12 16:50:42 UTC

BEGIN;

-- 1. Create the 'bars' table
CREATE TABLE IF NOT EXISTS public.bars (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL,
    name text NOT NULL,
    location_text text,
    country text,
    city_area text,
    currency text,
    momo_code text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT bars_slug_key UNIQUE (slug)
);

-- 2. Insert data into the 'bars' table (avoiding duplicates with ON CONFLICT)
INSERT INTO public.bars (name, location_text, country, city_area, currency, slug)
VALUES
  ('Paranga', 'Paranga, InterContinental Beach Club, InterContinental Malta, St. George''s Bay, St Julian''s STJ 3310, Malta', 'Malta', 'St Julian''s', 'EUR', 'paranga'),
  ('Le Bistro', 'Radisson Blu Resort, St. Julian''s, St Julian''s STJ 3391, Malta', 'Malta', 'St Julian''s', 'EUR', 'le-bistro'),
  ('Bahamas Pub', 'KG 18 Ave, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'bahamas-pub'),
  ('Seaside Kiosk', 'Triq It - Trunciera, San Pawl il-Baħar, Malta', 'Malta', 'San Pawl il-Baħar', 'EUR', 'seaside-kiosk'),
  ('Felice Brasserie', 'Triq Ix - Xatt, Tas-Sliema SLM 1171, Malta', 'Malta', 'Tas-Sliema', 'EUR', 'felice-brasserie')
ON CONFLICT (slug) DO NOTHING;

COMMIT;
