-- Helper RPC to inspect auth.users column definitions

begin;

create or replace function public.debug_auth_users_columns()
returns table (
  column_name text,
  data_type text,
  is_nullable text,
  column_default text
)
language sql
security definer
set search_path = information_schema
as $$
  select
    c.column_name,
    c.data_type,
    c.is_nullable,
    c.column_default
  from information_schema.columns c
  where c.table_schema = 'auth'
    and c.table_name = 'users'
  order by c.ordinal_position;
$$;

grant execute on function public.debug_auth_users_columns() to anon, authenticated, service_role;

commit;
