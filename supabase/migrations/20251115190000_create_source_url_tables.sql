-- =====================================================
-- CREATE SOURCE URL TABLES FOR DEEP SEARCH
-- =====================================================
-- Tables to store URLs for job and property listings
-- Used by deep search to scrape and populate listings
-- =====================================================

BEGIN;

-- =====================================================
-- 1. Job Source URLs Table
-- =====================================================

CREATE TABLE IF NOT EXISTS job_source_urls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL UNIQUE,
  country_code text NOT NULL DEFAULT 'RW',
  is_active boolean NOT NULL DEFAULT true,
  scrape_frequency_hours integer DEFAULT 24,
  last_scraped_at timestamptz,
  last_success_at timestamptz,
  total_scrapes integer DEFAULT 0,
  total_jobs_found integer DEFAULT 0,
  last_error text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_source_urls_country_idx ON job_source_urls(country_code) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS job_source_urls_scrape_idx ON job_source_urls(last_scraped_at) WHERE is_active = true;

COMMENT ON TABLE job_source_urls IS 
  'Source URLs for job listing deep search. Scraped daily to populate job_listings table.';

-- =====================================================
-- 2. Property Source URLs Table
-- =====================================================

CREATE TABLE IF NOT EXISTS property_source_urls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL UNIQUE,
  country_code text NOT NULL DEFAULT 'RW',
  is_active boolean NOT NULL DEFAULT true,
  scrape_frequency_hours integer DEFAULT 24,
  last_scraped_at timestamptz,
  last_success_at timestamptz,
  total_scrapes integer DEFAULT 0,
  total_properties_found integer DEFAULT 0,
  last_error text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS property_source_urls_country_idx ON property_source_urls(country_code) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS property_source_urls_scrape_idx ON property_source_urls(last_scraped_at) WHERE is_active = true;

COMMENT ON TABLE property_source_urls IS 
  'Source URLs for property listing deep search. Scraped daily to populate property_listings table.';

-- =====================================================
-- 3. Add RLS Policies
-- =====================================================

ALTER TABLE job_source_urls ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_source_urls ENABLE ROW LEVEL SECURITY;

-- Public read access for active sources
CREATE POLICY "Anyone can view active job sources"
  ON job_source_urls FOR SELECT
  USING (is_active = true);

CREATE POLICY "Anyone can view active property sources"
  ON property_source_urls FOR SELECT
  USING (is_active = true);

-- Service role full access
CREATE POLICY "Service role can manage job sources"
  ON job_source_urls FOR ALL
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role can manage property sources"
  ON property_source_urls FOR ALL
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- 4. Insert Malta Job Sources
-- =====================================================

INSERT INTO job_source_urls (name, url, country_code) VALUES
  ('JobsPlus', 'https://jobsplus.gov.mt', 'MT'),
  ('JobsInMalta', 'https://www.jobsinmalta.com', 'MT'),
  ('Keepmeposted', 'https://www.keepmeposted.com.mt', 'MT'),
  ('Maltapark Jobs', 'https://www.maltapark.com/jobs', 'MT'),
  ('MaltaJobPort', 'https://www.maltajobport.com', 'MT'),
  ('Facebook Jobs / Marketplace (Malta)', 'https://www.facebook.com/marketplace', 'MT'),
  ('LinkedIn Jobs (Malta)', 'https://www.linkedin.com/jobs', 'MT'),
  ('Indeed Malta', 'https://www.indeed.com/q-Malta-jobs.html', 'MT'),
  ('VacancyCentre', 'https://www.vacancycentre.com', 'MT'),
  ('Konnekt', 'https://www.konnekt.com', 'MT'),
  ('JobsFactor', 'https://www.jobsfactor.eu', 'MT'),
  ('JobHound / JobHunter Malta', 'https://jobhound.mt', 'MT'),
  ('Alfred Jobs', 'https://www.alfred.com.mt', 'MT'),
  ('Jobsrar Malta', 'https://jobsrar.com', 'MT'),
  ('TopJobsMalta', 'https://www.topjobsmalta.com', 'MT'),
  ('Glassdoor (Malta)', 'https://www.glassdoor.com/Job/malta-jobs-SRCH_IL.0,5_IN156.htm', 'MT'),
  ('CareerJet Malta', 'https://www.careerjet.com.mt', 'MT'),
  ('Times of Malta Jobs', 'https://www.timesofmalta.com/jobs', 'MT'),
  ('Monster (Malta)', 'https://www.monster.com/jobs/search?q=&where=Malta', 'MT'),
  ('Maltapark Services & Gigs', 'https://www.maltapark.com/category/9', 'MT')
ON CONFLICT (url) DO UPDATE SET
  name = EXCLUDED.name,
  country_code = EXCLUDED.country_code,
  updated_at = now();

-- =====================================================
-- 5. Insert Rwanda Job Sources
-- =====================================================

INSERT INTO job_source_urls (name, url, country_code) VALUES
  ('Job in Rwanda', 'https://jobinrwanda.com', 'RW'),
  ('RwandaJob', 'https://www.rwandajob.com', 'RW'),
  ('JobWeb Rwanda', 'https://jobwebrwanda.com', 'RW'),
  ('Great Rwanda Jobs', 'https://www.greatrwandajobs.com', 'RW'),
  ('AfriCareers (Rwanda)', 'https://africareers.net', 'RW'),
  ('Kora Job Portal', 'https://jobportal.kora.rw', 'RW'),
  ('New Times Job-Market', 'https://jobs.newtimes.co.rw', 'RW'),
  ('LinkedIn Jobs (Rwanda)', 'https://www.linkedin.com/jobs', 'RW'),
  ('Facebook Jobs / Marketplace (Rwanda)', 'https://www.facebook.com/marketplace', 'RW'),
  ('Indeed Rwanda', 'https://www.indeed.com/q-Rwanda-jobs.html', 'RW'),
  ('Glassdoor (Rwanda)', 'https://www.glassdoor.com/Job/rwanda-jobs-SRCH_IL.0,6_IN208.htm', 'RW'),
  ('Umurimo', 'https://umurimo.com', 'RW'),
  ('MIFOTRA E-Recruitment', 'https://recruitment.mifotra.gov.rw', 'RW'),
  ('BrighterMonday (East Africa)', 'https://www.brightermonday.co.ke', 'RW'),
  ('Summit Recruitment & Search (Rwanda)', 'https://www.summitrecruitment-search.com', 'RW'),
  ('Q-Sourcing Servtec (Rwanda)', 'https://qsourcing.com', 'RW'),
  ('CareerJet Rwanda', 'https://www.careerjet.co.rw', 'RW'),
  ('ReliefWeb Jobs (Rwanda)', 'https://reliefweb.int/jobs/country/rwa', 'RW'),
  ('Devex Jobs (Rwanda)', 'https://www.devex.com/jobs/search?location=rwanda', 'RW'),
  ('UN Jobs in Rwanda', 'https://unjobs.org/duty_stations/rwanda', 'RW')
ON CONFLICT (url) DO UPDATE SET
  name = EXCLUDED.name,
  country_code = EXCLUDED.country_code,
  updated_at = now();

-- =====================================================
-- 6. Insert Malta Property Sources
-- =====================================================

INSERT INTO property_source_urls (name, url, country_code) VALUES
  ('PropertyMarket Malta', 'https://www.propertymarket.com.mt', 'MT'),
  ('Indomio Malta', 'https://www.indomio.com.mt', 'MT'),
  ('Maltapark Property', 'https://www.maltapark.com/property', 'MT'),
  ('Yitaku', 'https://www.yitaku.com', 'MT'),
  ('Facebook Marketplace Property (Malta)', 'https://www.facebook.com/marketplace', 'MT'),
  ('RE/MAX Malta', 'https://remax-malta.com', 'MT'),
  ('Frank Salt Real Estate', 'https://www.franksalt.com.mt', 'MT'),
  ('Dhalia Real Estate', 'https://www.dhalia.com', 'MT'),
  ('QuickLets (Rentals)', 'https://www.quicklets.com.mt', 'MT'),
  ('Zanzi Homes (Sales)', 'https://www.zanzihomes.com', 'MT'),
  ('Alliance Real Estate', 'https://alliance.mt', 'MT'),
  ('Century 21 Malta', 'https://century21.mt', 'MT'),
  ('Sara Grech Real Estate', 'https://saragrech.com', 'MT'),
  ('Malta Sotheby''s International Realty', 'https://www.maltasothebysrealty.com', 'MT'),
  ('Belair Property', 'https://www.belair.com.mt', 'MT'),
  ('Rightmove Overseas – Malta', 'https://www.rightmove.co.uk/overseas-property/in-Malta.html', 'MT'),
  ('A Place in the Sun – Malta', 'https://www.aplaceinthesun.com/malta-property', 'MT'),
  ('Times of Malta – Property Classifieds', 'https://www.timesofmalta.com/classifieds/property', 'MT'),
  ('Expat.com – Malta Housing', 'https://www.expat.com/en/housing/europe/malta', 'MT'),
  ('Airbnb – Malta Stays', 'https://www.airbnb.com/s/Malta', 'MT')
ON CONFLICT (url) DO UPDATE SET
  name = EXCLUDED.name,
  country_code = EXCLUDED.country_code,
  updated_at = now();

-- =====================================================
-- 7. Insert Rwanda Property Sources
-- =====================================================

INSERT INTO property_source_urls (name, url, country_code) VALUES
  ('House in Rwanda', 'https://www.houseinrwanda.com', 'RW'),
  ('HomeRwanda', 'https://www.homerwanda.com', 'RW'),
  ('Abahuza', 'https://www.abahuza.com', 'RW'),
  ('Century Real Estate Rwanda', 'https://www.centuryrealestategroup.com', 'RW'),
  ('Vibe House / Vibe Real Estate', 'https://vibe.rw', 'RW'),
  ('Premier Real Estate Rwanda', 'https://premierrealestate.co.rw', 'RW'),
  ('Plut Properties', 'https://www.plutproperties.com', 'RW'),
  ('Quick Homes Rwanda', 'https://quick.rw', 'RW'),
  ('Kwanda Real Estate', 'https://kwandarealestate.com', 'RW'),
  ('Elimo Real Estate', 'https://elimo.rw', 'RW'),
  ('Marchal Real Estate', 'https://marchalestate.com', 'RW'),
  ('Facebook Marketplace Property (Rwanda)', 'https://www.facebook.com/marketplace', 'RW'),
  ('Homeland Real Estate', 'https://homeland.rw', 'RW'),
  ('Deluxe Properties Rwanda', 'https://deluxepropertiesrw.com', 'RW'),
  ('Mucuruzi – Real Estate Listings', 'https://mucuruzi.com', 'RW'),
  ('Expat.com – Rwanda Housing', 'https://www.expat.com/en/housing/africa/rwanda', 'RW'),
  ('Airbnb – Rwanda Stays', 'https://www.airbnb.com/s/Rwanda', 'RW'),
  ('Imara Properties', 'https://imara.rw', 'RW'),
  ('Vision City Kigali', 'https://www.visioncity.rw', 'RW'),
  ('RSSB Real Estate', 'https://www.rssb.rw/real-estate', 'RW')
ON CONFLICT (url) DO UPDATE SET
  name = EXCLUDED.name,
  country_code = EXCLUDED.country_code,
  updated_at = now();

-- =====================================================
-- 8. Create function to get sources needing scraping
-- =====================================================

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
  LIMIT 10;
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
  LIMIT 10;
$$;

-- =====================================================
-- 9. Create function to update scrape stats
-- =====================================================

CREATE OR REPLACE FUNCTION update_job_source_scrape_stats(
  p_source_id uuid,
  p_jobs_found integer DEFAULT 0,
  p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE job_source_urls
  SET 
    last_scraped_at = now(),
    last_success_at = CASE WHEN p_error IS NULL THEN now() ELSE last_success_at END,
    total_scrapes = total_scrapes + 1,
    total_jobs_found = total_jobs_found + p_jobs_found,
    last_error = p_error,
    updated_at = now()
  WHERE id = p_source_id;
END;
$$;

CREATE OR REPLACE FUNCTION update_property_source_scrape_stats(
  p_source_id uuid,
  p_properties_found integer DEFAULT 0,
  p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE property_source_urls
  SET 
    last_scraped_at = now(),
    last_success_at = CASE WHEN p_error IS NULL THEN now() ELSE last_success_at END,
    total_scrapes = total_scrapes + 1,
    total_properties_found = total_properties_found + p_properties_found,
    last_error = p_error,
    updated_at = now()
  WHERE id = p_source_id;
END;
$$;

COMMIT;

-- Verify insertions
SELECT 'Job Sources' as type, country_code, count(*) as total
FROM job_source_urls
GROUP BY country_code
UNION ALL
SELECT 'Property Sources' as type, country_code, count(*) as total
FROM property_source_urls
GROUP BY country_code
ORDER BY type, country_code;
