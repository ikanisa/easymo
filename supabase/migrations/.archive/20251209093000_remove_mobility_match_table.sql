-- Clean up unused mobility match artifacts: no automatic matching/bookings.
-- Drops the table/function introduced in earlier migration to avoid duplication.

begin;

drop function if exists public.accept_mobility_match cascade;
drop table if exists public.mobility_trip_matches cascade;

commit;
