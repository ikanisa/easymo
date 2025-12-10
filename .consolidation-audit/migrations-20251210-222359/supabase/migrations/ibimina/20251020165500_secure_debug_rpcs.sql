begin;

revoke execute on function public.debug_auth_users_tokens() from anon, authenticated;
revoke execute on function public.debug_auth_users_columns() from anon, authenticated;
revoke execute on function public.debug_null_tokens() from anon, authenticated;
revoke execute on function public.debug_null_text_columns() from anon, authenticated;
-- service_role retains access

grant execute on function public.debug_auth_users_tokens() to service_role;
grant execute on function public.debug_auth_users_columns() to service_role;
grant execute on function public.debug_null_tokens() to service_role;
grant execute on function public.debug_null_text_columns() to service_role;

commit;
