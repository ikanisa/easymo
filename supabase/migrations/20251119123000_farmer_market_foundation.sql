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

create unique index if not exists produce_catalog_market_idx
  on public.produce_catalog (market_code, commodity, variety, grade);

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
