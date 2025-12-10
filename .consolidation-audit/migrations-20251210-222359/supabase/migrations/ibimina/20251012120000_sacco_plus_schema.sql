-- SACCO+ greenfield schema, security, and job orchestration
-- Creates SACCO-scoped application schema, operational helpers, RLS policies,
-- and scheduled procedures for nightly reconciliation and monthly close.

-- 1. Extensions and schemas ---------------------------------------------------
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
do $$
begin
  if current_database() = 'postgres'
     and exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';
  end if;
end;
$$;

create schema if not exists app;
create schema if not exists ops;

-- 2. Core entities ------------------------------------------------------------
create table if not exists app.saccos (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  district text not null,
  sector_code text not null,
  merchant_code text not null,
  status text not null default 'ACTIVE',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('UTC', now()),
  updated_at timestamptz not null default timezone('UTC', now())
);

drop trigger if exists saccos_touch_updated_at on app.saccos;
create trigger saccos_touch_updated_at
before update on app.saccos
for each row
execute function public.set_updated_at();

create table if not exists app.ikimina (
  id uuid primary key default gen_random_uuid(),
  sacco_id uuid not null references app.saccos(id) on delete cascade,
  code text not null unique,
  name text not null,
  type text not null default 'ASCA',
  settings jsonb not null default '{}'::jsonb,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default timezone('UTC', now()),
  updated_at timestamptz not null default timezone('UTC', now())
);

drop trigger if exists ikimina_touch_updated_at on app.ikimina;
create trigger ikimina_touch_updated_at
before update on app.ikimina
for each row
execute function public.set_updated_at();

create table if not exists app.members (
  id uuid primary key default gen_random_uuid(),
  ikimina_id uuid not null references app.ikimina(id) on delete cascade,
  sacco_id uuid not null references app.saccos(id) on delete cascade,
  member_code text,
  full_name text not null,
  national_id text,
  national_id_encrypted text,
  national_id_hash text,
  national_id_masked text,
  msisdn text not null,
  msisdn_encrypted text,
  msisdn_hash text,
  msisdn_masked text,
  joined_at timestamptz not null default timezone('UTC', now()),
  status text not null default 'ACTIVE',
  created_at timestamptz not null default timezone('UTC', now()),
  updated_at timestamptz not null default timezone('UTC', now()),
  unique (ikimina_id, member_code)
);

create index if not exists idx_members_sacco on app.members(sacco_id);
create index if not exists idx_members_msisdn_hash on app.members(msisdn_hash);
create index if not exists idx_members_national_hash on app.members(national_id_hash);

drop trigger if exists members_touch_updated_at on app.members;
create trigger members_touch_updated_at
before update on app.members
for each row
execute function public.set_updated_at();

create table if not exists app.accounts (
  id uuid primary key default gen_random_uuid(),
  sacco_id uuid references app.saccos(id) on delete set null,
  owner_type text not null, -- IKIMINA|SACCO|MOMO_CLEARING|MOMO_SETTLEMENT|FEE|AWARD
  owner_id uuid,
  currency text not null default 'RWF',
  status text not null default 'ACTIVE',
  created_at timestamptz not null default timezone('UTC', now())
);

create index if not exists idx_accounts_owner on app.accounts(owner_type, owner_id);
create index if not exists idx_accounts_sacco on app.accounts(sacco_id);

create table if not exists app.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  sacco_id uuid references app.saccos(id) on delete set null,
  debit_id uuid not null references app.accounts(id),
  credit_id uuid not null references app.accounts(id),
  amount bigint not null check (amount > 0),
  currency text not null default 'RWF',
  value_date date not null default current_date,
  external_id text,
  memo text,
  created_at timestamptz not null default timezone('UTC', now())
);

create index if not exists idx_ledger_created on app.ledger_entries(created_at desc);
create index if not exists idx_ledger_external on app.ledger_entries(external_id);

create table if not exists app.import_files (
  id uuid primary key default gen_random_uuid(),
  sacco_id uuid references app.saccos(id),
  type text not null check (type in ('STATEMENT','SMS')),
  filename text not null,
  uploaded_by uuid,
  uploaded_at timestamptz not null default timezone('UTC', now()),
  status text not null default 'RECEIVED',
  error text
);

create table if not exists app.sms_inbox (
  id uuid primary key default gen_random_uuid(),
  sacco_id uuid references app.saccos(id),
  raw_text text not null,
  msisdn text,
  msisdn_encrypted text,
  msisdn_hash text,
  msisdn_masked text,
  received_at timestamptz not null,
  vendor_meta jsonb,
  parsed_json jsonb,
  parse_source text,
  confidence numeric,
  status text not null default 'NEW',
  error text,
  created_at timestamptz not null default timezone('UTC', now())
);

create index if not exists idx_sms_sacco_status on app.sms_inbox(sacco_id, status);
create index if not exists idx_sms_received_at on app.sms_inbox(received_at desc);
create index if not exists idx_sms_msisdn_hash on app.sms_inbox(msisdn_hash);

create table if not exists app.payments (
  id uuid primary key default gen_random_uuid(),
  channel text not null default 'SMS',
  sacco_id uuid not null references app.saccos(id),
  ikimina_id uuid references app.ikimina(id),
  member_id uuid references app.members(id),
  msisdn text not null,
  msisdn_encrypted text,
  msisdn_hash text,
  msisdn_masked text,
  amount bigint not null,
  currency text not null default 'RWF',
  txn_id text not null,
  reference text,
  occurred_at timestamptz not null,
  status text not null default 'PENDING',
  source_id uuid references app.sms_inbox(id),
  ai_version text,
  confidence numeric,
  created_at timestamptz not null default timezone('UTC', now()),
  unique (txn_id, amount, occurred_at)
);

create index if not exists idx_payments_sacco_status on app.payments(sacco_id, status);
create index if not exists idx_payments_msisdn_hash on app.payments(msisdn_hash);
create index if not exists idx_payments_txn_id on app.payments(txn_id);
create index if not exists idx_payments_reference on app.payments(reference);
create index if not exists idx_payments_occurred_at on app.payments(occurred_at desc);

create table if not exists app.recon_exceptions (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references app.payments(id) on delete cascade,
  reason text not null,
  status text not null default 'OPEN',
  note text,
  created_at timestamptz not null default timezone('UTC', now()),
  resolved_at timestamptz
);

create index if not exists idx_recon_payment on app.recon_exceptions(payment_id);
create index if not exists idx_recon_status on app.recon_exceptions(status);

create table if not exists app.audit_logs (
  id uuid primary key default gen_random_uuid(),
  sacco_id uuid references app.saccos(id),
  actor uuid,
  action text not null,
  entity text,
  entity_id uuid,
  diff jsonb,
  created_at timestamptz not null default timezone('UTC', now())
);

create index if not exists idx_audit_entity on app.audit_logs(entity, entity_id);
create index if not exists idx_audit_actor on app.audit_logs(actor);

create table if not exists app.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sacco_id uuid references app.saccos(id),
  role text not null default 'SACCO_STAFF',
  created_at timestamptz not null default timezone('UTC', now()),
  updated_at timestamptz not null default timezone('UTC', now())
);

drop trigger if exists user_profiles_touch_updated_at on app.user_profiles;
create trigger user_profiles_touch_updated_at
before update on app.user_profiles
for each row
execute function public.set_updated_at();

create or replace function app.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = app, public
as $$
begin
  insert into app.user_profiles(user_id, role, sacco_id)
  values (new.id, 'SACCO_STAFF', null)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists app_on_auth_user_created on auth.users;
create trigger app_on_auth_user_created
after insert on auth.users
for each row
execute function app.handle_new_auth_user();

create table if not exists app.devices_trusted (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_hash text not null,
  device_label text,
  last_seen_at timestamptz not null default timezone('UTC', now()),
  expires_at timestamptz not null default timezone('UTC', now()) + interval '90 days',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('UTC', now()),
  unique (user_id, device_hash)
);

-- 3. Operational helpers ------------------------------------------------------
create table if not exists ops.rate_limits (
  bucket_key text not null,
  route text not null,
  window_started timestamptz not null,
  count integer not null default 0,
  primary key (bucket_key, route, window_started)
);

create index if not exists idx_rate_limits_expiry on ops.rate_limits(window_started);

create or replace function ops.consume_rate_limit(
  bucket_key_raw text,
  route text,
  max_hits integer,
  window_seconds integer
)
returns boolean
language plpgsql
as $$
declare
  span integer := greatest(window_seconds, 1);
  now_utc timestamptz := timezone('UTC', now());
  window_start timestamptz := now_utc - make_interval(secs => mod(floor(extract(epoch from now_utc))::int, span));
  bucket_key text := coalesce(nullif(trim(bucket_key_raw), ''), 'anonymous');
  new_count integer;
begin
  insert into ops.rate_limits(bucket_key, route, window_started, count)
  values (bucket_key, route, window_start, 1)
  on conflict (bucket_key, route, window_started)
  do update set count = ops.rate_limits.count + 1
  returning count into new_count;

  delete from ops.rate_limits
  where window_started < now_utc - make_interval(secs => span * 2);

  return new_count <= max_hits;
end;
$$;

create or replace function public.consume_route_rate_limit(
  bucket_key text,
  route text,
  max_hits integer,
  window_seconds integer
)
returns boolean
language sql
stable
security definer
set search_path = public, ops
as $$
  select ops.consume_rate_limit(bucket_key, route, max_hits, window_seconds);
$$;

create table if not exists ops.idempotency (
  user_id uuid not null,
  key text not null,
  request_hash text not null,
  response jsonb,
  created_at timestamptz not null default timezone('UTC', now()),
  expires_at timestamptz not null,
  primary key (user_id, key)
);

create index if not exists idx_idempotency_expires on ops.idempotency(expires_at);

-- 4. Utility functions --------------------------------------------------------
create or replace function app.current_sacco()
returns uuid
language sql
stable
security definer
set search_path = app, public
as $$
  select sacco_id
  from app.user_profiles
  where user_id = auth.uid()
$$;

create or replace function app.current_role()
returns text
language sql
stable
security definer
set search_path = app, public
as $$
  select role
  from app.user_profiles
  where user_id = auth.uid()
$$;

create or replace function app.is_admin()
returns boolean
language sql
stable
security definer
set search_path = app, public
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'SYSTEM_ADMIN',
    false
  )
  or coalesce(app.current_role() = 'SYSTEM_ADMIN', false)
$$;

create or replace function app.member_sacco(member_id uuid)
returns uuid
language sql
stable
security definer
set search_path = app, public
as $$
  select sacco_id
  from app.members
  where id = member_id
$$;

create or replace function app.payment_sacco(payment_id uuid)
returns uuid
language sql
stable
security definer
set search_path = app, public
as $$
  select sacco_id
  from app.payments
  where id = payment_id
$$;

create or replace function app.account_sacco(account_id uuid)
returns uuid
language sql
stable
security definer
set search_path = app, public
as $$
  select sacco_id
  from app.accounts
  where id = account_id
$$;

create or replace function app.account_balance(account_id uuid)
returns numeric
language sql
stable
security definer
set search_path = app, public
as $$
  with movements as (
    select
      sum(case when credit_id = account_id then amount else 0 end) as credits,
      sum(case when debit_id = account_id then amount else 0 end) as debits
    from app.ledger_entries
    where debit_id = account_id or credit_id = account_id
  )
  select coalesce(credits, 0) - coalesce(debits, 0)
  from movements;
$$;

create or replace function public.account_balance(account_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public, app
as $$
  select app.account_balance(account_id);
$$;

-- 5. Row level security -------------------------------------------------------
alter table app.user_profiles enable row level security;
alter table app.user_profiles force row level security;
alter table app.saccos enable row level security;
alter table app.saccos force row level security;
alter table app.ikimina enable row level security;
alter table app.ikimina force row level security;
alter table app.members enable row level security;
alter table app.members force row level security;
alter table app.payments enable row level security;
alter table app.payments force row level security;
alter table app.recon_exceptions enable row level security;
alter table app.recon_exceptions force row level security;
alter table app.accounts enable row level security;
alter table app.accounts force row level security;
alter table app.ledger_entries enable row level security;
alter table app.ledger_entries force row level security;
alter table app.sms_inbox enable row level security;
alter table app.sms_inbox force row level security;
alter table app.import_files enable row level security;
alter table app.audit_logs enable row level security;
alter table app.audit_logs force row level security;
alter table app.devices_trusted enable row level security;
alter table ops.rate_limits enable row level security;
alter table ops.idempotency enable row level security;

-- user_profiles
create policy user_self_read
  on app.user_profiles
  for select
  using (auth.uid() = user_id);

create policy admin_manage_profiles
  on app.user_profiles
  for all
  using (app.is_admin());

-- saccos
create policy sacco_select_admin
  on app.saccos
  for select
  using (app.is_admin());

create policy sacco_select_staff
  on app.saccos
  for select
  using (id = app.current_sacco());

create policy sacco_manage_admin
  on app.saccos
  for all
  using (app.is_admin());

-- ikimina
create policy ikimina_select
  on app.ikimina
  for select
  using (app.is_admin() or sacco_id = app.current_sacco());

create policy ikimina_modify
  on app.ikimina
  for all
  using (app.is_admin() or sacco_id = app.current_sacco());

-- members
create policy members_select
  on app.members
  for select
  using (
    app.is_admin()
    or sacco_id = app.current_sacco()
  );

create policy members_modify
  on app.members
  for all
  using (
    app.is_admin()
    or sacco_id = app.current_sacco()
  );

-- payments
create policy payments_select
  on app.payments
  for select
  using (
    app.is_admin()
    or sacco_id = app.current_sacco()
  );

create policy payments_insert
  on app.payments
  for insert
  with check (
    app.is_admin()
    or sacco_id = app.current_sacco()
  );

create policy payments_update
  on app.payments
  for update
  using (
    app.is_admin()
    or sacco_id = app.current_sacco()
  );

-- recon exceptions
create policy recon_select
  on app.recon_exceptions
  for select
  using (
    app.is_admin()
    or app.payment_sacco(payment_id) = app.current_sacco()
  );

create policy recon_modify
  on app.recon_exceptions
  for all
  using (
    app.is_admin()
    or app.payment_sacco(payment_id) = app.current_sacco()
  );

-- accounts
create policy accounts_select
  on app.accounts
  for select
  using (
    app.is_admin()
    or sacco_id = app.current_sacco()
  );

create policy accounts_modify_admin
  on app.accounts
  for all
  using (app.is_admin());

-- ledger entries
create policy ledger_select
  on app.ledger_entries
  for select
  using (
    app.is_admin()
    or sacco_id = app.current_sacco()
  );

create policy ledger_modify_admin
  on app.ledger_entries
  for all
  using (app.is_admin());

-- sms inbox
create policy sms_select
  on app.sms_inbox
  for select
  using (
    app.is_admin()
    or sacco_id = app.current_sacco()
  );

create policy sms_modify
  on app.sms_inbox
  for all
  using (
    app.is_admin()
    or sacco_id = app.current_sacco()
  );

-- import files
create policy import_select
  on app.import_files
  for select
  using (
    app.is_admin()
    or sacco_id = app.current_sacco()
  );

create policy import_modify
  on app.import_files
  for all
  using (
    app.is_admin()
    or sacco_id = app.current_sacco()
  );

-- audit logs
create policy audit_select
  on app.audit_logs
  for select
  using (
    app.is_admin()
    or actor = auth.uid()
  );

create policy audit_insert
  on app.audit_logs
  for insert
  with check (true);

-- devices trusted
create policy devices_self_manage
  on app.devices_trusted
  for all
  using (
    auth.uid() = user_id
    or app.is_admin()
  )
  with check (
    auth.uid() = user_id
    or app.is_admin()
  );

-- ops.rate_limits
create policy rate_limits_admin
  on ops.rate_limits
  for all
  using (app.is_admin())
  with check (app.is_admin());

-- ops.idempotency
create policy idempotency_user_access
  on ops.idempotency
  for select
  using (auth.uid() = user_id or app.is_admin());

create policy idempotency_user_write
  on ops.idempotency
  for insert
  with check (auth.uid() = user_id or app.is_admin());

create policy idempotency_user_update
  on ops.idempotency
  for update
  using (auth.uid() = user_id or app.is_admin());

-- 6. Stored procedures --------------------------------------------------------
-- Stored Procedure: Nightly Reconciliation
-- Reopens all closed reconciliation exceptions for review
-- This procedure runs nightly at 2 AM via pg_cron to ensure that any
-- previously closed exceptions are re-examined. This helps catch cases where
-- payments may have been incorrectly matched or need additional review.
-- 
-- Schedule: Daily at 2:00 AM UTC (via cron job 00-nightly-recon)
-- Impact: Reopens all non-OPEN exceptions by setting status to OPEN and clearing resolved_at
create or replace procedure ops.sp_nightly_recon()
language plpgsql
as $$
begin
  -- Widen matching window for potential duplicates and reopen unresolved items.
  update app.recon_exceptions re
    set status = 'OPEN',
        resolved_at = null
  where re.status <> 'OPEN';
end;
$$;

-- Stored Procedure: Monthly Close
-- Creates an immutable audit log entry marking the end of a monthly period
-- This procedure runs on the 1st of each month at 2:10 AM to create a
-- checkpoint in the audit trail. Used for regulatory reporting and ensures
-- a clear audit trail of monthly accounting periods.
-- 
-- Schedule: Monthly on the 1st at 2:10 AM UTC (via cron job 01-monthly-close)
-- Impact: Inserts a MONTHLY_CLOSE audit log entry with UTC timestamp
create or replace procedure ops.sp_monthly_close()
language plpgsql
as $$
begin
  insert into app.audit_logs(action, entity, diff, created_at)
  values (
    'MONTHLY_CLOSE',
    'SYSTEM',
    jsonb_build_object('timestamp', timezone('UTC', now())),
    timezone('UTC', now())
  );
end;
$$;

-- 7. Scheduling ---------------------------------------------------------------
do $$
declare
  nightly_id int;
begin
  if current_database() = 'postgres'
     and exists (select 1 from pg_extension where extname = 'pg_cron') then
    select jobid into nightly_id from cron.job where jobname = '00-nightly-recon';
    if nightly_id is null then
      select cron.schedule('00-nightly-recon', '0 2 * * *', 'call ops.sp_nightly_recon();') into nightly_id;
    else
      perform cron.unschedule('00-nightly-recon');
      select cron.schedule('00-nightly-recon', '0 2 * * *', 'call ops.sp_nightly_recon();') into nightly_id;
    end if;
  end if;
end;
$$;

do $$
declare
  monthly_id int;
begin
  if current_database() = 'postgres'
     and exists (select 1 from pg_extension where extname = 'pg_cron') then
    select jobid into monthly_id from cron.job where jobname = '01-monthly-close';
    if monthly_id is null then
      select cron.schedule('01-monthly-close', '10 2 1 * *', 'call ops.sp_monthly_close();') into monthly_id;
    else
      perform cron.unschedule('01-monthly-close');
      select cron.schedule('01-monthly-close', '10 2 1 * *', 'call ops.sp_monthly_close();') into monthly_id;
    end if;
  end if;
end;
$$;

-- 8. Housekeeping helpers -----------------------------------------------------
comment on table app.saccos is 'Registered SACCOs participating in SACCO+ system.';
comment on table app.ikimina is 'Local savings groups belonging to a SACCO.';
comment on table app.members is 'Members enrolled under a SACCO/Ikimina pair.';
comment on table app.accounts is 'Ledger accounts for double-entry bookkeeping.';
comment on table app.ledger_entries is 'Ledger movements with debit/credit enforcement.';
comment on table app.payments is 'Inbound payments derived from SMS or reconciliations.';
comment on table app.sms_inbox is 'Inbound SMS payloads awaiting parsing and mapping.';
comment on table app.recon_exceptions is 'Payments requiring manual resolution.';
comment on table app.audit_logs is 'Immutable audit trail for privileged actions.';
comment on table app.import_files is 'Uploaded files (statements, SMS dumps) for ingestion.';
comment on table app.user_profiles is 'SACCO-scoped roles mapped to auth.users.';
comment on table app.devices_trusted is 'Trusted device fingerprints for MFA bypass.';
comment on table ops.rate_limits is 'Per-route rate limiter buckets (ip/user/service).';
comment on table ops.idempotency is 'Idempotent request ledger for Edge functions.';
