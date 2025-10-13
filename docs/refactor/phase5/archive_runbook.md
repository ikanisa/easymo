# Phase 5 Archive Runbook (Draft)

## Objective

Capture and remove remaining legacy data safely before finalizing the refactor.

## Steps

1. Export `_archive.served_drivers` / `_archive.served_passengers` to warehouse
   (CSV or direct load).
2. Run migration `phase5_drop_archive_tables.sql` to drop empty archive tables.
3. Update documentation / analytics owners on data location.
4. Post-drop verification:
   - Ensure application logs show no references to dropped tables.
   - Confirm analytics dashboards remain green.

## Exports

- `_archive.served_drivers` → `supabase/snapshots/phase5/served_drivers.csv`
- `_archive.served_passengers` →
  `supabase/snapshots/phase5/served_passengers.csv`

## Drop

- `_archive` schema dropped via migration
  `20251011130000_phase5_drop_archive_tables.sql`.
