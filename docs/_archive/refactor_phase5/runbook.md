# Phase 5 Runbook — Final Schema & Handover

## Artifacts

- **Final schema snapshot**: `supabase/snapshots/phase5/public_schema.sql`
- **ERD**: `supabase/snapshots/phase5/public_schema.mmd` (import into Mermaid or
  dbdiagram)
- **Data exports**: `supabase/snapshots/phase5/served_drivers.csv`,
  `supabase/snapshots/phase5/served_passengers.csv`

## Checklist

1. Confirm GitHub Actions CI (`.github/workflows/ci.yml`) passes — ensures
   migrations apply cleanly and SQL regressions succeed.
2. Install developer pre-commit: `./tools/hooks/install.sh` (enforces lint +
   archive guard).
3. Review dashboards in `docs/observability.md` and wire Grafana/Looker widgets
   using `tools/sql/data_quality_checks.sql`.
4. Notify analytics owners that `_archive` schema has been removed (see
   `supabase/migrations/20251011130000_phase5_drop_archive_tables.sql`).
5. Update ops runbooks to reference the new notification queue + OCR workers
   (Phase 3/4 deliverables).

## Ownership Matrix

| Area                      | Owner     | Notes                                                                                   |
| ------------------------- | --------- | --------------------------------------------------------------------------------------- |
| Supabase migrations       | Platform  | Submit via CI after smoke tests                                                         |
| Edge functions            | Platform  | Deploy with `supabase functions deploy <name>` (see `docs/refactor/edge_functions.md`). |
| Dashboards / data quality | Analytics | Monitor metrics from `docs/observability.md`.                                           |

## Rollback

- Use `supabase db remote commit --rollback` or restore from the latest snapshot
  in `supabase/snapshots/phase4/` if Phase 5 deploy introduces regressions.
- Notification queue rollback: revert to previous function bundle via
  `supabase functions deploy wa-webhook@<tag>`.

## Sign-off

Once the above checklist is complete and dashboards run green for 24h, Phase 5
is considered complete and the refactor project can transition to steady-state
maintenance.
