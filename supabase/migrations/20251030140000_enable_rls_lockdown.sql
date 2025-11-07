-- Enable RLS + deny-all default policies for sensitive tables.
-- This gets the "SQL Policy Audit" green without opening any data paths.
-- Service role access (used by your server/backoffice) bypasses RLS as usual.

-- Helper: drop a policy if it exists so migration is idempotent on re-run
create or replace function public._drop_policy_if_exists(tbl regclass, pol_name text) returns void
language plpgsql as $$
begin
  if exists (select 1 from pg_policies where schemaname = split_part(tbl::text,'.',1)
                                       and tablename  = split_part(tbl::text,'.',2)
                                       and policyname = pol_name) then
    execute format('drop policy %I on %s', pol_name, tbl);
  end if;
end; $$;

-- List of tables to lock down (add here if audit flags more)
-- Note: all in schema public
-- settings, admin_alert_prefs, ibimina, ibimina_members, saccos, sacco_officers,
-- sacco_loans, sacco_collateral, momo_unmatched, contributions_ledger, kyc_documents,
-- campaigns, campaign_targets, notifications, audit_log

do $$
declare
  t text;
  target regclass;
  tables text[] := array[
    'public.settings',
    'public.admin_alert_prefs',
    'public.ibimina',
    'public.ibimina_members',
    'public.saccos',
    'public.sacco_officers',
    'public.sacco_loans',
    'public.sacco_collateral',
    'public.momo_unmatched',
    'public.contributions_ledger',
    'public.kyc_documents',
    'public.campaigns',
    'public.campaign_targets',
    'public.notifications',
    'public.audit_log'
  ];
begin
  foreach t in array tables loop
    target := to_regclass(t);
    if target IS NULL then
      RAISE NOTICE 'Skipping %, table does not exist', t;
      continue;
    end if;
    -- Enable RLS
    execute format('alter table %s enable row level security', target);

    -- Clear any pre-existing generic policies we are about to set
    perform public._drop_policy_if_exists(target, 'deny read');
    perform public._drop_policy_if_exists(target, 'deny insert');
    perform public._drop_policy_if_exists(target, 'deny update');
    perform public._drop_policy_if_exists(target, 'deny delete');

    -- Deny-all default policies (authenticated users get no access; service role bypasses)
    execute format('create policy %I on %s for select using (false)', 'deny read',   target);
    execute format('create policy %I on %s for insert with check (false)', 'deny insert',  target);
    execute format('create policy %I on %s for update using (false) with check (false)', 'deny update',  target);
    execute format('create policy %I on %s for delete using (false)', 'deny delete', target);
  end loop;
end $$;

-- Optional: if some tables must be readable by authenticated app users later,
-- add *specific* policies in a follow-up migration (principle of least privilege).

-- Cleanup helper (harmless to leave around; small and useful)
-- drop function public._drop_policy_if_exists(regclass, text);
