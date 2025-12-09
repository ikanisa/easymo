-- Ensure PostgREST roles can introspect and query the app schema
begin;

grant usage on schema app to anon, authenticated, service_role;
grant usage on schema app_helpers to anon, authenticated, service_role;

grant select on all tables in schema app to anon, authenticated, service_role;

alter default privileges in schema app
  grant select on tables to anon, authenticated, service_role;
alter default privileges in schema app
  grant select on sequences to anon, authenticated, service_role;
alter default privileges in schema app
  grant usage on sequences to anon, authenticated, service_role;

commit;
