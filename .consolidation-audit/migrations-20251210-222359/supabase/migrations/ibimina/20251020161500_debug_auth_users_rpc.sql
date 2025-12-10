-- Helper RPC to inspect auth.users token values (temporary for debugging)

begin;

create or replace function public.debug_auth_users_tokens()
returns table (
  id uuid,
  email text,
  confirmation_token text,
  email_change_token_current text,
  email_change_token_new text,
  recovery_token text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = auth, public
as $$
  select
    u.id,
    u.email,
    u.confirmation_token,
    u.email_change_token_current,
    u.email_change_token_new,
    u.recovery_token,
    u.created_at,
    u.updated_at
  from auth.users u;
$$;

grant execute on function public.debug_auth_users_tokens() to anon, authenticated, service_role;

commit;
