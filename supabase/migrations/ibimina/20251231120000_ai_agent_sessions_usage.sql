-- AI Agent operational tables: session storage, usage logging, opt-out registry

create table if not exists public.agent_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  channel text not null check (char_length(channel) <= 50),
  metadata jsonb not null default '{}'::jsonb,
  messages jsonb not null default '[]'::jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('UTC', now()),
  updated_at timestamptz not null default timezone('UTC', now()),
  last_interaction_at timestamptz not null default timezone('UTC', now())
);

create index if not exists idx_agent_sessions_org on public.agent_sessions(org_id);
create index if not exists idx_agent_sessions_user on public.agent_sessions(user_id);
create index if not exists idx_agent_sessions_expiry on public.agent_sessions(expires_at);

alter table public.agent_sessions enable row level security;

create policy "Service role manages agent sessions"
  on public.agent_sessions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create table if not exists public.agent_usage_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.agent_sessions(id) on delete set null,
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  channel text not null check (char_length(channel) <= 50),
  model text not null,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  cost_usd numeric(10,4),
  latency_ms integer,
  success boolean not null default true,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('UTC', now())
);

create index if not exists idx_agent_usage_org on public.agent_usage_events(org_id);
create index if not exists idx_agent_usage_session on public.agent_usage_events(session_id);
create index if not exists idx_agent_usage_created on public.agent_usage_events(created_at desc);

alter table public.agent_usage_events enable row level security;

create policy "Service role logs agent usage"
  on public.agent_usage_events
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create table if not exists public.agent_opt_outs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  channel text,
  reason text,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('UTC', now())
);

create unique index if not exists idx_agent_opt_outs_unique
  on public.agent_opt_outs(org_id, coalesce(user_id, '00000000-0000-0000-0000-000000000000'), coalesce(channel, ''));

alter table public.agent_opt_outs enable row level security;

create policy "Service role manages agent opt outs"
  on public.agent_opt_outs
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Staff manage org opt outs"
  on public.agent_opt_outs
  for all
  using (
    exists (
      select 1 from public.org_memberships
      where org_memberships.org_id = agent_opt_outs.org_id
      and org_memberships.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.org_memberships
      where org_memberships.org_id = agent_opt_outs.org_id
      and org_memberships.user_id = auth.uid()
    )
  );
