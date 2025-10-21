BEGIN;
-- Phase 2 mobility core tables and helpers
-- Enables extensions required for geospatial queries and UUID generation
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "postgis";

-- Settings singleton
create table if not exists public.settings (
  id integer primary key default 1 check (id = 1),
  subscription_price integer not null default 5000,
  search_radius_km integer not null default 5,
  max_results integer not null default 10,
  momo_payee_number text not null default '0780000000',
  support_phone_e164 text not null default '+250780000000',
  admin_whatsapp_numbers text[] default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.settings (id)
values (1)
on conflict (id) do nothing;

-- Profiles represent authenticated users
create table if not exists public.profiles (
  user_id uuid primary key default gen_random_uuid(),
  whatsapp_e164 text not null unique,
  ref_code text not null unique,
  credits_balance integer not null default 0,
  locale text default 'en',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists profiles_ref_code_idx on public.profiles (ref_code);
create index if not exists profiles_created_at_idx on public.profiles (created_at desc);

-- Driver presence for simulator
create table if not exists public.driver_presence (
  id bigserial primary key,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  vehicle_type text not null,
  last_seen timestamptz not null default timezone('utc', now()),
  lat double precision not null,
  lng double precision not null,
  location geography(point, 4326) generated always as (
    st_setsrid(st_makepoint(lng, lat), 4326)::geography
  ) stored,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists driver_presence_user_idx on public.driver_presence (user_id);
create index if not exists driver_presence_last_seen_idx on public.driver_presence (last_seen desc);
create index if not exists driver_presence_location_idx on public.driver_presence using gist (location);

-- Trips created by simulator participants
create table if not exists public.trips (
  id bigserial primary key,
  creator_user_id uuid references public.profiles(user_id) on delete set null,
  role text not null check (role in ('driver','passenger')),
  vehicle_type text not null,
  status text not null default 'active',
  lat double precision not null,
  lng double precision not null,
  location geography(point, 4326) generated always as (
    st_setsrid(st_makepoint(lng, lat), 4326)::geography
  ) stored,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists trips_status_idx on public.trips (status);
create index if not exists trips_created_at_idx on public.trips (created_at desc);
create index if not exists trips_location_idx on public.trips using gist (location);

-- Subscription ledger
create table if not exists public.subscriptions (
  id bigserial primary key,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  status text not null default 'pending_review',
  amount integer not null,
  txn_id text,
  proof_url text,
  rejection_reason text,
  started_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists subscriptions_user_idx on public.subscriptions (user_id);
create index if not exists subscriptions_status_idx on public.subscriptions (status);
create index if not exists subscriptions_expires_idx on public.subscriptions (expires_at desc);

-- Voucher program tables
create table if not exists public.vouchers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  campaign_id uuid,
  code text not null unique,
  status text not null default 'issued',
  value integer not null,
  currency text not null default 'RWF',
  metadata jsonb not null default '{}'::jsonb,
  issued_at timestamptz not null default timezone('utc', now()),
  redeemed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists vouchers_user_idx on public.vouchers (user_id);
create index if not exists vouchers_status_idx on public.vouchers (status);

create table if not exists public.voucher_events (
  id bigserial primary key,
  voucher_id uuid not null references public.vouchers(id) on delete cascade,
  event_type text not null,
  actor_user_id uuid references public.profiles(user_id),
  station_scope uuid,
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists voucher_events_voucher_idx on public.voucher_events (voucher_id);

-- Campaign targeting tables
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text not null default 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.campaign_targets (
  id bigserial primary key,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  profile_id uuid not null references public.profiles(user_id) on delete cascade,
  status text not null default 'pending',
  last_contacted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (campaign_id, profile_id)
);

create table if not exists public.insurance_quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  vehicle_type text,
  premium integer,
  coverage jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  quote_number text unique,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.stations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  whatsapp_e164 text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.audit_log (
  id bigserial primary key,
  actor_user_id uuid,
  action text not null,
  target_table text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists audit_log_target_idx on public.audit_log (target_table, target_id);

-- Updated-at triggers
create trigger settings_touch_updated_at
  before update on public.settings
  for each row execute function public.touch_updated_at();

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

create trigger driver_presence_touch_updated_at
  before update on public.driver_presence
  for each row execute function public.touch_updated_at();

create trigger trips_touch_updated_at
  before update on public.trips
  for each row execute function public.touch_updated_at();
COMMIT;

create trigger subscriptions_touch_updated_at
  before update on public.subscriptions
  for each row execute function public.touch_updated_at();

create trigger vouchers_touch_updated_at
  before update on public.vouchers
  for each row execute function public.touch_updated_at();

create trigger campaigns_touch_updated_at
  before update on public.campaigns
  for each row execute function public.touch_updated_at();

create trigger campaign_targets_touch_updated_at
  before update on public.campaign_targets
  for each row execute function public.touch_updated_at();

create trigger insurance_quotes_touch_updated_at
  before update on public.insurance_quotes
  for each row execute function public.touch_updated_at();

create trigger stations_touch_updated_at
  before update on public.stations
  for each row execute function public.touch_updated_at();

-- Simulator helper RPCs
create or replace function public.simulator_find_nearby_drivers(
  lat double precision,
  lng double precision,
  radius_km double precision default 5,
  max_results integer default 10,
  vehicle_type text default null
)
returns table (
  user_id uuid,
  vehicle_type text,
  last_seen timestamptz,
  lat double precision,
  lng double precision,
  ref_code text,
  whatsapp_e164 text
)
language sql
stable
as $$
  select
    dp.user_id,
    dp.vehicle_type,
    dp.last_seen,
    dp.lat,
    dp.lng,
    p.ref_code,
    p.whatsapp_e164
  from public.driver_presence dp
  join public.profiles p on p.user_id = dp.user_id
  where (vehicle_type is null or dp.vehicle_type = vehicle_type)
    and dp.last_seen > timezone('utc', now()) - interval '10 minutes'
    and st_dwithin(
      dp.location,
      st_setsrid(st_makepoint(lng, lat), 4326)::geography,
      greatest(radius_km, 0) * 1000
    )
  order by dp.last_seen desc
  limit max_results;
$$;

create or replace function public.simulator_find_nearby_passenger_trips(
  lat double precision,
  lng double precision,
  radius_km double precision default 5,
  max_results integer default 10,
  vehicle_type text default null
)
returns jsonb
language plpgsql
stable
as $$
declare
  result jsonb;
begin
  result := jsonb_build_object(
    'access', true,
    'trips', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id,
        'creator_user_id', t.creator_user_id,
        'role', t.role,
        'vehicle_type', t.vehicle_type,
        'status', t.status,
        'created_at', t.created_at,
        'lat', t.lat,
        'lng', t.lng,
        'ref_code', p.ref_code,
        'whatsapp_e164', p.whatsapp_e164
      ))
      from (
        select *
        from public.trips
        where role = 'passenger'
          and status = 'active'
          and (vehicle_type is null or public.trips.vehicle_type = vehicle_type)
          and st_dwithin(
            location,
            st_setsrid(st_makepoint(lng, lat), 4326)::geography,
            greatest(radius_km, 0) * 1000
          )
        order by created_at desc
        limit max_results
      ) as t
      join public.profiles p on p.user_id = t.creator_user_id
    ), '[]'::jsonb)
  );
  return result;
end;
$$;
