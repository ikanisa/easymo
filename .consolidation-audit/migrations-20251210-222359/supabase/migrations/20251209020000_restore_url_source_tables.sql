-- ============================================================================
-- RESTORE URL SOURCE TABLES (job_sources, real_estate_sources, farmers_sources)
-- ============================================================================
-- Migration: 20251209020000_restore_url_source_tables.sql
-- Date: 2025-12-09
-- Purpose: Restore deleted URL source tables with all seed data
-- 
-- These tables were accidentally archived and need to be restored:
-- - job_sources: Job board URLs for web scraping/searching
-- - real_estate_sources: Property portal URLs  
-- - farmers_sources: Agricultural market URLs
--
-- Original migration: 20251205130000_deep_search_sources.sql (archived)
-- ============================================================================

BEGIN;

-- ============================================================================
-- JOB SOURCES - Websites to search for jobs
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.job_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source identification
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  domain TEXT GENERATED ALWAYS AS (
    regexp_replace(url, '^https?://([^/]+).*$', '\1')
  ) STORED,
  
  -- Configuration
  country TEXT DEFAULT 'RW', -- ISO country code
  region TEXT, -- e.g., 'East Africa', 'Europe'
  source_type TEXT CHECK (source_type IN ('job_board', 'company', 'aggregator', 'government', 'ngo', 'freelance')),
  
  -- Capabilities
  supports_search BOOLEAN DEFAULT true,
  search_url_template TEXT, -- e.g., 'https://example.com/jobs?q={query}&location={location}'
  api_available BOOLEAN DEFAULT false,
  api_endpoint TEXT,
  api_key_env TEXT, -- Environment variable name for API key
  
  -- Crawling settings
  crawl_frequency TEXT DEFAULT 'daily' CHECK (crawl_frequency IN ('hourly', 'daily', 'weekly', 'monthly')),
  last_crawled_at TIMESTAMPTZ,
  crawl_enabled BOOLEAN DEFAULT true,
  
  -- Priority and quality
  priority INTEGER DEFAULT 50 CHECK (priority BETWEEN 1 AND 100), -- Higher = search first
  trust_score NUMERIC(3,2) DEFAULT 0.80 CHECK (trust_score BETWEEN 0 AND 1),
  
  -- Categories
  categories TEXT[] DEFAULT '{}', -- e.g., ['tech', 'healthcare', 'hospitality']
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_job_sources_active ON public.job_sources(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_job_sources_country ON public.job_sources(country);
CREATE INDEX IF NOT EXISTS idx_job_sources_priority ON public.job_sources(priority DESC);

-- ============================================================================
-- REAL ESTATE SOURCES - Websites to search for properties
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.real_estate_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source identification
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  domain TEXT GENERATED ALWAYS AS (
    regexp_replace(url, '^https?://([^/]+).*$', '\1')
  ) STORED,
  
  -- Configuration
  country TEXT DEFAULT 'RW',
  region TEXT,
  coverage_areas TEXT[], -- e.g., ['Kigali', 'Eastern Province']
  source_type TEXT CHECK (source_type IN ('portal', 'agency', 'classifieds', 'developer', 'government')),
  
  -- Property types supported
  property_types TEXT[] DEFAULT '{}', -- e.g., ['apartment', 'house', 'land', 'commercial']
  transaction_types TEXT[] DEFAULT '{rent,buy}',
  
  -- Capabilities
  supports_search BOOLEAN DEFAULT true,
  search_url_template TEXT,
  api_available BOOLEAN DEFAULT false,
  api_endpoint TEXT,
  api_key_env TEXT,
  
  -- Crawling settings
  crawl_frequency TEXT DEFAULT 'daily' CHECK (crawl_frequency IN ('hourly', 'daily', 'weekly', 'monthly')),
  last_crawled_at TIMESTAMPTZ,
  crawl_enabled BOOLEAN DEFAULT true,
  
  -- Priority and quality
  priority INTEGER DEFAULT 50 CHECK (priority BETWEEN 1 AND 100),
  trust_score NUMERIC(3,2) DEFAULT 0.80 CHECK (trust_score BETWEEN 0 AND 1),
  
  -- Pricing info
  currency TEXT DEFAULT 'RWF',
  typical_price_min NUMERIC,
  typical_price_max NUMERIC,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_real_estate_sources_active ON public.real_estate_sources(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_real_estate_sources_country ON public.real_estate_sources(country);
CREATE INDEX IF NOT EXISTS idx_real_estate_sources_priority ON public.real_estate_sources(priority DESC);

-- ============================================================================
-- FARMERS SOURCES - Websites/markets for agricultural data
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.farmers_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  domain TEXT GENERATED ALWAYS AS (
    regexp_replace(url, '^https?://([^/]+).*$', '\1')
  ) STORED,
  
  country TEXT DEFAULT 'RW',
  region TEXT,
  source_type TEXT CHECK (source_type IN ('market', 'exchange', 'cooperative', 'government', 'ngo', 'aggregator')),
  
  -- Produce categories
  produce_categories TEXT[] DEFAULT '{}', -- e.g., ['vegetables', 'fruits', 'grains', 'dairy']
  
  -- Capabilities
  supports_search BOOLEAN DEFAULT true,
  has_price_data BOOLEAN DEFAULT false,
  has_buyer_listings BOOLEAN DEFAULT false,
  has_farmer_listings BOOLEAN DEFAULT false,
  api_available BOOLEAN DEFAULT false,
  api_endpoint TEXT,
  
  -- Crawling
  crawl_frequency TEXT DEFAULT 'daily',
  last_crawled_at TIMESTAMPTZ,
  crawl_enabled BOOLEAN DEFAULT true,
  
  priority INTEGER DEFAULT 50,
  trust_score NUMERIC(3,2) DEFAULT 0.80,
  
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_farmers_sources_active ON public.farmers_sources(is_active) WHERE is_active = true;

-- ============================================================================
-- SEED DATA - Initial Rwanda Sources (ALL URLs RESTORED)
-- ============================================================================

-- Job sources for Rwanda and region
INSERT INTO public.job_sources (name, url, country, source_type, categories, priority, notes) VALUES
  ('JobInRwanda', 'https://www.jobinrwanda.com', 'RW', 'job_board', '{"general", "tech", "finance"}', 90, 'Main Rwanda job board'),
  ('Umurava', 'https://umurava.africa', 'RW', 'job_board', '{"tech", "digital", "creative"}', 85, 'Tech-focused'),
  ('RDB Careers', 'https://rdb.rw/careers', 'RW', 'government', '{"government", "investment"}', 80, 'Rwanda Development Board'),
  ('BrighterMonday Rwanda', 'https://www.brightermonday.co.rw', 'RW', 'aggregator', '{"general"}', 75, 'Regional job aggregator'),
  ('Kigali Farms', 'https://kigalifarms.com/jobs', 'RW', 'job_board', '{"agriculture", "hospitality"}', 70, 'Hospitality and agriculture'),
  ('Indeed Malta', 'https://mt.indeed.com', 'MT', 'aggregator', '{"general"}', 85, 'Malta job listings'),
  ('JobsPlus Malta', 'https://jobsplus.gov.mt', 'MT', 'government', '{"general", "government"}', 80, 'Malta official employment service'),
  ('LinkedIn Jobs', 'https://www.linkedin.com/jobs', NULL, 'aggregator', '{"professional", "tech", "business"}', 95, 'Global professional network')
ON CONFLICT (url) DO NOTHING;

-- Real estate sources for Rwanda
INSERT INTO public.real_estate_sources (name, url, country, source_type, property_types, coverage_areas, priority, notes) VALUES
  ('Living in Kigali', 'https://www.livinginkigali.com', 'RW', 'portal', '{"apartment", "house", "commercial"}', '{"Kigali"}', 90, 'Main Kigali property portal'),
  ('Imali', 'https://imali.rw', 'RW', 'classifieds', '{"apartment", "house", "land"}', '{"Kigali", "Eastern", "Western"}', 85, 'Rwanda classifieds'),
  ('House in Rwanda', 'https://houseinrwanda.com', 'RW', 'portal', '{"apartment", "house", "land", "commercial"}', '{"Kigali", "Nationwide"}', 80, 'National coverage'),
  ('Real Estate Rwanda', 'https://realestaterwanda.com', 'RW', 'agency', '{"apartment", "house", "villa"}', '{"Kigali"}', 75, 'Kigali agency'),
  ('Jumia House Rwanda', 'https://house.jumia.rw', 'RW', 'portal', '{"apartment", "house", "land"}', '{"Kigali", "Nationwide"}', 85, 'Jumia real estate')
ON CONFLICT (url) DO NOTHING;

-- Farmers sources
INSERT INTO public.farmers_sources (name, url, country, source_type, produce_categories, priority, notes) VALUES
  ('Rwanda Agriculture Board', 'https://www.rab.gov.rw', 'RW', 'government', '{"grains", "vegetables", "fruits", "livestock"}', 90, 'Official agricultural data'),
  ('NAEB', 'https://naeb.gov.rw', 'RW', 'government', '{"coffee", "tea", "horticulture", "silk"}', 85, 'Export crops'),
  ('Twiga Foods', 'https://twiga.com', 'KE', 'aggregator', '{"vegetables", "fruits"}', 80, 'Regional B2B platform'),
  ('Fresh in a Box', 'https://freshinabox.rw', 'RW', 'aggregator', '{"vegetables", "fruits", "dairy"}', 75, 'Rwanda fresh produce')
ON CONFLICT (url) DO NOTHING;

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE public.job_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.real_estate_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farmers_sources ENABLE ROW LEVEL SECURITY;

-- Service role full access
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'job_sources' AND policyname = 'job_sources_service_all') THEN
    CREATE POLICY job_sources_service_all ON public.job_sources
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'real_estate_sources' AND policyname = 'real_estate_sources_service_all') THEN
    CREATE POLICY real_estate_sources_service_all ON public.real_estate_sources
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'farmers_sources' AND policyname = 'farmers_sources_service_all') THEN
    CREATE POLICY farmers_sources_service_all ON public.farmers_sources
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Public read access to active sources
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'job_sources' AND policyname = 'job_sources_public_read') THEN
    CREATE POLICY job_sources_public_read ON public.job_sources
      FOR SELECT TO anon, authenticated USING (is_active = true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'real_estate_sources' AND policyname = 'real_estate_sources_public_read') THEN
    CREATE POLICY real_estate_sources_public_read ON public.real_estate_sources
      FOR SELECT TO anon, authenticated USING (is_active = true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'farmers_sources' AND policyname = 'farmers_sources_public_read') THEN
    CREATE POLICY farmers_sources_public_read ON public.farmers_sources
      FOR SELECT TO anon, authenticated USING (is_active = true);
  END IF;
END $$;

-- Grant permissions
GRANT SELECT ON public.job_sources TO anon, authenticated;
GRANT SELECT ON public.real_estate_sources TO anon, authenticated;
GRANT SELECT ON public.farmers_sources TO anon, authenticated;
GRANT ALL ON public.job_sources TO service_role;
GRANT ALL ON public.real_estate_sources TO service_role;
GRANT ALL ON public.farmers_sources TO service_role;

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
DECLARE
  v_job_count INTEGER;
  v_property_count INTEGER;
  v_farmer_count INTEGER;
BEGIN
  SELECT count(*) INTO v_job_count FROM public.job_sources;
  SELECT count(*) INTO v_property_count FROM public.real_estate_sources;
  SELECT count(*) INTO v_farmer_count FROM public.farmers_sources;
  
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'URL SOURCE TABLES RESTORED';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'job_sources: % URLs', v_job_count;
  RAISE NOTICE 'real_estate_sources: % URLs', v_property_count;
  RAISE NOTICE 'farmers_sources: % URLs', v_farmer_count;
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'All URLs have been restored from archived migration';
  RAISE NOTICE '====================================================================';
END $$;

COMMIT;
