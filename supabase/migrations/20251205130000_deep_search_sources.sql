-- ============================================================================
-- Dynamic Source Tables for Deep Search
-- Agents search from: 1) Configured websites  2) User listings in database
-- ============================================================================

-- ============================================================================
-- JOB SOURCES - Websites to search for jobs
-- ============================================================================

create table if not exists job_sources (
  id uuid primary key default gen_random_uuid(),
  
  -- Source identification
  name text not null,
  url text not null unique,
  domain text generated always as (
    regexp_replace(url, '^https?://([^/]+).*$', '\1')
  ) stored,
  
  -- Configuration
  country text default 'RW', -- ISO country code
  region text, -- e.g., 'East Africa', 'Europe'
  source_type text check (source_type in ('job_board', 'company', 'aggregator', 'government', 'ngo', 'freelance')),
  
  -- Capabilities
  supports_search boolean default true,
  search_url_template text, -- e.g., 'https://example.com/jobs?q={query}&location={location}'
  api_available boolean default false,
  api_endpoint text,
  api_key_env text, -- Environment variable name for API key
  
  -- Crawling settings
  crawl_frequency text default 'daily' check (crawl_frequency in ('hourly', 'daily', 'weekly', 'monthly')),
  last_crawled_at timestamptz,
  crawl_enabled boolean default true,
  
  -- Priority and quality
  priority integer default 50 check (priority between 1 and 100), -- Higher = search first
  trust_score numeric(3,2) default 0.80 check (trust_score between 0 and 1),
  
  -- Categories
  categories text[] default '{}', -- e.g., ['tech', 'healthcare', 'hospitality']
  
  -- Status
  is_active boolean default true,
  notes text,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_job_sources_active on job_sources(is_active) where is_active = true;
create index if not exists idx_job_sources_country on job_sources(country);
create index if not exists idx_job_sources_priority on job_sources(priority desc);

-- ============================================================================
-- REAL ESTATE SOURCES - Websites to search for properties
-- ============================================================================

create table if not exists real_estate_sources (
  id uuid primary key default gen_random_uuid(),
  
  -- Source identification
  name text not null,
  url text not null unique,
  domain text generated always as (
    regexp_replace(url, '^https?://([^/]+).*$', '\1')
  ) stored,
  
  -- Configuration
  country text default 'RW',
  region text,
  coverage_areas text[], -- e.g., ['Kigali', 'Eastern Province']
  source_type text check (source_type in ('portal', 'agency', 'classifieds', 'developer', 'government')),
  
  -- Property types supported
  property_types text[] default '{}', -- e.g., ['apartment', 'house', 'land', 'commercial']
  transaction_types text[] default '{rent,buy}',
  
  -- Capabilities
  supports_search boolean default true,
  search_url_template text,
  api_available boolean default false,
  api_endpoint text,
  api_key_env text,
  
  -- Crawling settings
  crawl_frequency text default 'daily' check (crawl_frequency in ('hourly', 'daily', 'weekly', 'monthly')),
  last_crawled_at timestamptz,
  crawl_enabled boolean default true,
  
  -- Priority and quality
  priority integer default 50 check (priority between 1 and 100),
  trust_score numeric(3,2) default 0.80 check (trust_score between 0 and 1),
  
  -- Pricing info
  currency text default 'RWF',
  typical_price_min numeric,
  typical_price_max numeric,
  
  -- Status
  is_active boolean default true,
  notes text,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_real_estate_sources_active on real_estate_sources(is_active) where is_active = true;
create index if not exists idx_real_estate_sources_country on real_estate_sources(country);
create index if not exists idx_real_estate_sources_priority on real_estate_sources(priority desc);

-- ============================================================================
-- FARMERS SOURCES - Websites/markets for agricultural data
-- ============================================================================

create table if not exists farmers_sources (
  id uuid primary key default gen_random_uuid(),
  
  name text not null,
  url text not null unique,
  domain text generated always as (
    regexp_replace(url, '^https?://([^/]+).*$', '\1')
  ) stored,
  
  country text default 'RW',
  region text,
  source_type text check (source_type in ('market', 'exchange', 'cooperative', 'government', 'ngo', 'aggregator')),
  
  -- Produce categories
  produce_categories text[] default '{}', -- e.g., ['vegetables', 'fruits', 'grains', 'dairy']
  
  -- Capabilities
  supports_search boolean default true,
  has_price_data boolean default false,
  has_buyer_listings boolean default false,
  has_farmer_listings boolean default false,
  api_available boolean default false,
  api_endpoint text,
  
  -- Crawling
  crawl_frequency text default 'daily',
  last_crawled_at timestamptz,
  crawl_enabled boolean default true,
  
  priority integer default 50,
  trust_score numeric(3,2) default 0.80,
  
  is_active boolean default true,
  notes text,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_farmers_sources_active on farmers_sources(is_active) where is_active = true;

-- ============================================================================
-- SEED DATA - Initial Rwanda Sources 
-- ============================================================================

-- Job sources for Rwanda and region
insert into job_sources (name, url, country, source_type, categories, priority, notes) values
  ('JobInRwanda', 'https://www.jobinrwanda.com', 'RW', 'job_board', '{"general", "tech", "finance"}', 90, 'Main Rwanda job board'),
  ('Umurava', 'https://umurava.africa', 'RW', 'job_board', '{"tech", "digital", "creative"}', 85, 'Tech-focused'),
  ('RDB Careers', 'https://rdb.rw/careers', 'RW', 'government', '{"government", "investment"}', 80, 'Rwanda Development Board'),
  ('BrighterMonday Rwanda', 'https://www.brightermonday.co.rw', 'RW', 'aggregator', '{"general"}', 75, 'Regional job aggregator'),
  ('Kigali Farms', 'https://kigalifarms.com/jobs', 'RW', 'job_board', '{"agriculture", "hospitality"}', 70, 'Hospitality and agriculture'),
  ('Indeed Malta', 'https://mt.indeed.com', 'MT', 'aggregator', '{"general"}', 85, 'Malta job listings'),
  ('JobsPlus Malta', 'https://jobsplus.gov.mt', 'MT', 'government', '{"general", "government"}', 80, 'Malta official employment service'),
  ('LinkedIn Jobs', 'https://www.linkedin.com/jobs', NULL, 'aggregator', '{"professional", "tech", "business"}', 95, 'Global professional network')
on conflict (url) do nothing;

-- Real estate sources for Rwanda
insert into real_estate_sources (name, url, country, source_type, property_types, coverage_areas, priority, notes) values
  ('Living in Kigali', 'https://www.livinginkigali.com', 'RW', 'portal', '{"apartment", "house", "commercial"}', '{"Kigali"}', 90, 'Main Kigali property portal'),
  ('Imali', 'https://imali.rw', 'RW', 'classifieds', '{"apartment", "house", "land"}', '{"Kigali", "Eastern", "Western"}', 85, 'Rwanda classifieds'),
  ('House in Rwanda', 'https://houseinrwanda.com', 'RW', 'portal', '{"apartment", "house", "land", "commercial"}', '{"Kigali", "Nationwide"}', 80, 'National coverage'),
  ('Real Estate Rwanda', 'https://realestaterwanda.com', 'RW', 'agency', '{"apartment", "house", "villa"}', '{"Kigali"}', 75, 'Kigali agency'),
  ('Jumia House Rwanda', 'https://house.jumia.rw', 'RW', 'portal', '{"apartment", "house", "land"}', '{"Kigali", "Nationwide"}', 85, 'Jumia real estate')
on conflict (url) do nothing;

-- Farmers sources
insert into farmers_sources (name, url, country, source_type, produce_categories, priority, notes) values
  ('Rwanda Agriculture Board', 'https://www.rab.gov.rw', 'RW', 'government', '{"grains", "vegetables", "fruits", "livestock"}', 90, 'Official agricultural data'),
  ('NAEB', 'https://naeb.gov.rw', 'RW', 'government', '{"coffee", "tea", "horticulture", "silk"}', 85, 'Export crops'),
  ('Twiga Foods', 'https://twiga.com', 'KE', 'aggregator', '{"vegetables", "fruits"}', 80, 'Regional B2B platform'),
  ('Fresh in a Box', 'https://freshinabox.rw', 'RW', 'aggregator', '{"vegetables", "fruits", "dairy"}', 75, 'Rwanda fresh produce')
on conflict (url) do nothing;

-- ============================================================================
-- RLS Policies
-- ============================================================================

alter table job_sources enable row level security;
alter table real_estate_sources enable row level security;
alter table farmers_sources enable row level security;

-- Public read access for active sources
create policy "Public can view active job sources"
  on job_sources for select
  using (is_active = true);

create policy "Public can view active real estate sources"
  on real_estate_sources for select
  using (is_active = true);

create policy "Public can view active farmers sources"
  on farmers_sources for select
  using (is_active = true);

-- Service role full access
create policy "Service role manages job sources"
  on job_sources for all
  using (auth.role() = 'service_role');

create policy "Service role manages real estate sources"
  on real_estate_sources for all
  using (auth.role() = 'service_role');

create policy "Service role manages farmers sources"
  on farmers_sources for all
  using (auth.role() = 'service_role');

-- ============================================================================
-- RPC: Get sources for deep search
-- ============================================================================

-- Get job search sources with priority ordering
create or replace function get_job_search_sources(
  p_country text default null,
  p_category text default null,
  p_limit integer default 10
)
returns table (
  id uuid,
  name text,
  url text,
  search_url_template text,
  priority integer,
  trust_score numeric
)
language plpgsql
security definer
as $$
begin
  return query
  select 
    js.id, js.name, js.url, js.search_url_template, js.priority, js.trust_score
  from job_sources js
  where js.is_active = true
    and js.supports_search = true
    and (p_country is null or js.country = p_country or js.country is null)
    and (p_category is null or p_category = any(js.categories))
  order by js.priority desc
  limit p_limit;
end;
$$;

-- Get real estate search sources
create or replace function get_real_estate_search_sources(
  p_country text default null,
  p_area text default null,
  p_property_type text default null,
  p_limit integer default 10
)
returns table (
  id uuid,
  name text,
  url text,
  search_url_template text,
  priority integer,
  trust_score numeric
)
language plpgsql
security definer
as $$
begin
  return query
  select 
    res.id, res.name, res.url, res.search_url_template, res.priority, res.trust_score
  from real_estate_sources res
  where res.is_active = true
    and res.supports_search = true
    and (p_country is null or res.country = p_country)
    and (p_area is null or p_area = any(res.coverage_areas))
    and (p_property_type is null or p_property_type = any(res.property_types))
  order by res.priority desc
  limit p_limit;
end;
$$;

-- ============================================================================
-- Comments
-- ============================================================================

comment on table job_sources is 'Dynamic list of job websites for Deep Search to crawl';
comment on table real_estate_sources is 'Dynamic list of real estate websites for Deep Search';
comment on table farmers_sources is 'Dynamic list of agricultural websites for market intel';
