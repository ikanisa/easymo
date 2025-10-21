create extension if not exists "pgcrypto";

create table if not exists agents(
  id uuid primary key default gen_random_uuid(),
  name text not null,
  product text not null,
  locale text not null default 'en-RW',
  created_at timestamptz default now()
);

create table if not exists calls(
  id uuid primary key default gen_random_uuid(),
  twilio_call_sid text unique,
  sip_from text,
  sip_to text,
  agent_id uuid references agents(id),
  status text check (status in ('queued','ringing','in-progress','completed','failed','no-answer','busy')) default 'in-progress',
  started_at timestamptz default now(),
  ended_at timestamptz
);

create table if not exists call_events(
  id bigserial primary key,
  call_id uuid references calls(id) on delete cascade,
  at timestamptz default now(),
  kind text,
  payload jsonb
);

create table if not exists transcripts(
  id bigserial primary key,
  call_id uuid references calls(id) on delete cascade,
  role text check (role in ('user','assistant')),
  content text,
  at timestamptz default now()
);

create table if not exists leads(
  id uuid primary key default gen_random_uuid(),
  call_id uuid references calls(id) on delete set null,
  full_name text,
  phone text,
  company text,
  intent text,
  stage text default 'new',
  notes text,
  created_at timestamptz default now()
);

-- RLS - tighten later (service role only for now)
alter table agents enable row level security;
alter table calls enable row level security;
alter table call_events enable row level security;
alter table transcripts enable row level security;
alter table leads enable row level security;

create policy "svc can do all" on agents for all using (true) with check (true);
create policy "svc can do all c" on calls for all using (true) with check (true);
create policy "svc can do all e" on call_events for all using (true) with check (true);
create policy "svc can do all t" on transcripts for all using (true) with check (true);
create policy "svc can do all l" on leads for all using (true) with check (true);
