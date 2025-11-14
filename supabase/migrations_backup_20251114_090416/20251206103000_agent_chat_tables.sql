-- Agent chat session storage for broker/support AI surfaces.

begin;

create table if not exists public.agent_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(user_id) on delete set null,
  agent_kind text not null,
  status text not null default 'open',
  metadata jsonb not null default '{}'::jsonb,
  last_user_message text,
  last_agent_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists agent_chat_sessions_profile_kind_idx
  on public.agent_chat_sessions (profile_id, agent_kind)
  where profile_id is not null and status = 'open';

create index if not exists agent_chat_sessions_agent_kind_idx
  on public.agent_chat_sessions (agent_kind, status, updated_at desc);

create table if not exists public.agent_chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.agent_chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'agent', 'system')),
  content jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists agent_chat_messages_session_idx
  on public.agent_chat_messages (session_id, created_at);

alter table public.agent_chat_sessions enable row level security;
alter table public.agent_chat_messages enable row level security;

create policy agent_chat_sessions_service_only
  on public.agent_chat_sessions
  for all
  using (false)
  with check (false);

create policy agent_chat_messages_service_only
  on public.agent_chat_messages
  for all
  using (false)
  with check (false);

commit;
