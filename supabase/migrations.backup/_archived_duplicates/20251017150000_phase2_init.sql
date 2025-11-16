-- Migration: Phase‑2 initial schema for WhatsApp Mobility
-- This script creates the core tables used by the admin panel and
-- WhatsApp workflows.  It enables Row Level Security (RLS) and defines
-- simple policies to allow reads by anonymous clients while requiring
-- service role keys for writes.  Additional tables for vouchers,
-- campaigns, insurance quotes, etc. can be added similarly.

begin;

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------
create table if not exists public.settings (
  id serial primary key,
  subscription_price numeric not null,
  search_radius_km numeric not null default 5,
  max_results integer not null default 10,
  momo_payee_number text not null,
  support_phone_e164 text not null,
  admin_whatsapp_numbers text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  whatsapp_e164 text not null unique,
  ref_code text not null unique,
  credits_balance numeric default 0,
  created_at timestamp with time zone default now()
);

-- ---------------------------------------------------------------------------
-- Driver Presence
-- ---------------------------------------------------------------------------
create table if not exists public.driver_presence (
  user_id uuid references public.profiles (user_id) on delete cascade,
  vehicle_type text not null,
  lat numeric,
  lng numeric,
  last_seen timestamp with time zone not null default now(),
  ref_code text,
  whatsapp_e164 text,
  primary key (user_id, vehicle_type)
);

-- ---------------------------------------------------------------------------
-- Trips
-- ---------------------------------------------------------------------------
create table if not exists public.trips (
  id bigserial primary key,
  creator_user_id uuid references public.profiles (user_id) on delete set null,
  role text not null check (role in ('passenger', 'driver')),
  vehicle_type text not null,
  created_at timestamp with time zone default now(),
  status text,
  ref_code text,
  whatsapp_e164 text,
  lat numeric,
  lng numeric
);

-- ---------------------------------------------------------------------------
-- Subscriptions
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id bigserial primary key,
  user_id uuid references public.profiles (user_id) on delete cascade,
  status text not null check (status in ('pending_review','active','expired','rejected')),
  started_at timestamp with time zone,
  expires_at timestamp with time zone,
  amount numeric not null default 0,
  proof_url text,
  txn_id text,
  rejection_reason text,
  created_at timestamp with time zone default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security and Policies
-- ---------------------------------------------------------------------------
alter table public.settings enable row level security;
alter table public.profiles enable row level security;
alter table public.driver_presence enable row level security;
alter table public.trips enable row level security;
alter table public.subscriptions enable row level security;

-- Read policies: allow all clients to read
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'settings_read' and schemaname = 'public' and tablename = 'settings') then
    create policy "settings_read" on public.settings for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'profiles_read' and schemaname = 'public' and tablename = 'profiles') then
    create policy "profiles_read" on public.profiles for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'driver_presence_read' and schemaname = 'public' and tablename = 'driver_presence') then
    create policy "driver_presence_read" on public.driver_presence for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'trips_read' and schemaname = 'public' and tablename = 'trips') then
    create policy "trips_read" on public.trips for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'subscriptions_read' and schemaname = 'public' and tablename = 'subscriptions') then
    create policy "subscriptions_read" on public.subscriptions for select using (true);
  end if;

  -- Write policies: deny updates/inserts/deletes from anon/regular users.  Service role keys bypass RLS automatically.
  if not exists (select 1 from pg_policies where policyname = 'no_settings_mod' and schemaname = 'public' and tablename = 'settings') then
    create policy "no_settings_mod" on public.settings for all using (false) with check (false);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'no_profiles_mod' and schemaname = 'public' and tablename = 'profiles') then
    create policy "no_profiles_mod" on public.profiles for all using (false) with check (false);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'no_driver_presence_mod' and schemaname = 'public' and tablename = 'driver_presence') then
    create policy "no_driver_presence_mod" on public.driver_presence for all using (false) with check (false);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'no_trips_mod' and schemaname = 'public' and tablename = 'trips') then
    create policy "no_trips_mod" on public.trips for all using (false) with check (false);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'no_subscriptions_mod' and schemaname = 'public' and tablename = 'subscriptions') then
    create policy "no_subscriptions_mod" on public.subscriptions for all using (false) with check (false);
  end if;
end;
$$;

commit;
