-- Replace duplicated public tables with updatable views backed by app schema

begin;
-- Drop dependent view before replacing base tables
drop view if exists public.ikimina_members_public;
-- Drop foreign keys that previously referenced public tables
alter table if exists public.users drop constraint if exists users_sacco_id_fkey;
alter table if exists public.sms_templates drop constraint if exists sms_templates_sacco_id_fkey;
-- Remove legacy duplicates (data already copied into app.*)
drop table if exists public.ikimina_members cascade;
drop table if exists public.payments cascade;
drop table if exists public.sms_inbox cascade;
drop table if exists public.accounts cascade;
drop table if exists public.ledger_entries cascade;
drop table if exists public.ibimina cascade;
drop table if exists public.audit_logs cascade;
drop table if exists public.saccos cascade;
-- Recreate public objects as thin views over app schema
create view public.saccos as
select
  id,
  name,
  district,
  sector_code,
  status,
  created_at,
  updated_at,
  province,
  email,
  category,
  logo_url,
  sector,
  search_slug,
  search_document,
  brand_color
from app.saccos;
alter view public.saccos set (security_barrier = true);
create view public.ibimina as
select
  id,
  sacco_id,
  code,
  name,
  type,
  settings_json,
  status,
  created_at,
  updated_at
from app.ikimina;
alter view public.ibimina set (security_barrier = true);
create view public.ikimina_members as
select
  id,
  ikimina_id,
  member_code,
  full_name,
  national_id,
  msisdn,
  joined_at,
  status,
  created_at,
  updated_at,
  msisdn_encrypted,
  msisdn_masked,
  msisdn_hash,
  national_id_encrypted,
  national_id_masked,
  national_id_hash
from app.members;
alter view public.ikimina_members set (security_barrier = true);
create view public.sms_inbox as
select
  id,
  sacco_id,
  raw_text,
  msisdn,
  received_at,
  vendor_meta,
  parsed_json,
  parse_source,
  confidence,
  status,
  error,
  created_at,
  msisdn_encrypted,
  msisdn_masked,
  msisdn_hash
from app.sms_inbox;
alter view public.sms_inbox set (security_barrier = true);
create view public.payments as
select
  id,
  channel,
  sacco_id,
  ikimina_id,
  member_id,
  msisdn,
  amount,
  currency,
  txn_id,
  reference,
  occurred_at,
  status,
  source_id,
  ai_version,
  confidence,
  created_at,
  msisdn_encrypted,
  msisdn_masked,
  msisdn_hash
from app.payments;
alter view public.payments set (security_barrier = true);
create view public.accounts as
select
  id,
  owner_type,
  owner_id,
  currency,
  status,
  balance,
  created_at,
  updated_at
from app.accounts;
alter view public.accounts set (security_barrier = true);
create view public.ledger_entries as
select
  id,
  debit_id,
  credit_id,
  amount,
  currency,
  value_date,
  external_id,
  memo,
  created_at
from app.ledger_entries;
alter view public.ledger_entries set (security_barrier = true);
create view public.audit_logs as
select
  id,
  action,
  actor as actor_id,
  created_at,
  diff as diff_json,
  entity,
  entity_id,
  sacco_id
from app.audit_logs;
alter view public.audit_logs set (security_barrier = true);
-- Recreate helper view with new sources
create view public.ikimina_members_public
with (security_barrier = true) as
select
  m.id,
  m.ikimina_id,
  m.member_code,
  m.full_name,
  m.status,
  m.joined_at,
  m.msisdn_masked as msisdn,
  m.national_id_masked as national_id,
  i.name as ikimina_name,
  i.sacco_id
from app.members m
join app.ikimina i on i.id = m.ikimina_id
where public.has_role(auth.uid(), 'SYSTEM_ADMIN'::app_role)
  or i.sacco_id = public.get_user_sacco(auth.uid());
-- Restore grants required by PostgREST
grant select, insert, update, delete on public.saccos to anon, authenticated, service_role;
grant select, insert, update, delete on public.ibimina to anon, authenticated, service_role;
grant select, insert, update, delete on public.ikimina_members to anon, authenticated, service_role;
grant select, insert, update, delete on public.sms_inbox to anon, authenticated, service_role;
grant select, insert, update, delete on public.payments to anon, authenticated, service_role;
grant select, insert, update, delete on public.accounts to anon, authenticated, service_role;
grant select, insert, update, delete on public.ledger_entries to anon, authenticated, service_role;
grant select, insert, update, delete on public.audit_logs to anon, authenticated, service_role;
grant select on public.ikimina_members_public to anon, authenticated, service_role;
-- Recreate foreign keys referencing the new canonical tables
alter table if exists public.users
  add constraint users_sacco_id_fkey
  foreign key (sacco_id)
  references app.saccos(id)
  on delete set null;
alter table if exists public.sms_templates
  add constraint sms_templates_sacco_id_fkey
  foreign key (sacco_id)
  references app.saccos(id)
  on delete cascade;
commit;
