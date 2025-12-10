BEGIN;

-- Ensure job_sources table has needed structure
ALTER TABLE public.job_sources 
ADD COLUMN IF NOT EXISTS crawl_strategy text DEFAULT 'openai_web_search',
ADD COLUMN IF NOT EXISTS crawl_frequency_hours integer DEFAULT 24;

-- Seed Malta Job Sources
INSERT INTO public.job_sources (name, url, country_code, crawl_strategy) VALUES
('Keepmeposted Malta', 'https://www.keepmeposted.com.mt', 'MT', 'openai_web_search'),
('Maltapark Jobs', 'https://www.maltapark.com/jobs', 'MT', 'openai_web_search'),
('Konnekt', 'https://www.konnekt.com', 'MT', 'openai_web_search'),
('Jobsplus Malta', 'https://jobsplus.gov.mt', 'MT', 'openai_web_search'),
('Ceek Recruitment', 'https://ceek.com.mt', 'MT', 'openai_web_search'),
('VacancyCentre', 'https://vacancycentre.com', 'MT', 'openai_web_search'),
('Broadwing', 'https://broadwing.jobs', 'MT', 'openai_web_search'),
('Castille Resources', 'https://castilleresources.com', 'MT', 'openai_web_search'),
('Spotlight Recruitment', 'https://spotlight.com.mt', 'MT', 'openai_web_search'),
('Crossroads Recruitment', 'https://crossroads.com.mt', 'MT', 'openai_web_search')
ON CONFLICT (url) DO UPDATE SET 
crawl_strategy = EXCLUDED.crawl_strategy,
country_code = EXCLUDED.country_code;

-- Seed Rwanda Job Sources
INSERT INTO public.job_sources (name, url, country_code, crawl_strategy) VALUES
('Job in Rwanda', 'https://www.jobinrwanda.com', 'RW', 'openai_web_search'),
('Umurimo', 'https://umurimo.com', 'RW', 'openai_web_search'),
('Kigali Job News', 'https://kigalijobnews.com', 'RW', 'openai_web_search'),
('Rwanda Job', 'https://www.rwandajob.com', 'RW', 'openai_web_search')
ON CONFLICT (url) DO UPDATE SET 
crawl_strategy = EXCLUDED.crawl_strategy,
country_code = EXCLUDED.country_code;

COMMIT;
