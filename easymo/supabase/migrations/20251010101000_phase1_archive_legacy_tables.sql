-- Phase 1: move unused mobility and legacy contribution tables into archive schema
BEGIN;

CREATE SCHEMA IF NOT EXISTS _archive AUTHORIZATION postgres;
COMMENT ON SCHEMA _archive IS 'Cold storage for decommissioned tables (Phase 1 refactor).';

ALTER TABLE IF EXISTS public.contributions SET SCHEMA _archive;
COMMENT ON TABLE _archive.contributions IS 'Archived legacy basket contribution ledger (Phase 1).';

ALTER TABLE IF EXISTS public.drivers_available SET SCHEMA _archive;
COMMENT ON TABLE _archive.drivers_available IS 'Archived legacy mobility availability table (Phase 1).';

ALTER TABLE IF EXISTS public.passengers_requests SET SCHEMA _archive;
COMMENT ON TABLE _archive.passengers_requests IS 'Archived legacy mobility passenger request table (Phase 1).';

ALTER TABLE IF EXISTS public.served_drivers SET SCHEMA _archive;
COMMENT ON TABLE _archive.served_drivers IS 'Archived mobility matching log; superseded by trips audit fields.';

ALTER TABLE IF EXISTS public.served_passengers SET SCHEMA _archive;
COMMENT ON TABLE _archive.served_passengers IS 'Archived mobility matching log; superseded by trips audit fields.';

COMMIT;
