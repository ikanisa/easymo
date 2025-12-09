-- Helper to determine if current user can access a given SACCO
create or replace function app.can_access_sacco(target_sacco uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app
as $$
  select
    -- System admin bypass
    exists(select 1 from public.users u where u.id = auth.uid() and u.role = 'SYSTEM_ADMIN')
    or
    -- Direct SACCO membership
    exists(
      select 1 from app.org_memberships m
      where m.user_id = auth.uid()
        and m.org_id = target_sacco
        and m.role in ('SACCO_MANAGER','SACCO_STAFF','SACCO_VIEWER')
    )
    or
    -- District manager can access all SACCOs under their district
    exists(
      select 1
      from app.org_memberships m
      join app.organizations d on d.id = m.org_id and d.type = 'DISTRICT'
      join app.saccos s on s.id = target_sacco and s.district_org_id = d.id
      where m.user_id = auth.uid()
        and m.role = 'DISTRICT_MANAGER'
    );
$$;

-- Update policies for tenant-scoped tables to use can_access_sacco

-- saccos (read-only for staff, admin manages)
drop policy if exists sacco_select_staff on app.saccos;
create policy sacco_select_staff
  on app.saccos
  for select
  using (app.can_access_sacco(id));

-- ikimina
drop policy if exists ikimina_select on app.ikimina;
create policy ikimina_select
  on app.ikimina
  for select
  using (app.can_access_sacco(sacco_id));

drop policy if exists ikimina_modify on app.ikimina;
create policy ikimina_modify
  on app.ikimina
  for all
  using (app.can_access_sacco(sacco_id));

-- members
drop policy if exists members_select on app.members;
create policy members_select
  on app.members
  for select
  using (app.can_access_sacco(sacco_id));

drop policy if exists members_modify on app.members;
create policy members_modify
  on app.members
  for all
  using (app.can_access_sacco(sacco_id));

-- payments
drop policy if exists payments_select on app.payments;
create policy payments_select
  on app.payments
  for select
  using (app.can_access_sacco(sacco_id));

drop policy if exists payments_insert on app.payments;
create policy payments_insert
  on app.payments
  for insert
  with check (app.can_access_sacco(sacco_id));

drop policy if exists payments_update on app.payments;
create policy payments_update
  on app.payments
  for update
  using (app.can_access_sacco(sacco_id));

-- recon exceptions (by payment linkage)
drop policy if exists recon_select on app.recon_exceptions;
create policy recon_select
  on app.recon_exceptions
  for select
  using (app.can_access_sacco(app.payment_sacco(payment_id)::uuid));

drop policy if exists recon_modify on app.recon_exceptions;
create policy recon_modify
  on app.recon_exceptions
  for all
  using (app.can_access_sacco(app.payment_sacco(payment_id)::uuid));

-- accounts
drop policy if exists accounts_select on app.accounts;
create policy accounts_select
  on app.accounts
  for select
  using (app.can_access_sacco(sacco_id));

drop policy if exists accounts_modify_admin on app.accounts;
create policy accounts_modify_admin
  on app.accounts
  for all
  using (app.is_admin());

-- ledger entries
drop policy if exists ledger_select on app.ledger_entries;
create policy ledger_select
  on app.ledger_entries
  for select
  using (app.can_access_sacco(sacco_id));

drop policy if exists ledger_modify_admin on app.ledger_entries;
create policy ledger_modify_admin
  on app.ledger_entries
  for all
  using (app.is_admin());

-- sms inbox
drop policy if exists sms_select on app.sms_inbox;
create policy sms_select
  on app.sms_inbox
  for select
  using (app.can_access_sacco(sacco_id));

drop policy if exists sms_modify on app.sms_inbox;
create policy sms_modify
  on app.sms_inbox
  for all
  using (app.can_access_sacco(sacco_id));

-- import files
drop policy if exists import_select on app.import_files;
create policy import_select
  on app.import_files
  for select
  using (app.can_access_sacco(sacco_id));

drop policy if exists import_modify on app.import_files;
create policy import_modify
  on app.import_files
  for all
  using (app.can_access_sacco(sacco_id));

