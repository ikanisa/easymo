begin;

-- Ensure app.user_profiles contains data from legacy public.users table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND table_type = 'BASE TABLE'
  ) THEN
    INSERT INTO app.user_profiles (user_id, role, sacco_id)
    SELECT
      id,
      COALESCE(role::text, 'SACCO_STAFF')::public.app_role,
      sacco_id
    FROM public.users
    ON CONFLICT (user_id) DO UPDATE
      SET role = EXCLUDED.role,
          sacco_id = EXCLUDED.sacco_id;

    ALTER TABLE public.users RENAME TO users_legacy_20251024;
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.views
    WHERE table_schema = 'public'
      AND table_name = 'users'
  ) THEN
    DROP VIEW public.users;
  END IF;
END
$$;

-- Helper to drop existing public projections if they are tables/views
DO $$
DECLARE
  obj record;
BEGIN
  FOR obj IN
    SELECT table_name, table_type
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('saccos','ibimina','ikimina_members','sms_inbox','payments','accounts','ledger_entries','audit_logs')
  LOOP
    EXECUTE format('ALTER TABLE public.%I RENAME TO %I', obj.table_name, obj.table_name || '_legacy_20251024');
  END LOOP;

  FOR obj IN
    SELECT table_name
    FROM information_schema.views
    WHERE table_schema = 'public'
      AND table_name IN ('saccos','ibimina','ikimina_members','sms_inbox','payments','accounts','ledger_entries','audit_logs','ikimina_members_public')
  LOOP
    EXECUTE format('DROP VIEW public.%I CASCADE', obj.table_name);
  END LOOP;
END
$$;

-- Recreate core public views pointing to app schema -----------------------------------
create view public.users
with (security_barrier = true) as
select
  p.user_id as id,
  auth_users.email,
  coalesce(p.role, 'SACCO_STAFF')::public.app_role as role,
  p.sacco_id,
  auth_users.created_at,
  auth_users.updated_at,
  coalesce((auth_users.raw_user_meta_data ->> 'mfa_enabled')::boolean, false) as mfa_enabled,
  (auth_users.raw_user_meta_data ->> 'mfa_enrolled_at')::timestamptz as mfa_enrolled_at,
  coalesce((auth_users.raw_user_meta_data ->> 'mfa_passkey_enrolled')::boolean, false) as mfa_passkey_enrolled,
  coalesce((auth_users.raw_user_meta_data -> 'mfa_methods')::jsonb, '[]'::jsonb) as mfa_methods,
  coalesce((auth_users.raw_user_meta_data -> 'mfa_backup_hashes')::jsonb, '[]'::jsonb) as mfa_backup_hashes,
  coalesce((auth_users.raw_user_meta_data ->> 'failed_mfa_count')::int, 0) as failed_mfa_count,
  (auth_users.raw_user_meta_data ->> 'last_mfa_success_at')::timestamptz as last_mfa_success_at,
  (auth_users.raw_user_meta_data ->> 'last_mfa_step')::int as last_mfa_step,
  (auth_users.raw_user_meta_data ->> 'mfa_secret_enc') as mfa_secret_enc
from app.user_profiles p
join auth.users auth_users on auth_users.id = p.user_id;

alter view public.users set (security_barrier = true);
grant select on public.users to anon, authenticated, service_role;

create view public.saccos as
select
  id,
  name,
  district,
  sector_code,
  merchant_code,
  status,
  metadata,
  created_at,
  updated_at,
  coalesce(metadata->>'province', null::text) as province,
  coalesce(metadata->>'category', null::text) as category,
  coalesce(metadata->>'email', null::text) as email,
  coalesce(metadata->>'logo_url', null::text) as logo_url,
  coalesce(metadata->>'sector', null::text) as sector,
  coalesce(metadata->>'brand_color', null::text) as brand_color
from app.saccos;

alter view public.saccos set (security_barrier = true);
grant select on public.saccos to anon, authenticated, service_role;

create view public.ibimina as
select
  id,
  sacco_id,
  code,
  name,
  type,
  settings_json,
  status,
  created_at,
  updated_at
from app.ikimina;

alter view public.ibimina set (security_barrier = true);
grant select on public.ibimina to anon, authenticated, service_role;

create view public.ikimina_members as
select
  id,
  ikimina_id,
  member_code,
  full_name,
  national_id,
  msisdn,
  joined_at,
  status,
  created_at,
  updated_at,
  national_id_encrypted,
  national_id_hash,
  national_id_masked,
  msisdn_encrypted,
  msisdn_hash,
  msisdn_masked,
  sacco_id
from app.members;

alter view public.ikimina_members set (security_barrier = true);
grant select on public.ikimina_members to anon, authenticated, service_role;

create view public.sms_inbox as
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
  created_at
from app.sms_inbox;

alter view public.sms_inbox set (security_barrier = true);
grant select on public.sms_inbox to anon, authenticated, service_role;

create view public.payments as
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
  created_at
from app.payments;

alter view public.payments set (security_barrier = true);
grant select on public.payments to anon, authenticated, service_role;

create view public.accounts as
select
  id,
  sacco_id,
  owner_type,
  owner_id,
  currency,
  status,
  created_at
from app.accounts;

alter view public.accounts set (security_barrier = true);
grant select on public.accounts to anon, authenticated, service_role;

create view public.ledger_entries as
select
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
from app.ledger_entries;

alter view public.ledger_entries set (security_barrier = true);
grant select on public.ledger_entries to anon, authenticated, service_role;

create view public.audit_logs as
select
  id,
  sacco_id,
  actor,
  action,
  entity,
  entity_id,
  diff,
  created_at
from app.audit_logs;

alter view public.audit_logs set (security_barrier = true);
grant select on public.audit_logs to anon, authenticated, service_role;

create view public.ikimina_members_public
with (security_barrier = true) as
select
  m.id,
  m.ikimina_id,
  m.member_code,
  m.full_name,
  m.status,
  m.joined_at,
  m.msisdn_masked as msisdn,
  m.national_id_masked as national_id,
  i.name as ikimina_name,
  i.sacco_id
from app.members m
join app.ikimina i on i.id = m.ikimina_id;

grant select on public.ikimina_members_public to anon, authenticated, service_role;

-- Restore helper function for SACCO search ------------------------------------------------
DROP FUNCTION IF EXISTS public.search_saccos(text, integer, text, text);
CREATE FUNCTION public.search_saccos(
  query text default null,
  limit_count integer default 20,
  district_filter text default null,
  sector_filter text default null
)
returns table (
  id uuid,
  name text,
  district text,
  sector_code text,
  merchant_code text,
  province text,
  category text
)
language sql
security definer
set search_path = public
as $$
  select
    s.id,
    s.name,
    s.district,
    s.sector_code,
    s.merchant_code,
    coalesce(s.province, null::text) as province,
    coalesce(s.category, null::text) as category
  from public.saccos s
  where (
    query is null
    or s.name ilike '%' || query || '%'
    or s.merchant_code ilike '%' || query || '%'
    or s.sector_code ilike '%' || query || '%'
  )
  and (district_filter is null or s.district = district_filter)
  and (sector_filter is null or s.sector_code = sector_filter)
  order by s.name asc
  limit greatest(coalesce(limit_count, 20), 1);
$$;

grant execute on function public.search_saccos(text, integer, text, text) to anon, authenticated, service_role;

-- Recreate analytics materialized views if missing ----------------------------------------
create materialized view if not exists public.analytics_payment_rollups_mv as
with params as (
  select
    timezone('utc', current_date)::timestamp as today_start,
    timezone('utc', current_date - interval '7 days')::timestamp as week_start,
    date_trunc('month', timezone('utc', current_date)) as month_start,
    timezone('utc', now()) as refreshed_at
),
scoped as (
  select
    p.sacco_id,
    p.amount,
    p.status,
    p.occurred_at,
    params.today_start,
    params.week_start,
    params.month_start,
    params.refreshed_at
  from public.payments p
  cross join params
)
select
  sacco_id,
  sum(case when status in ('POSTED','SETTLED') and occurred_at >= month_start then amount else 0 end) as month_total,
  sum(case when status in ('POSTED','SETTLED') and occurred_at >= week_start then amount else 0 end) as week_total,
  sum(case when status in ('POSTED','SETTLED') and occurred_at >= today_start then amount else 0 end) as today_total,
  count(*) filter (where status = 'UNALLOCATED') as unallocated_count,
  max(occurred_at) filter (where status in ('POSTED','SETTLED')) as latest_payment_at,
  max(refreshed_at) as refreshed_at
from scoped
group by rollup(sacco_id);

create unique index if not exists analytics_payment_rollups_mv_sacco_idx
  on public.analytics_payment_rollups_mv ((coalesce(sacco_id::text, '00000000-0000-0000-0000-000000000000')));

create materialized view if not exists public.analytics_ikimina_monthly_mv as
with params as (
  select
    date_trunc('month', timezone('utc', current_date)) as month_start,
    timezone('utc', now()) as refreshed_at
)
select
  i.id as ikimina_id,
  i.sacco_id,
  i.name,
  i.code,
  i.status,
  i.updated_at,
  coalesce(sum(case when p.status in ('POSTED','SETTLED') and p.occurred_at >= params.month_start then p.amount else 0 end), 0) as month_total,
  coalesce(count(distinct case when p.status in ('POSTED','SETTLED') and p.occurred_at >= params.month_start then p.member_id end), 0) as contributing_members,
  count(distinct case when m.status = 'ACTIVE' then m.id end) as active_member_count,
  max(p.occurred_at) filter (where p.status in ('POSTED','SETTLED')) as last_contribution_at,
  max(params.refreshed_at) as refreshed_at
from public.ibimina i
cross join params
left join public.payments p on p.ikimina_id = i.id
left join public.ikimina_members m on m.ikimina_id = i.id
where i.status = 'ACTIVE'
group by i.id, i.sacco_id, i.name, i.code, i.status, i.updated_at, params.month_start;

create unique index if not exists analytics_ikimina_monthly_mv_pk
  on public.analytics_ikimina_monthly_mv (ikimina_id);

create index if not exists analytics_ikimina_monthly_mv_sacco_idx
  on public.analytics_ikimina_monthly_mv (sacco_id, month_total desc);

create materialized view if not exists public.analytics_member_last_payment_mv as
with params as (
  select timezone('utc', now()) as refreshed_at
)
select
  m.id as member_id,
  i.sacco_id,
  m.ikimina_id,
  m.member_code,
  m.full_name,
  m.msisdn,
  m.status,
  i.name as ikimina_name,
  max(case when p.status in ('POSTED','SETTLED') then p.occurred_at end) as last_payment_at,
  coalesce(
    date_part('day', max(params.refreshed_at) - max(case when p.status in ('POSTED','SETTLED') then p.occurred_at end)),
    999
  )::int as days_since_last,
  max(params.refreshed_at) as refreshed_at
from public.ikimina_members m
left join public.ibimina i on i.id = m.ikimina_id
left join public.payments p on p.member_id = m.id
cross join params
where m.status = 'ACTIVE'
group by m.id, i.sacco_id, m.ikimina_id, m.member_code, m.full_name, m.msisdn, m.status, i.name;

create unique index if not exists analytics_member_last_payment_mv_pk
  on public.analytics_member_last_payment_mv (member_id);

create index if not exists analytics_member_last_payment_mv_sacco_idx
  on public.analytics_member_last_payment_mv (sacco_id, days_since_last desc);

create or replace function public.analytics_refresh_dashboard_materialized_views()
returns void
language sql
security definer
set search_path = public, analytics
as $$
  select analytics.refresh_dashboard_materialized_views();
$$;

grant execute on function public.analytics_refresh_dashboard_materialized_views() to service_role;

commit;
