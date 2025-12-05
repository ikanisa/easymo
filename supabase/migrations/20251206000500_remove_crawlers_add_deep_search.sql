BEGIN;

-- ============================================================================
-- REMOVE WEB CRAWLING INFRASTRUCTURE - TRANSITION TO DEEP SEARCH API
-- ============================================================================
-- This migration removes all web scraping/crawling tables and functions
-- New architecture: Real-time Deep Search API calls instead of stored data
-- Keep: Source URL tables (job_sources, real_estate_sources) for targeting
-- Remove: External listings tables, crawling jobs, scraping infrastructure
-- ============================================================================

-- ============================================================================
-- 1. DROP EXTERNAL LISTINGS TABLES (No longer storing scraped data)
-- ============================================================================

-- Jobs external listings (from old web scraping)
DROP TABLE IF EXISTS jobs_external_listings CASCADE;

-- Real estate external listings (from old web scraping)
DROP TABLE IF EXISTS real_estate_external_listings CASCADE;

-- Any other scraping result tables
DROP TABLE IF EXISTS scraped_job_listings CASCADE;
DROP TABLE IF EXISTS scraped_property_listings CASCADE;
DROP TABLE IF EXISTS scraping_jobs CASCADE;
DROP TABLE IF EXISTS scraping_results CASCADE;

-- ============================================================================
-- 2. REMOVE CRON JOBS (Scheduled scraping)
-- ============================================================================

-- Remove all scraping-related cron jobs
DO $$
BEGIN
  -- Job scraping cron
  PERFORM cron.unschedule('job-sources-sync')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'job-sources-sync');
  
  PERFORM cron.unschedule('daily-job-scraper')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-job-scraper');
  
  -- Property scraping cron
  PERFORM cron.unschedule('property-sources-sync')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'property-sources-sync');
  
  PERFORM cron.unschedule('daily-property-scraper')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-property-scraper');
  
  -- Source URL scraper
  PERFORM cron.unschedule('source-url-scraper')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'source-url-scraper');
EXCEPTION
  WHEN undefined_table THEN NULL; -- cron extension not installed
END $$;

-- ============================================================================
-- 3. KEEP SOURCE URL TABLES (Used for Deep Search targeting)
-- ============================================================================

-- These tables are KEPT - they define where Deep Search should look
-- ✅ job_sources
-- ✅ real_estate_sources  
-- ✅ farmers_sources

-- Add helper comment to clarify usage
COMMENT ON TABLE job_sources IS 'Source URLs for OpenAI Deep Search to target when searching for jobs. NOT for storing scraped data.';
COMMENT ON TABLE real_estate_sources IS 'Source URLs for OpenAI Deep Search to target when searching for properties. NOT for storing scraped data.';
COMMENT ON TABLE farmers_sources IS 'Source URLs for OpenAI Deep Search to target when searching for agricultural markets. NOT for storing scraped data.';

-- ============================================================================
-- 4. UPDATE DEEP RESEARCH TABLES (Already exist, just add comments)
-- ============================================================================

-- These tables track Deep Search API calls and results
COMMENT ON TABLE deep_research_jobs IS 'Tracks OpenAI Deep Research API calls initiated by AI agents. Results are returned in real-time, not stored long-term.';
COMMENT ON TABLE deep_research_results IS 'Temporary storage for Deep Research API results. Used for immediate agent processing, then can be cleaned up.';

-- ============================================================================
-- 5. ADD CLEANUP POLICY (Auto-delete old research results)
-- ============================================================================

-- Clean up old deep research results (keep only 7 days for debugging)
CREATE OR REPLACE FUNCTION cleanup_old_deep_research_results()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM deep_research_results
  WHERE created_at < NOW() - INTERVAL '7 days';
  
  DELETE FROM deep_research_jobs
  WHERE status IN ('succeeded', 'failed', 'cancelled')
    AND created_at < NOW() - INTERVAL '7 days';
END;
$$;

-- Schedule cleanup (if cron extension available)
DO $$
BEGIN
  PERFORM cron.schedule(
    'cleanup-old-deep-research',
    '0 2 * * *', -- Daily at 2 AM
    $cron$SELECT cleanup_old_deep_research_results()$cron$
  );
EXCEPTION
  WHEN undefined_table THEN NULL; -- cron extension not installed
  WHEN undefined_function THEN NULL; -- cron.schedule not available
END $$;

-- ============================================================================
-- 6. ADD INDEXES FOR PERFORMANCE
-- ============================================================================

-- Indexes for source URL lookups (used frequently by Deep Search)
CREATE INDEX IF NOT EXISTS idx_job_sources_country_active 
  ON job_sources(country, is_active) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_real_estate_sources_country_active 
  ON real_estate_sources(country, is_active) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_farmers_sources_country_active 
  ON farmers_sources(country, is_active) 
  WHERE is_active = true;

-- Indexes for source type filtering
CREATE INDEX IF NOT EXISTS idx_job_sources_type 
  ON job_sources(source_type) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_real_estate_sources_type 
  ON real_estate_sources(source_type) 
  WHERE is_active = true;

-- ============================================================================
-- 7. CREATE HELPER FUNCTIONS FOR DEEP SEARCH INTEGRATION
-- ============================================================================

-- Get job sources for Deep Search API targeting
CREATE OR REPLACE FUNCTION get_job_sources_for_deep_search(
  p_country TEXT DEFAULT 'RW',
  p_category TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  name TEXT,
  url TEXT,
  search_url_template TEXT,
  priority INTEGER,
  trust_score NUMERIC
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    js.name,
    js.url,
    js.search_url_template,
    js.priority,
    js.trust_score
  FROM job_sources js
  WHERE js.is_active = true
    AND (p_country IS NULL OR js.country = p_country)
    AND (p_category IS NULL OR p_category = ANY(js.job_categories))
  ORDER BY js.priority DESC, js.trust_score DESC
  LIMIT p_limit;
END;
$$;

-- Get real estate sources for Deep Search API targeting
CREATE OR REPLACE FUNCTION get_real_estate_sources_for_deep_search(
  p_country TEXT DEFAULT 'RW',
  p_area TEXT DEFAULT NULL,
  p_property_type TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  name TEXT,
  url TEXT,
  search_url_template TEXT,
  priority INTEGER,
  trust_score NUMERIC
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    res.name,
    res.url,
    res.search_url_template,
    res.priority,
    res.trust_score
  FROM real_estate_sources res
  WHERE res.is_active = true
    AND (p_country IS NULL OR res.country = p_country)
    AND (p_area IS NULL OR p_area = ANY(res.coverage_areas))
    AND (p_property_type IS NULL OR p_property_type = ANY(res.property_types))
  ORDER BY res.priority DESC, res.trust_score DESC
  LIMIT p_limit;
END;
$$;

-- Get farmers sources for Deep Search API targeting
CREATE OR REPLACE FUNCTION get_farmers_sources_for_deep_search(
  p_country TEXT DEFAULT 'RW',
  p_produce_category TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  name TEXT,
  url TEXT,
  priority INTEGER,
  trust_score NUMERIC
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    fs.name,
    fs.url,
    fs.priority,
    fs.trust_score
  FROM farmers_sources fs
  WHERE fs.is_active = true
    AND (p_country IS NULL OR fs.country = p_country)
    AND (p_produce_category IS NULL OR p_produce_category = ANY(fs.produce_categories))
  ORDER BY fs.priority DESC, fs.trust_score DESC
  LIMIT p_limit;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_job_sources_for_deep_search TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_real_estate_sources_for_deep_search TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_farmers_sources_for_deep_search TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_deep_research_results TO service_role;

-- ============================================================================
-- 8. VERIFY CLEANUP
-- ============================================================================

DO $$
DECLARE
  table_count INTEGER;
BEGIN
  -- Verify external listings tables are gone
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('jobs_external_listings', 'real_estate_external_listings', 'scraped_job_listings', 'scraped_property_listings');
  
  IF table_count > 0 THEN
    RAISE EXCEPTION 'Scraping tables still exist after cleanup';
  END IF;
  
  -- Verify source tables still exist
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('job_sources', 'real_estate_sources', 'farmers_sources');
  
  IF table_count != 3 THEN
    RAISE EXCEPTION 'Source URL tables are missing';
  END IF;
  
  RAISE NOTICE 'Cleanup successful: Scraping tables removed, source URL tables preserved';
END $$;

COMMIT;
