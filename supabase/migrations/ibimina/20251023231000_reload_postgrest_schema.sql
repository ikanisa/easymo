-- Trigger PostgREST to reload schema cache after privilege updates
select pg_notify('pgrst', 'reload schema');
