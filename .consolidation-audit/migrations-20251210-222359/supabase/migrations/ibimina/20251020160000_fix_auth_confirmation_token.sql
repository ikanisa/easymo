-- Ensure Supabase Auth token columns never store NULL values

begin;

update auth.users
set confirmation_token = ''
where confirmation_token is null;

update auth.users
set email_change_token_current = ''
where email_change_token_current is null;

update auth.users
set email_change_token_new = ''
where email_change_token_new is null;

-- Defaults remain managed by GoTrue; ensure future manual inserts supply blanks.

commit;
