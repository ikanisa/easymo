-- =============================================================================
-- MULTI-COUNTRY INTERMEDIATION PRIMITIVES
-- =============================================================================

-- Extensions
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
-- Optional: pgvector if you use embeddings elsewhere
-- create extension if not exists vector;

-- -----------------------------------------------------------------------------
-- COUNTRIES & TELCO PROVIDERS
-- -----------------------------------------------------------------------------

create table if not exists public.countries (
  id uuid primary key default gen_random_uuid(),
  iso2 char(2) not null,          -- 'RW', 'SN', 'CI', 'GH', ...
  iso3 char(3) not null,          -- 'RWA', 'SEN', 'CIV', ...
  name text not null,
  default_locale text not null,   -- 'rw-RW', 'fr-SN', 'en-GH', ...
  currency_code char(3) not null, -- 'RWF', 'XOF', 'GHS', ...
  timezone text not null,         -- 'Africa/Kigali'
  is_active boolean not null default true,
  unique (iso2),
  unique (iso3),
  unique (name)
);

create table if not exists public.telco_providers (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries(id) on delete cascade,
  name text not null,              -- 'MTN', 'Airtel', 'Orange', etc.
  ussd_pattern text not null,      -- e.g. '*182#'
  merchant_field_name text not null default 'merchant',
  reference_field_name text not null default 'reference',
  notes text
);
create index if not exists idx_telco_country on public.telco_providers(country_id);

-- -----------------------------------------------------------------------------
-- CONFIG BY COUNTRY & PARTNER (ORG)
-- -----------------------------------------------------------------------------

create table if not exists public.country_config (
  country_id uuid primary key references public.countries(id) on delete cascade,
  languages text[] not null,                   -- e.g. '{ "rw-RW","en-RW","fr-RW" }'
  enabled_features text[] not null,            -- e.g. '{ "USSD","OCR","SMS_INGEST","NFC" }'
  kyc_required_docs jsonb not null,            -- { "NID": true, "Passport": false, "Selfie": true }
  legal_pages jsonb not null,                  -- { "terms": "...", "privacy": "..." } localized urls
  telco_ids uuid[] not null,                   -- telco_providers.ids used in this country
  reference_format text not null default 'C3.D3.S3.G4.M3',  -- COUNTRY.DISTRICT.SACCO.GROUP.MEMBER
  number_format jsonb,
  settlement_notes text
);

create table if not exists public.partner_config (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  enabled_features text[],
  merchant_code text,              -- partner's MoMo merchant code
  telco_ids uuid[],
  language_pack text[],
  reference_prefix text,           -- override if needed (e.g., 'RWA.NYA.GAS.TWIZ')
  contact jsonb                    -- { "phone": "...", "email": "...", "hours": "..." }
);

-- -----------------------------------------------------------------------------
-- MAKE ORGANIZATIONS COUNTRY-AWARE
-- -----------------------------------------------------------------------------

-- For existing rows, add column nullable then backfill, then set NOT NULL.
alter table public.organizations add column if not exists country_id uuid;
-- Backfill example (set Rwanda by default if you only have RW initially):
-- update public.organizations set country_id = (select id from public.countries where iso2='RW') where country_id is null;

-- Enforce foreign key and NOT NULL for new rows:
alter table public.organizations
  add constraint org_country_fk foreign key (country_id) references public.countries(id);

-- You can set NOT NULL after backfill:
-- alter table public.organizations alter column country_id set not null;

-- -----------------------------------------------------------------------------
-- TENANT TABLES: ADD COUNTRY_ID + TRIGGERS TO PROPAGATE FROM ORG
-- -----------------------------------------------------------------------------

-- Groups (ibimina)
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  country_id uuid,
  name text not null,
  code text not null,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default timezone('UTC', now()),
  updated_at timestamptz not null default timezone('UTC', now())
);

alter table if exists public.groups
  add constraint groups_country_fk foreign key (country_id) references public.countries(id);

create index if not exists idx_groups_org on public.groups(org_id);
create index if not exists idx_groups_country on public.groups(country_id);

create or replace function public.set_group_country()
returns trigger language plpgsql as $$
begin
  if new.country_id is null then
    select country_id into new.country_id from public.organizations where id = new.org_id;
  end if;
  return new;
end$$;

drop trigger if exists trg_groups_country on public.groups;
create trigger trg_groups_country
before insert on public.groups
for each row execute function public.set_group_country();

-- Group members
create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  country_id uuid,
  member_name text not null,
  member_code text not null,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default timezone('UTC', now()),
  updated_at timestamptz not null default timezone('UTC', now())
);

alter table if exists public.group_members
  add constraint gm_country_fk foreign key (country_id) references public.countries(id);

create index if not exists idx_group_members_group on public.group_members(group_id);
create index if not exists idx_group_members_country on public.group_members(country_id);

create or replace function public.set_group_member_country()
returns trigger language plpgsql as $$
declare
  v_country uuid;
begin
  if new.country_id is null then
    select g.country_id into v_country from public.groups g where g.id = new.group_id;
    new.country_id := v_country;
  end if;
  return new;
end$$;

drop trigger if exists trg_group_members_country on public.group_members;
create trigger trg_group_members_country
before insert on public.group_members
for each row execute function public.set_group_member_country();

-- Uploads (staff OCR/CSV)
create table if not exists public.uploads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  country_id uuid,
  file_name text not null,
  file_type text not null,
  status text not null default 'PENDING',
  created_at timestamptz not null default timezone('UTC', now()),
  updated_at timestamptz not null default timezone('UTC', now())
);

alter table if exists public.uploads
  add constraint uploads_country_fk foreign key (country_id) references public.countries(id);

create index if not exists idx_uploads_org on public.uploads(org_id);
create index if not exists idx_uploads_country on public.uploads(country_id);

create or replace function public.set_upload_country()
returns trigger language plpgsql as $$
begin
  if new.country_id is null then
    select country_id into new.country_id from public.organizations where id = new.org_id;
  end if;
  return new;
end$$;

drop trigger if exists trg_uploads_country on public.uploads;
create trigger trg_uploads_country
before insert on public.uploads
for each row execute function public.set_upload_country();

-- Allocations (MoMo evidence)
create table if not exists public.allocations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  country_id uuid,
  sacco_name text,
  momo_txn_id text not null,
  payer_msisdn text,
  amount integer not null,
  ts timestamptz not null,
  raw_ref text,
  decoded_district text,
  decoded_sacco text,
  decoded_group text,
  decoded_member text,
  match_status text not null default 'UNALLOCATED',
  notes text,
  created_at timestamptz not null default timezone('UTC', now()),
  updated_at timestamptz not null default timezone('UTC', now())
);

alter table if exists public.allocations
  add constraint allocations_country_fk foreign key (country_id) references public.countries(id);

create index if not exists idx_allocations_org on public.allocations(org_id);
create index if not exists idx_allocations_country on public.allocations(country_id);
create index if not exists idx_allocations_txn on public.allocations(momo_txn_id);

create or replace function public.set_allocation_country()
returns trigger language plpgsql as $$
begin
  if new.country_id is null then
    select country_id into new.country_id from public.organizations where id = new.org_id;
  end if;
  return new;
end$$;

drop trigger if exists trg_allocations_country on public.allocations;
create trigger trg_allocations_country
before insert on public.allocations
for each row execute function public.set_allocation_country();

-- Optional: org knowledge base / tickets if you use AI/ticketing
-- org_kb
create table if not exists public.org_kb (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  country_id uuid references public.countries(id),
  title text not null,
  content text not null,
  tags text[],
  created_at timestamptz default now()
);
create index if not exists idx_org_kb_org on public.org_kb(org_id);
create index if not exists idx_org_kb_country on public.org_kb(country_id);

create or replace function public.set_org_kb_country()
returns trigger language plpgsql as $$
begin
  if new.country_id is null then
    select country_id into new.country_id from public.organizations where id = new.org_id;
  end if;
  return new;
end$$;

drop trigger if exists trg_org_kb_country on public.org_kb;
create trigger trg_org_kb_country
before insert on public.org_kb
for each row execute function public.set_org_kb_country();

-- tickets
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  country_id uuid,
  user_id uuid references auth.users(id) on delete set null,
  channel text check (channel in ('in_app','whatsapp','email','ivr')) not null,
  subject text not null,
  status text check (status in ('open','pending','resolved','closed')) not null default 'open',
  priority text check (priority in ('low','normal','high','urgent')) default 'normal',
  meta jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_tickets_org on public.tickets(org_id);
create index if not exists idx_tickets_country on public.tickets(country_id);
create index if not exists idx_tickets_user on public.tickets(user_id);

create or replace function public.set_ticket_country()
returns trigger language plpgsql as $$
begin
  if new.country_id is null then
    select country_id into new.country_id from public.organizations where id = new.org_id;
  end if;
  return new;
end$$;

drop trigger if exists trg_tickets_country on public.tickets;
create trigger trg_tickets_country
before insert on public.tickets
for each row execute function public.set_ticket_country();

-- -----------------------------------------------------------------------------
-- RLS HELPERS
-- -----------------------------------------------------------------------------

create or replace function public.user_org_ids()
returns setof uuid language sql stable as $$
  select org_id from public.org_memberships where user_id = auth.uid()
$$;

create or replace function public.user_country_ids()
returns setof uuid language sql stable as $$
  select distinct o.country_id
  from public.organizations o
  join public.org_memberships m on m.org_id = o.id
  where m.user_id = auth.uid()
$$;

create or replace function public.is_system_admin()
returns boolean language sql stable as $$
  select exists (
    select 1 from public.org_memberships
    where user_id = auth.uid() and role = 'SYSTEM_ADMIN'
  )
$$;

-- Enable RLS
alter table public.countries enable row level security;
alter table public.telco_providers enable row level security;
alter table public.country_config enable row level security;
alter table public.partner_config enable row level security;
alter table public.organizations enable row level security;
alter table public.org_memberships enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.uploads enable row level security;
alter table public.allocations enable row level security;
alter table public.org_kb enable row level security;
alter table public.tickets enable row level security;

-- Countries readable to admins and anyone who belongs to any org within that country
create policy countries_read on public.countries
for select using (
  public.is_system_admin()
  or id in (select public.user_country_ids())
);

create policy telcos_read on public.telco_providers
for select using (
  public.is_system_admin()
  or country_id in (select public.user_country_ids())
);

create policy country_config_read on public.country_config
for select using (
  public.is_system_admin()
  or country_id in (select public.user_country_ids())
);

-- Organizations: read if admin or you belong to the org or its parent (district)
create policy orgs_read on public.organizations
for select using (
  public.is_system_admin()
  or id in (select public.user_org_ids())
  or id in (
    select parent_id from public.organizations o2
    where o2.id in (select public.user_org_ids())
  )
);

-- org_memberships: visible to admin or self or same org
create policy om_read on public.org_memberships
for select using (
  public.is_system_admin()
  or user_id = auth.uid()
  or org_id in (select public.user_org_ids())
);

-- Groups: only within your org or district scope and country
create policy groups_select on public.groups
for select using (
  country_id in (select public.user_country_ids())
  and (
    org_id in (select public.user_org_ids())
    or org_id in (
      -- child SACCOs of your district orgs
      select o.id from public.organizations o
      join public.organizations d on o.parent_id = d.id
      where d.id in (select public.user_org_ids())
    )
  )
);

-- Group members: same visibility as groups
create policy group_members_select on public.group_members
for select using (
  country_id in (select public.user_country_ids())
  and group_id in (
    select id from public.groups
    where org_id in (select public.user_org_ids())
      or org_id in (
        select o.id from public.organizations o
        join public.organizations d on o.parent_id = d.id
        where d.id in (select public.user_org_ids())
      )
  )
);

-- Uploads: staff RW within own org & country
create policy uploads_rw on public.uploads
for all using (
  country_id in (select public.user_country_ids())
  and org_id in (select public.user_org_ids())
) with check (
  country_id in (select public.user_country_ids())
  and org_id in (select public.user_org_ids())
);

-- Allocations: staff RW within own org & country; district managers read across child orgs
create policy allocations_staff_rw on public.allocations
for all using (
  country_id in (select public.user_country_ids())
  and org_id in (select public.user_org_ids())
) with check (
  country_id in (select public.user_country_ids())
  and org_id in (select public.user_org_ids())
);

create policy allocations_district_r on public.allocations
for select using (
  country_id in (select public.user_country_ids())
  and org_id in (
    select o.id from public.organizations o
    join public.organizations d on o.parent_id = d.id
    where d.id in (select public.user_org_ids())
  )
);

-- org_kb: read by same org/country (and admin)
create policy org_kb_read on public.org_kb
for select using (
  public.is_system_admin()
  or (country_id in (select public.user_country_ids())
      and org_id in (select public.user_org_ids()))
);

-- tickets: staff RW own org/country; users R their tickets
create policy tickets_staff_rw on public.tickets
for all using (
  country_id in (select public.user_country_ids())
  and org_id in (select public.user_org_ids())
) with check (
  country_id in (select public.user_country_ids())
  and org_id in (select public.user_org_ids())
);

create policy tickets_user_r on public.tickets
for select using (user_id = auth.uid());

-- Partner config readable to admin and partner staff
create policy partner_config_read on public.partner_config
for select using (
  public.is_system_admin()
  or org_id in (select public.user_org_ids())
);

-- Backfill note: run a one-time script to set country_id on existing organizations (e.g., to Rwanda),
-- then on groups, group_members, uploads, allocations using the triggers or direct updates.
