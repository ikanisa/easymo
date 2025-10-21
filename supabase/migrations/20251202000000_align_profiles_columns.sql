BEGIN;
-- Align profile columns with admin edge function expectations.

alter table public.profiles
  add column if not exists ref_code text,
  add column if not exists credits_balance numeric default 0;

update public.profiles
set credits_balance = coalesce(credits_balance, 0);
COMMIT;
