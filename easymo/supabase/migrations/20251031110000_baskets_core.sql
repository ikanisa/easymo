-- Core SACCO & Ikimina tables for Baskets module.

BEGIN;

create table if not exists public.saccos (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  branch_code text not null,
  umurenge_name text,
  district text,
  contact_phone text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.saccos
  add constraint saccos_status_check
    check (status in ('pending','active','suspended'));

create unique index if not exists saccos_branch_code_key on public.saccos (branch_code);
create index if not exists idx_saccos_umurenge_name on public.saccos (umurenge_name);

create table if not exists public.sacco_officers (
  id uuid primary key default gen_random_uuid(),
  sacco_id uuid not null references public.saccos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_sacco_officers_sacco on public.sacco_officers (sacco_id);
create index if not exists idx_sacco_officers_user on public.sacco_officers (user_id);

create table if not exists public.ibimina (
  id uuid primary key default gen_random_uuid(),
  sacco_id uuid references public.saccos(id) on delete set null,
  name text not null,
  description text,
  slug text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.ibimina
  add constraint ibimina_status_check
    check (status in ('pending','active','suspended'));

create unique index if not exists ibimina_slug_key on public.ibimina (slug);
create unique index if not exists ibimina_sacco_name_key on public.ibimina (sacco_id, lower(name));

create table if not exists public.ibimina_members (
  id uuid primary key default gen_random_uuid(),
  ikimina_id uuid not null references public.ibimina(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  joined_at timestamptz not null default now(),
  status text not null default 'pending'
);

alter table public.ibimina_members
  add constraint ibimina_members_status_check
    check (status in ('pending','active','removed'));

create index if not exists idx_ibimina_members_ikimina on public.ibimina_members (ikimina_id);
create index if not exists idx_ibimina_members_user on public.ibimina_members (user_id);
create unique index if not exists idx_ibimina_members_active_user
  on public.ibimina_members (user_id)
  where status = 'active';

create table if not exists public.ibimina_committee (
  id uuid primary key default gen_random_uuid(),
  ikimina_id uuid not null references public.ibimina(id) on delete cascade,
  member_id uuid not null references public.ibimina_members(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now()
);

alter table public.ibimina_committee
  add constraint ibimina_committee_role_check
    check (role in ('president','vp','secretary','treasurer'));

create unique index if not exists ibimina_committee_role_key on public.ibimina_committee (ikimina_id, role);

create table if not exists public.ibimina_settings (
  ikimina_id uuid primary key references public.ibimina(id) on delete cascade,
  contribution_type text not null default 'fixed',
  periodicity text not null default 'monthly',
  min_amount numeric(12,2) not null default 0,
  due_day integer,
  reminder_policy jsonb not null default '{}'::jsonb,
  quorum jsonb not null default '{}'::jsonb
);

alter table public.ibimina_settings
  add constraint ibimina_settings_contribution_type_check
    check (contribution_type in ('fixed','variable'));

alter table public.ibimina_settings
  add constraint ibimina_settings_periodicity_check
    check (periodicity in ('weekly','monthly'));

alter table public.ibimina_settings
  add constraint ibimina_settings_due_day_check
    check (due_day is null or (due_day between 1 and 31));

create table if not exists public.ibimina_accounts (
  id uuid primary key default gen_random_uuid(),
  ikimina_id uuid not null references public.ibimina(id) on delete cascade,
  sacco_account_number text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.ibimina_accounts
  add constraint ibimina_accounts_status_check
    check (status in ('pending','active','suspended'));

create unique index if not exists ibimina_accounts_account_number_key on public.ibimina_accounts (sacco_account_number);
create index if not exists idx_ibimina_accounts_ikimina on public.ibimina_accounts (ikimina_id);

COMMIT;
