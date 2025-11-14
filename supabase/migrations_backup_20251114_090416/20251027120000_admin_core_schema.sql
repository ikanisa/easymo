-- Additive migration to introduce core admin tables, indexes, and RLS policies.

BEGIN;

create schema if not exists app;

create or replace function app.current_role() returns text
  language sql
  stable
as $$
  select coalesce((auth.jwt() ->> 'role'), 'viewer');
$$;

create or replace function app.is_admin() returns boolean
  language sql
  stable
as $$
  select app.current_role() = 'admin';
$$;

grant usage on schema app to authenticated, anon, service_role;
grant execute on all functions in schema app to authenticated, anon, service_role;

create extension if not exists postgis;

create table if not exists public.stations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  engencode text not null,
  owner_contact text,
  location_point geography(Point, 4326),
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create unique index if not exists stations_engencode_key on public.stations (engencode);
create index if not exists stations_name_idx on public.stations using btree (name);
create index if not exists stations_location_point_idx on public.stations using gist (location_point);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null,
  status text not null default 'draft',
  template_id text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists campaigns_status_idx on public.campaigns (status);

create table if not exists public.vouchers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  amount numeric(12,2) not null,
  currency text not null,
  station_scope uuid references public.stations(id) on delete set null,
  code5 text not null,
  qr_url text,
  png_url text,
  status text not null default 'issued',
  issued_at timestamptz not null default now(),
  redeemed_at timestamptz,
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
);

-- Upgrade legacy vouchers schema to expose admin-facing columns while keeping existing flows compatible.
do $$
declare
  has_column boolean;
begin
  -- Legacy columns kept for backwards compatibility with WhatsApp flows.
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'vouchers' and column_name = 'code_5'
  ) then
    alter table public.vouchers add column code_5 text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'vouchers' and column_name = 'amount_minor'
  ) then
    alter table public.vouchers add column amount_minor integer;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'vouchers' and column_name = 'image_url'
  ) then
    alter table public.vouchers add column image_url text;
  end if;

  -- Ensure admin columns exist.
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'vouchers' and column_name = 'code5'
  ) then
    alter table public.vouchers add column code5 text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'vouchers' and column_name = 'amount'
  ) then
    alter table public.vouchers add column amount numeric(12,2);
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'vouchers' and column_name = 'station_scope'
  ) then
    alter table public.vouchers add column station_scope uuid;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'vouchers' and column_name = 'campaign_id'
  ) then
    alter table public.vouchers add column campaign_id uuid;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'vouchers' and column_name = 'qr_url'
  ) then
    alter table public.vouchers add column qr_url text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'vouchers' and column_name = 'png_url'
  ) then
    alter table public.vouchers add column png_url text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'vouchers' and column_name = 'expires_at'
  ) then
    alter table public.vouchers add column expires_at timestamptz;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'vouchers' and column_name = 'created_by'
  ) then
    alter table public.vouchers add column created_by uuid;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'vouchers' and column_name = 'metadata'
  ) then
    alter table public.vouchers add column metadata jsonb;
  end if;

  -- Align defaults and nullability where possible.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'vouchers' and column_name = 'metadata'
  ) then
    update public.vouchers set metadata = '{}'::jsonb where metadata is null;
    alter table public.vouchers alter column metadata set default '{}'::jsonb;
    alter table public.vouchers alter column metadata set not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'vouchers' and column_name = 'status'
  ) then
    alter table public.vouchers alter column status set default 'issued';
  end if;

  -- Backfill admin columns from legacy data when present.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'vouchers' and column_name = 'code5'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'vouchers' and column_name = 'code_5'
  ) then
    update public.vouchers set code5 = code_5 where code5 is null and code_5 is not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'vouchers' and column_name = 'png_url'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'vouchers' and column_name = 'image_url'
  ) then
    update public.vouchers set png_url = image_url where png_url is null and image_url is not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'vouchers' and column_name = 'amount'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'vouchers' and column_name = 'amount_minor'
  ) then
    update public.vouchers
      set amount = round((amount_minor::numeric) / 100, 2)
      where amount is null and amount_minor is not null;
  end if;

  -- Refresh foreign keys where missing.
  if not exists (
    select 1 from pg_constraint where conname = 'vouchers_station_scope_fkey'
  ) then
    begin
      alter table public.vouchers
        add constraint vouchers_station_scope_fkey
        foreign key (station_scope) references public.stations(id) on delete set null;
    exception when undefined_table then null;
    end;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'vouchers_campaign_id_fkey'
  ) then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'campaigns'
        and column_name = 'id'
        and data_type = 'uuid'
    ) then
      begin
        alter table public.vouchers
          add constraint vouchers_campaign_id_fkey
          foreign key (campaign_id) references public.campaigns(id) on delete set null;
      exception when undefined_table then null;
      end;
    end if;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'vouchers_created_by_fkey'
  ) then
    begin
      alter table public.vouchers
        add constraint vouchers_created_by_fkey
        foreign key (created_by) references auth.users(id) on delete set null;
    exception when undefined_table then null;
    end;
  end if;

  -- Replace strict numeric-only constraint to allow alphanumeric voucher codes.
  if exists (
    select 1 from pg_constraint where conname = 'vouchers_code_5_check'
  ) then
    alter table public.vouchers drop constraint vouchers_code_5_check;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'vouchers_code5_format_check'
  ) then
    alter table public.vouchers
      add constraint vouchers_code5_format_check
      check (
        coalesce(code5, code_5) is null
        or upper(coalesce(code5, code_5)) ~ '^[A-Z0-9]{5}$'
      );
  end if;

  -- Expand status validation to cover new admin lifecycle states.
  if exists (
    select 1 from pg_constraint where conname = 'vouchers_status_check'
  ) then
    alter table public.vouchers drop constraint vouchers_status_check;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'vouchers_status_check'
  ) then
    alter table public.vouchers
      add constraint vouchers_status_check
      check (status in ('issued','sent','redeemed','expired','void','cancelled'));
  end if;
  if exists (
    select 1 from pg_constraint where conname = 'vouchers_code_5_check'
  ) then
    alter table public.vouchers drop constraint vouchers_code_5_check;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'vouchers_code5_format_check'
  ) then
    alter table public.vouchers
      add constraint vouchers_code5_format_check
      check (
        coalesce(code5, code_5) is null
        or upper(coalesce(code5, code_5)) ~ '^[A-Z0-9]{5}$'
      );
  end if;
end;
$$;

create or replace function public.vouchers_sync_admin_columns()
returns trigger
language plpgsql
as $$
begin
  if new.code5 is null and new.code_5 is not null then
    new.code5 := upper(new.code_5);
  elsif new.code5 is not null then
    new.code5 := upper(new.code5);
    new.code_5 := new.code5;
  end if;

  if new.amount is null and new.amount_minor is not null then
    new.amount := round((new.amount_minor::numeric) / 100, 2);
  elsif new.amount is not null then
    new.amount_minor := round(new.amount * 100)::integer;
  end if;

  if new.png_url is null and new.image_url is not null then
    new.png_url := new.image_url;
  elsif new.png_url is not null and (new.image_url is distinct from new.png_url) then
    new.image_url := new.png_url;
  end if;

  return new;
end;
$$;

drop trigger if exists vouchers_sync_admin_columns on public.vouchers;
create trigger vouchers_sync_admin_columns
before insert or update on public.vouchers
for each row execute function public.vouchers_sync_admin_columns();

-- Create indexes only when admin columns are present.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'vouchers' and column_name = 'code5'
  ) then
    begin
      create unique index if not exists vouchers_code5_active_idx
        on public.vouchers (code5)
        where status in ('issued', 'sent', 'redeemed');
    exception when undefined_column then null;
    end;
  end if;
end;
$$;

create index if not exists vouchers_status_idx on public.vouchers (status);
create index if not exists vouchers_user_idx on public.vouchers (user_id);
create index if not exists vouchers_campaign_idx on public.vouchers (campaign_id);

create table if not exists public.voucher_events (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references public.vouchers(id) on delete cascade,
  event_type text not null,
  actor_id uuid references auth.users(id) on delete set null,
  station_id uuid references public.stations(id) on delete set null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists voucher_events_voucher_idx on public.voucher_events (voucher_id);
create index if not exists voucher_events_type_idx on public.voucher_events (event_type);

create table if not exists public.orders (
  id text primary key,
  bar_id uuid references public.stations(id) on delete set null,
  bar_name text,
  table_label text,
  status text not null,
  total numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  staff_number text,
  override_reason text,
  override_at timestamptz
);

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'bar_name'
  ) then
    alter table public.orders add column bar_name text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'total'
  ) then
    alter table public.orders add column total numeric(12,2);
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'staff_number'
  ) then
    alter table public.orders add column staff_number text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'override_reason'
  ) then
    alter table public.orders add column override_reason text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'override_at'
  ) then
    alter table public.orders add column override_at timestamptz;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'total'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'total_minor'
  ) then
    update public.orders
      set total = round((total_minor::numeric) / 100, 2)
      where total is null and total_minor is not null;
  end if;
end;
$$;

create or replace function public.orders_sync_admin_columns()
returns trigger
language plpgsql
as $$
begin
  if new.total is null and new.total_minor is not null then
    new.total := round((new.total_minor::numeric) / 100, 2);
  elsif new.total is not null then
    new.total_minor := round(new.total * 100)::integer;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_sync_admin_columns on public.orders;
create trigger orders_sync_admin_columns
before insert or update on public.orders
for each row execute function public.orders_sync_admin_columns();

create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_bar_idx on public.orders (bar_id);

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id text references public.orders(id) on delete cascade,
  type text not null,
  status text,
  actor_id uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

-- Ensure legacy checkout events (enum columns) stay in sync with admin-facing columns.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_events' and column_name = 'type'
  ) then
    alter table public.order_events add column type text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_events' and column_name = 'status'
  ) then
    alter table public.order_events add column status text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_events' and column_name = 'actor_id'
  ) then
    alter table public.order_events add column actor_id uuid;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_events' and column_name = 'station_id'
  ) then
    alter table public.order_events add column station_id uuid;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_events' and column_name = 'type'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_events' and column_name = 'event_type'
  ) then
    update public.order_events set type = event_type::text where type is null;
  end if;
end;
$$;

create or replace function public.order_events_sync_admin_columns()
returns trigger
language plpgsql
as $$
declare
  has_event_type boolean := exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_events' and column_name = 'event_type'
  );
  has_actor_type boolean := exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_events' and column_name = 'actor_type'
  );
begin
  if has_event_type then
    if new.type is null and new.event_type is not null then
      new.type := new.event_type::text;
    elsif new.type is not null then
      begin
        new.event_type := new.type::order_event_type;
      exception when others then
        new.event_type := 'admin_override';
      end;
    end if;
  end if;

  if has_actor_type and new.actor_id is not null and (new.actor_type is null or new.actor_type = '') then
    new.actor_type := 'admin';
  end if;

  return new;
end;
$$;

drop trigger if exists order_events_sync_admin_columns on public.order_events;
create trigger order_events_sync_admin_columns
before insert or update on public.order_events
for each row execute function public.order_events_sync_admin_columns();

create index if not exists order_events_order_idx on public.order_events (order_id);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_events' and column_name = 'type'
  ) then
    begin
      create index if not exists order_events_type_idx on public.order_events (type);
    exception when undefined_column then null;
    end;
  end if;
end;
$$;

create table if not exists public.qr_tokens (
  id uuid primary key default gen_random_uuid(),
  station_id uuid references public.stations(id) on delete set null,
  table_label text not null,
  token text not null,
  printed boolean not null default false,
  created_at timestamptz not null default now(),
  last_scan_at timestamptz
);

create unique index if not exists qr_tokens_token_key on public.qr_tokens (token);
create index if not exists qr_tokens_station_idx on public.qr_tokens (station_id);

create table if not exists public.campaign_targets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null,
  msisdn text not null,
  user_id uuid references auth.users(id) on delete set null,
  personalized_vars jsonb not null default '{}'::jsonb,
  status text not null default 'queued',
  error_code text,
  message_id text,
  last_update_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'campaign_targets_campaign_id_fkey'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'campaigns' and column_name = 'id' and data_type = 'uuid'
  ) then
    begin
      alter table public.campaign_targets
        add constraint campaign_targets_campaign_id_fkey
        foreign key (campaign_id) references public.campaigns(id) on delete cascade;
    exception when undefined_table then null;
    end;
  end if;
end;
$$;

create index if not exists campaign_targets_campaign_idx on public.campaign_targets (campaign_id);
create index if not exists campaign_targets_status_idx on public.campaign_targets (status);
create index if not exists campaign_targets_msisdn_idx on public.campaign_targets (msisdn);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  to_role text not null,
  type text not null,
  status text not null default 'queued',
  msisdn text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'notifications' and column_name = 'to_role'
  ) then
    alter table public.notifications add column to_role text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'notifications' and column_name = 'type'
  ) then
    alter table public.notifications add column type text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'notifications' and column_name = 'msisdn'
  ) then
    alter table public.notifications add column msisdn text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'notifications' and column_name = 'metadata'
  ) then
    alter table public.notifications add column metadata jsonb;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'notifications' and column_name = 'metadata'
  ) then
    update public.notifications set metadata = '{}'::jsonb where metadata is null;
    alter table public.notifications alter column metadata set default '{}'::jsonb;
    alter table public.notifications alter column metadata set not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'notifications' and column_name = 'status'
  ) then
    alter table public.notifications alter column status set default 'queued';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'notifications' and column_name = 'type'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'notifications' and column_name = 'notification_type'
  ) then
    update public.notifications set type = notification_type where type is null and notification_type is not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'notifications' and column_name = 'msisdn'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'notifications' and column_name = 'to_wa_id'
  ) then
    update public.notifications set msisdn = to_wa_id where msisdn is null and to_wa_id is not null;
  end if;

  update public.notifications
    set to_role = coalesce(to_role, 'whatsapp');
end;
$$;

create or replace function public.notifications_sync_admin_columns()
returns trigger
language plpgsql
as $$
begin
  if new.type is null and new.notification_type is not null then
    new.type := new.notification_type;
  elsif new.type is not null then
    new.notification_type := new.type;
  end if;

  if new.msisdn is null and new.to_wa_id is not null then
    new.msisdn := new.to_wa_id;
  elsif new.msisdn is not null and (new.to_wa_id is null or new.to_wa_id = '') then
    new.to_wa_id := new.msisdn;
  end if;

  if new.to_role is null then
    new.to_role := 'whatsapp';
  end if;

  if new.metadata is null then
    new.metadata := '{}'::jsonb;
  end if;

  return new;
end;
$$;

drop trigger if exists notifications_sync_admin_columns on public.notifications;
create trigger notifications_sync_admin_columns
before insert or update on public.notifications
for each row execute function public.notifications_sync_admin_columns();

create index if not exists notifications_status_idx on public.notifications (status);

create table if not exists public.insurance_quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  uploaded_docs text[] not null default '{}',
  premium numeric(12,2),
  insurer text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  reviewer_comment text
);

create index if not exists insurance_quotes_status_idx on public.insurance_quotes (status);
create index if not exists insurance_quotes_user_idx on public.insurance_quotes (user_id);

create table if not exists public.settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_table text not null,
  target_id text,
  diff jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'audit_log' and column_name = 'actor_id'
  ) then
    alter table public.audit_log add column actor_id uuid;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'audit_log' and column_name = 'target_table'
  ) then
    alter table public.audit_log add column target_table text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'audit_log' and column_name = 'target_id'
  ) then
    alter table public.audit_log add column target_id text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'audit_log' and column_name = 'diff'
  ) then
    alter table public.audit_log add column diff jsonb;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'audit_log' and column_name = 'diff'
  ) then
    update public.audit_log set diff = '{}'::jsonb where diff is null;
    alter table public.audit_log alter column diff set default '{}'::jsonb;
    alter table public.audit_log alter column diff set not null;
  end if;
end;
$$;

create or replace function public.audit_log_sync_admin_columns()
returns trigger
language plpgsql
as $$
begin
  if new.actor_id is not null and (new.actor is null or new.actor = '') then
    new.actor := new.actor_id::text;
  elsif new.actor_id is null and new.actor is not null then
    begin
      new.actor_id := new.actor::uuid;
    exception when others then
      -- leave actor_id null if actor is not a uuid
      null;
    end;
  end if;

  if new.diff is null then
    new.diff := '{}'::jsonb;
  end if;

  return new;
end;
$$;

drop trigger if exists audit_log_sync_admin_columns on public.audit_log;
create trigger audit_log_sync_admin_columns
before insert or update on public.audit_log
for each row execute function public.audit_log_sync_admin_columns();

create table if not exists public.idempotency_keys (
  key text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

-- Enable RLS and policies.

alter table public.stations enable row level security;
alter table public.vouchers enable row level security;
alter table public.voucher_events enable row level security;
alter table public.orders enable row level security;
alter table public.order_events enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_targets enable row level security;
alter table public.notifications enable row level security;
alter table public.insurance_quotes enable row level security;
alter table public.settings enable row level security;
alter table public.audit_log enable row level security;
alter table public.qr_tokens enable row level security;
alter table public.idempotency_keys enable row level security;

-- Stations policies
create policy stations_select on public.stations
  for select using (app.current_role() in ('admin','ops','station'));
create policy stations_insert on public.stations
  for insert with check (app.current_role() in ('admin','ops'));
create policy stations_update on public.stations
  for update using (app.current_role() in ('admin','ops')) with check (app.current_role() in ('admin','ops'));
create policy stations_delete on public.stations
  for delete using (app.current_role() = 'admin');

-- Vouchers policies
create policy vouchers_select on public.vouchers
  for select using (app.current_role() in ('admin','ops','station'));
create policy vouchers_insert on public.vouchers
  for insert with check (app.current_role() in ('admin','ops'));
create policy vouchers_update on public.vouchers
  for update using (app.current_role() in ('admin','ops')) with check (app.current_role() in ('admin','ops'));
create policy vouchers_delete on public.vouchers
  for delete using (app.current_role() = 'admin');

-- Voucher events read-only to admin/ops/station
create policy voucher_events_select on public.voucher_events
  for select using (app.current_role() in ('admin','ops','station'));
create policy voucher_events_insert on public.voucher_events
  for insert with check (app.current_role() in ('admin','ops'));
create policy voucher_events_delete on public.voucher_events
  for delete using (app.current_role() = 'admin');

-- QR tokens
create policy qr_tokens_select on public.qr_tokens
  for select using (app.current_role() in ('admin','ops','station'));
create policy qr_tokens_insert on public.qr_tokens
  for insert with check (app.current_role() in ('admin','ops'));
create policy qr_tokens_update on public.qr_tokens
  for update using (app.current_role() in ('admin','ops')) with check (app.current_role() in ('admin','ops'));
create policy qr_tokens_delete on public.qr_tokens
  for delete using (app.current_role() = 'admin');

-- Campaigns
create policy campaigns_select on public.campaigns
  for select using (app.current_role() in ('admin','ops'));
create policy campaigns_insert on public.campaigns
  for insert with check (app.current_role() in ('admin','ops'));
create policy campaigns_update on public.campaigns
  for update using (app.current_role() in ('admin','ops')) with check (app.current_role() in ('admin','ops'));
create policy campaigns_delete on public.campaigns
  for delete using (app.current_role() = 'admin');

-- Campaign targets (read/write admin + ops)
create policy campaign_targets_select on public.campaign_targets
  for select using (app.current_role() in ('admin','ops'));
create policy campaign_targets_insert on public.campaign_targets
  for insert with check (app.current_role() in ('admin','ops'));
create policy campaign_targets_update on public.campaign_targets
  for update using (app.current_role() in ('admin','ops')) with check (app.current_role() in ('admin','ops'));
create policy campaign_targets_delete on public.campaign_targets
  for delete using (app.current_role() = 'admin');

-- Notifications
create policy notifications_select on public.notifications
  for select using (app.current_role() in ('admin','ops'));
create policy notifications_update on public.notifications
  for update using (app.current_role() in ('admin','ops')) with check (app.current_role() in ('admin','ops'));
create policy notifications_delete on public.notifications
  for delete using (app.current_role() = 'admin');

-- Insurance quotes
create policy insurance_quotes_select on public.insurance_quotes
  for select using (app.current_role() in ('admin','ops'));
create policy insurance_quotes_insert on public.insurance_quotes
  for insert with check (app.current_role() in ('admin','ops'));
create policy insurance_quotes_update on public.insurance_quotes
  for update using (app.current_role() in ('admin','ops')) with check (app.current_role() in ('admin','ops'));
create policy insurance_quotes_delete on public.insurance_quotes
  for delete using (app.current_role() = 'admin');

-- Settings (admin write, ops read)
create policy settings_select on public.settings
  for select using (app.current_role() in ('admin','ops'));
create policy settings_modify on public.settings
  for insert with check (app.current_role() = 'admin');
create policy settings_update on public.settings
  for update using (app.current_role() = 'admin') with check (app.current_role() = 'admin');
create policy settings_delete on public.settings
  for delete using (app.current_role() = 'admin');

-- Audit log (admin/ops read, inserts allowed to service roles)
create policy audit_log_select on public.audit_log
  for select using (app.current_role() in ('admin','ops'));
create policy audit_log_insert on public.audit_log
  for insert with check (app.current_role() in ('admin','ops'));
create policy audit_log_delete on public.audit_log
  for delete using (app.current_role() = 'admin');

create policy idempotency_keys_rw on public.idempotency_keys
  for all using (app.current_role() in ('admin','ops'))
  with check (app.current_role() in ('admin','ops'));

COMMIT;
