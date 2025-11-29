-- Transaction wrapper for production safety
BEGIN;

-- Farmer market support tables

create table if not exists public.produce_catalog (
  id uuid primary key default gen_random_uuid(),
  commodity text not null,
  variety text not null,
  market_code text not null,
  grade text not null,
  unit text not null,
  min_order numeric default 1,
  price_floor numeric,
  price_ceiling numeric,
  synonyms text[] default array[]::text[],
  localized_names jsonb default '{}'::jsonb,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add columns if they don't exist (for existing produce_catalog with different schema)
do $$
begin
  -- Add commodity if missing
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'produce_catalog' and column_name = 'commodity') then
    alter table public.produce_catalog add column commodity text;
  end if;
  
  -- Add variety if missing
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'produce_catalog' and column_name = 'variety') then
    alter table public.produce_catalog add column variety text;
  end if;
  
  -- Add market_code if missing
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'produce_catalog' and column_name = 'market_code') then
    alter table public.produce_catalog add column market_code text;
  end if;
  
  -- Add grade if missing
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'produce_catalog' and column_name = 'grade') then
    alter table public.produce_catalog add column grade text;
  end if;
  
  -- Add unit if missing
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'produce_catalog' and column_name = 'unit') then
    alter table public.produce_catalog add column unit text;
  end if;
  
  -- Add min_order if missing
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'produce_catalog' and column_name = 'min_order') then
    alter table public.produce_catalog add column min_order numeric default 1;
  end if;
  
  -- Add price_floor if missing
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'produce_catalog' and column_name = 'price_floor') then
    alter table public.produce_catalog add column price_floor numeric;
  end if;
  
  -- Add price_ceiling if missing
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'produce_catalog' and column_name = 'price_ceiling') then
    alter table public.produce_catalog add column price_ceiling numeric;
  end if;
  
  -- Add synonyms if missing
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'produce_catalog' and column_name = 'synonyms') then
    alter table public.produce_catalog add column synonyms text[] default array[]::text[];
  end if;
  
  -- Add localized_names if missing
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'produce_catalog' and column_name = 'localized_names') then
    alter table public.produce_catalog add column localized_names jsonb default '{}'::jsonb;
  end if;
end $$;

-- Only create index if all required columns exist
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'produce_catalog' and column_name = 'market_code'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'produce_catalog' and column_name = 'commodity'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'produce_catalog' and column_name = 'variety'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'produce_catalog' and column_name = 'grade'
  ) then
    create unique index if not exists produce_catalog_market_idx
      on public.produce_catalog (market_code, commodity, variety, grade);
  end if;
end $$;

create table if not exists public.buyer_market_alerts (
  id uuid primary key default gen_random_uuid(),
  buyer_id text,
  buyer_phone text,
  buyer_type text default 'merchant',
  market_code text not null,
  template_intent text not null,
  template_locale text not null default 'en',
  channel text not null default 'whatsapp',
  payload jsonb not null default '{}'::jsonb,
  cod_fallback jsonb,
  send_at timestamptz not null,
  status text not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists buyer_market_alerts_pending_idx
  on public.buyer_market_alerts (market_code, status, send_at);

create trigger set_updated_at_produce_catalog
  before update on public.produce_catalog
  for each row
  execute function public.set_updated_at();

create trigger set_updated_at_buyer_market_alerts
  before update on public.buyer_market_alerts
  for each row
  execute function public.set_updated_at();

COMMIT;
