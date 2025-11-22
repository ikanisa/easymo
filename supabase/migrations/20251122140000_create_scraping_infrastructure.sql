CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.listing_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('jobs', 'real_estate')),
    source_type TEXT CHECK (source_type IN ('google_search', 'rss', 'direct')),
    config JSONB, -- { queries: ["..."], country: "Rwanda" }
    is_active BOOLEAN DEFAULT TRUE,
    last_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns to job_listings if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_listings' AND column_name = 'source_id') THEN
        ALTER TABLE public.job_listings ADD COLUMN source_id UUID REFERENCES public.listing_sources(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_listings' AND column_name = 'job_hash') THEN
        ALTER TABLE public.job_listings ADD COLUMN job_hash TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_listings' AND column_name = 'raw_data') THEN
        ALTER TABLE public.job_listings ADD COLUMN raw_data JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_listings' AND column_name = 'embedding') THEN
        ALTER TABLE public.job_listings ADD COLUMN embedding VECTOR(768);
    END IF;
END $$;

-- Add columns to property_listings if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'property_listings' AND column_name = 'source_id') THEN
        ALTER TABLE public.property_listings ADD COLUMN source_id UUID REFERENCES public.listing_sources(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'property_listings' AND column_name = 'property_hash') THEN
        ALTER TABLE public.property_listings ADD COLUMN property_hash TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'property_listings' AND column_name = 'raw_data') THEN
        ALTER TABLE public.property_listings ADD COLUMN raw_data JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'property_listings' AND column_name = 'embedding') THEN
        ALTER TABLE public.property_listings ADD COLUMN embedding VECTOR(768);
    END IF;
END $$;

-- Insert default sources
INSERT INTO public.listing_sources (name, type, source_type, config)
SELECT 'Rwanda Jobs Search', 'jobs', 'google_search', '{"queries": ["jobs in Rwanda", "jobs in Kigali", "driver jobs Rwanda", "construction jobs Kigali", "waiter jobs Kigali", "security jobs Rwanda"], "country": "Rwanda"}'
WHERE NOT EXISTS (SELECT 1 FROM public.listing_sources WHERE name = 'Rwanda Jobs Search');

INSERT INTO public.listing_sources (name, type, source_type, config)
SELECT 'Rwanda Real Estate Search', 'real_estate', 'google_search', '{"queries": ["apartments for rent Kigali", "houses for sale Kigali", "land for sale Rwanda", "commercial property for rent Kigali", "plots for sale Kigali"], "country": "Rwanda"}'
WHERE NOT EXISTS (SELECT 1 FROM public.listing_sources WHERE name = 'Rwanda Real Estate Search');
