begin;

-- Create table if missing (safe)
create table if not exists public.insurance_admin_contacts (
  phone text primary key,
  display_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- HARD RESET: ensure ONLY the approved numbers exist
truncate table public.insurance_admin_contacts;

-- Seed with the ONLY allowed contacts + friendly Rwandan names
insert into public.insurance_admin_contacts (phone, display_name, is_active)
values
  ('+250795588248', 'Aline (Insurance Support)', true),
  ('+250796884076', 'Patrick (Insurance Support)', true);

-- Enforce whitelist forever (even if someone tries to insert later)
alter table public.insurance_admin_contacts
  drop constraint if exists insurance_admin_contacts_phone_whitelist;

alter table public.insurance_admin_contacts
  add constraint insurance_admin_contacts_phone_whitelist
  check (phone in ('+250795588248', '+250796884076'));

-- Make it readable (but not writable) for everyone via RLS
alter table public.insurance_admin_contacts enable row level security;

drop policy if exists insurance_admin_contacts_read on public.insurance_admin_contacts;
create policy insurance_admin_contacts_read
on public.insurance_admin_contacts
for select
to public
using (is_active = true);

commit;
