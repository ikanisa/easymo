-- Organizations and memberships (Phase 2 scaffolding)
-- Enum for organization types
do $$ begin
  create type app.org_type as enum ('SACCO','MFI','DISTRICT');
exception when duplicate_object then null; end $$;

-- Extend app_role for future roles (safe if already added)
do $$ begin
  alter type public.app_role add value if not exists 'DISTRICT_MANAGER';
exception when duplicate_object then null; end $$;
do $$ begin
  alter type public.app_role add value if not exists 'MFI_MANAGER';
exception when duplicate_object then null; end $$;
do $$ begin
  alter type public.app_role add value if not exists 'MFI_STAFF';
exception when duplicate_object then null; end $$;

-- Organizations table
create table if not exists app.organizations (
  id uuid primary key default gen_random_uuid(),
  type app.org_type not null,
  name text not null,
  district_code text,
  parent_id uuid null references app.organizations(id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table app.organizations is 'Generic organizations: SACCO, MFI, DISTRICT.';

-- Org memberships table
create table if not exists app.org_memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null references app.organizations(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, org_id)
);

create index if not exists org_memberships_user_idx on app.org_memberships(user_id);
create index if not exists org_memberships_org_idx on app.org_memberships(org_id);
create index if not exists org_memberships_role_idx on app.org_memberships(role);

comment on table app.org_memberships is 'User assignments to organizations with roles per org.';

-- RLS scaffolding (service role bypasses RLS)
alter table app.organizations enable row level security;
alter table app.org_memberships enable row level security;

-- Deny all by default; reads/writes are currently done via service role APIs
do $$ begin
  create policy orgs_admin_only on app.organizations for all using (false) with check (false);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy org_memberships_admin_only on app.org_memberships for all using (false) with check (false);
exception when duplicate_object then null; end $$;

