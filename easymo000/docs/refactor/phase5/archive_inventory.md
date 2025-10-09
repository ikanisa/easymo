# Phase 5 Archive Inventory (2025-09-25)

## Archived Tables (`_archive` schema)

| Table                          | Rows | Notes                                      |
| ------------------------------ | ---- | ------------------------------------------ |
| `_archive.basket_joins`        | 0    | Dropped via `20251011130000` after export. |
| `_archive.contributions`       | 0    | Dropped via `20251011130000`.              |
| `_archive.drivers_available`   | 0    | Dropped via `20251011130000`.              |
| `_archive.passengers_requests` | 0    | Dropped via `20251011130000`.              |
| `_archive.served_drivers`      | 6    | Exported and dropped via `20251011130000`. |
| `_archive.served_passengers`   | 4    | Exported and dropped via `20251011130000`. |

## High-volume Tables to Audit

| Table           | Rows               | Proposed action                                                  |
| --------------- | ------------------ | ---------------------------------------------------------------- |
| `notifications` | 1 (staging sample) | Define retention window; archive to warehouse when volume grows. |
| `send_logs`     | 0                  | Monitor; consider pruning future growth.                         |
| `send_queue`    | 2                  | Legacy queue; ensure unused after notification worker cutover.   |

## Next Steps

1. Confirm whether `_archive.served_*` records require analytics export; if so,
   dump to warehouse and drop tables via migration.
2. Validate no application code references `_archive.*` tables (Phase 3 router
   already migrated).
3. Draft `supabase/migrations/phase5_*` to drop empty archive tables after
   sign-off.
4. Prepare export/runbook instructions for any tables retained in `_archive`
   (add to `archive_runbook.md`).

## Summary

- `_archive.served_*` hold the only residual rows (10 total).
- Empty archive tables (`basket_joins`, `contributions`, `drivers_available`,
  `passengers_requests`) ready for drop after export sign-off.
- Tests deferred until final end-to-end pass per plan.

_All archive tables dropped; `_archive` schema removed after exports._
