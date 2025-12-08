-- Drop legacy/unused profile tables now that data is consolidated in public.profiles
begin;

drop table if exists public."BuyerProfile" cascade;
drop table if exists public."VendorProfile" cascade;
drop table if exists public.user_profiles cascade;
drop table if exists public.worker_profiles cascade;

commit;
