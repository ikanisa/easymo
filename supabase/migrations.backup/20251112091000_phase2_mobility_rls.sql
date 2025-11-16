BEGIN;
-- Enable row level security for new mobility tables
alter table if exists public.settings enable row level security;
alter table if exists public.profiles enable row level security;
alter table if exists public.driver_presence enable row level security;
alter table if exists public.trips enable row level security;
alter table if exists public.subscriptions enable row level security;
alter table if exists public.vouchers enable row level security;
alter table if exists public.voucher_events enable row level security;
alter table if exists public.campaigns enable row level security;
alter table if exists public.campaign_targets enable row level security;
alter table if exists public.insurance_quotes enable row level security;
alter table if exists public.stations enable row level security;
alter table if exists public.audit_log enable row level security;

-- Helper predicates
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt()->>'role', '') = 'admin';
$$;

create or replace function public.jwt_station_id()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt()->>'station_id', '');
$$;

-- Profiles policies
create policy profiles_admin_manage on public.profiles
  for all using (public.is_admin())
  with check (public.is_admin());

create policy profiles_self_select on public.profiles
  for select using (auth.uid() = user_id);

-- Driver presence policies
create policy driver_presence_admin_manage on public.driver_presence
  for all using (public.is_admin())
  with check (public.is_admin());

create policy driver_presence_owner_select on public.driver_presence
  for select using (auth.uid() = user_id);

-- Trips policies
create policy trips_admin_manage on public.trips
  for all using (public.is_admin())
  with check (public.is_admin());

create policy trips_owner_select on public.trips
  for select using (auth.uid() = creator_user_id);

-- Subscriptions policies
create policy subscriptions_admin_manage on public.subscriptions
  for all using (public.is_admin())
  with check (public.is_admin());

create policy subscriptions_user_select on public.subscriptions
  for select using (auth.uid() = user_id);

-- Settings policies
create policy settings_admin_manage on public.settings
  for all using (public.is_admin())
  with check (public.is_admin());

create policy settings_authenticated_select on public.settings
  for select using (auth.uid() is not null);

-- Vouchers policies
create policy vouchers_admin_manage on public.vouchers
  for all using (public.is_admin())
  with check (public.is_admin());

create policy vouchers_user_select on public.vouchers
  for select using (auth.uid() = user_id);

create policy vouchers_station_select on public.vouchers
  for select using (
    public.jwt_station_id() <> ''
  );

-- Voucher events policies
create policy voucher_events_admin_manage on public.voucher_events
  for all using (public.is_admin())
  with check (public.is_admin());

create policy voucher_events_station_select on public.voucher_events
  for select using (
    public.jwt_station_id() <> ''
  );

-- Campaign policies (admin only)
create policy campaigns_admin_manage on public.campaigns
  for all using (public.is_admin())
  with check (public.is_admin());

create policy campaign_targets_admin_manage on public.campaign_targets
  for all using (public.is_admin())
  with check (public.is_admin());

-- Insurance quotes
create policy insurance_quotes_admin_manage on public.insurance_quotes
  for all using (public.is_admin())
  with check (public.is_admin());

create policy insurance_quotes_user_select on public.insurance_quotes
  for select using (auth.uid() = user_id);

-- Stations (admin or station scoped)
create policy stations_admin_manage on public.stations
  for all using (public.is_admin())
  with check (public.is_admin());

create policy stations_station_select on public.stations
  for select using (public.jwt_station_id() <> '');

-- Audit log (admins only)
create policy audit_log_admin_select on public.audit_log
  for select using (public.is_admin());

create policy audit_log_admin_insert on public.audit_log
  for insert with check (public.is_admin());
COMMIT;
