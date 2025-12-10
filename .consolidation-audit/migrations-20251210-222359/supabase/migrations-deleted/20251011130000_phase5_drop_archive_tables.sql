-- Phase 5: drop legacy archive tables after export
BEGIN;

DROP TABLE IF EXISTS _archive.served_passengers;
DROP TABLE IF EXISTS _archive.served_drivers;
DROP TABLE IF EXISTS _archive.passengers_requests;
DROP TABLE IF EXISTS _archive.drivers_available;
DROP TABLE IF EXISTS _archive.contributions;
DROP TABLE IF EXISTS _archive.basket_joins;

DROP SCHEMA IF EXISTS _archive;

COMMIT;
