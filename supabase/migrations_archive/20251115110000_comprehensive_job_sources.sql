-- =====================================================
-- COMPREHENSIVE JOB SOURCES FOR MALTA & RWANDA
-- =====================================================
-- Configures extensive job scraping from ALL major platforms
-- =====================================================

BEGIN;

-- Clear existing minimal sources
TRUNCATE job_sources CASCADE;

-- =====================================================
-- MALTA JOB SOURCES (Comprehensive Coverage)
-- =====================================================

-- Malta: JobsPlus (Government Employment Agency)
INSERT INTO job_sources (name, source_type, base_url, config, is_active) VALUES
('JobsPlus Malta', 'openai_deep_search', 'https://jobsplus.gov.mt', 
'{
  "queries": [
    {"country": "Malta", "city": "Valletta", "query": "jobs site:jobsplus.gov.mt Malta", "category": "all"},
    {"country": "Malta", "city": "Sliema", "query": "vacancies site:jobsplus.gov.mt hospitality", "category": "cooking"},
    {"country": "Malta", "city": "St. Julian''s", "query": "jobs site:jobsplus.gov.mt iGaming", "category": "igaming"}
  ],
  "target": "malta",
  "priority": "high"
}'::jsonb, true);

-- Malta: LinkedIn Jobs
INSERT INTO job_sources (name, source_type, base_url, config, is_active) VALUES
('LinkedIn Malta', 'serpapi', 'https://linkedin.com/jobs', 
'{
  "queries": [
    {"country": "Malta", "query": "site:linkedin.com/jobs Malta jobs", "num_results": 50},
    {"country": "Malta", "query": "site:linkedin.com/jobs Valletta jobs", "num_results": 30},
    {"country": "Malta", "query": "site:linkedin.com/jobs Malta iGaming jobs", "num_results": 30},
    {"country": "Malta", "query": "site:linkedin.com/jobs Malta hospitality jobs", "num_results": 20}
  ],
  "target": "malta",
  "priority": "high"
}'::jsonb, true);

-- Malta: Keepmeposted.com.mt (Major Malta Job Portal)
INSERT INTO job_sources (name, source_type, base_url, config, is_active) VALUES
('KeepMePosted Malta', 'openai_deep_search', 'https://keepmeposted.com.mt', 
'{
  "queries": [
    {"country": "Malta", "query": "site:keepmeposted.com.mt jobs Malta", "num_results": 50},
    {"country": "Malta", "query": "site:keepmeposted.com.mt part time Malta", "num_results": 30}
  ],
  "target": "malta"
}'::jsonb, true);

-- Malta: Castille (Malta Recruitment)
INSERT INTO job_sources (name, source_type, base_url, config, is_active) VALUES
('Castille Recruitment Malta', 'openai_deep_search', 'https://castille.com.mt', 
'{
  "queries": [
    {"country": "Malta", "query": "site:castille.com.mt vacancies Malta"}
  ]
}'::jsonb, true);

-- Malta: Reed Malta
INSERT INTO job_sources (name, source_type, base_url, config, is_active) VALUES
('Reed Malta', 'serpapi', 'https://reed.com', 
'{
  "queries": [
    {"country": "Malta", "query": "site:reed.com Malta jobs", "num_results": 30}
  ]
}'::jsonb, true);

-- Malta: JobsinMalta.com
INSERT INTO job_sources (name, source_type, base_url, config, is_active) VALUES
('JobsInMalta', 'openai_deep_search', 'https://jobsinmalta.com', 
'{
  "queries": [
    {"country": "Malta", "query": "site:jobsinmalta.com current vacancies", "num_results": 50}
  ]
}'::jsonb, true);

-- Malta: Konnekt (Recruitment Agency)
INSERT INTO job_sources (name, source_type, base_url, config, is_active) VALUES
('Konnekt Malta', 'openai_deep_search', 'https://www.konnekt.com.mt', 
'{
  "queries": [
    {"country": "Malta", "query": "site:konnekt.com.mt job vacancies Malta"}
  ]
}'::jsonb, true);

-- Malta: Indeed Malta
INSERT INTO job_sources (name, source_type, base_url, config, is_active) VALUES
('Indeed Malta', 'serpapi', 'https://mt.indeed.com', 
'{
  "queries": [
    {"country": "Malta", "query": "site:mt.indeed.com jobs Malta", "num_results": 50},
    {"country": "Malta", "query": "site:mt.indeed.com jobs Valletta", "num_results": 30}
  ]
}'::jsonb, true);

-- Malta: iGaming Jobs (Specialized)
INSERT INTO job_sources (name, source_type, base_url, config, is_active) VALUES
('iGaming Jobs Malta', 'openai_deep_search', 'https://igaming.org', 
'{
  "queries": [
    {"country": "Malta", "query": "site:igaming.org jobs Malta iGaming", "category": "igaming"},
    {"country": "Malta", "query": "Malta online gaming jobs vacancies"}
  ]
}'::jsonb, true);

-- Malta: Totaljobs
INSERT INTO job_sources (name, source_type, base_url, config, is_active) VALUES
('Totaljobs Malta', 'serpapi', 'https://totaljobs.com', 
'{
  "queries": [
    {"country": "Malta", "query": "site:totaljobs.com Malta", "num_results": 30}
  ]
}'::jsonb, true);

-- =====================================================
-- RWANDA JOB SOURCES (Comprehensive Coverage)
-- =====================================================

-- Rwanda: MyJobsinRwanda (Major Portal)
INSERT INTO job_sources (name, source_type, base_url, config, is_active) VALUES
('MyJobsinRwanda', 'openai_deep_search', 'https://www.myjobsinrwanda.com', 
'{
  "queries": [
    {"country": "Rwanda", "city": "Kigali", "query": "site:myjobsinrwanda.com jobs Kigali", "num_results": 50},
    {"country": "Rwanda", "query": "site:myjobsinrwanda.com latest vacancies Rwanda"}
  ],
  "target": "rwanda",
  "priority": "high"
}'::jsonb, true);

-- Rwanda: LinkedIn
INSERT INTO job_sources (name, source_type, base_url, config, is_active) VALUES
('LinkedIn Rwanda', 'serpapi', 'https://linkedin.com/jobs', 
'{
  "queries": [
    {"country": "Rwanda", "query": "site:linkedin.com/jobs Rwanda jobs", "num_results": 50},
    {"country": "Rwanda", "query": "site:linkedin.com/jobs Kigali jobs", "num_results": 30}
  ],
  "target": "rwanda"
}'::jsonb, true);

-- Rwanda: BrighterMonday Rwanda
INSERT INTO job_sources (name, source_type, base_url, config, is_active) VALUES
('BrighterMonday Rwanda', 'openai_deep_search', 'https://www.brightermonday.rw', 
'{
  "queries": [
    {"country": "Rwanda", "query": "site:brightermonday.rw jobs Rwanda", "num_results": 50},
    {"country": "Rwanda", "query": "site:brightermonday.rw part time jobs Kigali"}
  ],
  "target": "rwanda",
  "priority": "high"
}'::jsonb, true);

-- Rwanda: Akazi Kanoze (Youth Jobs)
INSERT INTO job_sources (name, source_type, base_url, config, is_active) VALUES
('Akazi Kanoze Rwanda', 'openai_deep_search', 'https://akazikanoze.rw', 
'{
  "queries": [
    {"country": "Rwanda", "query": "site:akazikanoze.rw job opportunities Rwanda"},
    {"country": "Rwanda", "query": "Akazi Kanoze youth jobs Rwanda Kigali"}
  ],
  "target": "rwanda"
}'::jsonb, true);

-- Rwanda: New Times Classifieds
INSERT INTO job_sources (name, source_type, base_url, config, is_active) VALUES
('New Times Rwanda Classifieds', 'openai_deep_search', 'https://newtimes.co.rw', 
'{
  "queries": [
    {"country": "Rwanda", "query": "site:newtimes.co.rw jobs vacancies classifieds"}
  ]
}'::jsonb, true);

-- Rwanda: JobinRwanda
INSERT INTO job_sources (name, source_type, base_url, config, is_active) VALUES
('JobinRwanda', 'openai_deep_search', 'https://www.jobinrwanda.com', 
'{
  "queries": [
    {"country": "Rwanda", "query": "site:jobinrwanda.com latest jobs Rwanda", "num_results": 50}
  ],
  "target": "rwanda"
}'::jsonb, true);

-- Rwanda: Indeed
INSERT INTO job_sources (name, source_type, base_url, config, is_active) VALUES
('Indeed Rwanda', 'serpapi', 'https://indeed.com', 
'{
  "queries": [
    {"country": "Rwanda", "query": "site:indeed.com jobs Rwanda", "num_results": 30},
    {"country": "Rwanda", "query": "site:indeed.com jobs Kigali", "num_results": 30}
  ]
}'::jsonb, true);

-- Rwanda: Jooble Rwanda
INSERT INTO job_sources (name, source_type, base_url, config, is_active) VALUES
('Jooble Rwanda', 'serpapi', 'https://rw.jooble.org', 
'{
  "queries": [
    {"country": "Rwanda", "query": "site:rw.jooble.org jobs", "num_results": 30}
  ]
}'::jsonb, true);

-- Rwanda: NGO Jobs
INSERT INTO job_sources (name, source_type, base_url, config, is_active) VALUES
('Rwanda NGO Jobs', 'openai_deep_search', 'https://ngojobsinafrica.org', 
'{
  "queries": [
    {"country": "Rwanda", "query": "site:ngojobsinafrica.org Rwanda jobs"},
    {"country": "Rwanda", "query": "NGO jobs Rwanda Kigali development"}
  ]
}'::jsonb, true);

-- Rwanda: Casual/Daily Work Sites
INSERT INTO job_sources (name, source_type, base_url, config, is_active) VALUES
('Rwanda Casual Jobs', 'openai_deep_search', NULL, 
'{
  "queries": [
    {"country": "Rwanda", "city": "Kigali", "query": "one day jobs Kigali Rwanda daily work", "kind": "one_day", "category": "casual"},
    {"country": "Rwanda", "city": "Kigali", "query": "part time weekend jobs Kigali", "kind": "part_time"},
    {"country": "Rwanda", "city": "Kigali", "query": "casual work delivery driver Kigali", "category": "delivery"},
    {"country": "Rwanda", "query": "housekeeping cleaning jobs Rwanda contact", "category": "cleaning"},
    {"country": "Rwanda", "query": "security guard jobs Kigali phone number", "category": "security"}
  ],
  "target": "rwanda",
  "focus": "casual_daily_gigs"
}'::jsonb, true);

-- =====================================================
-- SPECIALIZED & AGGREGATOR SOURCES
-- =====================================================

-- Google Jobs Aggregator (Malta)
INSERT INTO job_sources (name, source_type, base_url, config, is_active) VALUES
('Google Jobs Malta', 'serpapi', NULL, 
'{
  "queries": [
    {"country": "Malta", "query": "jobs in Malta hospitality", "num_results": 30},
    {"country": "Malta", "query": "jobs in Malta iGaming casino", "num_results": 30},
    {"country": "Malta", "query": "jobs in Valletta Malta", "num_results": 20},
    {"country": "Malta", "query": "part time jobs Malta", "num_results": 20}
  ],
  "engine": "google_jobs"
}'::jsonb, true);

-- Google Jobs Aggregator (Rwanda)
INSERT INTO job_sources (name, source_type, base_url, config, is_active) VALUES
('Google Jobs Rwanda', 'serpapi', NULL, 
'{
  "queries": [
    {"country": "Rwanda", "query": "jobs in Kigali Rwanda", "num_results": 30},
    {"country": "Rwanda", "query": "jobs in Rwanda hospitality", "num_results": 20},
    {"country": "Rwanda", "query": "NGO jobs Rwanda", "num_results": 20}
  ],
  "engine": "google_jobs"
}'::jsonb, true);

-- =====================================================
-- SCHEDULE: Activate pg_cron for daily sync
-- =====================================================

-- Enable pg_cron if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily job sync at 2 AM UTC
SELECT cron.schedule(
  'daily-job-sources-sync',
  '0 2 * * *', -- Every day at 2 AM UTC
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/job-sources-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
    ),
    body := jsonb_build_object('scheduled', true, 'timestamp', now())
  );
  $$
);

COMMIT;
