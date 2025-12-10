-- Agent management schema for AI personas, versions, documents and deployments

BEGIN;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.agent_personas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  status text not null default 'draft' check (status in ('draft','active','archived')),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  unique (name)
);

create table if not exists public.agent_versions (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references public.agent_personas(id) on delete cascade,
  version_no integer not null,
  instructions text not null,
  tools jsonb not null default '[]'::jsonb,
  memory_config jsonb not null default '{}'::jsonb,
  evaluation_plan jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  unique (persona_id, version_no)
);

create table if not exists public.agent_prompts (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references public.agent_personas(id) on delete cascade,
  role text not null check (role in ('system','user','assistant')),
  label text,
  content text not null,
  sort_order integer not null default 0,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by text
);

create table if not exists public.agent_documents (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references public.agent_personas(id) on delete cascade,
  title text not null,
  storage_path text,
  checksum text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by text
);

create table if not exists public.agent_deployments (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references public.agent_personas(id) on delete cascade,
  version_id uuid not null references public.agent_versions(id) on delete cascade,
  environment text not null check (environment in ('staging','production')),
  status text not null default 'published' check (status in ('published','disabled')),
  notes text,
  created_at timestamptz not null default now(),
  created_by text
);

create table if not exists public.agent_audit_log (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid references public.agent_personas(id) on delete set null,
  actor text,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agent_personas_status_idx on public.agent_personas(status);
create index if not exists agent_versions_persona_idx on public.agent_versions(persona_id);
create index if not exists agent_prompts_persona_idx on public.agent_prompts(persona_id);
create index if not exists agent_documents_persona_idx on public.agent_documents(persona_id);
create index if not exists agent_deployments_persona_env_idx on public.agent_deployments(persona_id, environment);
create index if not exists agent_audit_persona_idx on public.agent_audit_log(persona_id);

create trigger agent_personas_set_updated
before update on public.agent_personas
for each row execute function public.set_updated_at();

create trigger agent_versions_set_updated
before update on public.agent_versions
for each row execute function public.set_updated_at();

alter table public.agent_personas enable row level security;
alter table public.agent_versions enable row level security;
alter table public.agent_prompts enable row level security;
alter table public.agent_documents enable row level security;
alter table public.agent_deployments enable row level security;
alter table public.agent_audit_log enable row level security;

create policy agent_personas_service_policy on public.agent_personas
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy agent_versions_service_policy on public.agent_versions
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy agent_prompts_service_policy on public.agent_prompts
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy agent_documents_service_policy on public.agent_documents
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy agent_deployments_service_policy on public.agent_deployments
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy agent_audit_service_policy on public.agent_audit_log
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

COMMIT;
