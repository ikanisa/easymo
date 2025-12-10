-- Normalize SACCO slugs using helper schema and triggers.

begin;

create schema if not exists app_helpers;

create or replace function app_helpers.slugify(input text)
returns text
language sql
immutable
as $$
  select nullif(
    trim(both '-' from regexp_replace(
      regexp_replace(lower(coalesce($1, '')), '[^[:alnum:]]+', '-', 'g'),
      '-{2,}', '-', 'g'
    )),
    ''
  );
$$;

grant usage on schema app_helpers to anon, authenticated, service_role;
grant execute on function app_helpers.slugify(text) to anon, authenticated, service_role;

create or replace function app_helpers.sync_sacco_slug()
returns trigger
language plpgsql
as $$
begin
  new.search_slug := app_helpers.slugify(new.name);
  return new;
end;
$$;

alter table if exists app.saccos
  alter column search_slug drop expression;

update app.saccos
set search_slug = app_helpers.slugify(name);

drop trigger if exists app_saccos_set_slug on app.saccos;

create trigger app_saccos_set_slug
before insert or update on app.saccos
for each row
execute function app_helpers.sync_sacco_slug();

commit;
