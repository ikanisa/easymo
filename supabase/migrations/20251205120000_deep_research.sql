-- ============================================================================
-- Deep Research Integration for easyMO AI Agents
-- Enables autonomous web research powered by OpenAI o3-class models
-- ============================================================================

-- Deep research job status enum
create type deep_research_status as enum (
  'pending',
  'running',
  'succeeded',
  'failed',
  'cancelled'
);

-- ============================================================================
-- DEEP RESEARCH JOBS
-- Tracks research requests from domain agents
-- ============================================================================

create table if not exists deep_research_jobs (
  id uuid primary key default gen_random_uuid(),
  
  -- Ownership
  user_id uuid references auth.users(id) on delete set null,
  agent_id text not null, -- 'jobs_ai', 'real_estate_ai', 'farmers_ai', 'sales_sdr_ai'
  domain text not null check (domain in ('jobs', 'real_estate', 'farmers', 'sales', 'generic')),
  
  -- Research request
  query text not null, -- Human-readable question/task
  input_context jsonb not null default '{}'::jsonb, -- Entities from call, user profile, etc.
  
  -- Job tracking
  status deep_research_status not null default 'pending',
  openai_job_id text, -- ID returned by Deep Research API
  
  -- Timestamps
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  
  -- Error handling
  error_message text,
  retry_count integer not null default 0,
  
  -- Metadata
  metadata jsonb not null default '{}'::jsonb
);

-- Indexes
create index if not exists idx_deep_research_jobs_user on deep_research_jobs(user_id);
create index if not exists idx_deep_research_jobs_status on deep_research_jobs(status);
create index if not exists idx_deep_research_jobs_domain on deep_research_jobs(domain);
create index if not exists idx_deep_research_jobs_created on deep_research_jobs(created_at desc);
create index if not exists idx_deep_research_jobs_openai_id on deep_research_jobs(openai_job_id) where openai_job_id is not null;

-- ============================================================================
-- DEEP RESEARCH RESULTS
-- Stores completed research reports with citations
-- ============================================================================

create table if not exists deep_research_results (
  job_id uuid primary key references deep_research_jobs(id) on delete cascade,
  
  -- Summary for quick consumption
  summary text not null,
  
  -- Full report from OpenAI
  raw_report jsonb not null,
  
  -- Parsed citations
  citations jsonb not null default '[]'::jsonb,
  -- Example: [{"title": "Rwanda Real Estate Report", "url": "https://...", "snippet": "..."}]
  
  -- Derived actions for the agent
  follow_up_actions jsonb not null default '[]'::jsonb,
  -- Example: [{"type": "notify_user", "priority": "high", "description": "Found 3 matching properties"}]
  
  -- Stats
  source_count integer,
  word_count integer,
  
  created_at timestamptz not null default now()
);

-- ============================================================================
-- EXTERNAL LISTINGS (from Deep Research)
-- Domain-specific parsed results for matching
-- ============================================================================

-- Jobs external listings (from web research)
create table if not exists jobs_external_listings (
  id uuid primary key default gen_random_uuid(),
  research_job_id uuid references deep_research_jobs(id) on delete set null,
  
  -- Source info
  source_url text not null,
  source_name text,
  scraped_at timestamptz not null default now(),
  
  -- Job details
  title text not null,
  company_name text,
  location text,
  salary_range text,
  employment_type text,
  description text,
  requirements text[],
  
  -- Matching
  relevance_score numeric(3,2),
  matched_to_intake_id uuid,
  
  -- Raw data
  raw_data jsonb,
  
  created_at timestamptz not null default now()
);

create index if not exists idx_jobs_external_research on jobs_external_listings(research_job_id);

-- Real estate external listings (from web research)
create table if not exists real_estate_external_listings (
  id uuid primary key default gen_random_uuid(),
  research_job_id uuid references deep_research_jobs(id) on delete set null,
  
  -- Source info
  source_url text not null,
  source_name text,
  scraped_at timestamptz not null default now(),
  
  -- Property details
  title text not null,
  property_type text,
  transaction_type text check (transaction_type in ('rent', 'buy')),
  price numeric,
  currency text default 'RWF',
  bedrooms integer,
  bathrooms integer,
  size_sqm numeric,
  location text,
  neighborhood text,
  description text,
  amenities text[],
  contact_info text,
  
  -- Matching
  relevance_score numeric(3,2),
  matched_to_intake_id uuid,
  
  -- Raw data
  raw_data jsonb,
  
  created_at timestamptz not null default now()
);

create index if not exists idx_real_estate_external_research on real_estate_external_listings(research_job_id);

-- Farmers market intel (from web research)
create table if not exists farmers_market_intel (
  id uuid primary key default gen_random_uuid(),
  research_job_id uuid references deep_research_jobs(id) on delete set null,
  
  -- Source info
  source_url text,
  source_name text,
  data_date date,
  
  -- Market data
  produce_type text not null,
  market_name text,
  location text,
  wholesale_price_min numeric,
  wholesale_price_max numeric,
  retail_price_min numeric,
  retail_price_max numeric,
  currency text default 'RWF',
  unit text,
  availability text,
  quality_notes text,
  
  -- Raw data
  raw_data jsonb,
  
  created_at timestamptz not null default now()
);

create index if not exists idx_farmers_intel_research on farmers_market_intel(research_job_id);
create index if not exists idx_farmers_intel_produce on farmers_market_intel(produce_type);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table deep_research_jobs enable row level security;
alter table deep_research_results enable row level security;
alter table jobs_external_listings enable row level security;
alter table real_estate_external_listings enable row level security;
alter table farmers_market_intel enable row level security;

-- Users can view their own research jobs
create policy "Users can view own research jobs"
  on deep_research_jobs for select
  using (auth.uid() = user_id);

-- Service role has full access
create policy "Service role has full access to research jobs"
  on deep_research_jobs for all
  using (auth.role() = 'service_role');

create policy "Service role has full access to research results"
  on deep_research_results for all
  using (auth.role() = 'service_role');

create policy "Service role has full access to external listings"
  on jobs_external_listings for all
  using (auth.role() = 'service_role');

create policy "Service role has full access to real estate external"
  on real_estate_external_listings for all
  using (auth.role() = 'service_role');

create policy "Service role has full access to farmers intel"
  on farmers_market_intel for all
  using (auth.role() = 'service_role');

-- ============================================================================
-- COMMENTS
-- ============================================================================

comment on table deep_research_jobs is 'Tracks autonomous web research jobs powered by OpenAI Deep Research';
comment on table deep_research_results is 'Stores completed research reports with structured citations';
comment on table jobs_external_listings is 'Job listings discovered via Deep Research for matching';
comment on table real_estate_external_listings is 'Property listings discovered via Deep Research for matching';
comment on table farmers_market_intel is 'Market price and availability data from Deep Research';
