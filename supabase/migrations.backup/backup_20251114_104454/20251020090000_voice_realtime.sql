BEGIN;
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

create table if not exists voice_calls (
  id uuid primary key default gen_random_uuid(),
  direction text check (direction in ('inbound','outbound')) not null,
  from_e164 text,
  to_e164 text,
  twilio_call_sid text unique,
  sip_session_id text,
  project_id text,
  locale text default 'en',
  started_at timestamptz default now(),
  ended_at timestamptz,
  duration_seconds int,
  consent_obtained boolean default false,
  outcome text,
  handoff boolean default false,
  handoff_target text,
  country text,
  metadata jsonb default '{}'::jsonb
);

create table if not exists voice_events (
  id uuid primary key default gen_random_uuid(),
  call_id uuid references voice_calls(id) on delete cascade,
  t timestamptz default now(),
  type text,
  payload jsonb
);

create table if not exists transcripts (
  id uuid primary key default gen_random_uuid(),
  call_id uuid references voice_calls(id) on delete cascade,
  role text check (role in ('user','assistant','system')),
  content text,
  t timestamptz default now(),
  lang text
);

create table if not exists call_consents (
  id uuid primary key default gen_random_uuid(),
  call_id uuid references voice_calls(id) on delete cascade,
  consent_text text,
  consent_result boolean,
  audio_url text,
  t timestamptz default now()
);

create table if not exists mcp_tool_calls (
  id uuid primary key default gen_random_uuid(),
  call_id uuid references voice_calls(id) on delete cascade,
  server text,
  tool text,
  args jsonb,
  result jsonb,
  t timestamptz default now(),
  success boolean
);

create table if not exists wa_threads (
  id uuid primary key default gen_random_uuid(),
  call_id uuid references voice_calls(id) on delete cascade,
  wa_conversation_id text,
  customer_msisdn text,
  state text,
  last_message_at timestamptz default now()
);

create table if not exists voice_memories (
  id uuid primary key default gen_random_uuid(),
  msisdn text,
  country text,
  prefs jsonb,
  last_seen_at timestamptz default now()
);

alter table voice_calls enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'voice_calls'
      and policyname = 'svc_rw_voice_calls'
  ) then
    create policy svc_rw_voice_calls on voice_calls
      for all using (auth.role() = 'service_role') with check (true);
end if;
end $$;
COMMIT;
COMMIT;

alter table voice_events enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'voice_events'
      and policyname = 'svc_rw_voice_events'
  ) then
    create policy svc_rw_voice_events on voice_events
      for all using (auth.role() = 'service_role') with check (true);
  end if;
end $$;
COMMIT;

alter table transcripts enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'transcripts'
      and policyname = 'svc_rw_transcripts'
  ) then
    create policy svc_rw_transcripts on transcripts
      for all using (auth.role() = 'service_role') with check (true);
  end if;
end $$;

alter table call_consents enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'call_consents'
      and policyname = 'svc_rw_call_consents'
  ) then
    create policy svc_rw_call_consents on call_consents
      for all using (auth.role() = 'service_role') with check (true);
  end if;
end $$;

alter table mcp_tool_calls enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'mcp_tool_calls'
      and policyname = 'svc_rw_mcp_tool_calls'
  ) then
    create policy svc_rw_mcp_tool_calls on mcp_tool_calls
      for all using (auth.role() = 'service_role') with check (true);
  end if;
end $$;

alter table wa_threads enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'wa_threads'
      and policyname = 'svc_rw_wa_threads'
  ) then
    create policy svc_rw_wa_threads on wa_threads
      for all using (auth.role() = 'service_role') with check (true);
  end if;
end $$;

alter table voice_memories enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'voice_memories'
      and policyname = 'svc_rw_voice_memories'
  ) then
    create policy svc_rw_voice_memories on voice_memories
      for all using (auth.role() = 'service_role') with check (true);
  end if;
end $$;
COMMIT;
