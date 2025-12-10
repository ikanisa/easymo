-- Temporary view to inspect auth.users token columns

begin;

create or replace view public.debug_auth_users as
select
  id,
  email,
  confirmation_token,
  email_change_token_current,
  email_change_token_new,
  recovery_token
from auth.users;

grant select on public.debug_auth_users to anon, authenticated, service_role;

commit;
