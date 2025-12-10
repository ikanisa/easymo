BEGIN;

-- Seed Additional Malta Job Sources
INSERT INTO public.job_sources (name, url, country_code, crawl_strategy) VALUES
('JobsinMalta', 'https://jobsinmalta.com', 'MT', 'openai_web_search'),
('Pentasia iGaming', 'https://www.pentasia.com/jobs/malta', 'MT', 'openai_web_search'),
('Betting Connections', 'https://www.bettingconnections.com/jobs', 'MT', 'openai_web_search'),
('Reed Malta', 'https://www.reed.co.uk/jobs/jobs-in-malta', 'MT', 'openai_web_search'),
('MaltaJobs.com.mt', 'https://www.maltajobs.com.mt', 'MT', 'openai_web_search'),
('Muovo', 'https://muovo.eu/jobs', 'MT', 'openai_web_search'),
('Boston Link', 'https://www.boston-link.com/jobs', 'MT', 'openai_web_search'),
('Archer IT Recruitment', 'https://www.archer.com.mt', 'MT', 'openai_web_search'),
('Basis Specialist Recruitment', 'https://www.basis.com.mt', 'MT', 'openai_web_search'),
('Egg Recruitment', 'https://egg.com.mt', 'MT', 'openai_web_search')
ON CONFLICT (url) DO UPDATE SET 
crawl_strategy = EXCLUDED.crawl_strategy,
country_code = EXCLUDED.country_code;

COMMIT;
