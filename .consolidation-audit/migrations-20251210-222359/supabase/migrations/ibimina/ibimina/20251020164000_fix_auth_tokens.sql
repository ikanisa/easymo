begin;

update auth.users
set confirmation_token = coalesce(confirmation_token, ''),
    email_change_token_current = coalesce(email_change_token_current, ''),
    email_change_token_new = coalesce(email_change_token_new, ''),
    recovery_token = coalesce(recovery_token, ''),
    phone_change_token = coalesce(phone_change_token, ''),
    reauthentication_token = coalesce(reauthentication_token, '');

commit;
