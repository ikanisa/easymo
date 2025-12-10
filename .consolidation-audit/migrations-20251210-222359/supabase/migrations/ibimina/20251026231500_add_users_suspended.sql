-- Add suspended flag to staff users (soft suspension)
-- Note: public.users is a view; the actual column is in app.user_profiles
-- This migration is superseded by 20251031193000_live_hotfixes.sql which recreates
-- the view with suspended_at and suspended_by columns.

do $$
begin
  -- Try to add column to app.user_profiles if it's a table
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'app' and table_name = 'user_profiles'
  ) then
    execute 'alter table app.user_profiles add column if not exists suspended_at timestamptz';
    execute 'alter table app.user_profiles add column if not exists suspended_by uuid';
    execute 'alter table app.user_profiles add column if not exists notes text';
  end if;
  
  -- If public.users is a table (older schema), add to it
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'users'
  ) then
    execute 'alter table public.users add column if not exists suspended boolean not null default false';
  end if;
exception
  when others then
    raise notice 'Could not add suspended columns: %', sqlerrm;
end;
$$;

