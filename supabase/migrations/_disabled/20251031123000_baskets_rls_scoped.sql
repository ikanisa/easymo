-- Refine RLS policies for Baskets tables with scoped access rules.

BEGIN;

alter policy saccos_admin_staff_rw on public.saccos
  using (
    app.current_role() = 'admin'
    or (
      app.current_role() = 'sacco_staff'
      and exists (
        select 1
        from public.sacco_officers o
        where o.sacco_id = saccos.id
          and o.user_id = auth.uid()
      )
    )
  )
  with check (
    app.current_role() = 'admin'
    or (
      app.current_role() = 'sacco_staff'
      and exists (
        select 1
        from public.sacco_officers o
        where o.sacco_id = saccos.id
          and o.user_id = auth.uid()
      )
    )
  );

alter policy sacco_officers_admin_staff_rw on public.sacco_officers
  using (
    app.current_role() = 'admin'
    or (
      app.current_role() = 'sacco_staff'
      and exists (
        select 1
        from public.sacco_officers o
        where o.sacco_id = sacco_officers.sacco_id
          and o.user_id = auth.uid()
      )
    )
  )
  with check (
    app.current_role() = 'admin'
    or (
      app.current_role() = 'sacco_staff'
      and exists (
        select 1
        from public.sacco_officers o
        where o.sacco_id = sacco_officers.sacco_id
          and o.user_id = auth.uid()
      )
    )
  );

alter policy ibimina_admin_staff_rw on public.ibimina
  using (
    app.current_role() = 'admin'
    or (
      app.current_role() = 'sacco_staff'
      and ibimina.sacco_id is not null
      and exists (
        select 1
        from public.sacco_officers o
        where o.sacco_id = ibimina.sacco_id
          and o.user_id = auth.uid()
      )
    )
  )
  with check (
    app.current_role() = 'admin'
    or (
      app.current_role() = 'sacco_staff'
      and ibimina.sacco_id is not null
      and exists (
        select 1
        from public.sacco_officers o
        where o.sacco_id = ibimina.sacco_id
          and o.user_id = auth.uid()
      )
    )
  );

alter policy ibimina_members_admin_staff_rw on public.ibimina_members
  using (
    app.current_role() = 'admin'
    or (
      app.current_role() = 'sacco_staff'
      and exists (
        select 1
        from public.ibimina i
        join public.sacco_officers o on o.sacco_id = i.sacco_id
        where i.id = ibimina_members.ikimina_id
          and o.user_id = auth.uid()
      )
    )
  )
  with check (
    app.current_role() = 'admin'
    or (
      app.current_role() = 'sacco_staff'
      and exists (
        select 1
        from public.ibimina i
        join public.sacco_officers o on o.sacco_id = i.sacco_id
        where i.id = ibimina_members.ikimina_id
          and o.user_id = auth.uid()
      )
    )
  );

alter policy ibimina_committee_admin_staff_rw on public.ibimina_committee
  using (
    app.current_role() = 'admin'
    or (
      app.current_role() = 'sacco_staff'
      and exists (
        select 1
        from public.ibimina i
        join public.sacco_officers o on o.sacco_id = i.sacco_id
        where i.id = ibimina_committee.ikimina_id
          and o.user_id = auth.uid()
      )
    )
  )
  with check (
    app.current_role() = 'admin'
    or (
      app.current_role() = 'sacco_staff'
      and exists (
        select 1
        from public.ibimina i
        join public.sacco_officers o on o.sacco_id = i.sacco_id
        where i.id = ibimina_committee.ikimina_id
          and o.user_id = auth.uid()
      )
    )
  );

alter policy ibimina_settings_admin_staff_rw on public.ibimina_settings
  using (
    app.current_role() = 'admin'
    or (
      app.current_role() = 'sacco_staff'
      and exists (
        select 1
        from public.ibimina i
        join public.sacco_officers o on o.sacco_id = i.sacco_id
        where i.id = ibimina_settings.ikimina_id
          and o.user_id = auth.uid()
      )
    )
  )
  with check (
    app.current_role() = 'admin'
    or (
      app.current_role() = 'sacco_staff'
      and exists (
        select 1
        from public.ibimina i
        join public.sacco_officers o on o.sacco_id = i.sacco_id
        where i.id = ibimina_settings.ikimina_id
          and o.user_id = auth.uid()
      )
    )
  );

alter policy ibimina_accounts_admin_staff_rw on public.ibimina_accounts
  using (
    app.current_role() = 'admin'
    or (
      app.current_role() = 'sacco_staff'
      and exists (
        select 1
        from public.ibimina i
        join public.sacco_officers o on o.sacco_id = i.sacco_id
        where i.id = ibimina_accounts.ikimina_id
          and o.user_id = auth.uid()
      )
    )
  )
  with check (
    app.current_role() = 'admin'
    or (
      app.current_role() = 'sacco_staff'
      and exists (
        select 1
        from public.ibimina i
        join public.sacco_officers o on o.sacco_id = i.sacco_id
        where i.id = ibimina_accounts.ikimina_id
          and o.user_id = auth.uid()
      )
    )
  );

alter policy contributions_admin_staff_rw on public.contributions_ledger
  using (
    app.current_role() = 'admin'
    or (
      app.current_role() = 'sacco_staff'
      and exists (
        select 1
        from public.ibimina i
        join public.sacco_officers o on o.sacco_id = i.sacco_id
        where i.id = contributions_ledger.ikimina_id
          and o.user_id = auth.uid()
      )
    )
  )
  with check (
    app.current_role() = 'admin'
    or (
      app.current_role() = 'sacco_staff'
      and exists (
        select 1
        from public.ibimina i
        join public.sacco_officers o on o.sacco_id = i.sacco_id
        where i.id = contributions_ledger.ikimina_id
          and o.user_id = auth.uid()
      )
    )
  );

alter policy contribution_cycles_admin_staff_rw on public.contribution_cycles
  using (
    app.current_role() = 'admin'
    or (
      app.current_role() = 'sacco_staff'
      and exists (
        select 1
        from public.ibimina i
        join public.sacco_officers o on o.sacco_id = i.sacco_id
        where i.id = contribution_cycles.ikimina_id
          and o.user_id = auth.uid()
      )
    )
  )
  with check (
    app.current_role() = 'admin'
    or (
      app.current_role() = 'sacco_staff'
      and exists (
        select 1
        from public.ibimina i
        join public.sacco_officers o on o.sacco_id = i.sacco_id
        where i.id = contribution_cycles.ikimina_id
          and o.user_id = auth.uid()
      )
    )
  );

alter policy sacco_loans_admin_staff_rw on public.sacco_loans
  using (
    app.current_role() = 'admin'
    or (
      app.current_role() = 'sacco_staff'
      and exists (
        select 1
        from public.ibimina i
        join public.sacco_officers o on o.sacco_id = i.sacco_id
        where i.id = sacco_loans.ikimina_id
          and o.user_id = auth.uid()
      )
    )
  )
  with check (
    app.current_role() = 'admin'
    or (
      app.current_role() = 'sacco_staff'
      and exists (
        select 1
        from public.ibimina i
        join public.sacco_officers o on o.sacco_id = i.sacco_id
        where i.id = sacco_loans.ikimina_id
          and o.user_id = auth.uid()
      )
    )
  );

alter policy sacco_collateral_admin_staff_rw on public.sacco_collateral
  using (
    app.current_role() = 'admin'
    or (
      app.current_role() = 'sacco_staff'
      and exists (
        select 1
        from public.sacco_loans l
        join public.ibimina i on i.id = l.ikimina_id
        join public.sacco_officers o on o.sacco_id = i.sacco_id
        where l.id = sacco_collateral.loan_id
          and o.user_id = auth.uid()
      )
    )
  )
  with check (
    app.current_role() = 'admin'
    or (
      app.current_role() = 'sacco_staff'
      and exists (
        select 1
        from public.sacco_loans l
        join public.ibimina i on i.id = l.ikimina_id
        join public.sacco_officers o on o.sacco_id = i.sacco_id
        where l.id = sacco_collateral.loan_id
          and o.user_id = auth.uid()
      )
    )
  );

alter policy basket_invites_admin_staff_rw on public.basket_invites
  using (
    app.current_role() = 'admin'
    or (
      app.current_role() = 'sacco_staff'
      and exists (
        select 1
        from public.ibimina i
        join public.sacco_officers o on o.sacco_id = i.sacco_id
        where i.id = basket_invites.ikimina_id
          and o.user_id = auth.uid()
      )
    )
  )
  with check (
    app.current_role() = 'admin'
    or (
      app.current_role() = 'sacco_staff'
      and exists (
        select 1
        from public.ibimina i
        join public.sacco_officers o on o.sacco_id = i.sacco_id
        where i.id = basket_invites.ikimina_id
          and o.user_id = auth.uid()
      )
    )
  );

alter policy kyc_documents_admin_staff_rw on public.kyc_documents
  using (
    app.current_role() in ('admin','sacco_staff')
  )
  with check (
    app.current_role() in ('admin','sacco_staff')
  );

create policy saccos_committee_select on public.saccos
  for select using (
    app.current_role() in ('ikimina_committee','member')
    and exists (
      select 1
      from public.ibimina_members m
      join public.ibimina i on i.id = m.ikimina_id
      where m.user_id = auth.uid()
        and m.status = 'active'
        and i.sacco_id = saccos.id
    )
  );

create policy ibimina_committee_select on public.ibimina
  for select using (
    app.current_role() in ('ikimina_committee','member')
    and exists (
      select 1
      from public.ibimina_members m
      where m.ikimina_id = ibimina.id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );

create policy ibimina_members_committee_select on public.ibimina_members
  for select using (
    app.current_role() = 'ikimina_committee'
    and exists (
      select 1
      from public.ibimina_members self
      where self.user_id = auth.uid()
        and self.status = 'active'
        and self.ikimina_id = ibimina_members.ikimina_id
    )
  );

create policy ibimina_members_member_self_select on public.ibimina_members
  for select using (
    app.current_role() = 'member'
    and ibimina_members.user_id = auth.uid()
  );

create policy contributions_committee_member_select on public.contributions_ledger
  for select using (
    app.current_role() in ('ikimina_committee','member')
    and exists (
      select 1
      from public.ibimina_members m
      where m.ikimina_id = contributions_ledger.ikimina_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );

COMMIT;
