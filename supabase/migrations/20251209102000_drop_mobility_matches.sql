-- Remove the unused mobility_matches table to prevent duplication of mobility data
begin;

drop table if exists public.mobility_matches cascade;

commit;
