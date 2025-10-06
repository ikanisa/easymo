-- RLS scaffolding for Baskets tables.

alter table public.saccos enable row level security;
alter table public.sacco_officers enable row level security;
alter table public.ibimina enable row level security;
alter table public.ibimina_members enable row level security;
alter table public.ibimina_committee enable row level security;
alter table public.ibimina_settings enable row level security;
alter table public.ibimina_accounts enable row level security;
alter table public.contributions_ledger enable row level security;
alter table public.contribution_cycles enable row level security;
alter table public.momo_sms_inbox enable row level security;
alter table public.momo_parsed_txns enable row level security;
alter table public.momo_unmatched enable row level security;
alter table public.sacco_loans enable row level security;
alter table public.sacco_collateral enable row level security;
alter table public.basket_invites enable row level security;
alter table public.kyc_documents enable row level security;

create policy saccos_admin_staff_rw on public.saccos
  for all using (app.current_role() in ('admin','sacco_staff'))
  with check (app.current_role() in ('admin','sacco_staff'));

create policy sacco_officers_admin_staff_rw on public.sacco_officers
  for all using (app.current_role() in ('admin','sacco_staff'))
  with check (app.current_role() in ('admin','sacco_staff'));

create policy ibimina_admin_staff_rw on public.ibimina
  for all using (app.current_role() in ('admin','sacco_staff'))
  with check (app.current_role() in ('admin','sacco_staff'));

create policy ibimina_members_admin_staff_rw on public.ibimina_members
  for all using (app.current_role() in ('admin','sacco_staff'))
  with check (app.current_role() in ('admin','sacco_staff'));

create policy ibimina_committee_admin_staff_rw on public.ibimina_committee
  for all using (app.current_role() in ('admin','sacco_staff'))
  with check (app.current_role() in ('admin','sacco_staff'));

create policy ibimina_settings_admin_staff_rw on public.ibimina_settings
  for all using (app.current_role() in ('admin','sacco_staff'))
  with check (app.current_role() in ('admin','sacco_staff'));

create policy ibimina_accounts_admin_staff_rw on public.ibimina_accounts
  for all using (app.current_role() in ('admin','sacco_staff'))
  with check (app.current_role() in ('admin','sacco_staff'));

create policy contributions_admin_staff_rw on public.contributions_ledger
  for all using (app.current_role() in ('admin','sacco_staff'))
  with check (app.current_role() in ('admin','sacco_staff'));

create policy contribution_cycles_admin_staff_rw on public.contribution_cycles
  for all using (app.current_role() in ('admin','sacco_staff'))
  with check (app.current_role() in ('admin','sacco_staff'));

create policy momo_sms_admin_staff_rw on public.momo_sms_inbox
  for all using (app.current_role() in ('admin','sacco_staff'))
  with check (app.current_role() in ('admin','sacco_staff'));

create policy momo_parsed_admin_staff_rw on public.momo_parsed_txns
  for all using (app.current_role() in ('admin','sacco_staff'))
  with check (app.current_role() in ('admin','sacco_staff'));

create policy momo_unmatched_admin_staff_rw on public.momo_unmatched
  for all using (app.current_role() in ('admin','sacco_staff'))
  with check (app.current_role() in ('admin','sacco_staff'));

create policy sacco_loans_admin_staff_rw on public.sacco_loans
  for all using (app.current_role() in ('admin','sacco_staff'))
  with check (app.current_role() in ('admin','sacco_staff'));

create policy sacco_collateral_admin_staff_rw on public.sacco_collateral
  for all using (app.current_role() in ('admin','sacco_staff'))
  with check (app.current_role() in ('admin','sacco_staff'));

create policy basket_invites_admin_staff_rw on public.basket_invites
  for all using (app.current_role() in ('admin','sacco_staff'))
  with check (app.current_role() in ('admin','sacco_staff'));

create policy kyc_documents_admin_staff_rw on public.kyc_documents
  for all using (app.current_role() in ('admin','sacco_staff'))
  with check (app.current_role() in ('admin','sacco_staff'));

