# Phase 2 SQL Test Outline

The SQL scripts under `tests/sql/` now implement the regression checks outlined below. Each script runs in a transaction and can be executed collectively via `psql -f tests/sql/run_all.sql`.

## matching_v2.sql
- Seed minimal `profiles`, `trips`, `driver_status` data.
- Invoke `match_drivers_for_trip_v2` and `match_passengers_for_trip_v2` as authenticated (non-service-role) user and assert:
  - Results include only open trips within radius.
  - Function respects `_limit` and `_prefer_dropoff` ordering.
  - RLS prevents access when caller lacks trip membership.

## claim_notifications.sql
- Seed two `notifications` rows (queued + locked).
- Execute `security.claim_notifications(_limit => 1)` via `service_role` and assert one row returned and locked.
- Attempt execution as `anon`/`authenticated` (expect `permission denied`).
- Verify retry window by updating `locked_at` and confirming function skips recent locks.

## promote_draft_menu.sql
- Seed draft menu + categories/items for a bar plus published menu.
- Execute `menu_admin.promote_draft_menu` and assert:
  - New published menu created with incremented version.
  - Previous published menu archived.
  - Categories/items copied with new UUIDs and relationships preserved.
- Verify function inaccessible to non-service-role (expect `permission denied`).

## set_updated_at.sql (optional)
- Attach trigger to temp table and assert `updated_at` auto-updates on insert/update.

Test runner TBD – once pgTAP is wired, these scripts can be executed via `pg_prove` in CI.

## Next Steps (testing)
- Flesh out each script with pgTAP assertions once harness is added.
- Wire scripts into CI (pg_prove) alongside Supabase migrations.
- Backfill seed fixtures for menu promotion and matching scenarios.
