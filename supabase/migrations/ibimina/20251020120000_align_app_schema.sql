-- Align app schema with legacy public tables and seed existing data

begin;

do $$
begin
  if exists (
    select 1
    from pg_views
    where schemaname = 'public'
      and viewname in ('ledger_entries', 'payments')
  ) then
    execute 'drop view if exists public.ledger_entries cascade';
    execute 'drop view if exists public.payments cascade';
  end if;
end$$;
-- Allow merchant_code to be null so we can migrate legacy rows without values
alter table if exists app.saccos
  alter column merchant_code drop not null;
-- Add extended profile columns to app.saccos
alter table if exists app.saccos
  add column if not exists province text,
  add column if not exists email text,
  add column if not exists category text default 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)',
  add column if not exists logo_url text,
  add column if not exists sector text,
  add column if not exists brand_color text;
-- Remove old search helpers if present so we can recreate them as generated columns
alter table if exists app.saccos
  drop column if exists search_slug cascade,
  drop column if exists search_document cascade;
alter table if exists app.saccos
  add column search_slug text generated always as (
    trim(both '-' from lower(regexp_replace(coalesce(name, ''), '[^a-z0-9]+', '-', 'g')))
  ) stored,
  add column search_document tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A')
    || setweight(to_tsvector('simple', coalesce(district, '')), 'B')
    || setweight(to_tsvector('simple', coalesce(sector, '')), 'C')
  ) stored;
create index if not exists app_saccos_search_document_idx
  on app.saccos using gin (search_document);
-- Ensure ikimina settings column matches legacy naming
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'app'
      and table_name = 'ikimina'
      and column_name = 'settings'
  ) then
    alter table app.ikimina
      rename column settings to settings_json;
  end if;
end;
$$;
alter table if exists app.ikimina
  alter column settings_json set default '{}'::jsonb;
-- Align ledger/account/payment/sms types with legacy expectations
alter table if exists app.accounts
  add column if not exists balance integer default 0,
  add column if not exists updated_at timestamptz not null default timezone('UTC', now());
alter table if exists app.ledger_entries
  alter column amount type integer using amount::integer,
  alter column value_date type timestamptz using timezone('UTC', value_date::timestamp),
  alter column value_date set default timezone('UTC', now());
alter table if exists app.payments
  alter column amount type integer using amount::integer,
  alter column confidence type double precision using confidence::double precision,
  alter column created_at set default timezone('UTC', now());
alter table if exists app.sms_inbox
  alter column confidence type double precision using confidence::double precision;
-- Seed data from public tables where present
insert into app.saccos (
  id,
  name,
  district,
  sector_code,
  merchant_code,
  status,
  metadata,
  created_at,
  updated_at,
  province,
  email,
  category,
  logo_url,
  sector,
  brand_color
)
select
  id,
  name,
  district,
  sector_code,
  null,
  status,
  '{}'::jsonb,
  coalesce(created_at, timezone('UTC', now())),
  coalesce(updated_at, timezone('UTC', now())),
  province,
  email,
  category,
  logo_url,
  sector,
  brand_color
from public.saccos
on conflict (id) do update
  set
    name = excluded.name,
    district = excluded.district,
    sector_code = excluded.sector_code,
    status = excluded.status,
    province = excluded.province,
    email = excluded.email,
    category = excluded.category,
    logo_url = excluded.logo_url,
    sector = excluded.sector,
    brand_color = excluded.brand_color,
    updated_at = excluded.updated_at;
insert into app.ikimina (
  id,
  sacco_id,
  code,
  name,
  type,
  settings_json,
  status,
  created_at,
  updated_at
)
select
  id,
  sacco_id,
  code,
  name,
  type,
  settings_json,
  status,
  coalesce(created_at, timezone('UTC', now())),
  coalesce(updated_at, timezone('UTC', now()))
from public.ibimina
on conflict (id) do nothing;
insert into app.members (
  id,
  ikimina_id,
  sacco_id,
  member_code,
  full_name,
  national_id,
  national_id_encrypted,
  national_id_hash,
  national_id_masked,
  msisdn,
  msisdn_encrypted,
  msisdn_hash,
  msisdn_masked,
  joined_at,
  status,
  created_at,
  updated_at
)
select
  id,
  ikimina_id,
  (select sacco_id from public.ibimina where public.ibimina.id = ikimina_members.ikimina_id),
  member_code,
  full_name,
  national_id,
  national_id_encrypted,
  national_id_hash,
  national_id_masked,
  msisdn,
  msisdn_encrypted,
  msisdn_hash,
  msisdn_masked,
  coalesce(joined_at, timezone('UTC', now())),
  status,
  coalesce(created_at, timezone('UTC', now())),
  coalesce(updated_at, timezone('UTC', now()))
from public.ikimina_members
on conflict (id) do nothing;
insert into app.sms_inbox (
  id,
  sacco_id,
  raw_text,
  msisdn,
  msisdn_encrypted,
  msisdn_hash,
  msisdn_masked,
  received_at,
  vendor_meta,
  parsed_json,
  parse_source,
  confidence,
  status,
  error,
  created_at
)
select
  id,
  sacco_id,
  raw_text,
  msisdn,
  msisdn_encrypted,
  msisdn_hash,
  msisdn_masked,
  received_at,
  vendor_meta,
  parsed_json,
  parse_source,
  confidence,
  status,
  error,
  coalesce(created_at, timezone('UTC', now()))
from public.sms_inbox
on conflict (id) do nothing;
insert into app.payments (
  id,
  channel,
  sacco_id,
  ikimina_id,
  member_id,
  msisdn,
  msisdn_encrypted,
  msisdn_hash,
  msisdn_masked,
  amount,
  currency,
  txn_id,
  reference,
  occurred_at,
  status,
  source_id,
  ai_version,
  confidence,
  created_at
)
select
  id,
  channel,
  sacco_id,
  ikimina_id,
  member_id,
  msisdn,
  msisdn_encrypted,
  msisdn_hash,
  msisdn_masked,
  amount,
  currency,
  txn_id,
  reference,
  occurred_at,
  status,
  source_id,
  ai_version,
  confidence,
  coalesce(created_at, timezone('UTC', now()))
from public.payments
on conflict (id) do nothing;
insert into app.accounts (
  id,
  sacco_id,
  owner_type,
  owner_id,
  currency,
  status,
  balance,
  created_at,
  updated_at
)
select
  id,
  null,
  owner_type,
  owner_id,
  currency,
  status,
  coalesce(balance, 0),
  coalesce(created_at, timezone('UTC', now())),
  coalesce(updated_at, timezone('UTC', now()))
from public.accounts
on conflict (id) do nothing;
insert into app.ledger_entries (
  id,
  sacco_id,
  debit_id,
  credit_id,
  amount,
  currency,
  value_date,
  external_id,
  memo,
  created_at
)
select
  id,
  null,
  debit_id,
  credit_id,
  amount,
  currency,
  coalesce(value_date, timezone('UTC', now())),
  external_id,
  memo,
  coalesce(created_at, timezone('UTC', now()))
from public.ledger_entries
on conflict (id) do nothing;
do $$
declare
  has_sacco boolean;
begin
  if to_regclass('public.audit_logs') is not null then
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'audit_logs'
        and column_name = 'sacco_id'
    ) into has_sacco;

    if has_sacco then
      insert into app.audit_logs (
        id,
        sacco_id,
        actor,
        action,
        entity,
        entity_id,
        diff,
        created_at
      )
      select
        id,
        sacco_id,
        actor_id,
        action,
        entity,
        entity_id,
        diff_json,
        coalesce(created_at, timezone('UTC', now()))
      from public.audit_logs
      on conflict (id) do nothing;
    else
      insert into app.audit_logs (
        id,
        sacco_id,
        actor,
        action,
        entity,
        entity_id,
        diff,
        created_at
      )
      select
        id,
        null,
        actor_id,
        action,
        entity,
        entity_id,
        diff_json,
        coalesce(created_at, timezone('UTC', now()))
      from public.audit_logs
      on conflict (id) do nothing;
    end if;
  end if;
end;
$$;
do $$
begin
  if to_regclass('public.import_files') is not null then
    insert into app.import_files (
      id,
      sacco_id,
      type,
      filename,
      uploaded_by,
      uploaded_at,
      status,
      error
    )
    select
      id,
      sacco_id,
      type,
      filename,
      uploaded_by,
      coalesce(uploaded_at, timezone('UTC', now())),
      status,
      error
    from public.import_files
    on conflict (id) do nothing;
  end if;
end;
$$;
do $$
begin
  if to_regclass('public.recon_exceptions') is not null then
    insert into app.recon_exceptions (
      id,
      payment_id,
      reason,
      status,
      note,
      created_at,
      resolved_at
    )
    select
      id,
      payment_id,
      reason,
      status,
      note,
      coalesce(created_at, timezone('UTC', now())),
      resolved_at
    from public.recon_exceptions
    on conflict (id) do nothing;
  end if;
end;
$$;
commit;
