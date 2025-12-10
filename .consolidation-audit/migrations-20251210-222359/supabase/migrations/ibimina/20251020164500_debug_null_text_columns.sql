begin;

create or replace function public.debug_null_text_columns()
returns jsonb
language plpgsql
security definer
set search_path = auth, public
as $$
declare
  result jsonb := '{}'::jsonb;
  rec record;
  cnt bigint;
begin
  for rec in
    select column_name
    from information_schema.columns
    where table_schema = 'auth'
      and table_name = 'users'
      and data_type in ('text', 'character varying')
  loop
    execute format('select count(*) from auth.users where %I is null', rec.column_name) into cnt;
    result := result || jsonb_build_object(rec.column_name, cnt);
  end loop;
  return result;
end;
$$;

grant execute on function public.debug_null_text_columns() to anon, authenticated, service_role;

commit;
