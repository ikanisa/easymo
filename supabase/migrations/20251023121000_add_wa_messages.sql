create table if not exists wa_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references wa_threads(id) on delete cascade,
  direction text check (direction in ('user', 'assistant')) not null,
  content text,
  agent_profile text,
  agent_display_name text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists wa_messages_thread_idx on wa_messages (thread_id);
create index if not exists wa_messages_created_at_idx on wa_messages (created_at);

alter table wa_messages enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'wa_messages'
      and policyname = 'svc_rw_wa_messages'
  ) then
    create policy svc_rw_wa_messages on wa_messages
      for all using (auth.role() = 'service_role') with check (true);
  end if;
end $$;
