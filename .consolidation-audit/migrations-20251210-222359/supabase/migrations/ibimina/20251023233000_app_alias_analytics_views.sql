begin;

do $$
begin
  if exists (select 1 from pg_matviews where schemaname = 'public' and matviewname = 'analytics_payment_rollups_mv') then
    execute 'create or replace view app.analytics_payment_rollups_mv as select * from public.analytics_payment_rollups_mv';
    execute 'grant select on app.analytics_payment_rollups_mv to anon, authenticated, service_role';
    execute 'grant select on app.analytics_payment_rollups_mv to supabase_authenticator, supabase_auth_admin';
  end if;

  if exists (select 1 from pg_matviews where schemaname = 'public' and matviewname = 'analytics_ikimina_monthly_mv') then
    execute 'create or replace view app.analytics_ikimina_monthly_mv as select * from public.analytics_ikimina_monthly_mv';
    execute 'grant select on app.analytics_ikimina_monthly_mv to anon, authenticated, service_role';
    execute 'grant select on app.analytics_ikimina_monthly_mv to supabase_authenticator, supabase_auth_admin';
  end if;

  if exists (select 1 from pg_matviews where schemaname = 'public' and matviewname = 'analytics_member_last_payment_mv') then
    execute 'create or replace view app.analytics_member_last_payment_mv as select * from public.analytics_member_last_payment_mv';
    execute 'grant select on app.analytics_member_last_payment_mv to anon, authenticated, service_role';
    execute 'grant select on app.analytics_member_last_payment_mv to supabase_authenticator, supabase_auth_admin';
  end if;
end;
$$;

commit;
