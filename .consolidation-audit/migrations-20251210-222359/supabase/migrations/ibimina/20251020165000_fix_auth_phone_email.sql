begin;

update auth.users
set email_change = coalesce(email_change, '');

update auth.users
set phone = concat('pending-', id::text)
where phone is null;

commit;
