-- Remove unused mobility_intent_cache (empty; superseded by state store)
begin;

drop table if exists public.mobility_intent_cache cascade;

commit;
