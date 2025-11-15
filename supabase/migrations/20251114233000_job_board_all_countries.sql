-- =====================================================
-- JOB BOARD: EXTEND TO ALL COUNTRIES
-- =====================================================
-- Extends job board support to all countries in the countries table
-- Dynamically generates job source queries for each country
-- =====================================================

BEGIN;

-- =====================================================
-- 1. Add job board to all countries' menu items
-- =====================================================

-- Get all active countries and update menu item
UPDATE whatsapp_home_menu_items
SET active_countries = (
  SELECT array_agg(code)
  FROM countries
  WHERE is_active = true
)
WHERE key = 'jobs';

-- =====================================================
-- 2. Create dynamic job source queries for all countries
-- =====================================================

-- Function to generate job queries for a country
CREATE OR REPLACE FUNCTION generate_country_job_queries(
  p_country_code text,
  p_country_name text,
  p_currency text
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  queries jsonb;
BEGIN
  -- Generate standard job queries for each country
  queries := jsonb_build_array(
    -- One-day gigs
    jsonb_build_object(
      'country', p_country_code,
      'query', format('one day casual jobs in %s', p_country_name),
      'kind', 'one_day',
      'currency', p_currency
    ),
    -- Part-time jobs
    jsonb_build_object(
      'country', p_country_code,
      'query', format('part time jobs in %s', p_country_name),
      'kind', 'part_time',
      'currency', p_currency
    ),
    -- Short-term contract work
    jsonb_build_object(
      'country', p_country_code,
      'query', format('short term contract work %s', p_country_name),
      'kind', 'contract',
      'currency', p_currency
    ),
    -- Delivery/driver jobs (common gig economy)
    jsonb_build_object(
      'country', p_country_code,
      'query', format('delivery driver jobs %s', p_country_name),
      'kind', 'gig',
      'category', 'delivery',
      'currency', p_currency
    ),
    -- Hospitality jobs (popular in tourism countries)
    jsonb_build_object(
      'country', p_country_code,
      'query', format('restaurant waiter hospitality jobs %s', p_country_name),
      'kind', 'part_time',
      'category', 'cooking',
      'currency', p_currency
    ),
    -- General full-time
    jsonb_build_object(
      'country', p_country_code,
      'query', format('jobs in %s', p_country_name),
      'kind', 'full_time',
      'currency', p_currency
    )
  );
  
  RETURN queries;
END;
$$;

-- =====================================================
-- 3. Update OpenAI Deep Search source with all countries
-- =====================================================

DO $$
DECLARE
  all_queries jsonb := '[]'::jsonb;
  country_rec record;
BEGIN
  -- Loop through all active countries
  FOR country_rec IN 
    SELECT code, name, currency_code
    FROM countries
    WHERE is_active = true
    ORDER BY code
  LOOP
    -- Generate queries for this country and append
    all_queries := all_queries || generate_country_job_queries(
      country_rec.code,
      country_rec.name,
      country_rec.currency_code
    );
  END LOOP;
  
  -- Update the OpenAI Deep Search source
  UPDATE job_sources
  SET 
    config = jsonb_build_object('queries', all_queries),
    updated_at = now()
  WHERE source_type = 'openai_deep_search';
END;
$$;

-- =====================================================
-- 4. Update SerpAPI source with all countries
-- =====================================================

DO $$
DECLARE
  all_queries jsonb := '[]'::jsonb;
  country_rec record;
BEGIN
  -- Loop through all active countries
  FOR country_rec IN 
    SELECT code, name
    FROM countries
    WHERE is_active = true
    ORDER BY code
  LOOP
    -- Add general job search query for each country
    all_queries := all_queries || jsonb_build_array(
      jsonb_build_object(
        'country', country_rec.code,
        'query', format('jobs in %s', country_rec.name)
      ),
      jsonb_build_object(
        'country', country_rec.code,
        'query', format('part time work %s', country_rec.name)
      ),
      jsonb_build_object(
        'country', country_rec.code,
        'query', format('gig economy jobs %s', country_rec.name)
      )
    );
  END LOOP;
  
  -- Update the SerpAPI source
  UPDATE job_sources
  SET 
    config = jsonb_build_object('queries', all_queries),
    updated_at = now()
  WHERE source_type = 'serpapi';
END;
$$;

-- =====================================================
-- 5. Add country-specific job categories
-- =====================================================

CREATE TABLE IF NOT EXISTS job_categories_by_country (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL REFERENCES countries(code),
  category_key text NOT NULL,
  label_en text NOT NULL,
  label_fr text,
  label_local text, -- Kinyarwanda, Swahili, Arabic, etc.
  is_popular boolean DEFAULT false, -- Highlight popular categories per country
  display_order int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(country_code, category_key)
);

CREATE INDEX job_categories_country_idx ON job_categories_by_country(country_code);
CREATE INDEX job_categories_popular_idx ON job_categories_by_country(country_code, is_popular) WHERE is_popular = true;

-- =====================================================
-- 6. Seed common job categories for all countries
-- =====================================================

-- Function to seed categories for a country
CREATE OR REPLACE FUNCTION seed_job_categories_for_country(p_country_code text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO job_categories_by_country (country_code, category_key, label_en, label_fr, is_popular, display_order)
  VALUES
    (p_country_code, 'delivery', 'Delivery & Transport', 'Livraison & Transport', true, 1),
    (p_country_code, 'cleaning', 'Cleaning & Housekeeping', 'Nettoyage & Ménage', true, 2),
    (p_country_code, 'cooking', 'Hospitality & Food Service', 'Hôtellerie & Restauration', true, 3),
    (p_country_code, 'construction', 'Construction & Labor', 'Construction & Main d''œuvre', true, 4),
    (p_country_code, 'security', 'Security & Safety', 'Sécurité', true, 5),
    (p_country_code, 'childcare', 'Childcare & Babysitting', 'Garde d''enfants', false, 6),
    (p_country_code, 'tutoring', 'Tutoring & Teaching', 'Tutorat & Enseignement', false, 7),
    (p_country_code, 'sales', 'Sales & Marketing', 'Ventes & Marketing', true, 8),
    (p_country_code, 'data_entry', 'Admin & Data Entry', 'Administration & Saisie', false, 9),
    (p_country_code, 'igaming', 'iGaming & Customer Support', 'iGaming & Support Client', false, 10),
    (p_country_code, 'healthcare', 'Healthcare & Nursing', 'Santé & Soins', false, 11),
    (p_country_code, 'gardening', 'Gardening & Landscaping', 'Jardinage & Aménagement', false, 12),
    (p_country_code, 'event_support', 'Event Support & Catering', 'Événements & Traiteur', false, 13),
    (p_country_code, 'tech', 'Technology & IT', 'Technologie & IT', false, 14),
    (p_country_code, 'other', 'Other Services', 'Autres Services', false, 99)
  ON CONFLICT (country_code, category_key) DO NOTHING;
END;
$$;

-- Seed categories for all active countries
DO $$
DECLARE
  country_rec record;
BEGIN
  FOR country_rec IN SELECT code FROM countries WHERE is_active = true
  LOOP
    PERFORM seed_job_categories_for_country(country_rec.code);
  END LOOP;
END;
$$;

-- =====================================================
-- 7. Add Kinyarwanda labels for Rwanda
-- =====================================================

UPDATE job_categories_by_country
SET label_local = CASE category_key
  WHEN 'delivery' THEN 'Gutanga no Gutwara'
  WHEN 'cleaning' THEN 'Isuku n''Ubusuku'
  WHEN 'cooking' THEN 'Guteka n''Amahoteri'
  WHEN 'construction' THEN 'Ubwubatsi n''Umurimo'
  WHEN 'security' THEN 'Umutekano'
  WHEN 'childcare' THEN 'Kwitwararika Abana'
  WHEN 'tutoring' THEN 'Kwigisha'
  WHEN 'sales' THEN 'Kugurisha'
  WHEN 'data_entry' THEN 'Kwandika Amakuru'
  WHEN 'healthcare' THEN 'Ubuzima n''Ubuvuzi'
  WHEN 'gardening' THEN 'Ubuhinzi n''Ubusitani'
  WHEN 'event_support' THEN 'Ibirori n''Ibyabugeni'
  WHEN 'tech' THEN 'Ikoranabuhanga'
  WHEN 'other' THEN 'Ibindi Bikorwa'
  ELSE label_en
END
WHERE country_code = 'RW';

-- =====================================================
-- 8. Create view for active job listings with country info
-- =====================================================

CREATE OR REPLACE VIEW job_listings_with_country AS
SELECT 
  jl.*,
  c.code as country_code,
  c.name as country_name,
  c.currency_code,
  c.currency_symbol,
  c.flag_emoji,
  jcc.label_en as category_label_en,
  jcc.label_fr as category_label_fr,
  jcc.label_local as category_label_local
FROM job_listings jl
LEFT JOIN countries c ON jl.location ILIKE '%' || c.name || '%' OR jl.location ILIKE '%' || c.code || '%'
LEFT JOIN job_categories_by_country jcc ON c.code = jcc.country_code AND jl.category = jcc.category_key
WHERE jl.status = 'open'
  AND (jl.expires_at IS NULL OR jl.expires_at > now());

-- =====================================================
-- 9. Add function to get country from location text
-- =====================================================

CREATE OR REPLACE FUNCTION detect_country_from_location(location_text text)
RETURNS text
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  detected_code text;
BEGIN
  -- Try to match country name or code in location text
  SELECT code INTO detected_code
  FROM countries
  WHERE 
    is_active = true
    AND (
      location_text ILIKE '%' || name || '%'
      OR location_text ILIKE '%' || code || '%'
    )
  ORDER BY 
    -- Prefer exact matches
    CASE 
      WHEN location_text ILIKE name THEN 1
      WHEN location_text ILIKE code THEN 2
      ELSE 3
    END,
    length(name) DESC
  LIMIT 1;
  
  RETURN detected_code;
END;
$$;

-- =====================================================
-- 10. Add country code to existing job listings
-- =====================================================

-- Add country_code column if not exists
ALTER TABLE job_listings
  ADD COLUMN IF NOT EXISTS country_code text REFERENCES countries(code);

CREATE INDEX IF NOT EXISTS job_listings_country_code_idx ON job_listings(country_code);

-- Try to detect and update country codes for existing jobs
UPDATE job_listings
SET country_code = detect_country_from_location(location)
WHERE country_code IS NULL AND location IS NOT NULL;

-- =====================================================
-- 11. Update matching function to support country filtering
-- =====================================================

DROP FUNCTION IF EXISTS match_jobs_for_seeker(vector(1536), uuid, float, int, job_type[], text[], numeric);

CREATE OR REPLACE FUNCTION match_jobs_for_seeker(
  query_embedding vector(1536),
  seeker_org_id uuid DEFAULT NULL,
  seeker_country_code text DEFAULT NULL,
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
  country_code text,
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
    jl.country_code,
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
    -- Country filtering: prefer same country, but allow all if not specified
    AND (
      seeker_country_code IS NULL 
      OR jl.country_code IS NULL
      OR jl.country_code = seeker_country_code
      OR jl.is_external = true
    )
    -- Org scoping: match within org OR global external jobs
    AND (
      seeker_org_id IS NULL 
      OR jl.org_id IS NULL 
      OR jl.org_id = seeker_org_id
      OR jl.is_external = true
    )
  ORDER BY 
    -- Prioritize same country
    CASE WHEN seeker_country_code IS NOT NULL AND jl.country_code = seeker_country_code THEN 0 ELSE 1 END,
    -- Then by similarity
    jl.required_skills_embedding <=> query_embedding
  LIMIT match_count;
$$;

-- =====================================================
-- 12. Add country tracking to job_seekers
-- =====================================================

ALTER TABLE job_seekers
  ADD COLUMN IF NOT EXISTS country_code text REFERENCES countries(code);

CREATE INDEX IF NOT EXISTS job_seekers_country_code_idx ON job_seekers(country_code);

-- Try to detect country from phone numbers
UPDATE job_seekers js
SET country_code = c.code
FROM countries c
WHERE 
  js.country_code IS NULL
  AND js.phone_number LIKE c.phone_prefix || '%';

-- =====================================================
-- 13. Add function to auto-update job sources for new countries
-- =====================================================

CREATE OR REPLACE FUNCTION refresh_job_sources_for_all_countries()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  all_queries jsonb := '[]'::jsonb;
  country_rec record;
BEGIN
  -- OpenAI Deep Search queries
  FOR country_rec IN 
    SELECT code, name, currency_code
    FROM countries
    WHERE is_active = true
    ORDER BY code
  LOOP
    all_queries := all_queries || generate_country_job_queries(
      country_rec.code,
      country_rec.name,
      country_rec.currency_code
    );
  END LOOP;
  
  UPDATE job_sources
  SET 
    config = jsonb_build_object('queries', all_queries),
    updated_at = now()
  WHERE source_type = 'openai_deep_search';
  
  -- SerpAPI queries
  all_queries := '[]'::jsonb;
  
  FOR country_rec IN 
    SELECT code, name
    FROM countries
    WHERE is_active = true
    ORDER BY code
  LOOP
    all_queries := all_queries || jsonb_build_array(
      jsonb_build_object(
        'country', country_rec.code,
        'query', format('jobs in %s', country_rec.name)
      ),
      jsonb_build_object(
        'country', country_rec.code,
        'query', format('part time work %s', country_rec.name)
      )
    );
  END LOOP;
  
  UPDATE job_sources
  SET 
    config = jsonb_build_object('queries', all_queries),
    updated_at = now()
  WHERE source_type = 'serpapi';
END;
$$;

-- =====================================================
-- 14. Add trigger to refresh sources when countries change
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_refresh_job_sources()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM refresh_job_sources_for_all_countries();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER countries_changed_refresh_job_sources
  AFTER INSERT OR UPDATE OR DELETE ON countries
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_refresh_job_sources();

-- =====================================================
-- 15. Add comments for documentation
-- =====================================================

COMMENT ON TABLE job_categories_by_country IS 
  'Country-specific job categories with localized labels. Auto-seeded for all active countries.';

COMMENT ON FUNCTION generate_country_job_queries IS 
  'Generates standard job search queries for OpenAI Deep Search and SerpAPI for a given country.';

COMMENT ON FUNCTION refresh_job_sources_for_all_countries IS 
  'Regenerates all job source queries for all active countries. Run when adding new countries.';

COMMENT ON FUNCTION detect_country_from_location IS 
  'Attempts to extract country code from free-text location string using countries table.';

COMMENT ON VIEW job_listings_with_country IS 
  'Enriched job listings view with country information and localized category labels.';

COMMIT;
