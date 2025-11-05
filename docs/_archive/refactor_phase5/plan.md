# Phase 5 — Decommission & Archive Plan (Draft)

## Objectives

- Archive historical data (move cold tables to warehouse or `_archive`).
- Remove dead code paths in admin/station apps referencing retired
  tables/functions.
- Produce final ERD updates and runbook entries for handover.

## Candidate Tables / Schemas

| Table/Schema                                        | Action                                                      | Notes                                        |
| --------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------- |
| `_archive.*` tables                                 | Export to warehouse or confirm retention policy             | Use Supabase export or pg_dump for archival. |
| Legacy mobility tables (`_archive.served_*`, etc.)  | Validate retention window then drop                         | Ensure analytics backup exists.              |
| Notification history (`notifications`, `send_logs`) | Define retention/partitioning; archive older than N days.   |                                              |
| Insurance leads/media                               | Confirm new process; purge legacy data if no longer needed. |                                              |

## Code Cleanup Targets

- Admin/station apps: audit for references to archived tables/functions.
- Remove any feature flags or toggles that guarded legacy flows now dropped.
- Update Postman collections / docs to match final endpoints.

## Deliverables

1. Archive scripts/migrations (`supabase/migrations/phase5_*`).
2. Warehouse export instructions captured in
   `docs/refactor/phase5/archive_runbook.md`.
3. Updated ERD + final runbook in `docs/refactor/phase5/runbook.md`.

## Next Steps

- Identify concrete tables for export vs drop (Phase 5 inventory).
- Draft migration(s) for final drops once exports confirmed.
- Coordinate with analytics/support for data retention approval.

## Archive Checklist

- [x] Export `_archive.served_*` tables to warehouse. (CSV in
      `supabase/snapshots/phase5/`)
- [x] Drop empty archive tables via migration
      (`20251011130000_phase5_drop_archive_tables.sql`).
- [x] Update admin/station apps to remove references to archived tables.
      (Guarded by `tools/lint/check_archive_refs.ts` + CI job.)
- [x] Update ERD + runbook with post-archive schema.
      (`docs/refactor/phase5/runbook.md` + `supabase/snapshots/phase5/`.)

- Final schema snapshot captured in
  `supabase/snapshots/phase5/public_schema.sql`.
