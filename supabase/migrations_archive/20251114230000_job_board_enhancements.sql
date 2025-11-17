-- =====================================================
-- JOB BOARD ENHANCEMENTS - Organizational Context
-- =====================================================
-- Adds org_id support and additional metadata fields
-- Run AFTER 20251114220000_job_board_system.sql
-- =====================================================

BEGIN;

-- Add organizational context to job_listings
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations') THEN
    ALTER TABLE job_listings
      ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
  ELSE
    ALTER TABLE job_listings
      ADD COLUMN IF NOT EXISTS org_id uuid;
  END IF;
END $$;

ALTER TABLE job_listings
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS onsite_remote text CHECK (onsite_remote IN ('onsite', 'remote', 'hybrid', 'unspecified')) DEFAULT 'unspecified',
  ADD COLUMN IF NOT EXISTS slots integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS job_hash text, -- for deduplication
  ADD COLUMN IF NOT EXISTS is_external boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_id uuid,
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS external_url text,
  ADD COLUMN IF NOT EXISTS discovered_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

-- Add index for org-scoped queries
CREATE INDEX IF NOT EXISTS job_listings_org_id_idx ON job_listings(org_id) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS job_listings_job_hash_idx ON job_listings(job_hash) WHERE job_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS job_listings_is_external_idx ON job_listings(is_external);

-- Add organizational context to job_seekers
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations') THEN
    ALTER TABLE job_seekers
      ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
  ELSE
    ALTER TABLE job_seekers
      ADD COLUMN IF NOT EXISTS org_id uuid;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS job_seekers_org_id_idx ON job_seekers(org_id) WHERE org_id IS NOT NULL;

-- Job sources table for external integrations
CREATE TABLE IF NOT EXISTS job_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  source_type text NOT NULL CHECK (source_type IN ('openai_deep_search', 'serpapi', 'custom_rss', 'manual')),
  base_url text,
  config jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add unique constraint to job_sources.name if not exists
DO $$ BEGIN
  ALTER TABLE job_sources ADD CONSTRAINT job_sources_name_key UNIQUE (name);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Link job_listings to sources
DO $$ BEGIN
  ALTER TABLE job_listings
    ADD CONSTRAINT job_listings_source_id_fkey 
    FOREIGN KEY (source_id) REFERENCES job_sources(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Update RLS policies to use org_id when available
DROP POLICY IF EXISTS "Public can view open job listings" ON job_listings;
DROP POLICY IF EXISTS "Users can create job listings" ON job_listings;
DROP POLICY IF EXISTS "Poster can update own job listings" ON job_listings;
DROP POLICY IF EXISTS "Poster can delete own job listings" ON job_listings;

-- New RLS policies with org_id support
CREATE POLICY "View open jobs or org jobs"
  ON job_listings FOR SELECT
  USING (
    status = 'open' 
    OR posted_by = current_setting('request.jwt.claims', true)::json->>'phone'
    OR (org_id IS NOT NULL AND org_id::text = current_setting('request.jwt.claims', true)::json->>'org_id')
  );

CREATE POLICY "Create job in own org"
  ON job_listings FOR INSERT
  WITH CHECK (
    posted_by = current_setting('request.jwt.claims', true)::json->>'phone'
    OR (org_id IS NOT NULL AND org_id::text = current_setting('request.jwt.claims', true)::json->>'org_id')
  );

CREATE POLICY "Update own or org jobs"
  ON job_listings FOR UPDATE
  USING (
    posted_by = current_setting('request.jwt.claims', true)::json->>'phone'
    OR (org_id IS NOT NULL AND org_id::text = current_setting('request.jwt.claims', true)::json->>'org_id')
  );

CREATE POLICY "Delete own or org jobs"
  ON job_listings FOR DELETE
  USING (
    posted_by = current_setting('request.jwt.claims', true)::json->>'phone'
    OR (org_id IS NOT NULL AND org_id::text = current_setting('request.jwt.claims', true)::json->>'org_id')
  );

-- Similar updates for job_seekers
DROP POLICY IF EXISTS "Users can view own seeker profile" ON job_seekers;
DROP POLICY IF EXISTS "Users can create own seeker profile" ON job_seekers;
DROP POLICY IF EXISTS "Users can update own seeker profile" ON job_seekers;

CREATE POLICY "View own or org seeker profiles"
  ON job_seekers FOR SELECT
  USING (
    phone_number = current_setting('request.jwt.claims', true)::json->>'phone'
    OR (org_id IS NOT NULL AND org_id::text = current_setting('request.jwt.claims', true)::json->>'org_id')
  );

CREATE POLICY "Create seeker in own org"
  ON job_seekers FOR INSERT
  WITH CHECK (
    phone_number = current_setting('request.jwt.claims', true)::json->>'phone'
    OR (org_id IS NOT NULL AND org_id::text = current_setting('request.jwt.claims', true)::json->>'org_id')
  );

CREATE POLICY "Update own or org seekers"
  ON job_seekers FOR UPDATE
  USING (
    phone_number = current_setting('request.jwt.claims', true)::json->>'phone'
    OR (org_id IS NOT NULL AND org_id::text = current_setting('request.jwt.claims', true)::json->>'org_id')
  );

-- Update matching functions to respect org boundaries
CREATE OR REPLACE FUNCTION match_jobs_for_seeker(
  query_embedding vector(1536),
  seeker_org_id uuid DEFAULT NULL,
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 20,
  filter_job_types job_type[] DEFAULT NULL,
  filter_categories text[] DEFAULT NULL,
  min_pay numeric DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  job_type job_type,
  category text,
  location text,
  pay_min numeric,
  pay_max numeric,
  pay_type pay_type,
  company_name text,
  is_external boolean,
  similarity_score float
)
LANGUAGE sql STABLE
AS $$
  SELECT 
    jl.id,
    jl.title,
    jl.description,
    jl.job_type,
    jl.category,
    jl.location,
    jl.pay_min,
    jl.pay_max,
    jl.pay_type,
    jl.company_name,
    jl.is_external,
    1 - (jl.required_skills_embedding <=> query_embedding) as similarity_score
  FROM job_listings jl
  WHERE 
    jl.status = 'open'
    AND jl.required_skills_embedding IS NOT NULL
    AND 1 - (jl.required_skills_embedding <=> query_embedding) > match_threshold
    AND (filter_job_types IS NULL OR jl.job_type = ANY(filter_job_types))
    AND (filter_categories IS NULL OR jl.category = ANY(filter_categories))
    AND (min_pay IS NULL OR jl.pay_max IS NULL OR jl.pay_max >= min_pay)
    AND (jl.expires_at IS NULL OR jl.expires_at > now())
    -- Org scoping: match within org OR global external jobs
    AND (
      seeker_org_id IS NULL 
      OR jl.org_id IS NULL 
      OR jl.org_id = seeker_org_id
      OR jl.is_external = true
    )
  ORDER BY jl.required_skills_embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Seed initial job sources
INSERT INTO job_sources (name, source_type, config, is_active) VALUES
  ('OpenAI Deep Search', 'openai_deep_search', '{
    "queries": [
      {"country": "RW", "city": "Kigali", "query": "one day casual jobs in Kigali"},
      {"country": "RW", "city": "Kigali", "query": "part time jobs Kigali"}
    ]
  }'::jsonb, false), -- Disabled by default until configured
  ('SerpAPI Jobs', 'serpapi', '{
    "queries": [
      {"country": "RW", "query": "jobs in Rwanda"}
    ]
  }'::jsonb, false) -- Disabled by default
ON CONFLICT (name) DO NOTHING;

-- Function to generate job hash for deduplication
CREATE OR REPLACE FUNCTION generate_job_hash(
  p_title text,
  p_company_name text,
  p_location_text text,
  p_external_url text
)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
  RETURN encode(
    sha256(
      lower(
        coalesce(p_title, '') || '|' ||
        coalesce(p_company_name, '') || '|' ||
        coalesce(p_location_text, '') || '|' ||
        coalesce(p_external_url, '')
      )::bytea
    ),
    'hex'
  );
END;
$$;

-- Trigger to auto-generate job_hash
CREATE OR REPLACE FUNCTION set_job_hash()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_external = true AND NEW.job_hash IS NULL THEN
    NEW.job_hash := generate_job_hash(
      NEW.title,
      NEW.company_name,
      NEW.location,
      NEW.external_url
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS job_listings_set_hash ON job_listings;
CREATE TRIGGER job_listings_set_hash
  BEFORE INSERT OR UPDATE ON job_listings
  FOR EACH ROW
  EXECUTE FUNCTION set_job_hash();

-- Add unique constraint for external job deduplication
CREATE UNIQUE INDEX job_listings_source_hash_uniq 
  ON job_listings(source_id, job_hash) 
  WHERE source_id IS NOT NULL AND job_hash IS NOT NULL;

COMMIT;
