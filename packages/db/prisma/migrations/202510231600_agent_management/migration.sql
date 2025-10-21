-- Agent management tables
create table if not exists "Agent" (
  id uuid primary key default gen_random_uuid(),
  "tenantId" uuid not null references "Tenant"(id) on delete cascade,
  name text not null,
  slug text not null,
  persona text not null default 'general',
  status text not null default 'active',
  "currentRevisionId" uuid null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create unique index if not exists agents_tenant_slug_unique on "Agent"("tenantId", slug);

create table if not exists "AgentRevision" (
  id uuid primary key default gen_random_uuid(),
  "agentId" uuid not null references "Agent"(id) on delete cascade,
  version integer not null default 1,
  instructions text not null,
  tools jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  published boolean not null default false,
  "createdBy" text null,
  "createdAt" timestamptz not null default now()
);
create index if not exists agent_revisions_agent_version_idx on "AgentRevision"("agentId", version);

alter table "Agent"
  add constraint agent_current_revision_fkey foreign key ("currentRevisionId") references "AgentRevision"(id) on delete set null;

create table if not exists "AgentDocument" (
  id uuid primary key default gen_random_uuid(),
  "agentId" uuid not null references "Agent"(id) on delete cascade,
  title text not null,
  source text not null default 'text',
  url text null,
  content text null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index if not exists agent_docs_agent_idx on "AgentDocument"("agentId");

create table if not exists "AgentTask" (
  id uuid primary key default gen_random_uuid(),
  "agentId" uuid not null references "Agent"(id) on delete cascade,
  title text not null,
  description text null,
  "payloadSchema" jsonb not null default '{}'::jsonb,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index if not exists agent_tasks_agent_idx on "AgentTask"("agentId");
