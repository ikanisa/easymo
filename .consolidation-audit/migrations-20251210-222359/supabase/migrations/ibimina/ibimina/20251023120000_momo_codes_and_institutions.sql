-- District MoMo codes and financial institution registry

-- 1. Financial institution kind enum
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'financial_institution_kind'
      and n.nspname = 'app'
  ) then
    create type app.financial_institution_kind as enum ('SACCO', 'MICROFINANCE', 'INSURANCE', 'OTHER');
  end if;
end;
$$;

-- 2. Financial institutions table and helpers
create table if not exists app.financial_institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind app.financial_institution_kind not null,
  district text not null,
  sacco_id uuid unique references app.saccos(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('UTC', now()),
  updated_at timestamptz not null default timezone('UTC', now())
);

drop trigger if exists financial_institutions_touch_updated_at on app.financial_institutions;
create trigger financial_institutions_touch_updated_at
before update on app.financial_institutions
for each row
execute function public.set_updated_at();

create index if not exists idx_financial_institutions_district on app.financial_institutions(district);
create index if not exists idx_financial_institutions_kind on app.financial_institutions(kind, district);

-- Keep institutions synced with SACCO registry
create or replace function app.sync_financial_institution_from_saccos()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    delete from app.financial_institutions where sacco_id = old.id;
    return old;
  end if;

  insert into app.financial_institutions (name, kind, district, sacco_id)
  values (new.name, 'SACCO', new.district, new.id)
  on conflict (sacco_id)
  do update set
    name = excluded.name,
    district = excluded.district,
    updated_at = timezone('UTC', now());

  return new;
end;
$$;

drop trigger if exists trig_sync_financial_institution_insert on app.saccos;
create trigger trig_sync_financial_institution_insert
after insert or update on app.saccos
for each row
execute function app.sync_financial_institution_from_saccos();

drop trigger if exists trig_sync_financial_institution_delete on app.saccos;
create trigger trig_sync_financial_institution_delete
after delete on app.saccos
for each row
execute function app.sync_financial_institution_from_saccos();

-- Backfill existing SACCOs into the registry
insert into app.financial_institutions (name, kind, district, sacco_id)
select s.name, 'SACCO', s.district, s.id
from app.saccos s
on conflict (sacco_id)
do update set
  name = excluded.name,
  district = excluded.district,
  updated_at = timezone('UTC', now());

alter table app.financial_institutions enable row level security;

create policy financial_institutions_select
  on app.financial_institutions
  for select
  using (app.is_admin());

create policy financial_institutions_manage
  on app.financial_institutions
  for all
  using (app.is_admin())
  with check (app.is_admin());

-- 3. MoMo codes per district/provider
create table if not exists app.momo_codes (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'MTN' check (provider in ('MTN', 'AIRTEL', 'OTHER')),
  district text not null,
  code text not null,
  account_name text,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('UTC', now()),
  updated_at timestamptz not null default timezone('UTC', now()),
  unique (provider, district)
);

drop trigger if exists momo_codes_touch_updated_at on app.momo_codes;
create trigger momo_codes_touch_updated_at
before update on app.momo_codes
for each row
execute function public.set_updated_at();

-- Seed placeholder codes for every district on file (to be updated with real merchant numbers)
insert into app.momo_codes (provider, district, code, account_name)
select 'MTN', district, 'TO_ASSIGN', max(name)
from app.saccos
group by district
on conflict (provider, district) do nothing;

alter table app.momo_codes enable row level security;

create policy momo_codes_read
  on app.momo_codes
  for select
  using (true);

create policy momo_codes_manage
  on app.momo_codes
  for all
  using (app.is_admin())
  with check (app.is_admin());
