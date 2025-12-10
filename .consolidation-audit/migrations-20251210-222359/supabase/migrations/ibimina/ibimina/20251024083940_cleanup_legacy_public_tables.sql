begin;

do $$
declare r record;
begin
  for r in
    select table_schema, table_name, table_type
    from information_schema.tables
    where table_schema = 'public'
      and table_name like '%\_legacy\_20251024'
  loop
    if r.table_type = 'BASE TABLE' then
      execute format('DROP TABLE IF EXISTS %I.%I CASCADE', r.table_schema, r.table_name);
    else
      execute format('DROP VIEW IF EXISTS %I.%I CASCADE', r.table_schema, r.table_name);
    end if;
  end loop;
end; $$;

commit;

