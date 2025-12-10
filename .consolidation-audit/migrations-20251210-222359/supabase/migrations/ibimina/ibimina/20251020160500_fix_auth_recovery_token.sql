-- Ensure recovery tokens are never NULL for Supabase Auth compatibility

begin;

update auth.users
set recovery_token = ''
where recovery_token is null;

commit;
