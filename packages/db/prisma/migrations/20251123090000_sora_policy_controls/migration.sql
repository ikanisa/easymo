-- Sora policy controls and generation governance tables
create table if not exists "BrandGuide" (
  id uuid primary key default gen_random_uuid(),
  "tenantId" uuid not null references "Tenant"(id) on delete cascade,
  name text not null,
  "voiceTone" text null,
  "legalDisclaimer" text null,
  "safetyGuidelines" text null,
  "brandPillars" text[] not null default '{}',
  "forbiddenTerms" text[] not null default '{}',
  directives jsonb not null default '{}'::jsonb,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index if not exists brand_guides_tenant_idx on "BrandGuide"("tenantId");

create table if not exists "Campaign" (
  id uuid primary key default gen_random_uuid(),
  "tenantId" uuid not null references "Tenant"(id) on delete cascade,
  "brandGuideId" uuid null references "BrandGuide"(id) on delete set null,
  name text not null,
  status text not null default 'active',
  "generationKillSwitch" boolean not null default false,
  "dailyCostCapUsd" numeric(12, 2) null,
  metadata jsonb not null default '{}'::jsonb,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index if not exists campaigns_tenant_idx on "Campaign"("tenantId");
create index if not exists campaigns_brand_guide_idx on "Campaign"("brandGuideId");

create table if not exists "Figure" (
  id uuid primary key default gen_random_uuid(),
  "tenantId" uuid not null references "Tenant"(id) on delete cascade,
  "campaignId" uuid null references "Campaign"(id) on delete set null,
  "brandGuideId" uuid null references "BrandGuide"(id) on delete set null,
  name text not null,
  slug text null,
  "rightsStart" timestamptz null,
  "rightsEnd" timestamptz null,
  "allowedCountries" text[] not null default '{}',
  "allowedRegions" text[] not null default '{}',
  "policyNotes" text null,
  "legalNotes" text null,
  metadata jsonb not null default '{}'::jsonb,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index if not exists figures_tenant_idx on "Figure"("tenantId");
create index if not exists figures_campaign_idx on "Figure"("campaignId");
create index if not exists figures_brand_guide_idx on "Figure"("brandGuideId");

create table if not exists "GenerationLimit" (
  id uuid primary key default gen_random_uuid(),
  "campaignId" uuid not null references "Campaign"(id) on delete cascade,
  date date not null,
  "spendUsd" numeric(14, 2) not null default 0,
  "jobsCount" integer not null default 0,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  constraint generation_limits_campaign_date_key unique ("campaignId", date)
);

create unique index if not exists agent_current_revision_unique on "Agent"("currentRevisionId");
