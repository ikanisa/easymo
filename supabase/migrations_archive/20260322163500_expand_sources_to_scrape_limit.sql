BEGIN;

-- Increase sources-to-scrape window to avoid cross-country starvation
CREATE OR REPLACE FUNCTION get_job_sources_to_scrape(
  hours_threshold integer DEFAULT 24
)
RETURNS TABLE (
  id uuid,
  name text,
  url text,
  country_code text,
  last_scraped_at timestamptz
)
LANGUAGE sql STABLE
AS $$
  SELECT id, name, url, country_code, last_scraped_at
  FROM job_source_urls
  WHERE is_active = true
    AND (
      last_scraped_at IS NULL 
      OR last_scraped_at < now() - (hours_threshold || ' hours')::interval
    )
  ORDER BY 
    CASE WHEN last_scraped_at IS NULL THEN 0 ELSE 1 END,
    last_scraped_at ASC NULLS FIRST
  LIMIT 200;
$$;

CREATE OR REPLACE FUNCTION get_property_sources_to_scrape(
  hours_threshold integer DEFAULT 24
)
RETURNS TABLE (
  id uuid,
  name text,
  url text,
  country_code text,
  last_scraped_at timestamptz
)
LANGUAGE sql STABLE
AS $$
  SELECT id, name, url, country_code, last_scraped_at
  FROM property_source_urls
  WHERE is_active = true
    AND (
      last_scraped_at IS NULL 
      OR last_scraped_at < now() - (hours_threshold || ' hours')::interval
    )
  ORDER BY 
    CASE WHEN last_scraped_at IS NULL THEN 0 ELSE 1 END,
    last_scraped_at ASC NULLS FIRST
  LIMIT 200;
$$;

COMMIT;

