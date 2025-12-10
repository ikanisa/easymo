begin;

create or replace function public.handle_public_user_insert()
returns trigger
language plpgsql
security definer
set search_path = public, app
as $$
declare
  desired_role app_role := coalesce(new.role, 'SACCO_STAFF'::app_role);
begin
  insert into app.user_profiles(user_id, role, sacco_id)
  values (new.id, desired_role, new.sacco_id)
  on conflict (user_id) do update
    set role = desired_role,
        sacco_id = coalesce(new.sacco_id, app.user_profiles.sacco_id),
        updated_at = timezone('UTC', now());
  return new;
end;
$$;

drop trigger if exists on_public_users_insert on public.users;
create trigger on_public_users_insert
instead of insert on public.users
for each row execute function public.handle_public_user_insert();

commit;
