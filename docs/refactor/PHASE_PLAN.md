# Full-stack Refactor Plan

This plan breaks the clean-up into phases so we can converge on a production-grade, well-documented backend without risking data loss. Each phase produces artifacts (ERDs, logs, migrations, tests) that become the acceptance criteria for the next phase.

## Phase 0 — Baseline & Inventory (current step)
- [x] Freeze schema snapshot: export ERD + `pg_dump --schema-only` for `public`. (snapshot in `supabase/snapshots/phase0/`, ERD in `docs/refactor/phase0/`)
- [x] Capture WA edge function bundle map: list modules + dependency graph. (see `docs/refactor/phase0/wa_webhook_map.md`)
- [x] Classify tables/functions/triggers into (Core, Legacy, Candidate for removal). (tracked in `docs/refactor/db_tables.md`, `db_functions.md`, `db_triggers.md`)
- [x] Identify ownership/stakeholders for each domain. (see `docs/refactor/phase0/domain_owners.md`)
- [x] Agree on success metrics (migration time, automated tests, roll-back). (see `docs/refactor/phase0/success_metrics.md`)

## Phase 1 — Data Model Consolidation
- [x] Merge duplicate basket/customer/contact tables if overlapping (requires data audit). (contacts auto-link trigger + rollup view in `20251012140000`; legacy chat session tables remain read-only)
- [x] Remove unused “shadow” tables (`basket_joins` vs `basket_members`, `passengers_requests` vs `trips`). (`basket_join_by_code` refactor + archive migrations in place)
- [x] Introduce naming conventions (`snake_case`, `_log`, `_queue`). (see `docs/refactor/phase1/naming_conventions.md`)
- [x] Document each surviving table (purpose, owner, access pattern) in `/docs/refactor/db_tables.md`.
- [x] Write migrations to drop/rescope redundant tables (with archive/backup steps). (`20251010100000`, `20251010101000`, `20251010102000`)

## Phase 2 — Function & Trigger Hygiene
- [x] Decommission unused RPCs (`match_drivers_for_trip` v1, `nearby_*` duplicates). (migrations `20251011113000`, `20251011124000`)
- [x] Gate keepers: ensure every trigger/function has automated coverage (SQL unit tests). (SQL scripts in `tests/sql/` now cover `match_*_v2`, `security.claim_notifications`, and `menu_admin.promote_draft_menu`.)
- [x] Split definer functions into schema modules (`security`, `mobility`, `wallet`). (notifications → `security`, menu promotion → `menu_admin`)
- [x] Harden security: remove `SECURITY DEFINER` where not required, add RLS if missing. (matching RPCs now invoker; definer routines isolated)
- [x] Update `/docs/refactor/db_functions.md` with status + ownership. (Phase 2 summary + priorities captured 2025-09-25)

## Phase 3 — Edge Function Modularization
- [x] Restructure `wa-webhook` into packages (`router`, `state`, `services`, `domains`). (dine-in, marketplace, mobility, wallet migrated to `domains/`)
- [x] Remove deprecated flows (insurance legacy, duplicate marketplace flows). (insurance OCR/admin archived)
- [x] Introduce shared client libs under `supabase/functions/_shared` (logging, config, http). (supabase client + logging wrappers in Phase 3)
- [x] Ensure every edge function has integration smoke tests. (Deno router tests in `tests/edge/`, queue tests in `notify/`, SQL scripts for privileged RPCs.)
- [x] Document bundles + deployment steps in `/docs/refactor/edge_functions.md`.

## Phase 4 — Observability & Automation
- [x] Enforce structured logging (no `console.log` with PII). (helpers in `observe/logging.ts`)
- [x] Add linting/pre-commit for SQL + TypeScript. (pre-commit hook in `tools/hooks/` + Deno/Next lint pipeline)
- [x] Configure migration + function deployment CI with dry-run + rollback. (GitHub workflow `.github/workflows/ci.yml` applies migrations against PostGIS container and runs SQL tests.)
- [x] Establish data quality dashboards (Supabase metrics, log drains). (Metrics catalogued in `docs/observability.md` + queries in `tools/sql/data_quality_checks.sql`.)

## Phase 5 — Decommission & Archive
- [ ] Archive historical tables (move to warehouse / BigQuery).
- [ ] Remove any dead code paths in admin- and station- apps referencing deleted tables.
- [ ] Final ERD + runbook update.

> **Current status:** Phase 1 planning underway — see `docs/refactor/status.md` for phase checkpoints.
