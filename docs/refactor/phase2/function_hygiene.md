# Phase 2 Function & Trigger Hygiene Audit (2025-09-25)

## Security Definer Inventory
| Function | Purpose | Notes | Recommended action |
|----------|---------|-------|---------------------|
| `security.claim_notifications(limit integer default 10)` | Pops queued notifications with SKIP LOCKED semantics for the notification worker. | Moved out of `public` via `20251011121000_phase2_claim_notifications_security.sql`; only `service_role` retains execute rights. | Keep `SECURITY DEFINER`; add pgTAP coverage for locking behaviour in later sub-phase. |
| `menu_admin.promote_draft_menu(menu_id uuid)` | Publishes menu snapshot and triggers cascade. | Moved out of `public` via `20251011124000_phase2_menu_admin_promote.sql`; grants restricted to `service_role`. | Keep definer; document schema usage and add tests around menu promotion. |
| `st_estimatedextent(...)` (PostGIS) | Extension helper. | Provided by PostGIS. | Leave as-is (extension managed). |

## Legacy RPCs / Shadow Functions
| Function | Status | Notes |
|----------|--------|-------|
| `match_drivers_for_trip` (v1) | Removed | Dropped in `20251011113000_phase2_match_invoker.sql`. |
| `match_passengers_for_trip` (v1) | Removed | Dropped in `20251011113000_phase2_match_invoker.sql`. |
| `nearby_drivers*`, `nearby_passengers*` | Removed | Dropped in `20251011113000_phase2_match_invoker.sql`. |
| `nearby_businesses` | Active | Still used by marketplace RPC (`rpc/marketplace.ts`). Keep. |

## Trigger Coverage Gaps
- `set_updated_at`: confirm single canonical definition; add regression test.
- `orders_set_defaults`: still lacks pgTAP coverage; plan `tests/sql/orders_defaults.sql`.
- `basket_create` and `match_*_v2`: add regression coverage for rate limiting + invoker behaviour.

## Recent Changes
- `match_drivers_for_trip_v2` and `match_passengers_for_trip_v2` recreated as `SECURITY INVOKER` (migration `20251011113000_phase2_match_invoker.sql`).
- `claim_notifications` relocated to `security` schema with tightened grants (`20251011121000_phase2_claim_notifications_security.sql`).
- `promote_draft_menu` relocated to `menu_admin` schema and legacy `increment_profile_credits` removed (`20251011124000_phase2_menu_admin_promote.sql`).

## Next Actions
1. Add pgTAP/SQL coverage for `security.claim_notifications`, `menu_admin.promote_draft_menu`, and `match_*_v2` (see `docs/refactor/phase2/test_plan.md`).
2. Audit remaining privileged routines (if any arise) and standardise schema placement.
3. Update Supabase configs/tests to use schema-qualified names (notification worker + menu helpers updated; audit remaining callers).

Data sources:
- `information_schema.routines` and `pg_proc` (project ezrriefbmhiiqfoxgjgz, 2025-09-25)
- `pg_stat_statements` sample (calls = 3 for removed `increment_profile_credits` prior to drop)
