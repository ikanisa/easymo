-- Ensure country_id propagation stays in sync when records are updated
create or replace function public.set_group_country()
returns trigger
language plpgsql
as $$
declare
  v_country uuid;
begin
  select country_id into v_country from public.organizations where id = new.org_id;

  if v_country is null then
    raise exception 'Organization % missing country context for group', new.org_id;
  end if;

  new.country_id := v_country;
  return new;
end;
$$;

drop trigger if exists trg_groups_country on public.groups;
create trigger trg_groups_country
before insert or update on public.groups
for each row execute function public.set_group_country();

create or replace function public.set_group_member_country()
returns trigger
language plpgsql
as $$
declare
  v_country uuid;
begin
  select g.country_id into v_country from public.groups g where g.id = new.group_id;

  if v_country is null then
    raise exception 'Group % missing country context for member trigger', new.group_id;
  end if;

  new.country_id := v_country;
  return new;
end;
$$;

drop trigger if exists trg_group_members_country on public.group_members;
create trigger trg_group_members_country
before insert or update on public.group_members
for each row execute function public.set_group_member_country();

create or replace function public.set_upload_country()
returns trigger
language plpgsql
as $$
declare
  v_country uuid;
begin
  select country_id into v_country from public.organizations where id = new.org_id;

  if v_country is null then
    raise exception 'Organization % missing country context for upload', new.org_id;
  end if;

  new.country_id := v_country;
  return new;
end;
$$;

drop trigger if exists trg_uploads_country on public.uploads;
create trigger trg_uploads_country
before insert or update on public.uploads
for each row execute function public.set_upload_country();

create or replace function public.set_allocation_country()
returns trigger
language plpgsql
as $$
declare
  v_country uuid;
begin
  select country_id into v_country from public.organizations where id = new.org_id;

  if v_country is null then
    raise exception 'Organization % missing country context for allocation', new.org_id;
  end if;

  new.country_id := v_country;
  return new;
end;
$$;

drop trigger if exists trg_allocations_country on public.allocations;
create trigger trg_allocations_country
before insert or update on public.allocations
for each row execute function public.set_allocation_country();

create or replace function public.set_ticket_country()
returns trigger
language plpgsql
as $$
declare
  v_country uuid;
begin
  select country_id into v_country from public.organizations where id = new.org_id;

  if v_country is null then
    raise exception 'Organization % missing country context for ticket', new.org_id;
  end if;

  new.country_id := v_country;
  return new;
end;
$$;

drop trigger if exists trg_tickets_country on public.tickets;
create trigger trg_tickets_country
before insert or update on public.tickets
for each row execute function public.set_ticket_country();

-- Ticket messages capture threaded communication with the same country/org context as tickets
create table if not exists public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  country_id uuid not null references public.countries(id),
  author_id uuid references auth.users(id) on delete set null,
  body text not null,
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('UTC', now()),
  updated_at timestamptz not null default timezone('UTC', now())
);

create index if not exists idx_ticket_messages_ticket on public.ticket_messages(ticket_id);
create index if not exists idx_ticket_messages_org on public.ticket_messages(org_id);
create index if not exists idx_ticket_messages_country on public.ticket_messages(country_id);
create index if not exists idx_ticket_messages_author on public.ticket_messages(author_id);

create or replace function public.set_ticket_message_context()
returns trigger
language plpgsql
as $$
declare
  v_org uuid;
  v_country uuid;
begin
  select org_id, country_id into v_org, v_country from public.tickets where id = new.ticket_id;

  if v_org is null then
    raise exception 'Ticket % missing organization context for message', new.ticket_id;
  end if;

  new.org_id := v_org;
  new.country_id := v_country;

  if new.author_id is null then
    new.author_id := auth.uid();
  end if;

  new.updated_at := timezone('UTC', now());
  return new;
end;
$$;

drop trigger if exists trg_ticket_messages_context on public.ticket_messages;
create trigger trg_ticket_messages_context
before insert or update on public.ticket_messages
for each row execute function public.set_ticket_message_context();

create or replace function public.refresh_ticket_message_context()
returns trigger
language plpgsql
as $$
begin
  if (new.org_id is distinct from old.org_id) or (new.country_id is distinct from old.country_id) then
    update public.ticket_messages
    set
      org_id = new.org_id,
      country_id = new.country_id,
      updated_at = timezone('UTC', now())
    where ticket_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_ticket_message_ticket_context on public.tickets;
create trigger trg_ticket_message_ticket_context
after update on public.tickets
for each row execute function public.refresh_ticket_message_context();

alter table public.ticket_messages enable row level security;

create policy ticket_messages_staff_rw on public.ticket_messages
for all using (
  country_id in (select public.user_country_ids())
  and org_id in (select public.user_org_ids())
) with check (
  country_id in (select public.user_country_ids())
  and org_id in (select public.user_org_ids())
  and author_id = auth.uid()
);

create policy ticket_messages_user_read on public.ticket_messages
for select using (
  ticket_id in (
    select id from public.tickets where user_id = auth.uid()
  )
);

create policy ticket_messages_user_insert on public.ticket_messages
for insert with check (
  author_id = auth.uid()
  and ticket_id in (
    select id from public.tickets where user_id = auth.uid()
  )
);
