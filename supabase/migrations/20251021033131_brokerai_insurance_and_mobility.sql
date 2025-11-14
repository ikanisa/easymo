BEGIN;
-- ADDITIVE migration for insurance & mobility (PostGIS enabled)
create extension if not exists postgis;
create extension if not exists pgcrypto;

create table if not exists public.wa_contacts (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text unique not null,
  display_name text,
  locale text default 'en',
  created_at timestamptz default now()
);

do $$ begin
  create type insurance_status as enum ('collecting','ocr_pending','ready_review','submitted','completed','rejected');
exception when duplicate_object then null; end $$;

create table if not exists public.insurance_intents (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.wa_contacts(id) on delete cascade,
  status insurance_status not null default 'collecting',
  vehicle_type text,
  vehicle_plate text,
  insurer_preference text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

do $$ begin
  create type doc_type as enum ('logbook','yellow_card','old_policy','id_card','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ocr_status as enum ('pending','processing','done','failed');
exception when duplicate_object then null; end $$;

create table if not exists public.insurance_documents (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid references public.insurance_intents(id) on delete cascade,
  contact_id uuid references public.wa_contacts(id) on delete cascade,
  kind doc_type not null,
  storage_path text not null,
  checksum text,
  ocr_state ocr_status not null default 'pending',
  ocr_json jsonb,
  ocr_confidence numeric,
  created_at timestamptz default now()
);

do $$ begin
  create type vehicle_kind as enum ('moto','sedan','suv','van','truck');
exception when duplicate_object then null; end $$;

create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text unique not null,
  display_name text,
  vehicle_type vehicle_kind,
  vehicle_desc text,
  rating numeric default 4.3,
  created_at timestamptz default now()
);

create table if not exists public.driver_availability (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid references public.drivers(id) on delete cascade,
  at timestamptz default now(),
  available boolean default true,
  loc geography(point,4326) not null
);
create index if not exists idx_driver_availability_gist on public.driver_availability using gist (loc);

do $$ begin
  create type ride_status as enum ('searching','shortlisted','booked','completed','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists public.rides (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.wa_contacts(id) on delete cascade,
  vehicle_type vehicle_kind not null,
  pickup geography(point,4326) not null,
  dropoff geography(point,4326),
  status ride_status not null default 'searching',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

do $$ begin
  create type candidate_status as enum ('pending','accepted','rejected','timeout');
exception when duplicate_object then null; end $$;

create table if not exists public.ride_candidates (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid references public.rides(id) on delete cascade,
  driver_id uuid references public.drivers(id) on delete cascade,
  eta_minutes int,
  offer_price numeric,
  currency text default 'RWF',
  status candidate_status default 'pending',
  driver_message text,
  created_at timestamptz default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  channel text not null default 'whatsapp',
  role text not null,
  contact_id uuid,
  driver_id uuid,
  wa_thread_id text,
  created_at timestamptz default now()
);

create table if not exists public.messages (
  id bigint generated always as identity primary key,
  conversation_id uuid references public.conversations(id) on delete cascade,
  dir text not null,
  body jsonb not null,
  created_at timestamptz default now()
);

-- RLS placeholders (server routes will use service role; keep strict by default)
alter table if exists public.insurance_intents enable row level security;
alter table if exists public.insurance_documents enable row level security;
alter table if exists public.rides enable row level security;
alter table if exists public.ride_candidates enable row level security;

-- Optional helper RPC: nearest drivers by vehicle type & distance
create or replace function public.nearest_drivers(
  p_lat double precision,
  p_lng double precision,
  p_vehicle text,
  p_limit integer default 8
) returns table(
  driver_id uuid,
  distance_meters numeric,
  eta_minutes int
) language sql stable as $$
  select a.driver_id,
         ST_Distance(
           a.loc,
           ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
         ) as distance_meters,
         null::int as eta_minutes
  from public.driver_availability a
  join public.drivers d on d.id = a.driver_id
  where a.available = true
    and (p_vehicle is null or d.vehicle_type::text = p_vehicle)
  order by ST_Distance(
           a.loc,
           ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
         ) asc
  limit coalesce(p_limit, 8)
$$;

-- Storage bucket for insurance uploads (idempotent)
insert into storage.buckets (id, name, public)
values ('insurance_uploads','insurance_uploads', false)
on conflict (id) do nothing;

COMMIT;
