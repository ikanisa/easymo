begin;

create or replace function public.debug_null_tokens()
returns jsonb
language sql
security definer
set search_path = auth, public
as $$
  select jsonb_build_object(
    'null_confirmation_token', (select count(*) from auth.users where confirmation_token is null),
    'null_email_change_token_current', (select count(*) from auth.users where email_change_token_current is null),
    'null_email_change_token_new', (select count(*) from auth.users where email_change_token_new is null),
    'null_recovery_token', (select count(*) from auth.users where recovery_token is null)
  );
$$;

grant execute on function public.debug_null_tokens() to anon, authenticated, service_role;

commit;
