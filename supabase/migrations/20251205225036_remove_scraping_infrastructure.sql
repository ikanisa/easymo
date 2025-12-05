-- ============================================================================
-- REMOVE SCRAPING INFRASTRUCTURE
-- Ref: https://github.com/ikanisa/easymo/issues/514
-- 
-- This migration removes the web scraping/crawling infrastructure in favor of
-- direct OpenAI Deep Search API calls per user request. External web data
-- should NOT be stored in our database - only user-created listings are stored.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. UNSCHEDULE CRON JOBS
-- Remove any scheduled jobs related to scraping, crawling, or syncing
-- ============================================================================

DO $$
DECLARE
  job_record RECORD;
BEGIN
  -- Check if pg_cron extension is available
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Unschedule any scraper/crawler/sync jobs
    FOR job_record IN 
      SELECT jobname FROM cron.job 
      WHERE jobname ILIKE '%scraper%' 
         OR jobname ILIKE '%crawler%' 
         OR jobname ILIKE '%sync%'
         OR jobname ILIKE '%scraping%'
    LOOP
      EXECUTE format('SELECT cron.unschedule(%L)', job_record.jobname);
      RAISE NOTICE 'Unscheduled cron job: %', job_record.jobname;
    END LOOP;
  END IF;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'pg_cron not available or no jobs to unschedule: %', SQLERRM;
END $$;

-- ============================================================================
-- 2. DROP EXTERNAL LISTINGS TABLES
-- These tables stored scraped external data - no longer needed
-- ============================================================================

DROP TABLE IF EXISTS jobs_external_listings CASCADE;
DROP TABLE IF EXISTS real_estate_external_listings CASCADE;

-- ============================================================================
-- 3. KEEP SOURCE TABLES (for Deep Search targeting)
-- These tables store the URLs that Deep Search will target - DO NOT DELETE:
-- - job_sources
-- - real_estate_sources  
-- - farmers_sources
-- ============================================================================

-- Add comment explaining new purpose
COMMENT ON TABLE job_sources IS 'URLs of job websites for OpenAI Deep Search to query in real-time. No data is stored from these sites.';
COMMENT ON TABLE real_estate_sources IS 'URLs of property websites for OpenAI Deep Search to query in real-time. No data is stored from these sites.';
COMMENT ON TABLE farmers_sources IS 'URLs of agricultural market websites for OpenAI Deep Search to query in real-time.';

-- Disable crawling-related columns (set defaults to indicate no longer used)
DO $$
BEGIN
  -- Disable crawling on all job sources
  UPDATE job_sources SET crawl_enabled = false WHERE crawl_enabled = true;
  UPDATE real_estate_sources SET crawl_enabled = false WHERE crawl_enabled = true;
  UPDATE farmers_sources SET crawl_enabled = false WHERE crawl_enabled = true;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Could not update crawl_enabled columns: %', SQLERRM;
END $$;

COMMIT;
